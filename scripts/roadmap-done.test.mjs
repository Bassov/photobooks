import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Contract with the rig `roadmap` CLI: item PRs close an item in its own file
// only, so docs/roadmap.md never conflicts between parallel item PRs.
const BIN = path.join(
  path.dirname(
    createRequire(import.meta.url).resolve(
      '@albasov/ts-agent-rig/package.json',
    ),
  ),
  'bin',
  'roadmap.mjs',
)

const INDEX = [
  '# Roadmap',
  '',
  '## P9 — Fixture milestone',
  '',
  '- [ ] [lite] [alpha](roadmap/P9/alpha.md) — Alpha',
  '- [ ] [lite] [beta](roadmap/P9/beta.md) — Beta',
  '',
].join('\n')

const itemFile = (slug, title) =>
  `# ${slug}\n\nTag: lite\nMilestone: P9\nTitle: ${title}\n\n## Scope\n\n- [ ] scope\n`

let root

const roadmap = (...args) => {
  const r = spawnSync(process.execPath, [BIN, ...args, '--root', root], {
    encoding: 'utf8',
    env: { ...process.env, PHOTOBOOKS_CHECK_INNER: '1' },
  })
  return { code: r.status, out: r.stdout.trim() ? JSON.parse(r.stdout) : null }
}

const snapshot = () =>
  Object.fromEntries(
    fs
      .readdirSync(root, { recursive: true })
      .map((f) => path.join(root, f))
      .filter((f) => fs.statSync(f).isFile())
      .map((f) => [path.relative(root, f), fs.readFileSync(f, 'utf8')]),
  )

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-done-'))
  fs.mkdirSync(path.join(root, 'docs/roadmap/P9'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs/roadmap.md'), INDEX)
  fs.writeFileSync(
    path.join(root, 'docs/roadmap/P9/alpha.md'),
    itemFile('alpha', 'Alpha'),
  )
  fs.writeFileSync(
    path.join(root, 'docs/roadmap/P9/beta.md'),
    itemFile('beta', 'Beta'),
  )
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('roadmap done', () => {
  it('writes Status: done in the item file and leaves the index untouched', () => {
    const before = snapshot()

    const r = roadmap('done', 'alpha', '--json')

    expect(r.code).toBe(0)
    expect(r.out).toMatchObject({ done: 'alpha', indexTicked: false })
    const after = snapshot()
    const changed = Object.keys(after).filter((f) => after[f] !== before[f])
    expect(changed).toEqual([path.join('docs', 'roadmap', 'P9', 'alpha.md')])
    expect(after[changed[0]]).toMatch(/^Status: done$/m)
    expect(after[path.join('docs', 'roadmap.md')]).toBe(INDEX)
  })

  it('makes next skip the done item while its index line stays open', () => {
    roadmap('done', 'alpha', '--json')

    const r = roadmap('next', '--json', '--no-body')

    expect(r.code).toBe(0)
    expect(r.out).toMatchObject({ slug: 'beta', status: 'open' })
  })

  it('keeps check green with only a pending-tick warning', () => {
    roadmap('done', 'alpha', '--json')

    const r = roadmap('check', '--json')

    expect(r.code).toBe(0)
    expect(r.out.errors).toEqual([])
    expect(r.out.warnings).toEqual([expect.stringMatching(/^sync: alpha /)])
  })
})

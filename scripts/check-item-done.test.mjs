import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { checkItemDone, main } from './check-item-done.mjs'

// #620 / #622 shape: a [lite] item merged without finalize, so its item file
// never got the `Status: done` line.
const itemFile = (slug, tag, status) =>
  [
    `# ${slug}`,
    '',
    `Tag: ${tag}`,
    'Milestone: P9',
    `Title: ${slug}`,
    ...(status ? [`Status: ${status}`] : []),
    '',
    '## Scope',
    '',
    '- [x] scope',
    '',
  ].join('\n')

let root

const writeItem = (slug, tag, status) =>
  fs.writeFileSync(
    path.join(root, 'docs/roadmap/P9', `${slug}.md`),
    itemFile(slug, tag, status),
  )

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'item-done-'))
  fs.mkdirSync(path.join(root, 'docs/roadmap/P9'), { recursive: true })
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('checkItemDone', () => {
  it('fails a lite branch whose item file lacks Status: done', () => {
    writeItem('code-scout-first', 'lite')

    const r = checkItemDone({ root, branch: 'fix/code-scout-first' })

    expect(r.ok).toBe(false)
    expect(r.message).toContain('docs/roadmap/P9/code-scout-first.md')
    expect(r.message).toContain('pnpm -s agent finalize code-scout-first')
  })

  it('passes once finalize wrote Status: done (lite and full track)', () => {
    writeItem('lint-no-wait-for-timeout', 'lite', 'done')
    writeItem('pdf-export', 'feature', 'done')

    expect(
      checkItemDone({ root, branch: 'fix/lint-no-wait-for-timeout' }).ok,
    ).toBe(true)
    expect(checkItemDone({ root, branch: 'feat/pdf-export' }).ok).toBe(true)
  })

  it('fails a feature branch whose item is still open', () => {
    writeItem('pdf-export', 'feature')

    expect(checkItemDone({ root, branch: 'feat/pdf-export' }).ok).toBe(false)
  })

  it('does not take another status for done', () => {
    writeItem('alpha', 'lite', 'open')

    expect(checkItemDone({ root, branch: 'fix/alpha' }).ok).toBe(false)
  })

  it.each([
    ['main', 'not an item branch'],
    ['', 'detached / unknown'],
    ['dependabot/npm_and_yarn/x', 'not feat/fix'],
    ['fix/no-such-item', 'no roadmap item for the slug'],
  ])('skips %j (%s)', (branch) => {
    writeItem('alpha', 'lite')
    fs.writeFileSync(path.join(root, 'docs/roadmap/README.md'), '# notes\n')

    const r = checkItemDone({ root, branch })

    expect(r.ok).toBe(true)
    expect(r.message).toMatch(/^item-done: skip/)
  })

  it('skips a tree without docs/roadmap', () => {
    fs.rmSync(path.join(root, 'docs'), { recursive: true })

    expect(checkItemDone({ root, branch: 'fix/alpha' }).ok).toBe(true)
  })
})

describe('main (C1 inventory entry)', () => {
  const run = (env) => {
    const out = { log: [], error: [] }
    const code = main({
      root,
      env,
      log: (m) => out.log.push(m),
      error: (m) => out.error.push(m),
    })
    return { code, ...out }
  }

  it('reads the PR branch from GITHUB_HEAD_REF in CI and exits 1', () => {
    writeItem('alpha', 'lite')

    const r = run({ GITHUB_HEAD_REF: 'fix/alpha' })

    expect(r.code).toBe(1)
    expect(r.log).toEqual([])
    expect(r.error).toEqual([expect.stringContaining('alpha.md')])
  })

  it('falls back to the checked-out git branch locally', () => {
    writeItem('alpha', 'lite', 'done')
    spawnSync('git', ['init', '-q', '-b', 'fix/alpha'], { cwd: root })

    const r = run({})

    expect(r.code).toBe(0)
    expect(r.log).toEqual(['item-done: alpha ok'])
  })

  it('skips outside a git checkout', () => {
    const r = run({})

    expect(r.code).toBe(0)
    expect(r.log).toEqual(['item-done: skip (no branch)'])
  })
})

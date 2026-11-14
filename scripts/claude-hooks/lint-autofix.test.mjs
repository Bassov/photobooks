import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hookOutput, inRepoPath, lintAutofix, main } from './lint-autofix.mjs'

const SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'lint-autofix.mjs',
)
const UGLY = 'export function  probe( ) {\n    debugger\n  return 1\n}\n'
const PRETTY = 'export function probe() {\n  debugger\n  return 1\n}\n'

/** @type {string[]} */
const temps = []

afterEach(() => {
  vi.restoreAllMocks()
  for (const t of temps.splice(0)) {
    fs.rmSync(t, { recursive: true, force: true })
  }
})

/** Repo-like root: generated `gen/` ignored by prettier and eslint; no-debugger is an error. */
function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-autofix-'))
  temps.push(root)
  fs.writeFileSync(path.join(root, '.prettierignore'), 'gen/\n')
  fs.writeFileSync(
    path.join(root, 'eslint.config.mjs'),
    "export default [{ ignores: ['gen/**'] }, { rules: { 'no-debugger': 'error', 'no-var': 'error' } }]\n",
  )
  fs.writeFileSync(
    path.join(root, '.prettierrc'),
    '{ "semi": false, "singleQuote": true }\n',
  )
  return root
}

function put(root, rel, text) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const hook = (file) =>
  JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: file } })

describe('inRepoPath', () => {
  it('keeps repo files with a prettier extension as POSIX relative paths', () => {
    expect(inRepoPath('/repo', '/repo/src/a.ts')).toBe('src/a.ts')
    expect(inRepoPath('/repo', 'docs/x.md')).toBe('docs/x.md')
  })

  it.each([
    ['outside the repo', '/elsewhere/a.ts'],
    ['a parent escape', '/repo/../a.ts'],
    ['node_modules', '/repo/node_modules/x/a.js'],
    ['an unknown extension', '/repo/a.png'],
    ['the root itself', '/repo'],
    ['a missing path', undefined],
  ])('skips %s', (_label, file) => {
    expect(inRepoPath('/repo', file)).toBeNull()
  })
})

describe('lintAutofix', () => {
  it('formats and lint-fixes the edited file, reporting unfixable errors in one line', async () => {
    const root = tmpRoot()
    put(root, 'src/a.js', UGLY.replace('return 1', 'var x = 1\n  return x'))
    const line = await lintAutofix(hook(path.join(root, 'src/a.js')), root)
    expect(read(root, 'src/a.js')).toBe(
      'export function probe() {\n  debugger\n  let x = 1\n  return x\n}\n',
    )
    expect(line).toBe(
      'lint-autofix: src/a.js: 1 eslint error(s) left after --fix (first 2:3 no-debugger)',
    )
  })

  it('is silent when the file ends clean', async () => {
    const root = tmpRoot()
    put(root, 'notes.md', '#  Title\n')
    expect(await lintAutofix(hook('notes.md'), root)).toBeNull()
    expect(read(root, 'notes.md')).toBe('# Title\n')
  })

  it('skips a file outside the repo', async () => {
    const root = tmpRoot()
    const outside = tmpRoot()
    put(outside, 'a.js', UGLY)
    expect(await lintAutofix(hook(path.join(outside, 'a.js')), root)).toBeNull()
    expect(read(outside, 'a.js')).toBe(UGLY)
  })

  it('skips a generated file ignored by .prettierignore and eslint', async () => {
    const root = tmpRoot()
    put(root, 'gen/a.js', UGLY)
    expect(await lintAutofix(hook('gen/a.js'), root)).toBeNull()
    expect(read(root, 'gen/a.js')).toBe(UGLY)
  })

  it('skips bad JSON and missing files', async () => {
    const root = tmpRoot()
    expect(await lintAutofix('not json', root)).toBeNull()
    expect(await lintAutofix(hook('src/gone.ts'), root)).toBeNull()
  })
})

describe('main', () => {
  it('exits 0 with one additionalContext line when eslint errors remain', async () => {
    const root = tmpRoot()
    put(root, 'src/a.js', UGLY)
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    expect(await main(root, () => Promise.resolve(hook('src/a.js')))).toBe(0)
    expect(read(root, 'src/a.js')).toBe(PRETTY)
    expect(write).toHaveBeenCalledExactlyOnceWith(
      `${hookOutput('lint-autofix: src/a.js: 1 eslint error(s) left after --fix (first 2:3 no-debugger)')}\n`,
    )
  })

  it('exits 0 silently when eslint itself throws', async () => {
    const root = tmpRoot()
    fs.writeFileSync(
      path.join(root, 'eslint.config.mjs'),
      "throw new Error('broken')\n",
    )
    put(root, 'src/a.js', UGLY)
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    expect(await main(root, () => Promise.resolve(hook('src/a.js')))).toBe(0)
    expect(write).not.toHaveBeenCalled()
  })

  it('CLI exits 0 and prints nothing for a non-repo path', () => {
    const run = spawnSync(process.execPath, [SCRIPT], {
      input: hook(path.join(os.tmpdir(), 'nowhere.ts')),
      encoding: 'utf8',
    })
    expect({ status: run.status, stdout: run.stdout }).toEqual({
      status: 0,
      stdout: '',
    })
  })
})

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  listScriptProductionFiles,
  listSrcProductionFiles,
  runMutationScopeCheck,
} from './check-mutation-scope.mjs'
import { classifyMutationFile, loadMutatePatterns } from './mutation-scope.mjs'
import { stripGitKeys } from './strip-git-env.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('check-mutation-scope scripts', () => {
  it('lists production scripts including foo.mjs and skips tests', () => {
    const files = listScriptProductionFiles()
    expect(files).toContain('scripts/foo.mjs')
    expect(files).toContain('scripts/check-mutation-scope.mjs')
    expect(files.some((f) => f.endsWith('.test.mjs'))).toBe(false)
    expect(listSrcProductionFiles().some((f) => f.startsWith('src/'))).toBe(
      true,
    )
  })

  it('real mutate patterns put foo.mjs in scope without config edit', () => {
    const patterns = loadMutatePatterns()
    expect(classifyMutationFile('scripts/foo.mjs', patterns)).toBe('in-scope')
    expect(classifyMutationFile('scripts/agent-cli.mjs', patterns)).toBe(
      'excluded',
    )
    expect(classifyMutationFile('scripts/foo.test.mjs', patterns)).toBe(
      'excluded',
    )
  })

  it('unclassified script fails the checker', () => {
    const errors = []
    const code = runMutationScopeCheck({
      patterns: ['src/**/*.ts', 'src/**/*.tsx'],
      srcFiles: [],
      scriptFiles: ['scripts/orphan-gate.mjs'],
      reasonText: '',
      gates: { mutation: { temporaryExcludes: [] } },
      error: (msg) => errors.push(msg),
      log: () => {},
    })
    expect(code).toBe(1)
    expect(errors.some((m) => m.includes('scripts/orphan-gate.mjs'))).toBe(true)
    expect(errors.some((m) => m.includes('scripts/'))).toBe(true)
  })

  it('reports missing exclude reasons, extras, and temp bang gaps', () => {
    const errors = []
    const code = runMutationScopeCheck({
      patterns: ['scripts/**/*.mjs', '!scripts/orphan.mjs'],
      srcFiles: [],
      scriptFiles: [],
      reasonText: '- `!scripts/other.mjs` — x\n',
      gates: {
        mutation: {
          temporaryExcludes: [{ path: 'scripts/orphan.mjs' }],
        },
      },
      error: (msg) => errors.push(msg),
      log: () => {},
    })
    expect(code).toBe(1)
    expect(errors.some((m) => m.includes('missing a reason'))).toBe(true)
    expect(errors.some((m) => m.includes('documents excludes'))).toBe(true)
  })

  it('reports temporaryExcludes missing bangs', () => {
    const errors = []
    const code = runMutationScopeCheck({
      patterns: ['scripts/**/*.mjs'],
      srcFiles: [],
      scriptFiles: [],
      reasonText: '',
      gates: {
        mutation: {
          temporaryExcludes: [{ path: 'scripts/no-bang.mjs' }],
        },
      },
      error: (msg) => errors.push(msg),
      log: () => {},
    })
    expect(code).toBe(1)
    expect(errors.some((m) => m.includes('temporaryExcludes'))).toBe(true)
  })

  it('uses default gates.mutation when omitted', () => {
    const code = runMutationScopeCheck({
      patterns: ['scripts/foo.mjs'],
      srcFiles: [],
      scriptFiles: ['scripts/foo.mjs'],
      reasonText: '',
      gates: {},
      error: () => {},
      log: () => {},
    })
    expect(code).toBe(0)
  })

  it('repo scripts pass mutation-scope against real config', () => {
    const code = runMutationScopeCheck({
      log: () => {},
      error: () => {},
    })
    expect(code).toBe(0)
  })

  it('CLI entry exits 0 on the real repo', () => {
    const result = spawnSync(
      process.execPath,
      [path.join(ROOT, 'scripts/check-mutation-scope.mjs')],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: stripGitKeys({ ...process.env }),
      },
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/script production files/)
  })

  it('listSrcProductionFiles filters ts/tsx only', () => {
    const files = listSrcProductionFiles()
    expect(files.every((f) => f.endsWith('.ts') || f.endsWith('.tsx'))).toBe(
      true,
    )
    expect(files.some((f) => f.endsWith('.tsx'))).toBe(true)
  })

  it('emits only the failing sections with exact prefixes', () => {
    const errors = []
    const code = runMutationScopeCheck({
      patterns: ['scripts/**/*.mjs', '!scripts/x.mjs'],
      srcFiles: [],
      scriptFiles: [],
      reasonText: '',
      gates: { mutation: { temporaryExcludes: [] } },
      error: (msg) => errors.push(msg),
      log: () => {},
    })
    expect(code).toBe(1)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe(
      'Exclude patterns missing a reason in stryker.mutate.md:\n!scripts/x.mjs',
    )
  })

  it('emits extra reason docs without unclassified noise', () => {
    const errors = []
    runMutationScopeCheck({
      patterns: ['scripts/foo.mjs'],
      srcFiles: [],
      scriptFiles: ['scripts/foo.mjs'],
      reasonText: '- `!scripts/ghost.mjs` — gone\n',
      gates: { mutation: { temporaryExcludes: [] } },
      error: (msg) => errors.push(msg),
      log: () => {},
    })
    expect(errors).toEqual([
      'stryker.mutate.md documents excludes that are not in stryker.config.mjs:\n!scripts/ghost.mjs',
    ])
  })

  it('emits temp bang gaps with exact prefix', () => {
    const errors = []
    runMutationScopeCheck({
      patterns: ['scripts/foo.mjs'],
      srcFiles: [],
      scriptFiles: ['scripts/foo.mjs'],
      reasonText: '',
      gates: {
        mutation: { temporaryExcludes: [{ path: 'scripts/no-bang.mjs' }] },
      },
      error: (msg) => errors.push(msg),
      log: () => {},
    })
    expect(errors).toEqual([
      'mutation.temporaryExcludes paths missing exact ! bang in stryker.config.mjs:\nscripts/no-bang.mjs',
    ])
  })

  it('treats non-array temporaryExcludes as empty', () => {
    const errors = []
    const code = runMutationScopeCheck({
      patterns: ['scripts/foo.mjs'],
      srcFiles: [],
      scriptFiles: ['scripts/foo.mjs'],
      reasonText: '',
      gates: { mutation: { temporaryExcludes: /** @type {any} */ ('nope') } },
      error: (msg) => errors.push(msg),
      log: () => {},
    })
    expect(code).toBe(0)
    expect(errors).toEqual([])
  })

  it('success log names src and script counts', () => {
    const logs = []
    const code = runMutationScopeCheck({
      patterns: ['src/**/*.ts', 'scripts/foo.mjs'],
      srcFiles: ['src/a.ts'],
      scriptFiles: ['scripts/foo.mjs'],
      reasonText: '',
      gates: { mutation: {} },
      error: () => {},
      log: (msg) => logs.push(msg),
    })
    expect(code).toBe(0)
    expect(logs).toEqual([
      'Mutation scope covers 1 src and 1 script production files.',
    ])
  })
})

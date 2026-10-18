import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { main, resolveChangedE2eTargets } from './e2e-changed-quiet.mjs'

describe('resolveChangedE2eTargets', () => {
  it('reuses burn-in selection for changed specs', () => {
    const targets = resolveChangedE2eTargets('origin/main', {
      gitLines: () => ['e2e/smoke.spec.ts', 'README.md'],
      exists: (path) => path === 'e2e/smoke.spec.ts',
      isFile: (path) => path === 'e2e/smoke.spec.ts',
      listSources: () => ['e2e/smoke.spec.ts'],
      readFile: () => '',
    })
    expect(targets).toEqual(['e2e/smoke.spec.ts'])
  })

  it('returns empty when diff has no e2e targets', () => {
    const targets = resolveChangedE2eTargets('origin/main', {
      gitLines: () => ['README.md'],
      listSources: () => [],
    })
    expect(targets).toEqual([])
  })
})

describe('main', () => {
  it('prints no targets and skips Playwright when empty', () => {
    let out = ''
    let spawned = false
    const code = main(
      {},
      {
        gitLines: () => ['README.md'],
        listSources: () => [],
        spawnSync: () => {
          spawned = true
          return { status: 0, stdout: '', stderr: '' }
        },
        write: (text) => {
          out += text
        },
      },
    )
    expect(code).toBe(0)
    expect(spawned).toBe(false)
    expect(out).toBe('changed-e2e: no targets\n')
  })

  it('runs quiet Playwright on targets and prints a one-line summary', () => {
    let out = ''
    let err = ''
    let argv = null
    const code = main(
      { STRYKER_DIFF_BASE: 'origin/main' },
      {
        gitLines: () => ['e2e/smoke.spec.ts'],
        exists: (path) => path === 'e2e/smoke.spec.ts',
        isFile: (path) => path === 'e2e/smoke.spec.ts',
        listSources: () => ['e2e/smoke.spec.ts'],
        readFile: () => '',
        spawnSync: (_file, args) => {
          argv = args
          return {
            status: 0,
            stdout: '····\n',
            stderr: '',
          }
        },
        write: (text) => {
          out += text
        },
        error: (text) => {
          err += String(text)
        },
      },
    )
    expect(code).toBe(0)
    expect(argv).toEqual([
      join(process.cwd(), 'scripts/with-playwright-env.mjs'),
      'playwright',
      'test',
      'e2e/smoke.spec.ts',
      '--reporter=dot',
    ])
    expect(out).toContain('····')
    expect(out).toContain('changed-e2e: 1 target(s) passed')
    expect(err).toBe('')
  })

  it('surfaces Playwright stderr and failed summary', () => {
    let out = ''
    let err = ''
    const code = main(
      {},
      {
        gitLines: () => ['e2e/smoke.spec.ts'],
        exists: (path) => path === 'e2e/smoke.spec.ts',
        isFile: (path) => path === 'e2e/smoke.spec.ts',
        listSources: () => ['e2e/smoke.spec.ts'],
        readFile: () => '',
        spawnSync: () => ({
          status: 1,
          stdout: '',
          stderr: '1 failed\n',
        }),
        write: (text) => {
          out += text
        },
        error: (text) => {
          err += String(text)
        },
      },
    )
    expect(code).toBe(1)
    expect(err).toContain('1 failed')
    expect(out).toContain('changed-e2e: 1 target(s) failed (exit 1)')
  })

  it('returns 1 when target resolution throws', () => {
    let err = ''
    const code = main(
      {},
      {
        gitLines: () => {
          throw new Error('git down')
        },
        error: (text) => {
          err += String(text)
        },
      },
    )
    expect(code).toBe(1)
    expect(err).toContain('git down')
  })

  it('pipes Playwright stdio, forwards env, and treats null status as failure', () => {
    let opts = null
    let writes = []
    let errors = []
    const code = main(
      { MARKER: 'keep-me', STRYKER_DIFF_BASE: 'origin/main' },
      {
        gitLines: () => ['e2e/smoke.spec.ts'],
        exists: (path) => path === 'e2e/smoke.spec.ts',
        isFile: (path) => path === 'e2e/smoke.spec.ts',
        listSources: () => ['e2e/smoke.spec.ts'],
        readFile: () => '',
        spawnSync: (_file, _args, options) => {
          opts = options
          return { status: null, stdout: 'out\n', stderr: 'err\n' }
        },
        write: (text) => {
          writes.push(text)
        },
        error: (text) => {
          errors.push(String(text))
        },
      },
    )
    expect(opts.stdio).toEqual(['ignore', 'pipe', 'pipe'])
    expect(opts.env.MARKER).toBe('keep-me')
    expect(code).toBe(1)
    expect(writes).toEqual([
      'out\n',
      'changed-e2e: 1 target(s) failed (exit 1)\n',
    ])
    expect(errors).toEqual(['err\n'])
  })

  it('does not forward empty Playwright streams', () => {
    const writes = []
    const errors = []
    const code = main(
      {},
      {
        gitLines: () => ['e2e/smoke.spec.ts'],
        exists: (path) => path === 'e2e/smoke.spec.ts',
        isFile: (path) => path === 'e2e/smoke.spec.ts',
        listSources: () => ['e2e/smoke.spec.ts'],
        readFile: () => '',
        spawnSync: () => ({ status: 0, stdout: '', stderr: '' }),
        write: (text) => {
          writes.push(text)
        },
        error: (text) => {
          errors.push(String(text))
        },
      },
    )
    expect(code).toBe(0)
    expect(writes).toEqual(['changed-e2e: 1 target(s) passed\n'])
    expect(errors).toEqual([])
  })
})

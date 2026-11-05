import { spawnSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import {
  LOCAL_FC_NUM_RUNS,
  configureLocalFcNumRuns,
  localFcNumRuns,
  main,
  mergeBase,
  vitestArgv,
} from './unit-changed.mjs'

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal()),
  spawnSync: vi.fn(),
}))

const SHA = '616dc3c346ea05ac88f1b7fdcb3f6ee2ae5c2f32'

/**
 * @param {{ base?: { status: number | null, stdout: string }, vitest?: { status: number | null } }} [results]
 */
function fakeSpawn(results = {}) {
  /** @type {{ cmd: string, args: string[], opts: any }[]} */
  const calls = []
  /** @type {any} */
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts })
    if (cmd === 'git') return results.base ?? { status: 0, stdout: `${SHA}\n` }
    return results.vitest ?? { status: 0 }
  }
  return { spawn, calls }
}

describe('vitestArgv', () => {
  it('runs the tests changed since the base without global thresholds', () => {
    expect(vitestArgv(SHA)).toEqual([
      'pnpm',
      'exec',
      'vitest',
      'run',
      '--changed',
      SHA,
      '--passWithNoTests',
      '--coverage.thresholds.lines=0',
      '--coverage.thresholds.functions=0',
      '--coverage.thresholds.statements=0',
      '--coverage.thresholds.branches=0',
      '--coverage',
      '--reporter=dot',
      '--silent',
    ])
  })

  it('runs the full suite with thresholds when there is no base', () => {
    expect(vitestArgv(null)).toEqual([
      'pnpm',
      'exec',
      'vitest',
      'run',
      '--coverage',
      '--reporter=dot',
      '--silent',
    ])
  })
})

describe('localFcNumRuns', () => {
  it('returns FC_NUM_RUNS outside CI', () => {
    expect(localFcNumRuns({ FC_NUM_RUNS: '25' })).toBe(25)
  })

  it('never overrides under CI', () => {
    expect(localFcNumRuns({ CI: 'true', FC_NUM_RUNS: '200' })).toBeUndefined()
  })

  it.each([undefined, '', '0', '-3', '2.5', 'many'])(
    'ignores FC_NUM_RUNS=%s',
    (value) => {
      expect(localFcNumRuns({ FC_NUM_RUNS: value })).toBeUndefined()
    },
  )
})

describe('configureLocalFcNumRuns', () => {
  it('sets the fast-check default from the local FC_NUM_RUNS', () => {
    const calls = []
    expect(
      configureLocalFcNumRuns({ FC_NUM_RUNS: '25' }, (p) => calls.push(p)),
    ).toBe(25)
    expect(calls).toEqual([{ numRuns: 25 }])
  })

  it('leaves the default alone under CI', () => {
    const calls = []
    expect(
      configureLocalFcNumRuns({ CI: 'true', FC_NUM_RUNS: '200' }, (p) =>
        calls.push(p),
      ),
    ).toBeUndefined()
    expect(calls).toEqual([])
  })
})

describe('mergeBase', () => {
  it('asks git for the merge-base of HEAD and the ref', () => {
    const { spawn, calls } = fakeSpawn()
    expect(mergeBase(spawn, 'origin/main')).toBe(SHA)
    expect(calls[0]).toMatchObject({
      cmd: 'git',
      args: ['merge-base', 'HEAD', 'origin/main'],
    })
  })

  it('returns null when git fails or prints nothing', () => {
    expect(
      mergeBase(fakeSpawn({ base: { status: 1, stdout: '' } }).spawn, 'x'),
    ).toBe(null)
    expect(
      mergeBase(fakeSpawn({ base: { status: 0, stdout: ' \n' } }).spawn, 'x'),
    ).toBe(null)
  })
})

describe('main', () => {
  it('runs the scoped suite with the local numRuns and returns its status', () => {
    const { spawn, calls } = fakeSpawn({ vitest: { status: 3 } })
    const lines = []
    expect(
      main({ env: { PATH: '/bin' }, spawn, write: (s) => lines.push(s) }),
    ).toBe(3)
    const [cmd, ...args] = vitestArgv(SHA)
    expect(calls[1]).toMatchObject({ cmd, args, opts: { stdio: 'inherit' } })
    expect(calls[1].opts.env).toEqual({
      PATH: '/bin',
      FC_NUM_RUNS: LOCAL_FC_NUM_RUNS,
    })
    expect(lines).toEqual([])
  })

  it('keeps an explicit FC_NUM_RUNS', () => {
    const { spawn, calls } = fakeSpawn()
    expect(main({ env: { FC_NUM_RUNS: '500' }, spawn, write: () => {} })).toBe(
      0,
    )
    expect(calls[1].opts.env.FC_NUM_RUNS).toBe('500')
  })

  it('diffs against UNIT_CHANGED_BASE when set', () => {
    const { spawn, calls } = fakeSpawn({ base: { status: 1, stdout: '' } })
    const lines = []
    main({
      env: { UNIT_CHANGED_BASE: 'abc123' },
      spawn,
      write: (s) => lines.push(s),
    })
    expect(calls[0].args).toEqual(['merge-base', 'HEAD', 'abc123'])
    expect(lines).toEqual([
      'unit-changed: no merge-base with abc123; running the full suite\n',
    ])
  })

  it('falls back to the full suite and says so without a merge-base', () => {
    const { spawn, calls } = fakeSpawn({ base: { status: 128, stdout: '' } })
    const lines = []
    main({ env: {}, spawn, write: (s) => lines.push(s) })
    expect(calls[1].args).toEqual(vitestArgv(null).slice(1))
    expect(lines).toEqual([
      'unit-changed: no merge-base with origin/main; running the full suite\n',
    ])
  })

  it('fails when vitest is killed without a status', () => {
    const { spawn } = fakeSpawn({ vitest: { status: null } })
    expect(main({ env: {}, spawn, write: () => {} })).toBe(1)
  })

  it('defaults to process.env, spawnSync and stderr', async () => {
    const { spawn, calls } = fakeSpawn({
      base: { status: 128, stdout: '' },
      vitest: { status: 2 },
    })
    vi.mocked(spawnSync).mockImplementation(spawn)
    // The setup file loaded the module before the mock; reload it so it binds the mocked spawnSync.
    vi.resetModules()
    const { main: mainWithDefaults } = await import('./unit-changed.mjs')
    vi.stubEnv('UNIT_CHANGED_BASE', 'abc123')
    const stderr = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)
    try {
      expect(mainWithDefaults()).toBe(2)
      expect(stderr).toHaveBeenCalledWith(
        'unit-changed: no merge-base with abc123; running the full suite\n',
      )
    } finally {
      stderr.mockRestore()
      vi.unstubAllEnvs()
    }
    expect(calls[0].args).toEqual(['merge-base', 'HEAD', 'abc123'])
    expect(calls[1].opts.env.UNIT_CHANGED_BASE).toBe('abc123')
  })
})

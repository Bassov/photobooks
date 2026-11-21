import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  APT_RETRIES_FILE,
  APT_RETRIES_LINE,
  MAX_ATTEMPTS,
  main,
  runCommand,
  sleepSync,
} from './ci-apt-retry.mjs'

const cli = path.join(import.meta.dirname, 'ci-apt-retry.mjs')

/** Fake deps: `statuses` are the exit codes of successive attempts of the wrapped command. */
const fakeDeps = ({
  statuses = [0],
  env = {},
  aptDir = true,
  sudo = 0,
} = {}) => {
  const calls = []
  const sleeps = []
  const errors = []
  const queue = [...statuses]
  return {
    calls,
    sleeps,
    errors,
    deps: {
      env,
      exists: () => aptDir,
      run: (cmd, args, input) => {
        calls.push({ cmd, args, input })
        return cmd === 'sudo' ? sudo : (queue.shift() ?? 1)
      },
      sleep: (ms) => sleeps.push(ms),
      error: (msg) => errors.push(msg),
    },
  }
}

const install = ['pnpm', 'exec', 'playwright', 'install-deps', 'chromium']
const commandCalls = (calls) => calls.filter((c) => c.cmd !== 'sudo')

describe('ci-apt-retry main', () => {
  it('runs a passing command once without sleeping', () => {
    const f = fakeDeps({ statuses: [0] })

    const code = main({ argv: install, ...f.deps })

    expect(code).toBe(0)
    expect(commandCalls(f.calls)).toEqual([
      { cmd: 'pnpm', args: install.slice(1), input: undefined },
    ])
    expect(f.sleeps).toEqual([])
  })

  it('retries a flaky command and exits 0 when try 2 succeeds', () => {
    const f = fakeDeps({ statuses: [100, 0] })

    const code = main({ argv: install, ...f.deps })

    expect(code).toBe(0)
    expect(commandCalls(f.calls)).toHaveLength(2)
    expect(f.sleeps).toEqual([10_000])
    expect(f.errors.join('\n')).toContain('attempt 1/3')
  })

  it('fails with the last exit code after 3 attempts, doubling the backoff', () => {
    const f = fakeDeps({
      statuses: [100, 100, 7],
      env: { CI_RETRY_DELAY_MS: '5' },
    })

    const code = main({ argv: install, ...f.deps })

    expect(code).toBe(7)
    expect(commandCalls(f.calls)).toHaveLength(MAX_ATTEMPTS)
    expect(f.sleeps).toEqual([5, 10])
    expect(f.errors.at(-1)).toContain('failed (exit 7) after 3 attempts')
  })

  it('exits 2 with usage when no command is given', () => {
    const f = fakeDeps()

    const code = main({ argv: [], ...f.deps })

    expect(code).toBe(2)
    expect(f.calls).toEqual([])
    expect(f.errors[0]).toContain('usage:')
  })

  it('writes the apt retries config via sudo tee on GitHub Actions', () => {
    const f = fakeDeps({ env: { GITHUB_ACTIONS: 'true' } })

    main({ argv: install, ...f.deps })

    expect(f.calls[0]).toEqual({
      cmd: 'sudo',
      args: ['tee', APT_RETRIES_FILE],
      input: APT_RETRIES_LINE,
    })
    expect(APT_RETRIES_LINE).toBe('Acquire::Retries "5";\n')
  })

  it('still runs the command when writing the apt config fails', () => {
    const f = fakeDeps({ env: { GITHUB_ACTIONS: 'true' }, sudo: 1 })

    const code = main({ argv: install, ...f.deps })

    expect(code).toBe(0)
    expect(commandCalls(f.calls)).toHaveLength(1)
    expect(f.errors[0]).toContain(`could not write ${APT_RETRIES_FILE}`)
  })

  it('leaves apt alone off GitHub Actions or without apt', () => {
    const local = fakeDeps()
    const noApt = fakeDeps({ env: { GITHUB_ACTIONS: 'true' }, aptDir: false })

    main({ argv: install, ...local.deps })
    main({ argv: install, ...noApt.deps })

    expect(local.calls.some((c) => c.cmd === 'sudo')).toBe(false)
    expect(noApt.calls.some((c) => c.cmd === 'sudo')).toBe(false)
  })
})

describe('ci-apt-retry runtime helpers', () => {
  it('runCommand returns the exit code, and 1 when the binary is missing', () => {
    expect(runCommand(process.execPath, ['-e', 'process.exit(3)'])).toBe(3)
    expect(runCommand(process.execPath, ['-e', ''], 'stdin')).toBe(0)
    expect(runCommand('ci-apt-retry-no-such-binary', [])).toBe(1)
  })

  it('sleepSync blocks for about the given time', () => {
    const start = performance.now()

    sleepSync(20)

    expect(performance.now() - start).toBeGreaterThanOrEqual(15)
  })
})

describe('ci-apt-retry CLI (real processes)', () => {
  let root
  let counter

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-apt-retry-'))
    counter = path.join(root, 'tries')
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  // Appends one line per call (line count = attempts); exits 0 once the count reaches okOnTry (0 = never).
  const flaky = (okOnTry) =>
    `echo try >> "${counter}"; n=$(wc -l < "${counter}"); ` +
    `[ ${okOnTry} -gt 0 ] && [ "$n" -ge ${okOnTry} ] && exit 0; exit 7`

  const runCli = (script) => {
    const env = { ...process.env, CI_RETRY_DELAY_MS: '0' }
    delete env.GITHUB_ACTIONS
    return spawnSync(process.execPath, [cli, 'bash', '-c', script], {
      encoding: 'utf8',
      env,
    })
  }

  const attempts = () =>
    fs.readFileSync(counter, 'utf8').trim().split('\n').length

  it('exits 0 when a flaky command succeeds on try 2', () => {
    const r = runCli(flaky(2))

    expect(r.status).toBe(0)
    expect(attempts()).toBe(2)
  })

  it('exits non-zero after 3 attempts of a real failure', () => {
    const r = runCli(flaky(0))

    expect(r.status).toBe(7)
    expect(attempts()).toBe(3)
  })
})

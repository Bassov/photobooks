import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const wrapper = path.join(import.meta.dirname, 'ci-apt-retry.sh')

let root
let counter

// The wrapped command appends a line per call, so the file length is the attempt count;
// it exits 0 once the count reaches `okOnTry` (0 = never).
const flaky = (okOnTry, failCode = 7) =>
  `echo try >> "${counter}"; n=$(wc -l < "${counter}"); ` +
  `[ ${okOnTry} -gt 0 ] && [ "$n" -ge ${okOnTry} ] && exit 0; exit ${failCode}`

const run = (...args) => {
  const env = { ...process.env, CI_RETRY_DELAY_SEC: '0' }
  delete env.GITHUB_ACTIONS
  return spawnSync('bash', [wrapper, ...args], { encoding: 'utf8', env })
}

const attempts = () =>
  fs.readFileSync(counter, 'utf8').trim().split('\n').length

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-apt-retry-'))
  counter = path.join(root, 'tries')
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('ci-apt-retry.sh', () => {
  it('runs a passing command once', () => {
    const r = run('bash', '-c', flaky(1))

    expect(r.status).toBe(0)
    expect(attempts()).toBe(1)
  })

  it('retries a flaky command and exits 0 when try 2 succeeds', () => {
    const r = run('bash', '-c', flaky(2))

    expect(r.status).toBe(0)
    expect(attempts()).toBe(2)
    expect(r.stderr).toContain('attempt 1/3')
  })

  it('fails with the command exit code after the 3rd attempt', () => {
    const r = run('bash', '-c', flaky(0, 7))

    expect(r.status).toBe(7)
    expect(attempts()).toBe(3)
    expect(r.stderr).toContain('after 3 attempts')
  })

  it('exits 2 with usage when no command is given', () => {
    const r = run()

    expect(r.status).toBe(2)
    expect(r.stderr).toContain('usage:')
  })
})

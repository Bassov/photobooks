// Run a CI install command (e.g. `pnpm exec playwright install --with-deps chromium`)
// so a transient apt mirror / network blip does not fail the job:
//   1. on GitHub Actions, make apt retry each download (Acquire::Retries);
//   2. run the command up to MAX_ATTEMPTS times with a short doubling backoff.
// A real failure still fails: after the last attempt the command's exit code is returned.
//
// Usage: node scripts/ci-apt-retry.mjs <command> [args...]
// Env: CI_RETRY_DELAY_MS — first backoff (default 10000).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const MAX_ATTEMPTS = 3
export const APT_CONF_DIR = '/etc/apt/apt.conf.d'
export const APT_RETRIES_FILE = `${APT_CONF_DIR}/80-retries`
export const APT_RETRIES_LINE = 'Acquire::Retries "5";\n'
const DEFAULT_DELAY_MS = 10_000

/** Spawn `cmd args` with inherited stdio; a signal or spawn error counts as exit 1. */
export function runCommand(cmd, args, input) {
  const r = spawnSync(cmd, args, {
    stdio: input === undefined ? 'inherit' : ['pipe', 'ignore', 'inherit'],
    input,
  })
  return r.status ?? 1
}

/** Block the (single-purpose) CLI process for `ms`. */
export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** On GitHub Actions runners, write the apt retries config (best effort). */
export function configureAptRetries({ env, exists, run, error }) {
  if (env.GITHUB_ACTIONS !== 'true' || !exists(APT_CONF_DIR)) return false
  const status = run('sudo', ['tee', APT_RETRIES_FILE], APT_RETRIES_LINE)
  if (status !== 0) {
    error(`ci-apt-retry: could not write ${APT_RETRIES_FILE} (exit ${status})`)
  }
  return status === 0
}

/** @returns {number} exit code of the last attempt */
export function runWithRetry(cmd, args, { run, sleep, error, delayMs }) {
  const label = [cmd, ...args].join(' ')
  let delay = delayMs
  for (let attempt = 1; ; attempt += 1) {
    const status = run(cmd, args)
    if (status === 0) return 0
    if (attempt >= MAX_ATTEMPTS) {
      error(
        `ci-apt-retry: '${label}' failed (exit ${status}) after ${attempt} attempts`,
      )
      return status
    }
    error(
      `ci-apt-retry: '${label}' failed (exit ${status}), attempt ${attempt}/${MAX_ATTEMPTS}; retrying in ${delay} ms`,
    )
    sleep(delay)
    delay *= 2
  }
}

/** @returns {number} exit code */
export function main({ argv, env, exists, run, sleep, error }) {
  const [cmd, ...args] = argv
  if (!cmd) {
    error('usage: node scripts/ci-apt-retry.mjs <command> [args...]')
    return 2
  }
  configureAptRetries({ env, exists, run, error })
  const delayMs = Number(env.CI_RETRY_DELAY_MS ?? DEFAULT_DELAY_MS)
  return runWithRetry(cmd, args, { run, sleep, error, delayMs })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main({
    argv: process.argv.slice(2),
    env: process.env,
    exists: fs.existsSync,
    run: runCommand,
    sleep: sleepSync,
    error: console.error,
  })
}

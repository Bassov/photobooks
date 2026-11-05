#!/usr/bin/env node
/**
 * Local `check:fast` unit step (pre-push and the A loop): Vitest runs only the
 * tests related to the diff vs the merge-base with origin/main, with fewer
 * fast-check runs. CI runs the full suite (`pnpm test:coverage`) instead.
 */
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const BASE_REF = 'origin/main'
export const LOCAL_FC_NUM_RUNS = '25'

const REPORT_ARGS = ['--coverage', '--reporter=dot', '--silent']
// A partial run cannot meet the global thresholds; patch-coverage still gates
// the changed lines from the same lcov, and CI keeps the thresholds.
const NO_GLOBAL_THRESHOLDS = [
  'lines',
  'functions',
  'statements',
  'branches',
].map((k) => `--coverage.thresholds.${k}=0`)

/**
 * @param {string | null} base merge-base SHA, or null for the full suite
 * @returns {string[]}
 */
export function vitestArgv(base) {
  const run = ['pnpm', 'exec', 'vitest', 'run']
  if (base === null) return [...run, ...REPORT_ARGS]
  return [
    ...run,
    '--changed',
    base,
    '--passWithNoTests',
    ...NO_GLOBAL_THRESHOLDS,
    ...REPORT_ARGS,
  ]
}

/**
 * Global fast-check numRuns for the Vitest setup file: the local `FC_NUM_RUNS`
 * outside CI, else no override (CI keeps each test's own numRuns).
 * @param {NodeJS.ProcessEnv} env
 * @returns {number | undefined}
 */
export function localFcNumRuns(env) {
  if (env.CI) return undefined
  const n = Number(env.FC_NUM_RUNS)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

/**
 * @param {typeof spawnSync} spawn
 * @param {string} ref
 * @returns {string | null}
 */
export function mergeBase(spawn, ref) {
  const r = spawn('git', ['merge-base', 'HEAD', ref], { encoding: 'utf8' })
  const sha = r.status === 0 ? String(r.stdout).trim() : ''
  return sha === '' ? null : sha
}

/**
 * @param {{ env?: NodeJS.ProcessEnv, spawn?: typeof spawnSync, write?: (s: string) => void }} [io]
 * @returns {number}
 */
export function main(io = {}) {
  const env = io.env ?? process.env
  const spawn = io.spawn ?? spawnSync
  const write = io.write ?? ((s) => process.stderr.write(s))
  // UNIT_CHANGED_BASE: another ref to diff against (e.g. after origin/main moved).
  const ref = env.UNIT_CHANGED_BASE || BASE_REF
  const base = mergeBase(spawn, ref)
  if (base === null) {
    write(`unit-changed: no merge-base with ${ref}; running the full suite\n`)
  }
  const [cmd, ...args] = vitestArgv(base)
  const r = spawn(cmd, args, {
    env: { ...env, FC_NUM_RUNS: env.FC_NUM_RUNS ?? LOCAL_FC_NUM_RUNS },
    stdio: 'inherit',
  })
  return r.status ?? 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main()
}

/**
 * Perf lane helpers (frame-budget / LoAF scenarios run apart from functional e2e).
 *   node scripts/perf-lane.mjs scope <base-ref>   → prints in_scope=true|false
 *   node scripts/perf-lane.mjs verdict <report.json>...   → exit 1 when red
 * Thresholds live in `e2e/perf/budgets.ts` / `src/perf/loafObserver.ts`; this
 * file only aggregates repeated runs (never relaxes a single assertion).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const GATE_TITLE = 'frame-budget gates'
/** A run with a frame blocking longer than this is red regardless of other runs. */
export const HARD_BLOCKING_MS = 50
/** A scenario failing in this many runs (of the repeats) is red. */
export const MAX_FAILED_RUNS = 2

const SCOPE_PATTERNS = [
  /^src\/(render|perf|photo|assets)\//,
  /^(src|e2e)\/.*(filmstrip|pasteboard)/i,
  /^e2e\/perf\//,
  /^e2e\/[^/]*frame[^/]*$/,
  /^e2e\/loaf-gate-canary\.spec\.ts$/,
  /^playwright\.config\.ts$/,
  /^scripts\/perf-lane\.mjs$/,
  /^\.github\/workflows\/(perf|integration)\.yml$/,
]

/**
 * @param {string} file repo-relative path
 * @param {(file: string) => boolean} [hasGate] true when the file declares a
 *   frame-budget describe (so editing such a spec also triggers the lane)
 */
export function isPerfPath(file, hasGate = () => false) {
  if (SCOPE_PATTERNS.some((re) => re.test(file))) return true
  return /^e2e\/.*\.spec\.ts$/.test(file) && hasGate(file)
}

export function isPerfScope(files, hasGate) {
  return files.some((file) => isPerfPath(file, hasGate))
}

const ANSI = /\u001b\[[0-9;]*m/g

/** Worst `blockingDuration` (ms) quoted by a LoAF assertion message, or 0. */
export function worstBlockingMs(message) {
  const plain = message.replace(ANSI, '')
  let worst = 0
  for (const m of plain.matchAll(/worst blockingDuration ([\d.]+)ms/g)) {
    worst = Math.max(worst, Number(m[1]))
  }
  return worst
}

/** Flatten a Playwright JSON report to `{ key, failed, messages }[]`. */
export function collectScenarios(report) {
  const out = []
  const walk = (suite, trail) => {
    const here = suite.title ? [...trail, suite.title] : trail
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? []
        const failed = results.some(
          (r) => r.status === 'failed' || r.status === 'timedOut',
        )
        const messages = results.flatMap((r) =>
          (r.errors ?? (r.error ? [r.error] : [])).map((e) => e.message ?? ''),
        )
        out.push({ key: [...here, spec.title].join(' › '), failed, messages })
      }
    }
    for (const child of suite.suites ?? []) walk(child, here)
  }
  for (const suite of report.suites ?? []) walk(suite, [])
  return out
}

/** @param {object[]} reports one Playwright JSON report per run */
export function judge(reports) {
  const byKey = new Map()
  reports.forEach((report, run) => {
    for (const s of collectScenarios(report)) {
      const row = byKey.get(s.key) ?? { failedRuns: [], worstMs: 0 }
      if (s.failed) row.failedRuns.push(run + 1)
      for (const msg of s.messages) {
        row.worstMs = Math.max(row.worstMs, worstBlockingMs(msg))
      }
      byKey.set(s.key, row)
    }
  })
  const problems = []
  const notes = []
  for (const [key, row] of byKey) {
    if (row.failedRuns.length >= MAX_FAILED_RUNS) {
      problems.push(
        `${key}: failed in runs ${row.failedRuns.join(', ')} of ${String(reports.length)}`,
      )
    } else if (row.worstMs > HARD_BLOCKING_MS) {
      problems.push(
        `${key}: blocking ${String(row.worstMs)}ms > ${String(HARD_BLOCKING_MS)}ms in run ${row.failedRuns.join(', ')}`,
      )
    } else if (row.failedRuns.length > 0) {
      notes.push(
        `${key}: tolerated single failure in run ${row.failedRuns.join(', ')}`,
      )
    }
  }
  if (byKey.size === 0) problems.push('no scenarios found in reports')
  return { pass: problems.length === 0, problems, notes }
}

function changedFiles(base) {
  const out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    encoding: 'utf8',
  })
  return out.split('\n').filter(Boolean)
}

function fileHasGate(file) {
  try {
    return fs.readFileSync(file, 'utf8').includes(GATE_TITLE)
  } catch {
    return false
  }
}

export function main(argv) {
  const [cmd, ...rest] = argv
  if (cmd === 'scope') {
    const inScope = isPerfScope(
      changedFiles(rest[0] ?? 'origin/main'),
      fileHasGate,
    )
    console.log(`in_scope=${String(inScope)}`)
    return 0
  }
  if (cmd === 'verdict') {
    const present = rest.filter((p) => fs.existsSync(p))
    const reports = present.map((p) => JSON.parse(fs.readFileSync(p, 'utf8')))
    const verdict = judge(reports)
    // A run that produced no report (crash / build failure) counts as red.
    const missing = rest.filter((p) => !present.includes(p))
    const problems = [
      ...verdict.problems,
      ...missing.map((p) => `missing report ${p}`),
    ]
    const pass = problems.length === 0
    for (const n of verdict.notes) console.log(`note: ${n}`)
    for (const p of problems) console.error(`perf: ${p}`)
    console.log(
      pass ? `perf lane ok (${String(reports.length)} runs)` : 'perf lane RED',
    )
    return pass ? 0 : 1
  }
  console.error('usage: perf-lane.mjs scope <base> | verdict <report.json>...')
  return 2
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) process.exit(main(process.argv.slice(2)))

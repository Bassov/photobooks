/**
 * Perf lane helpers (frame-budget / LoAF scenarios run apart from functional e2e).
 *   node scripts/perf-lane.mjs scope <base-ref>   → prints in_scope=true|false
 *   node scripts/perf-lane.mjs verdict <report.json>...   → exit 1 when red
 *     --out <f>   write `{ red: [scenario key] }` (main push runs)
 *     --base <f> --base-url <u> --base-ref <r>   forgive scenarios red on that
 *       main run and untouched by the PR (scripts/perf-baseline.mjs)
 * Thresholds live in `e2e/perf/budgets.ts` / `src/perf/loafObserver.ts`; this
 * file only aggregates repeated runs (never relaxes a single assertion).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { classify, readBaseVerdict } from './perf-baseline.mjs'

export const GATE_TITLE = 'frame-budget gates'
/** A run with a frame blocking longer than this is red regardless of other runs. */
export const HARD_BLOCKING_MS = 50
/** A scenario failing in this many runs (of the repeats) is red. */
export const MAX_FAILED_RUNS = 2

const SCOPE_PATTERNS = [
  /^src\/(render|perf|photo|assets|derivatives)\//,
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

/**
 * Flatten a Playwright JSON report to `{ key, spec, failed, messages }[]`;
 * `spec` is the repo path of the file (top-level suite, relative to `e2e/`).
 */
export function collectScenarios(report) {
  const out = []
  const walk = (suite, trail, file) => {
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
        out.push({
          key: [...here, spec.title].join(' › '),
          spec: file,
          failed,
          messages,
        })
      }
    }
    for (const child of suite.suites ?? []) walk(child, here, file)
  }
  for (const suite of report.suites ?? []) {
    const top = suite.file ?? suite.title
    walk(suite, [], top ? `e2e/${top}` : '')
  }
  return out
}

/** @param {object[]} reports one Playwright JSON report per run */
export function judge(reports) {
  const byKey = new Map()
  reports.forEach((report, run) => {
    for (const s of collectScenarios(report)) {
      const row = byKey.get(s.key) ?? {
        spec: s.spec,
        failedRuns: [],
        worstMs: 0,
      }
      if (s.failed) row.failedRuns.push(run + 1)
      for (const msg of s.messages) {
        row.worstMs = Math.max(row.worstMs, worstBlockingMs(msg))
      }
      byKey.set(s.key, row)
    }
  })
  /** @type {{ key: string, spec: string, problem: string }[]} */
  const red = []
  const notes = []
  for (const [key, row] of byKey) {
    if (row.failedRuns.length >= MAX_FAILED_RUNS) {
      red.push({
        key,
        spec: row.spec,
        problem: `${key}: failed in runs ${row.failedRuns.join(', ')} of ${String(reports.length)}`,
      })
    } else if (row.worstMs > HARD_BLOCKING_MS) {
      red.push({
        key,
        spec: row.spec,
        problem: `${key}: blocking ${String(row.worstMs)}ms > ${String(HARD_BLOCKING_MS)}ms in run ${row.failedRuns.join(', ')}`,
      })
    } else if (row.failedRuns.length > 0) {
      notes.push(
        `${key}: tolerated single failure in run ${row.failedRuns.join(', ')}`,
      )
    }
  }
  const problems = red.map((s) => s.problem)
  if (byKey.size === 0) problems.push('no scenarios found in reports')
  return { pass: problems.length === 0, problems, notes, red }
}

function changedFiles(base, cwd) {
  const out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return out.split('\n').filter(Boolean)
}

function fileHasGate(cwd, file) {
  try {
    return fs.readFileSync(path.join(cwd, file), 'utf8').includes(GATE_TITLE)
  } catch {
    return false
  }
}

export function main(argv) {
  const [cmd, ...rest] = argv
  if (cmd === 'scope')
    return scopeCommand(rest[0] ?? 'origin/main', process.cwd())
  if (cmd === 'verdict') return verdictCommand(rest)
  console.error(
    'usage: perf-lane.mjs scope <base> | verdict [--out f] [--base f --base-url u --base-ref r] <report.json>...',
  )
  return 2
}

/**
 * A git failure (no merge base, bad ref) is an error, never "not in scope":
 * a silent false would skip the gates on exactly the PRs that need them.
 * @param {string} base ref diffed as `${base}...HEAD`
 * @param {string} cwd git work tree to diff
 */
export function scopeCommand(base, cwd) {
  let files
  try {
    files = changedFiles(base, cwd)
  } catch (err) {
    const why = String(err.stderr ?? err.message).trim()
    console.error(`perf-lane scope: cannot diff ${base}...HEAD: ${why}`)
    return 1
  }
  const hasGate = (file) => fileHasGate(cwd, file)
  console.log(`in_scope=${String(isPerfScope(files, hasGate))}`)
  return 0
}

function verdictCommand(args) {
  const { values: opts, positionals: paths } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      base: { type: 'string' },
      'base-url': { type: 'string' },
      'base-ref': { type: 'string' },
    },
  })
  const present = paths.filter((p) => fs.existsSync(p))
  const reports = present.map((p) => JSON.parse(fs.readFileSync(p, 'utf8')))
  const verdict = judge(reports)
  if (opts.out) {
    const red = verdict.red.map((s) => s.key)
    fs.writeFileSync(opts.out, `${JSON.stringify({ red }, null, 2)}\n`)
  }
  const base = opts.base ? readBaseVerdict(opts.base) : null
  const changed = base ? prChangedFiles(opts['base-ref']) : null
  const baseUrl = opts['base-url'] || 'latest main perf run'
  const forgiven = new Set()
  const lines = []
  for (const s of verdict.red) {
    const why = classify(s, base, changed)
    if (why === 'pre-existing') {
      forgiven.add(s.problem)
      lines.push(`pre-existing on main (${baseUrl}): ${s.problem}`)
    } else if (opts.base) {
      lines.push(`red (${why}): ${s.problem}`)
    }
  }
  // A run that produced no report (crash / build failure) counts as red.
  const missing = paths.filter((p) => !present.includes(p))
  const problems = [
    ...verdict.problems.filter((p) => !forgiven.has(p)),
    ...missing.map((p) => `missing report ${p}`),
  ]
  const pass = problems.length === 0
  for (const n of verdict.notes) console.log(`note: ${n}`)
  for (const line of lines) console.log(`perf: ${line}`)
  for (const p of problems) console.error(`perf: ${p}`)
  const status = pass
    ? `perf lane ok (${String(reports.length)} runs)`
    : 'perf lane RED'
  console.log(status)
  if (lines.length > 0 && process.env.GITHUB_STEP_SUMMARY) {
    const summary = [status, ...lines.map((l) => `- ${l}`)].join('\n')
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  }
  return pass ? 0 : 1
}

/** Files the PR changes against `baseRef`, or null when unknown. */
function prChangedFiles(baseRef) {
  if (!baseRef) return null
  try {
    return changedFiles(baseRef, process.cwd())
  } catch {
    return null
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) process.exit(main(process.argv.slice(2)))

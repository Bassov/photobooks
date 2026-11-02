/**
 * Baseline-aware perf verdict: a scenario already red in the latest `perf`
 * push run on main does not fail a PR that leaves its spec and sources alone.
 * Used by `scripts/perf-lane.mjs verdict --base`; thresholds are not touched.
 */
import fs from 'node:fs'

/** Paths that feed every frame-budget scenario (harness, app shell, build). */
const SHARED_SOURCES = [
  /^src\/(perf|ui|testFixtures)\//,
  /^e2e\/(perf|fixtures)\//,
  /^src\/(main|App)\.tsx$/,
  /\.css$/,
  /^(index\.html|package\.json|pnpm-lock\.yaml|vite\.config\.ts|playwright\.config\.ts)$/,
]

/** Spec path → app sources its scenarios measure. */
const SCENARIO_SOURCES = [
  [
    /^e2e\/(thumb-|filmstrip)/,
    [/^src\/(assets|photo)\//, /^src\/editor\/.*filmstrip/i],
  ],
]

/** Specs without a row count every app source as theirs. */
const ANY_SRC = [/^src\//]

/** @param {string} spec repo-relative spec path, e.g. `e2e/filmstrip.spec.ts` */
export function scenarioSources(spec) {
  return SCENARIO_SOURCES.find(([re]) => re.test(spec))?.[1] ?? ANY_SRC
}

/** True when a changed file is the spec, a shared perf source or one of its sources. */
export function touchesScenario(spec, changed) {
  const sources = [...SHARED_SOURCES, ...scenarioSources(spec)]
  return changed.some(
    (file) => file === spec || sources.some((re) => re.test(file)),
  )
}

/**
 * @param {{ key: string, spec: string }} scenario red on the PR
 * @param {{ red: string[] } | null} base verdict of the latest main push run
 * @param {string[] | null} changed files the PR changes (null = unknown)
 * @returns {'pre-existing' | 'touched' | 'new' | 'no-baseline'} only
 *   `pre-existing` is forgiven
 */
export function classify(scenario, base, changed) {
  if (!base || !changed) return 'no-baseline'
  if (!base.red.includes(scenario.key)) return 'new'
  return touchesScenario(scenario.spec, changed) ? 'touched' : 'pre-existing'
}

/** Base verdict file → `{ red }`, or null when missing or malformed. */
export function readBaseVerdict(file) {
  try {
    const verdict = JSON.parse(fs.readFileSync(file, 'utf8'))
    const ok =
      Array.isArray(verdict?.red) &&
      verdict.red.every((key) => typeof key === 'string')
    return ok ? { red: verdict.red } : null
  } catch {
    return null
  }
}

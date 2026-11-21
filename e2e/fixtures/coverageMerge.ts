/**
 * In-memory Istanbul coverage merge for the e2e coverage fixture: one map per
 * Playwright worker, written once at worker teardown instead of a ~7.6 MB dump
 * per test.
 */

type HitMap = Record<string, number>
type BranchHitMap = Record<string, number[]>

/** Istanbul `FileCoverage` data; only the hit counters are read here. */
export interface FileCoverage {
  path: string
  s: HitMap
  f: HitMap
  b: BranchHitMap
  bT?: BranchHitMap
  [key: string]: unknown
}

/** Hit counters of one file, sent instead of the full record once the worker knows the file. */
export type FileCounters = Pick<FileCoverage, 's' | 'f' | 'b'> & {
  bT?: BranchHitMap | undefined
}

export type CoverageMap = Record<string, FileCoverage>

/** Per-test payload: full records for files new to the worker, counters for the rest. */
export type CoveragePayload = Record<string, FileCoverage | FileCounters>

function addHits(into: HitMap, from: HitMap): void {
  for (const [id, hits] of Object.entries(from))
    into[id] = (into[id] ?? 0) + hits
}

function addBranchHits(into: BranchHitMap, from: BranchHitMap): void {
  for (const [id, hits] of Object.entries(from)) {
    const sum = into[id] ?? []
    hits.forEach((n, i) => {
      sum[i] = (sum[i] ?? 0) + n
    })
    into[id] = sum
  }
}

function isFullRecord(cov: FileCoverage | FileCounters): cov is FileCoverage {
  return 'statementMap' in cov
}

/**
 * Adds `payload` into `map` (mutates it): sums s/f/b/bT hit counters per file,
 * like istanbul-lib-coverage `merge`. A file seen for the first time must come
 * as a full record; a counters-only entry for an unknown file throws.
 */
export function mergeCoverage(
  map: CoverageMap,
  payload: CoveragePayload,
): void {
  for (const [file, cov] of Object.entries(payload)) {
    const known = map[file]
    if (known === undefined) {
      if (!isFullRecord(cov)) {
        throw new Error(`coverage counters for unknown file ${file}`)
      }
      map[file] = structuredClone(cov)
      continue
    }
    addHits(known.s, cov.s)
    addHits(known.f, cov.f)
    addBranchHits(known.b, cov.b)
    if (cov.bT !== undefined) addBranchHits((known.bT ??= {}), cov.bT)
  }
}

/**
 * Runs in the page: `window.__coverage__` as a JSON string, full records only
 * for files outside `knownFiles`. Returns null without an instrumented build.
 * Self-contained (serialized by `page.evaluate`).
 */
export function readPageCoverage(knownFiles: string[]): string | null {
  const cov = (window as Window & { __coverage__?: CoverageMap }).__coverage__
  if (cov === undefined) return null
  const known = new Set(knownFiles)
  const out: CoveragePayload = {}
  for (const [file, fc] of Object.entries(cov)) {
    out[file] = known.has(file) ? { s: fc.s, f: fc.f, b: fc.b, bT: fc.bT } : fc
  }
  return JSON.stringify(out)
}

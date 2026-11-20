#!/usr/bin/env node
/**
 * Duration-balanced e2e shards for the CI functional lane. Playwright's own
 * `--shard` splits by test count, and the reader-gl specs take ~30–130 s a
 * test against ~1.5 s elsewhere, so count shards end up far from the mean.
 *
 * Shards run one worker, like the old single job: with two workers on one
 * runner the WebGL and long-task specs fail on timing. Units are whole spec
 * files, except the reader-gl specs (`SPLIT_BY_LOCATION`), which go by spec
 * location (`file:line`) because one such file outlasts a whole shard; only
 * files without serial describes may be listed there.
 *
 * Units go longest first to the least-loaded shard, weighted by the seconds
 * per spec location recorded in `.github/e2e-shard-durations.json` (a
 * location with no record weighs its test count × the recorded mean per
 * test).
 *
 * Every shard computes the same split from the same `--list` report, so the
 * shards cover each listed test exactly once; `verify` checks the merged
 * report against the listing.
 *
 * Usage:
 * - `node scripts/e2e-shard.mjs pick --list <list.json> --shard <i>/<n>`:
 *   prints one Playwright file filter per line for shard i.
 * - `node scripts/e2e-shard.mjs verify --list <list.json> --report <merged.json>`:
 *   exits 1 unless the report has every listed file with its test count.
 * - `node scripts/e2e-shard.mjs record --report <e2e-results.json>`:
 *   rewrites the durations file from a full CI JSON report.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DURATIONS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../.github/e2e-shard-durations.json',
)

/** Spec files split across shards by location. */
export const SPLIT_BY_LOCATION = /(^|\/)[^/]*reader-gl\.spec\.ts$/

/**
 * Playwright JSON report shape: a top-level suite per spec file, nested
 * describes in `suites` (omitted on leaves).
 * @typedef {{ results: { duration: number }[] }} Test
 * @typedef {{ line: number, tests: Test[] }} Spec
 * @typedef {{ specs: Spec[], suites?: Suite[] }} Suite
 * @typedef {{ suites: (Suite & { file: string })[] }} Report
 */

/**
 * Sum of `value(test)` per spec location `file:line` (testDir-relative file).
 * @param {Report} report
 * @param {(test: Test) => number} value
 * @returns {Map<string, number>}
 */
function sumPerLocation(report, value) {
  /** @type {Map<string, number>} */
  const sums = new Map()
  /** @param {Suite} suite @param {string} file */
  const walk = (suite, file) => {
    for (const spec of suite.specs) {
      const location = `${file}:${String(spec.line)}`
      for (const test of spec.tests) {
        sums.set(location, (sums.get(location) ?? 0) + value(test))
      }
    }
    for (const child of suite.suites ?? []) walk(child, file)
  }
  for (const suite of report.suites) walk(suite, suite.file)
  return sums
}

/** @param {string} location `file:line` */
function fileOf(location) {
  return location.slice(0, location.lastIndexOf(':'))
}

/**
 * Tests per spec location in a Playwright JSON report (a `--list` run or a
 * real one).
 * @param {Report} report
 */
export function testsPerLocation(report) {
  return sumPerLocation(report, () => 1)
}

/**
 * Tests per spec file.
 * @param {Report} report
 * @returns {Map<string, number>}
 */
export function testsPerFile(report) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const [location, tests] of testsPerLocation(report)) {
    const file = fileOf(location)
    counts.set(file, (counts.get(file) ?? 0) + tests)
  }
  return counts
}

/**
 * Seconds per spec location in a finished JSON report (all attempts, retries
 * too), rounded to 0.1 s, locations sorted.
 * @param {Report} report
 * @returns {Record<string, number>}
 */
export function secondsPerLocation(report) {
  const ms = sumPerLocation(report, (test) =>
    test.results.reduce((sum, result) => sum + result.duration, 0),
  )
  return Object.fromEntries(
    [...ms]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([location, total]) => [location, Math.round(total / 100) / 10]),
  )
}

/**
 * Weight of each shard unit: recorded seconds of its locations, else tests ×
 * the mean recorded seconds per test of the listed locations that have a
 * record. Units are locations in `SPLIT_BY_LOCATION` files, files elsewhere.
 * @param {Map<string, number>} counts tests per listed location
 * @param {Record<string, number>} durations
 * @returns {Map<string, number>}
 */
export function unitWeights(counts, durations) {
  let knownSeconds = 0
  let knownTests = 0
  for (const [location, tests] of counts) {
    if (Object.hasOwn(durations, location)) {
      knownSeconds += durations[location]
      knownTests += tests
    }
  }
  const perTest = knownTests > 0 ? knownSeconds / knownTests : 1
  /** @type {Map<string, number>} */
  const weights = new Map()
  for (const [location, tests] of counts) {
    const seconds = Object.hasOwn(durations, location)
      ? durations[location]
      : tests * perTest
    const file = fileOf(location)
    const unit = SPLIT_BY_LOCATION.test(file) ? location : file
    weights.set(unit, (weights.get(unit) ?? 0) + seconds)
  }
  return weights
}

/**
 * Longest-first greedy split into n shards; ties go to the lower shard index
 * and units of equal weight are taken by name, so every caller gets the
 * same split.
 * @param {Map<string, number>} weights
 * @param {number} n
 * @returns {{ units: string[], load: number }[]}
 */
export function assignShards(weights, n) {
  if (n < 1 || weights.size < n) {
    throw new Error(`${String(weights.size)} units for ${String(n)} shards`)
  }
  const units = [...weights].sort(
    ([a, weightA], [b, weightB]) => weightB - weightA || a.localeCompare(b),
  )
  const shards = Array.from({ length: n }, () => ({
    units: /** @type {string[]} */ ([]),
    load: 0,
  }))
  for (const [unit, weight] of units) {
    const loads = shards.map((shard) => shard.load)
    const target = shards[loads.indexOf(Math.min(...loads))]
    target.load += weight
    target.units.push(unit)
  }
  for (const shard of shards) shard.units.sort()
  return shards
}

/**
 * Playwright CLI filter matching exactly one testDir-relative spec file
 * (filters are regexes tested against the absolute path), or one spec
 * location `file:line`.
 * @param {string} unit
 */
export function unitFilter(unit) {
  const match = /^(.*):(\d+)$/.exec(unit)
  const file = match ? match[1] : unit
  const filter = `/e2e/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
  return match ? `${filter}:${match[2]}` : filter
}

/**
 * @param {string} value
 * @returns {{ index: number, total: number }}
 */
export function parseShard(value) {
  const match = /^(\d+)\/(\d+)$/.exec(value)
  const index = Number(match?.[1])
  const total = Number(match?.[2])
  if (!match || index < 1 || index > total) {
    throw new Error(`--shard must be <i>/<n> with 1 ≤ i ≤ n, got ${value}`)
  }
  return { index, total }
}

/**
 * Listed files missing from the report or with another test count.
 * @param {Map<string, number>} listed
 * @param {Map<string, number>} reported
 * @returns {string[]}
 */
export function coverageGaps(listed, reported) {
  const gaps = []
  for (const [file, tests] of listed) {
    const got = reported.get(file) ?? 0
    if (got !== tests) {
      gaps.push(`${file}: listed ${String(tests)}, reported ${String(got)}`)
    }
  }
  for (const [file, tests] of reported) {
    if (!listed.has(file)) {
      gaps.push(`${file}: listed 0, reported ${String(tests)}`)
    }
  }
  return gaps
}

/** @param {string} path @returns {Report} */
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * @param {string[]} argv
 * @param {string} name
 */
function option(argv, name) {
  const at = argv.indexOf(name)
  const value = at >= 0 ? argv[at + 1] : undefined
  if (value === undefined) throw new Error(`missing ${name} <value>`)
  return value
}

/**
 * @param {string[]} argv
 * @param {{ out: (line: string) => void, durationsPath?: string }} io
 * @returns {number} exit code
 */
export function main(argv, io) {
  const durationsPath = io.durationsPath ?? DURATIONS_PATH
  const [command, ...rest] = argv
  if (command === 'pick') {
    const { index, total } = parseShard(option(rest, '--shard'))
    const durations = JSON.parse(readFileSync(durationsPath, 'utf8'))
    const counts = testsPerLocation(readJson(option(rest, '--list')))
    const shard = assignShards(unitWeights(counts, durations), total)[index - 1]
    for (const unit of shard.units) io.out(unitFilter(unit))
    return 0
  }
  if (command === 'verify') {
    const listed = testsPerFile(readJson(option(rest, '--list')))
    const reported = testsPerFile(readJson(option(rest, '--report')))
    const gaps = coverageGaps(listed, reported)
    for (const gap of gaps) io.out(gap)
    io.out(
      gaps.length === 0
        ? `e2e shards cover all ${String(listed.size)} listed files`
        : `e2e shards: ${String(gaps.length)} file(s) differ from the listing`,
    )
    return gaps.length === 0 ? 0 : 1
  }
  if (command === 'record') {
    const seconds = secondsPerLocation(readJson(option(rest, '--report')))
    writeFileSync(durationsPath, `${JSON.stringify(seconds, null, 2)}\n`)
    io.out(`wrote ${String(Object.keys(seconds).length)} locations`)
    return 0
  }
  throw new Error(`usage: e2e-shard.mjs pick|verify|record (got ${command})`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2), {
    out: (line) => {
      console.log(line)
    },
  })
}

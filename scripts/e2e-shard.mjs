#!/usr/bin/env node
/**
 * Duration-balanced e2e shards for the CI functional lane. Playwright's own
 * `--shard` splits by test count, and the reader-gl specs take ~27 s a test
 * against ~1.5 s elsewhere, so count shards end up 1.5× the mean. Here whole
 * spec files go to the least-loaded shard (longest first), weighted by the
 * seconds recorded in `e2e-shard-durations.json`; a file with no record
 * weighs its listed test count × the recorded mean seconds per test.
 *
 * Every shard computes the same split from the same `--list` report, so the
 * shards cover each listed file exactly once; `verify` checks the merged
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
  'e2e-shard-durations.json',
)

/**
 * Playwright JSON report shape: a top-level suite per spec file, nested
 * describes in `suites` (omitted on leaves).
 * @typedef {{ results: { duration: number }[] }} Test
 * @typedef {{ specs: { tests: Test[] }[], suites?: Suite[] }} Suite
 * @typedef {{ suites: (Suite & { file: string })[] }} Report
 */

/**
 * Sum of `value(test)` per testDir-relative spec file.
 * @param {Report} report
 * @param {(test: Test) => number} value
 * @returns {Map<string, number>}
 */
function sumPerFile(report, value) {
  /** @type {Map<string, number>} */
  const sums = new Map()
  /** @param {Suite} suite @param {string} file */
  const walk = (suite, file) => {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        sums.set(file, (sums.get(file) ?? 0) + value(test))
      }
    }
    for (const child of suite.suites ?? []) walk(child, file)
  }
  for (const suite of report.suites) walk(suite, suite.file)
  return sums
}

/**
 * Tests per spec file in a Playwright JSON report (a `--list` run or a real
 * one).
 * @param {Report} report
 */
export function testsPerFile(report) {
  return sumPerFile(report, () => 1)
}

/**
 * Seconds per spec file in a finished JSON report (all attempts, retries too),
 * rounded to 0.1 s, files sorted.
 * @param {Report} report
 * @returns {Record<string, number>}
 */
export function secondsPerFile(report) {
  const ms = sumPerFile(report, (test) =>
    test.results.reduce((sum, result) => sum + result.duration, 0),
  )
  return Object.fromEntries(
    [...ms]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, total]) => [file, Math.round(total / 100) / 10]),
  )
}

/**
 * Weight of each listed file: recorded seconds, else tests × the mean
 * recorded seconds per test of the listed files that have a record.
 * @param {Map<string, number>} counts
 * @param {Record<string, number>} durations
 * @returns {Map<string, number>}
 */
export function fileWeights(counts, durations) {
  let knownSeconds = 0
  let knownTests = 0
  for (const [file, tests] of counts) {
    if (Object.hasOwn(durations, file)) {
      knownSeconds += durations[file]
      knownTests += tests
    }
  }
  const perTest = knownTests > 0 ? knownSeconds / knownTests : 1
  return new Map(
    [...counts].map(([file, tests]) => [
      file,
      Object.hasOwn(durations, file) ? durations[file] : tests * perTest,
    ]),
  )
}

/**
 * Longest-first greedy split into n shards; ties go to the lower shard index
 * and files of equal weight are taken by name, so every caller gets the
 * same split.
 * @param {Map<string, number>} weights
 * @param {number} n
 * @returns {string[][]}
 */
export function assignShards(weights, n) {
  if (weights.size < n) {
    throw new Error(
      `${String(weights.size)} spec files for ${String(n)} shards`,
    )
  }
  const files = [...weights].sort(
    ([a, weightA], [b, weightB]) => weightB - weightA || a.localeCompare(b),
  )
  const loads = Array.from({ length: n }, () => 0)
  /** @type {string[][]} */
  const shards = Array.from({ length: n }, () => [])
  for (const [file, weight] of files) {
    const target = loads.indexOf(Math.min(...loads))
    loads[target] += weight
    shards[target].push(file)
  }
  return shards.map((shard) => shard.sort())
}

/**
 * Playwright CLI filter matching exactly one testDir-relative spec file
 * (filters are regexes tested against the absolute path).
 * @param {string} file
 */
export function fileFilter(file) {
  return `/e2e/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
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
    const counts = testsPerFile(readJson(option(rest, '--list')))
    const shard = assignShards(fileWeights(counts, durations), total)[index - 1]
    for (const file of shard) io.out(fileFilter(file))
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
    const seconds = secondsPerFile(readJson(option(rest, '--report')))
    writeFileSync(durationsPath, `${JSON.stringify(seconds, null, 2)}\n`)
    io.out(`wrote ${String(Object.keys(seconds).length)} files`)
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

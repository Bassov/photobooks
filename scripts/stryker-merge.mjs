#!/usr/bin/env node
/**
 * Merge the nightly shard reports (`<dir>/<artifact>/mutation.json`) into one
 * `reports/mutation/mutation.json`, print the full score and the worst files
 * as Markdown, and fail below `quality/gates.json` `stryker.thresholds.break`
 * (applied once here: shards run with `break: null`).
 * Usage: node scripts/stryker-merge.mjs <shards-dir> [out.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadGates } from '@albasov/ts-agent-rig/load-gates'
import { SHARDS } from './stryker-shards.mjs'

export const WORST_FILES_LIMIT = 20

/**
 * @typedef {{ status?: string }} Mutant
 * @typedef {Record<string, { mutants?: Mutant[] }>} FileMap
 * @typedef {{ files?: FileMap } & Record<string, unknown>} Report
 */

/**
 * @param {readonly Report[]} reports
 * @returns {{ report: Report, duplicates: string[] }}
 */
export function mergeReports(reports) {
  /** @type {FileMap} */
  const files = {}
  /** @type {string[]} */
  const duplicates = []
  for (const report of reports) {
    for (const [file, entry] of Object.entries(report.files ?? {})) {
      if (Object.hasOwn(files, file)) duplicates.push(file)
      files[file] = entry
    }
  }
  return { report: { ...reports[0], files }, duplicates: duplicates.sort() }
}

/**
 * Stryker's score: detected / (detected + survived + no coverage).
 * @param {readonly Mutant[]} mutants
 */
export function scoreOf(mutants) {
  let detected = 0
  let undetected = 0
  for (const { status } of mutants) {
    if (status === 'Killed' || status === 'Timeout') detected += 1
    else if (status === 'Survived' || status === 'NoCoverage') undetected += 1
  }
  const valid = detected + undetected
  return {
    detected,
    undetected,
    score: valid === 0 ? null : (detected / valid) * 100,
  }
}

/**
 * Files with scored mutants, lowest score first (most undetected on ties).
 * @param {FileMap} files
 * @param {number} limit
 */
export function worstFiles(files, limit) {
  return Object.entries(files)
    .map(([file, entry]) => ({ file, ...scoreOf(entry.mutants ?? []) }))
    .filter((row) => row.score !== null)
    .sort(
      (a, b) =>
        Number(a.score) - Number(b.score) ||
        b.undetected - a.undetected ||
        a.file.localeCompare(b.file),
    )
    .slice(0, limit)
}

/**
 * @param {{ files: FileMap, shards: number, expected: number, duplicates: string[], breakAt: number | null }} input
 * @returns {{ ok: boolean, markdown: string }}
 */
export function evaluateMerge({
  files,
  shards,
  expected,
  duplicates,
  breakAt,
}) {
  const all = Object.values(files).flatMap((entry) => entry.mutants ?? [])
  const { score } = scoreOf(all)
  /** @type {string[]} */
  const errors = []
  if (shards !== expected) {
    errors.push(
      `${String(shards)} of ${String(expected)} shard reports (a shard crashed or timed out)`,
    )
  }
  if (duplicates.length > 0) {
    errors.push(`files in more than one shard: ${duplicates.join(', ')}`)
  }
  const below = breakAt !== null && score !== null && score < breakAt
  if (below) {
    errors.push(
      `full score ${score.toFixed(2)} is below break ${String(breakAt)}`,
    )
  }
  const lines = [
    '## Full mutation score (merged shards)',
    '',
    `Score **${score === null ? 'n/a' : score.toFixed(2)}%** over ${String(Object.keys(files).length)} files, ${String(shards)}/${String(expected)} shards; break ${String(breakAt)}.`,
    '',
    ...errors.map((e) => `- **Fail:** ${e}`),
    ...(errors.length > 0 ? [''] : []),
    `### Worst ${String(WORST_FILES_LIMIT)} files`,
    '',
    '| File | Score | Detected | Undetected |',
    '| --- | --- | --- | --- |',
    ...worstFiles(files, WORST_FILES_LIMIT).map(
      (row) =>
        `| \`${row.file}\` | ${Number(row.score).toFixed(1)} | ${String(row.detected)} | ${String(row.undetected)} |`,
    ),
    '',
  ]
  return { ok: errors.length === 0, markdown: lines.join('\n') }
}

/**
 * @param {string} shardsDir
 * @param {string} outPath
 * @param {{ breakAt?: number | null, write?: (s: string) => void }} [opts]
 */
export function main(shardsDir, outPath, opts = {}) {
  const breakAt =
    opts.breakAt === undefined
      ? (loadGates().stryker.thresholds.break ?? null)
      : opts.breakAt
  const write = opts.write ?? ((s) => process.stdout.write(s))
  const reportPaths = fs.existsSync(shardsDir)
    ? fs
        .readdirSync(shardsDir)
        .sort()
        .map((name) => path.join(shardsDir, name, 'mutation.json'))
        .filter((p) => fs.existsSync(p))
    : []
  const reports = reportPaths.map(
    (p) => /** @type {Report} */ (JSON.parse(fs.readFileSync(p, 'utf8'))),
  )
  const { report, duplicates } = mergeReports(reports)
  const files = report.files ?? {}
  if (reports.length > 0) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(report))
  }
  const result = evaluateMerge({
    files,
    shards: reports.length,
    expected: SHARDS.length,
    duplicates,
    breakAt,
  })
  write(result.markdown)
  return result.ok ? 0 : 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main(
    process.argv[2] ?? 'reports/mutation/shards',
    process.argv[3] ?? 'reports/mutation/mutation.json',
  )
}

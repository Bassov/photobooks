#!/usr/bin/env node
import { spawnSync as nodeSpawnSync } from 'node:child_process'
import {
  existsSync as nodeExistsSync,
  mkdirSync as nodeMkdirSync,
  readFileSync as nodeReadFileSync,
  writeFileSync as nodeWriteFileSync,
} from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadGates } from './load-gates.mjs'
import { loadMutatePatterns } from './mutation-scope.mjs'
import {
  DIFF_CONFIG,
  MUTATE_FILES_LIST,
  MSG_SKIP_PRODUCTION,
  buildStrykerArgs,
  evaluateNoCoverageGate,
  mergeRangeMaps,
  mutateSpecPath,
  parseUnifiedDiffNewSideRanges,
  planDiffMutation,
  scoredRangesFromMutateSpecs,
  temporaryExcludePaths,
} from './stryker-diff-gate.mjs'
import { DEFAULT_MUTATION_REPORT } from './stryker-pr-summary.mjs'

/**
 * @typedef {{
 *   spawnSync?: typeof nodeSpawnSync,
 *   existsSync?: typeof nodeExistsSync,
 *   mkdirSync?: typeof nodeMkdirSync,
 *   readFileSync?: typeof nodeReadFileSync,
 *   writeFileSync?: typeof nodeWriteFileSync,
 *   loadMutatePatterns?: typeof loadMutatePatterns,
 *   loadGates?: typeof loadGates,
 *   exit?: (code: number) => void,
 * }} StrykerDiffIo
 */

/**
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 * @param {string} cwd
 * @param {StrykerDiffIo} io
 */
function gitStdout(args, env, cwd, io) {
  const spawn = io.spawnSync ?? nodeSpawnSync
  const result = spawn('git', args, { encoding: 'utf8', env, cwd })
  if (result.status !== 0) {
    const detail =
      typeof result.stderr === 'string' && result.stderr.length > 0
        ? result.stderr
        : `git ${args.join(' ')} failed`
    console.error(detail)
    const exit = io.exit ?? ((code) => process.exit(code))
    exit(result.status ?? 1)
    throw new Error(detail)
  }
  return typeof result.stdout === 'string' ? result.stdout : ''
}

/**
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 * @param {string} cwd
 * @param {StrykerDiffIo} io
 */
function gitLines(args, env, cwd, io) {
  return gitStdout(args, env, cwd, io)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Count logical lines in a text file (trailing newline does not add a line).
 * @param {string} text
 */
export function countFileLines(text) {
  if (text === '') return 0
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text
  if (trimmed.length === 0) return 0
  return trimmed.split('\n').length
}

/**
 * New-side line ranges for ACMR changes vs base, plus whole-file for untracked.
 * @param {string} base
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [cwd]
 * @param {StrykerDiffIo} [io]
 * @returns {{ changed: string[], rangesByFile: Map<string, import('./stryker-diff-gate.mjs').LineRange[]> }}
 */
export function collectChangedLineRanges(
  base,
  env = process.env,
  cwd = process.cwd(),
  io = {},
) {
  const exists = io.existsSync ?? nodeExistsSync
  const read = io.readFileSync ?? nodeReadFileSync
  const changed = [
    ...gitLines(
      ['diff', '--name-only', '--diff-filter=ACMR', base],
      env,
      cwd,
      io,
    ),
    ...gitLines(
      ['diff', '--name-only', '--diff-filter=ACMR', '--cached', base],
      env,
      cwd,
      io,
    ),
    ...gitLines(['ls-files', '--others', '--exclude-standard'], env, cwd, io),
  ]
  const changedSet = [...new Set(changed)]

  const worktreeDiff = gitStdout(
    ['diff', '-U0', '--diff-filter=ACMR', base],
    env,
    cwd,
    io,
  )
  const cachedDiff = gitStdout(
    ['diff', '-U0', '--diff-filter=ACMR', '--cached', base],
    env,
    cwd,
    io,
  )
  let rangesByFile = mergeRangeMaps(
    parseUnifiedDiffNewSideRanges(worktreeDiff),
    parseUnifiedDiffNewSideRanges(cachedDiff),
  )

  const untracked = gitLines(
    ['ls-files', '--others', '--exclude-standard'],
    env,
    cwd,
    io,
  )
  for (const file of untracked) {
    const full = path.join(cwd, file)
    if (!exists(full)) continue
    const lines = countFileLines(String(read(full, 'utf8')))
    if (lines <= 0) continue
    rangesByFile = mergeRangeMaps(
      rangesByFile,
      new Map([[file, [{ start: 1, end: lines }]]]),
    )
  }

  return { changed: changedSet, rangesByFile }
}

/**
 * @param {string[]} [argv]
 * @param {NodeJS.ProcessEnv} [env]
 * @param {StrykerDiffIo} [io]
 */
export function runStrykerDiff(
  argv = process.argv.slice(2),
  env = process.env,
  io = {},
) {
  void argv
  const spawn = io.spawnSync ?? nodeSpawnSync
  const exists = io.existsSync ?? nodeExistsSync
  const mkdir = io.mkdirSync ?? nodeMkdirSync
  const read = io.readFileSync ?? nodeReadFileSync
  const write = io.writeFileSync ?? nodeWriteFileSync
  const patternsFn = io.loadMutatePatterns ?? loadMutatePatterns
  const gatesFn = io.loadGates ?? loadGates

  const base = env.STRYKER_DIFF_BASE ?? 'origin/main'
  const { changed: changedSet, rangesByFile } = collectChangedLineRanges(
    base,
    env,
    process.cwd(),
    io,
  )
  const patterns = patternsFn()
  const gates = gatesFn()
  const tempList = gates.mutation?.temporaryExcludes
  const tempPaths = temporaryExcludePaths(
    Array.isArray(tempList) ? tempList : [],
  )
  const plan = planDiffMutation(changedSet, patterns, tempPaths, rangesByFile)
  if (plan.errors.length > 0) {
    for (const err of plan.errors) console.error(err)
    return 1
  }
  if (plan.skip) {
    console.log(`No scored changed-line ranges vs ${base}; skipping Stryker.`)
    return 0
  }

  const existingSpecs = plan.mutateSpecs.filter((spec) =>
    exists(mutateSpecPath(spec)),
  )
  if (existingSpecs.length === 0) {
    console.error(
      `${MSG_SKIP_PRODUCTION}mutate paths missing on disk: ${plan.mutateFiles.join(', ')}`,
    )
    return 1
  }

  console.log(
    `Stryker mutate scored ranges (${String(existingSpecs.length)}):\n${existingSpecs.join('\n')}`,
  )

  mkdir(path.dirname(MUTATE_FILES_LIST), { recursive: true })
  write(MUTATE_FILES_LIST, `${existingSpecs.join('\n')}\n`, 'utf8')

  const result = spawn(
    'pnpm',
    [
      'exec',
      'stryker',
      'run',
      ...buildStrykerArgs(existingSpecs, plan.allowEmpty),
    ],
    { stdio: 'inherit' },
  )
  if ((result.status ?? 1) !== 0) return result.status ?? 1

  const reportPath = env.STRYKER_DIFF_REPORT ?? DEFAULT_MUTATION_REPORT
  if (!exists(reportPath)) {
    console.error(`No mutation report at ${reportPath}`)
    return 1
  }
  const report = JSON.parse(String(read(reportPath, 'utf8')))
  const scored = scoredRangesFromMutateSpecs(existingSpecs)
  const gate = evaluateNoCoverageGate(report.files ?? {}, scored)
  if (!gate.ok) {
    console.error(gate.error)
    return 1
  }
  return 0
}

export { DIFF_CONFIG, MUTATE_FILES_LIST }

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(runStrykerDiff())
}

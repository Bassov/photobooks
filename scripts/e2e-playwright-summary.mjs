#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

/**
 * Count tests that passed only after a prior failed attempt (retried pass).
 * @param {unknown} report Playwright JSON report
 */
export function countFlakyRetriedPasses(report) {
  let flaky = 0
  const suites = Array.isArray(report?.suites) ? report.suites : []
  const walk = (suite) => {
    for (const child of suite.suites ?? []) walk(child)
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = Array.isArray(test.results) ? test.results : []
        if (results.length < 2) continue
        const last = results.at(-1)
        const earlierFailed = results
          .slice(0, -1)
          .some(
            (result) =>
              result.status === 'failed' || result.status === 'timedOut',
          )
        if (earlierFailed && last?.status === 'passed') flaky += 1
      }
    }
  }
  for (const suite of suites) walk(suite)
  return flaky
}

/**
 * @param {{ burnInCount: number | null, flakyCount: number }} metrics
 */
export function formatE2eSectionMarkdown({ burnInCount, flakyCount }) {
  const lines = [
    '## E2E',
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Flaky (retried pass) | ${String(flakyCount)} |`,
  ]
  if (burnInCount !== null && burnInCount !== undefined) {
    lines.push(`| Burn-in | ${String(burnInCount)} |`)
  }
  return `${lines.join('\n')}\n`
}

export function loadPlaywrightJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * Drive a runner under burn-in policy. Used in tests with a stub command.
 * @param {{ command: string, args: string[], env?: NodeJS.ProcessEnv, spawn?: typeof spawnSync }} opts
 */
export function runBurnInInvocation(opts) {
  const spawn = opts.spawn ?? spawnSync
  const result = spawn(opts.command, opts.args, {
    encoding: 'utf8',
    env: opts.env ?? process.env,
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

/**
 * Stub intermittent runner: fails on odd attempt index, passes on even.
 * Exits non-zero if any attempt fails (burn-in / retries=0 semantics).
 */
export function intermittentPassRunner({ attempt, total }) {
  const index = Number(attempt)
  const failed = index % 2 === 1
  return { ok: !failed, attempt: index, total: Number(total) }
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      args._.push(token)
      continue
    }
    const key = token.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }
    args[key] = next
    index += 1
  }
  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args._[0] === 'intermittent') {
    const attempt = Number(args.attempt ?? 1)
    const total = Number(args.total ?? 10)
    const result = intermittentPassRunner({ attempt, total })
    if (!result.ok) {
      console.error(`intermittent fail attempt ${attempt}/${total}`)
      process.exit(1)
    }
    console.log(`intermittent pass attempt ${attempt}/${total}`)
    process.exit(0)
  }

  if (args._[0] === 'burn-in-harness') {
    const repeats = Number(args['repeat-each'] ?? 10)
    const retries = Number(args.retries ?? 0)
    if (retries !== 0) {
      console.error('burn-in harness requires --retries=0')
      process.exit(2)
    }
    for (let attempt = 1; attempt <= repeats; attempt += 1) {
      const run = runBurnInInvocation({
        command: process.execPath,
        args: [
          fileURLToPath(import.meta.url),
          'intermittent',
          '--attempt',
          String(attempt),
          '--total',
          String(repeats),
        ],
      })
      if (run.status !== 0) {
        process.exit(run.status)
      }
    }
    process.exit(0)
  }

  const reportPath = args.report
  if (!reportPath || !existsSync(reportPath)) {
    throw new Error(
      'Usage: e2e-playwright-summary.mjs --report <json> [--burn-in N] [--out file]',
    )
  }
  const burnInRaw = args['burn-in']
  const burnInCount =
    burnInRaw === undefined || burnInRaw === '' || burnInRaw === true
      ? null
      : Number(burnInRaw)
  const flakyCount = countFlakyRetriedPasses(loadPlaywrightJson(reportPath))
  const body = formatE2eSectionMarkdown({ burnInCount, flakyCount })
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true })
    writeFileSync(args.out, body)
  } else {
    process.stdout.write(body)
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

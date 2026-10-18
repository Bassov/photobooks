// Unified deterministic check entry: fail-all + compact default output.
// Entry: `pnpm check` (`node scripts/check.mjs`). Zero deps, Node 22, ESM.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DEFAULT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const LOG_DIR = '.cache/checks'
const PROBLEM_CAP = 20

const CORE_CHECKS = [
  { name: 'typecheck', argv: ['pnpm', 'typecheck'] },
  { name: 'lint', argv: ['pnpm', 'lint'] },
  { name: 'deps', argv: ['pnpm', 'deps'] },
  { name: 'knip', argv: ['pnpm', 'knip'] },
  { name: 'mutation-scope', argv: ['pnpm', 'mutation-scope'] },
  { name: 'git-test-isolation', argv: ['pnpm', 'git-test-isolation'] },
  { name: 'roadmap', argv: ['pnpm', '-s', 'roadmap', 'check'] },
  { name: 'unit', argv: ['pnpm', 'test:quiet'] },
]

const OPTIONAL_SCRIPTS = [
  { name: 'diff-size', rel: 'scripts/check-diff-size.mjs' },
  { name: 'pr-body', rel: 'scripts/check-pr-body.mjs' },
  { name: 'pr-policy', rel: 'scripts/check-pr-policy.mjs' },
]

/**
 * @param {string} root
 * @param {{ existsSync?: (p: string) => boolean }} [io]
 */
export function buildInventory(root, io = {}) {
  const exists = io.existsSync ?? fs.existsSync
  const list = CORE_CHECKS.map((c) => ({ ...c }))
  for (const opt of OPTIONAL_SCRIPTS) {
    const abs = path.join(root, opt.rel)
    if (exists(abs)) {
      list.push({ name: opt.name, argv: [process.execPath, abs] })
    }
  }
  return list
}

/** Extract problem-ish lines from tool output for compact failure reports. */
export function extractProblemLines(text, checkName) {
  const lines = String(text ?? '')
    .split('\n')
    .map((l) => l.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '').trimEnd())
    .filter((l) => l.trim().length > 0)
  const preferred = lines.filter(
    (l) =>
      /(?:error|fail|✖|×|ERR!|\berror\b)/i.test(l) ||
      /:\d+(?::\d+)?\b/.test(l) ||
      /\berror TS\d+/i.test(l),
  )
  const picked = preferred.length ? preferred : lines
  return picked.map((l) => `${checkName}: ${l.trim()}`)
}

/**
 * @param {{
 *   name: string
 *   ok: boolean
 *   ms: number
 *   problems: string[]
 *   logPath: string
 *   code: number
 * }} result
 * @param {{ verbose?: boolean, problemCap?: number }} [opts]
 */
export function formatCheckResult(result, opts = {}) {
  const cap = opts.problemCap ?? PROBLEM_CAP
  if (result.ok) {
    const n = result.problems.length
    const sec = (result.ms / 1000).toFixed(1)
    return `OK ${result.name} (${n}, ${sec}s)`
  }
  const problems = result.problems
  const shown = problems.slice(0, cap)
  const lines = [...shown]
  if (problems.length > cap) {
    lines.push(`… +${problems.length - cap} more, full log: ${result.logPath}`)
  } else if (result.logPath) {
    lines.push(`full log: ${result.logPath}`)
  }
  return lines.join('\n')
}

/**
 * @param {string[]} argv
 * @param {{
 *   cwd: string
 *   env?: NodeJS.ProcessEnv
 *   spawnImpl?: typeof spawn
 * }} opts
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function runChild(argv, opts) {
  const spawnImpl = opts.spawnImpl ?? spawn
  const [file, ...args] = argv
  return new Promise((resolve) => {
    const child = spawnImpl(file, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (err) => {
      resolve({
        code: 1,
        stdout,
        stderr: `${stderr}\n${err.message}`.trim(),
      })
    })
    child.on('close', (code) => {
      resolve({
        code: code === null || code === undefined ? 1 : code,
        stdout,
        stderr,
      })
    })
  })
}

/**
 * @param {{
 *   root?: string
 *   verbose?: boolean
 *   skipUnit?: boolean
 *   env?: NodeJS.ProcessEnv
 *   spawnImpl?: typeof spawn
 *   existsSync?: (p: string) => boolean
 *   mkdirSync?: typeof fs.mkdirSync
 *   writeFileSync?: typeof fs.writeFileSync
 *   now?: () => number
 *   write?: (text: string) => void
 *   inventory?: ReturnType<typeof buildInventory>
 * }} [opts]
 */
export async function runChecks(opts = {}) {
  const root = opts.root ?? ROOT_DEFAULT
  const verbose = Boolean(opts.verbose)
  const write = opts.write ?? ((t) => process.stdout.write(t))
  const now = opts.now ?? (() => Date.now())
  const mkdirSync = opts.mkdirSync ?? fs.mkdirSync
  const writeFileSync = opts.writeFileSync ?? fs.writeFileSync
  const logDir = path.join(root, LOG_DIR)
  mkdirSync(logDir, { recursive: true })

  let inventory = opts.inventory ?? buildInventory(root, opts)
  if (opts.skipUnit) {
    inventory = inventory.filter((c) => c.name !== 'unit')
  }

  const results = await Promise.all(
    inventory.map(async (check) => {
      const started = now()
      const child = await runChild(check.argv, {
        cwd: root,
        env: opts.env,
        spawnImpl: opts.spawnImpl,
      })
      const ms = Math.max(0, now() - started)
      const combined = `${child.stdout}\n${child.stderr}`
      const logPath = path.join(LOG_DIR, `${check.name}.log`)
      const absLog = path.join(root, logPath)
      writeFileSync(absLog, combined)
      const ok = child.code === 0
      const problems = ok ? [] : extractProblemLines(combined, check.name)
      const result = {
        name: check.name,
        ok,
        ms,
        problems,
        logPath,
        code: child.code,
        argv: check.argv,
      }
      if (verbose && combined.length > 0) {
        write(`--- ${check.name} ---\n${combined}`)
        if (!combined.endsWith('\n')) write('\n')
      }
      write(`${formatCheckResult(result)}\n`)
      return result
    }),
  )

  const failed = results.filter((r) => !r.ok)
  return {
    ok: failed.length === 0,
    results,
    failed,
  }
}

export async function main(argv = process.argv.slice(2), opts = {}) {
  const verbose = argv.includes('--verbose') || argv.includes('-v')
  const skipUnit = argv.includes('--skip-unit')
  const summary = await runChecks({
    ...opts,
    verbose,
    skipUnit,
  })
  return summary.ok ? 0 : 1
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirect) {
  main().then((code) => {
    process.exitCode = code
  })
}

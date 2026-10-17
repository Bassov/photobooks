#!/usr/bin/env node
// Agent pipeline CLI: composite preflight / finish / review-brief for /next-roadmap-item.
// Zero dependencies, Node 22, ESM. `pnpm agent help`.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export class AgentError extends Error {
  constructor(msg, code = 2) {
    super(msg)
    this.exitCode = code
  }
}
const fail = (m, code = 2) => {
  throw new AgentError(m, code)
}

const ANSI_RE = /\x1B\[[0-9;]*[A-Za-z]/g
export const stripAnsi = (s) => String(s ?? '').replace(ANSI_RE, '')

const BOOL = new Set(['json', 'quiet', 'help'])
const VALUE = new Set([
  'root',
  'change',
  'title',
  'body-file',
  'rules-json',
  'skip',
])

export function parseArgs(argv) {
  const o = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      o._.push(a)
      continue
    }
    let k = a.slice(2),
      v
    const eq = k.indexOf('=')
    if (eq >= 0) {
      v = k.slice(eq + 1)
      k = k.slice(0, eq)
    }
    if (BOOL.has(k)) {
      o[k] = true
      continue
    }
    if (!VALUE.has(k)) fail(`unknown option --${k}`)
    if (v === undefined) {
      v = argv[++i]
      if (v === undefined || v.startsWith('--'))
        fail(
          `--${k} needs a value (use --${k}=<value> for values starting with --)`,
        )
    }
    o[k] = v
  }
  return o
}

const HELP = `usage: pnpm agent <cmd> [--root <repo>] [--json] [--quiet]
  preflight [--skip a,b]     env + sync main + roadmap next + branch + compact report
  finish --title T --body-file F   verify:fast:quiet → push (≤2) → PR → CI summary
  review-brief [--change S] [--rules-json '[…]']   reviewer brief in one call
  help`

/** @typedef {{ code: number, stdout: string, stderr: string }} ExecResult */
/** @typedef {(file: string, args: string[], opts?: object) => ExecResult} ExecFn */

export function defaultExec(file, args, opts = {}) {
  try {
    const stdout = execFileSync(file, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    })
    return { code: 0, stdout: String(stdout ?? ''), stderr: '' }
  } catch (e) {
    return {
      code: typeof e.status === 'number' ? e.status : 1,
      stdout: String(e.stdout ?? ''),
      stderr: String(e.stderr ?? ''),
    }
  }
}

function wantQuiet(o, env) {
  return !!(o.quiet || env.CI)
}

function sh(exec, cwd, env, quiet, file, args, opts = {}) {
  const r = exec(file, args, { cwd, env, ...opts })
  if (quiet) {
    return {
      ...r,
      stdout: stripAnsi(r.stdout),
      stderr: stripAnsi(r.stderr),
    }
  }
  return r
}

function mustOk(r, label) {
  if (r.code !== 0)
    fail(
      `${label} failed (exit ${r.code}): ${stripAnsi(r.stderr || r.stdout)
        .trim()
        .slice(0, 500)}`,
      r.code || 1,
    )
  return r
}

function readNvmrcMajor(root) {
  const p = path.join(root, '.nvmrc')
  if (!fs.existsSync(p)) return null
  const v = fs.readFileSync(p, 'utf8').trim().replace(/^v/, '')
  const maj = Number.parseInt(v.split('.')[0] ?? '', 10)
  return Number.isFinite(maj) ? maj : null
}

function nodeMajor(exec, cwd, env, quiet) {
  const r = sh(exec, cwd, env, quiet, 'node', ['-v'])
  if (r.code !== 0) return null
  const m = /^v(\d+)/.exec(r.stdout.trim())
  return m ? Number(m[1]) : null
}

function assertEnv(exec, root, cwd, env, quiet) {
  const want = readNvmrcMajor(root)
  const got = nodeMajor(exec, cwd, env, quiet)
  if (want !== null && got !== want)
    fail(
      `node major is ${got ?? 'missing'}; need ${want} from .nvmrc (source scripts/agent-env.sh)`,
    )
  const pnpm = sh(exec, cwd, env, quiet, 'sh', [
    '-c',
    'command -v pnpm >/dev/null',
  ])
  if (pnpm.code !== 0)
    fail('pnpm not on PATH (source scripts/agent-env.sh once)')
  return { nodeMajor: got, nvmrcMajor: want }
}

function porcelain(exec, cwd, env, quiet) {
  return sh(exec, cwd, env, quiet, 'git', [
    'status',
    '--porcelain',
  ]).stdout.trim()
}

function collectSkipSlugs(exec, cwd, env, quiet, extra) {
  const fromExtra = (extra ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const pr = sh(exec, cwd, env, quiet, 'gh', [
    'pr',
    'list',
    '--state',
    'open',
    '--json',
    'headRefName',
    '-q',
    '.[].headRefName',
  ])
  const prSlugs =
    pr.code === 0
      ? pr.stdout
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((b) => b.replace(/^(feat|fix)\//, ''))
      : []
  const br = sh(exec, cwd, env, quiet, 'git', ['branch', '-r'])
  const remoteSlugs =
    br.code === 0
      ? br.stdout
          .split('\n')
          .map((l) => {
            const m = /origin\/(feat|fix)\/(\S+)/.exec(l.trim())
            return m ? m[2] : null
          })
          .filter(Boolean)
      : []
  return [...new Set([...fromExtra, ...prSlugs, ...remoteSlugs])]
}

function parseRoadmapNext(text) {
  try {
    return JSON.parse(text)
  } catch {
    const lines = text.split('\n')
    const get = (k) => {
      const line = lines.find((l) => l.startsWith(`${k}:`))
      return line ? line.slice(k.length + 1).trim() : null
    }
    const slug = get('slug')
    if (!slug) fail('roadmap next produced no slug')
    const bodyIdx = lines.indexOf('---')
    return {
      slug,
      tag: get('tag'),
      title: get('title'),
      file: get('file'),
      body: bodyIdx >= 0 ? lines.slice(bodyIdx + 1).join('\n') : undefined,
    }
  }
}

function parseInstructions(stdout) {
  try {
    const j = JSON.parse(stdout)
    return { template: j.template ?? null, rules: j.rules ?? null }
  } catch {
    return { template: null, rules: null }
  }
}

function parseTouchSetPaths(designText) {
  const paths = []
  for (const line of designText.split('\n')) {
    const m = /^\|\s*`([^`]+)`\s*\|/.exec(line)
    if (m && !m[1].includes('…') && m[1] !== 'File') paths.push(m[1])
  }
  return paths
}

function slugFromBranch(name) {
  const m = /^(?:feat|fix)\/(.+)$/.exec(name)
  return m ? m[1] : name
}

export function cmdPreflight(o, deps) {
  const { root, cwd, env, exec, quiet } = deps
  const envInfo = assertEnv(exec, root, cwd, env, quiet)
  const dirty = porcelain(exec, cwd, env, quiet)
  if (dirty) fail(`working tree not clean:\n${dirty}`)

  mustOk(sh(exec, cwd, env, quiet, 'git', ['fetch', 'origin']), 'git fetch')
  mustOk(
    sh(exec, cwd, env, quiet, 'git', ['switch', 'main']),
    'git switch main',
  )
  mustOk(
    sh(exec, cwd, env, quiet, 'git', ['pull', '--ff-only']),
    'git pull --ff-only',
  )

  const skips = collectSkipSlugs(exec, cwd, env, quiet, o.skip)
  const nextArgs = ['-s', 'roadmap', 'next', '--json']
  if (skips.length) nextArgs.push('--skip', skips.join(','))
  const nextR = mustOk(
    sh(exec, cwd, env, quiet, 'pnpm', nextArgs),
    'roadmap next',
  )
  const item = parseRoadmapNext(nextR.stdout)
  // bug items use fix/; prep/feature use feat/
  const branchPrefix =
    /\bbug\b/i.test(item.title ?? '') || item.tag === 'fix' ? 'fix' : 'feat'
  const branch = `${branchPrefix}/${item.slug}`
  const sw = sh(exec, cwd, env, quiet, 'git', ['switch', '-c', branch])
  if (sw.code !== 0) {
    // branch may already exist
    mustOk(
      sh(exec, cwd, env, quiet, 'git', ['switch', branch]),
      `git switch ${branch}`,
    )
  }

  const changeDir = path.join(root, 'openspec', 'changes', item.slug)
  if (!fs.existsSync(changeDir)) {
    mustOk(
      sh(exec, cwd, env, quiet, 'openspec', ['new', 'change', item.slug]),
      'openspec new change',
    )
  }

  const instr = sh(exec, cwd, env, quiet, 'openspec', [
    'instructions',
    'proposal',
    '--change',
    item.slug,
    '--json',
  ])
  const { template, rules } =
    instr.code === 0
      ? parseInstructions(instr.stdout)
      : { template: null, rules: null }

  const designPath = path.join('openspec', 'changes', item.slug, 'design.md')
  const touchSet = fs.existsSync(path.join(root, designPath))
    ? designPath
    : 'TBD until design.md'

  return {
    ok: true,
    env: envInfo,
    skips,
    branch,
    item: {
      slug: item.slug,
      tag: item.tag ?? null,
      title: item.title ?? null,
      file: item.file ?? null,
    },
    instructions: { template, rules },
    touchSet,
  }
}

export function cmdFinish(o, deps) {
  const { root, cwd, env, exec, quiet } = deps
  assertEnv(exec, root, cwd, env, quiet)
  const dirty = porcelain(exec, cwd, env, quiet)
  if (dirty) fail(`working tree not clean (commit first):\n${dirty}`, 1)

  mustOk(
    sh(exec, cwd, env, quiet, 'pnpm', ['verify:fast:quiet']),
    'verify:fast:quiet',
  )

  let pushAttempts = 0
  let pushOk = false
  let lastPush = null
  while (pushAttempts < 2 && !pushOk) {
    pushAttempts++
    lastPush = sh(exec, cwd, env, quiet, 'git', [
      'push',
      '-q',
      '-u',
      'origin',
      'HEAD',
    ])
    if (lastPush.code === 0) pushOk = true
  }
  if (!pushOk) {
    return {
      ok: false,
      stage: 'push',
      pushAttempts,
      summary: stripAnsi(lastPush?.stderr || lastPush?.stdout || '')
        .trim()
        .slice(0, 800),
    }
  }

  const branchR = mustOk(
    sh(exec, cwd, env, quiet, 'git', ['branch', '--show-current']),
    'git branch',
  )
  const branch = branchR.stdout.trim()

  const existing = sh(exec, cwd, env, quiet, 'gh', [
    'pr',
    'list',
    '--head',
    branch,
    '--json',
    'number,url',
    '-q',
    '.[0]',
  ])
  let prUrl = null
  let prNumber = null
  let created = false
  if (
    existing.code === 0 &&
    existing.stdout.trim() &&
    existing.stdout.trim() !== 'null'
  ) {
    try {
      const j = JSON.parse(existing.stdout)
      prNumber = j.number ?? null
      prUrl = j.url ?? null
    } catch {
      /* ignore */
    }
  }

  if (!prNumber) {
    if (!o.title) fail('finish create needs --title')
    if (!o['body-file']) fail('finish create needs --body-file')
    const bodyPath = path.resolve(cwd, o['body-file'])
    if (!fs.existsSync(bodyPath)) fail(`body file missing: ${bodyPath}`)
    const createdPr = mustOk(
      sh(exec, cwd, env, quiet, 'gh', [
        'pr',
        'create',
        '--title',
        o.title,
        '--body-file',
        bodyPath,
      ]),
      'gh pr create',
    )
    prUrl = createdPr.stdout.trim()
    created = true
  }

  sh(exec, cwd, env, quiet, 'gh', [
    'pr',
    'checks',
    '--watch',
    '--fail-fast',
    '--interval',
    '30',
  ])
  const checks = sh(exec, cwd, env, quiet, 'gh', [
    'pr',
    'checks',
    '--json',
    'name,bucket',
  ])
  let checkRows = []
  if (checks.code === 0) {
    try {
      checkRows = JSON.parse(checks.stdout)
    } catch {
      checkRows = []
    }
  }
  const failed = checkRows.filter(
    (c) => c.bucket === 'fail' || c.bucket === 'pending',
  )
  const lines = checkRows.map((c) => `${c.name}: ${c.bucket}`)
  let logTail = null
  if (failed.some((c) => c.bucket === 'fail')) {
    const view = sh(exec, cwd, env, quiet, 'gh', [
      'run',
      'view',
      '--log-failed',
    ])
    logTail = stripAnsi(view.stdout || view.stderr)
      .trim()
      .split('\n')
      .slice(-80)
      .join('\n')
  }
  const ok = checkRows.length > 0 && checkRows.every((c) => c.bucket === 'pass')
  return {
    ok,
    stage: 'ci',
    pushAttempts,
    branch,
    prUrl,
    created,
    checks: lines,
    logTail,
  }
}

export function cmdReviewBrief(o, deps) {
  const { root, cwd, env, exec, quiet } = deps
  let slug = o.change
  if (!slug) {
    const br = mustOk(
      sh(exec, cwd, env, quiet, 'git', ['branch', '--show-current']),
      'git branch',
    )
    slug = slugFromBranch(br.stdout.trim())
  }
  const changePath = path.join('openspec', 'changes', slug)
  let rules = []
  if (o['rules-json']) {
    try {
      rules = JSON.parse(o['rules-json'])
    } catch {
      fail('--rules-json must be valid JSON')
    }
  }
  const stat = sh(exec, cwd, env, quiet, 'git', ['diff', '--stat'])
  const designAbs = path.join(root, changePath, 'design.md')
  let touchPaths = []
  let touchNote = null
  if (fs.existsSync(designAbs)) {
    touchPaths = parseTouchSetPaths(fs.readFileSync(designAbs, 'utf8'))
  } else {
    touchNote = 'design.md missing; showing full working-tree diff'
  }
  const diffArgs = ['diff', '--']
  if (touchPaths.length) diffArgs.push(...touchPaths)
  const diff = sh(exec, cwd, env, quiet, 'git', diffArgs)
  return {
    slug,
    changePath,
    rules,
    rulesNote: rules.length
      ? null
      : 'pass --rules-json from openspec instructions',
    diffStat: stripAnsi(stat.stdout).trim(),
    touchSetPaths: touchPaths,
    touchNote,
    touchDiff: stripAnsi(diff.stdout).trim(),
  }
}

function fmtPreflight(r) {
  return [
    `ok: ${r.ok}`,
    `branch: ${r.branch}`,
    `slug: ${r.item.slug}`,
    `tag: ${r.item.tag ?? 'none'}`,
    `title: ${r.item.title ?? ''}`,
    `file: ${r.item.file ?? ''}`,
    `skips: ${r.skips.join(',') || '(none)'}`,
    `touchSet: ${r.touchSet}`,
    `rules: ${Array.isArray(r.instructions.rules) ? r.instructions.rules.length : 0} entries`,
    r.instructions.template
      ? `template: ${(r.instructions.template.split('\n')[0] ?? '').slice(0, 80)}`
      : 'template: (none)',
  ].join('\n')
}

function fmtFinish(r) {
  const lines = [
    `ok: ${r.ok}`,
    `stage: ${r.stage}`,
    `pushAttempts: ${r.pushAttempts}`,
  ]
  if (r.branch) lines.push(`branch: ${r.branch}`)
  if (r.prUrl) lines.push(`pr: ${r.prUrl}`)
  if (r.checks?.length) lines.push(...r.checks)
  if (r.summary) lines.push(`summary: ${r.summary}`)
  if (r.logTail) lines.push('--- log-failed (tail) ---', r.logTail)
  return lines.join('\n')
}

function fmtBrief(r) {
  return [
    `slug: ${r.slug}`,
    `changePath: ${r.changePath}`,
    `rules: ${JSON.stringify(r.rules)}`,
    r.rulesNote ? `rulesNote: ${r.rulesNote}` : null,
    '--- diff --stat ---',
    r.diffStat || '(empty)',
    r.touchNote ? `touchNote: ${r.touchNote}` : null,
    r.touchSetPaths.length ? `touchSet: ${r.touchSetPaths.join(', ')}` : null,
    '--- touch-set diff ---',
    r.touchDiff || '(empty)',
  ]
    .filter((x) => x !== null)
    .join('\n')
}

export function run(argv, deps = {}) {
  const cwd = deps.cwd ?? process.cwd()
  const env = deps.env ?? process.env
  const exec = deps.exec ?? defaultExec
  let o
  try {
    o = parseArgs(argv)
    const quiet = wantQuiet(o, env)
    const [cmd] = o._
    if (!cmd || cmd === 'help' || o.help)
      return { code: cmd || o.help ? 0 : 2, out: HELP }
    if (o._.length > 1) fail(`unexpected argument: ${o._[1]}`)
    const root = path.resolve(cwd, o.root ?? '.')
    const d = { root, cwd, env, exec, quiet }
    let r
    let code = 0
    switch (cmd) {
      case 'preflight':
        r = cmdPreflight(o, d)
        break
      case 'finish':
        r = cmdFinish(o, d)
        code = r.ok ? 0 : 1
        break
      case 'review-brief':
        r = cmdReviewBrief(o, d)
        break
      default:
        fail(`unknown command: ${cmd}\n${HELP}`)
    }
    const out = o.json
      ? JSON.stringify(r)
      : cmd === 'preflight'
        ? fmtPreflight(r)
        : cmd === 'finish'
          ? fmtFinish(r)
          : fmtBrief(r)
    return { code, out }
  } catch (e) {
    if (!(e instanceof AgentError)) throw e
    return {
      code: e.exitCode,
      err: o?.json
        ? JSON.stringify({ error: e.message })
        : `error: ${e.message}`,
    }
  }
}

export function main(argv, io) {
  const r = run(argv)
  if (r.out) io.stdout.write(r.out + '\n')
  if (r.err) io.stderr.write(r.err + '\n')
  io.exitCode = r.code
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main(process.argv.slice(2), process)

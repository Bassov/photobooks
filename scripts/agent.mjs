#!/usr/bin/env node
// Agent pipeline CLI: composite preflight / finish / review-brief for /next-roadmap-item.
// Zero dependencies, Node 22, ESM. POSIX/WSL (sh, bare pnpm/openspec on PATH). `pnpm agent help`.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Stryker disable StringLiteral,MethodExpression,ArrayDeclaration,Regex,OptionalChaining,BooleanLiteral,ArrowFunction,ObjectLiteral,ArithmeticOperator,BlockStatement,CallExpression,LogicalOperator,ConditionalExpression: CLI outcome-tested; EqualityOperator kept — see tasks.md

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

/** Last N non-empty-trimmed lines of combined streams (for failure reports). */
export function tailOutput(stdout, stderr, n = 60) {
  const combined = stripAnsi(`${stdout ?? ''}\n${stderr ?? ''}`.trim())
  if (!combined) return '(no output)'
  const lines = combined.split('\n')
  return lines.slice(-n).join('\n')
}

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
  finish --title T --body-file F   verify:fast:quiet → push (≤2/branch) → PR → CI summary
  review-brief [--change S] [--rules-json '[…]']   reviewer brief in one call
  help

Requires POSIX shell, Node matching .nvmrc, and pnpm/openspec/gh/git on PATH
(source scripts/agent-env.sh). Prefer --json for machine branching.`

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

export function mustOk(r, label) {
  if (r.code !== 0)
    fail(
      `${label} failed (exit ${r.code}):\n${tailOutput(r.stdout, r.stderr)}`,
      r.code || 1,
    )
  return r
}

export function readNvmrcMajor(root) {
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

export function branchPrefixForItem(item) {
  if (item.tag === 'fix' || /\bbug\b/i.test(item.title ?? '')) return 'fix'
  return 'feat'
}

export function isFeatureBranch(name) {
  return /^(feat|fix)\//.test(name)
}

export function collectSkipSlugs(exec, cwd, env, quiet, extra) {
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
  if (pr.code !== 0)
    fail(
      `gh pr list failed (cannot build skip-list):\n${tailOutput(pr.stdout, pr.stderr)}`,
      pr.code || 1,
    )
  const prSlugs = pr.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((b) => b.replace(/^(feat|fix)\//, ''))
  const br = sh(exec, cwd, env, quiet, 'git', ['branch', '-r'])
  if (br.code !== 0)
    fail(
      `git branch -r failed:\n${tailOutput(br.stdout, br.stderr)}`,
      br.code || 1,
    )
  const remoteSlugs = br.stdout
    .split('\n')
    .map((l) => {
      const m = /origin\/(feat|fix)\/(\S+)/.exec(l.trim())
      return m ? m[2] : null
    })
    .filter(Boolean)
  return [...new Set([...fromExtra, ...prSlugs, ...remoteSlugs])]
}

export function parseRoadmapNext(text) {
  try {
    const j = JSON.parse(text)
    if (!j?.slug) fail('roadmap next JSON missing slug')
    return j
  } catch (e) {
    if (e instanceof AgentError) throw e
    const lines = text.split('\n')
    const get = (k) => {
      const line = lines.find((l) => l.startsWith(`${k}:`))
      return line ? line.slice(k.length + 1).trim() : null
    }
    const goals = lines
      .filter((l) => l.startsWith('goal:'))
      .map((l) => l.slice(5).trim())
    const slug = get('slug')
    if (!slug) fail('roadmap next produced no slug')
    const bodyIdx = lines.indexOf('---')
    return {
      slug,
      tag: get('tag'),
      title: get('title'),
      file: get('file'),
      milestone: get('milestone'),
      goal: goals,
      body: bodyIdx >= 0 ? lines.slice(bodyIdx + 1).join('\n') : undefined,
    }
  }
}

export function parseInstructions(stdout) {
  const j = JSON.parse(stdout)
  return { template: j.template ?? null, rules: j.rules ?? null }
}

export function parseTouchSetPaths(designText) {
  const paths = []
  for (const line of designText.split('\n')) {
    const m = /^\|\s*`([^`]+)`\s*\|/.exec(line)
    if (m && !m[1].includes('…') && m[1] !== 'File') paths.push(m[1])
  }
  return paths
}

export function slugFromBranch(name) {
  const m = /^(?:feat|fix)\/(.+)$/.exec(name)
  return m ? m[1] : name
}

/** Extract GitHub Actions run id from a checks `link` URL when present. */
export function runIdFromCheckLink(link) {
  if (!link) return null
  const m = /\/actions\/runs\/(\d+)/.exec(link)
  return m ? m[1] : null
}

export function isFailingBucket(bucket) {
  return bucket === 'fail' || bucket === 'pending'
}

export function isPassingBucket(bucket) {
  return (
    bucket === 'pass' ||
    bucket === 'skipping' ||
    bucket === 'skip' ||
    bucket === 'neutral'
  )
}

const PUSH_FAIL_FILE = 'agent-finish-push-failures.json'

export function pushFailPath(root) {
  return path.join(root, '.git', PUSH_FAIL_FILE)
}

export function readPushFailures(root) {
  const p = pushFailPath(root)
  if (!fs.existsSync(p)) return {}
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

export function writePushFailures(root, map) {
  const gitDir = path.join(root, '.git')
  if (!fs.existsSync(gitDir)) fail(`.git missing under ${root}`)
  fs.writeFileSync(pushFailPath(root), JSON.stringify(map, null, 0) + '\n')
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
  const branch = `${branchPrefixForItem(item)}/${item.slug}`
  const sw = sh(exec, cwd, env, quiet, 'git', ['switch', '-c', branch])
  if (sw.code !== 0) {
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

  const instr = mustOk(
    sh(exec, cwd, env, quiet, 'openspec', [
      'instructions',
      'proposal',
      '--change',
      item.slug,
      '--json',
    ]),
    'openspec instructions',
  )
  let instructions
  try {
    instructions = parseInstructions(instr.stdout)
  } catch {
    fail(
      `openspec instructions returned invalid JSON:\n${tailOutput(instr.stdout, instr.stderr)}`,
    )
  }
  if (!Array.isArray(instructions.rules))
    fail('openspec instructions missing rules array')

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
      tag: item.tag,
      title: item.title,
      file: item.file,
      milestone: item.milestone,
      goal: item.goal || item.goals,
      body: item.body,
    },
    instructions,
    touchSet,
  }
}

export function assertFinishBranch(exec, cwd, env, quiet) {
  const branchR = mustOk(
    sh(exec, cwd, env, quiet, 'git', ['branch', '--show-current']),
    'git branch',
  )
  const branch = branchR.stdout.trim()
  if (!isFeatureBranch(branch))
    fail(
      `finish refuses branch "${branch}" (need feat/* or fix/* with commits ahead of origin/main)`,
      1,
    )
  const aheadR = mustOk(
    sh(exec, cwd, env, quiet, 'git', [
      'rev-list',
      '--count',
      'origin/main..HEAD',
    ]),
    'git rev-list',
  )
  const ahead = Number.parseInt(aheadR.stdout.trim(), 10)
  if (!Number.isFinite(ahead) || ahead < 1)
    fail(
      `finish refuses: no commits ahead of origin/main (ahead=${aheadR.stdout.trim() || '0'})`,
      1,
    )
  return { branch, ahead }
}

export function cmdFinish(o, deps) {
  const { root, cwd, env, exec, quiet } = deps
  assertEnv(exec, root, cwd, env, quiet)
  const dirty = porcelain(exec, cwd, env, quiet)
  if (dirty) fail(`working tree not clean (commit first):\n${dirty}`, 1)

  const { branch, ahead } = assertFinishBranch(exec, cwd, env, quiet)

  mustOk(
    sh(exec, cwd, env, quiet, 'pnpm', ['verify:fast:quiet']),
    'verify:fast:quiet',
  )

  const fails = readPushFailures(root)
  const prior = Number(fails[branch] ?? 0)
  if (prior >= 2) {
    return {
      ok: false,
      stage: 'push',
      pushAttempts: prior,
      branch,
      ahead,
      summary: `push budget exhausted for ${branch} (${prior} failed attempts recorded under .git/${PUSH_FAIL_FILE})`,
    }
  }

  // One push per finish invocation (S2); persist failures across calls.
  const lastPush = sh(exec, cwd, env, quiet, 'git', [
    'push',
    '-q',
    '-u',
    'origin',
    'HEAD',
  ])
  if (lastPush.code !== 0) {
    const next = prior + 1
    writePushFailures(root, { ...fails, [branch]: next })
    return {
      ok: false,
      stage: 'push',
      pushAttempts: next,
      branch,
      ahead,
      summary: tailOutput(lastPush.stdout, lastPush.stderr),
    }
  }
  if (fails[branch] !== undefined) {
    const rest = { ...fails }
    delete rest[branch]
    writePushFailures(root, rest)
  }

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
    'name,bucket,link',
  ])
  if (checks.code !== 0) {
    return {
      ok: false,
      stage: 'ci',
      pushAttempts: prior,
      branch,
      ahead,
      prUrl,
      created,
      checks: [],
      summary: `gh pr checks query failed:\n${tailOutput(checks.stdout, checks.stderr)}`,
      logTail: null,
    }
  }
  let checkRows = []
  try {
    checkRows = JSON.parse(checks.stdout)
    if (!Array.isArray(checkRows)) checkRows = []
  } catch {
    return {
      ok: false,
      stage: 'ci',
      pushAttempts: prior,
      branch,
      ahead,
      prUrl,
      created,
      checks: [],
      summary: `gh pr checks returned invalid JSON:\n${tailOutput(checks.stdout, checks.stderr)}`,
      logTail: null,
    }
  }
  const lines = checkRows.map((c) => `${c.name}: ${c.bucket}`)
  const failed = checkRows.filter((c) => isFailingBucket(c.bucket))
  let logTail = null
  const failedWithLink = failed.find(
    (c) => c.bucket === 'fail' && runIdFromCheckLink(c.link),
  )
  if (failedWithLink) {
    const runId = runIdFromCheckLink(failedWithLink.link)
    const view = sh(exec, cwd, env, quiet, 'gh', [
      'run',
      'view',
      runId,
      '--log-failed',
    ])
    logTail = tailOutput(view.stdout, view.stderr, 80)
  } else if (failed.some((c) => c.bucket === 'fail')) {
    logTail = 'failed check has no actions/runs link; cannot fetch --log-failed'
  }
  const ok =
    checkRows.length > 0 && checkRows.every((c) => isPassingBucket(c.bucket))
  return {
    ok,
    stage: 'ci',
    pushAttempts: prior,
    branch,
    ahead,
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
  const designAbs = path.join(root, changePath, 'design.md')
  let touchPaths = []
  let touchNote = null
  if (fs.existsSync(designAbs)) {
    touchPaths = parseTouchSetPaths(fs.readFileSync(designAbs, 'utf8'))
  } else {
    touchNote = 'design.md missing; treating all paths as outside touch-set'
  }

  const headStat = sh(exec, cwd, env, quiet, 'git', ['diff', 'HEAD', '--stat'])
  const headDiff = sh(exec, cwd, env, quiet, 'git', ['diff', 'HEAD'])
  const untrackedR = sh(exec, cwd, env, quiet, 'git', [
    'ls-files',
    '--others',
    '--exclude-standard',
  ])
  const untracked = untrackedR.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const touchSet = new Set(touchPaths)
  const changedTracked = []
  const nameOnly = sh(exec, cwd, env, quiet, 'git', [
    'diff',
    'HEAD',
    '--name-only',
  ])
  for (const f of nameOnly.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)) {
    changedTracked.push(f)
  }
  const allChanged = [...new Set([...changedTracked, ...untracked])]
  const inTouch = allChanged.filter((f) => touchSet.has(f))
  const outside = allChanged.filter((f) => !touchSet.has(f))

  const touchDiffParts = []
  if (touchPaths.length) {
    const td = sh(exec, cwd, env, quiet, 'git', [
      'diff',
      'HEAD',
      '--',
      ...touchPaths,
    ])
    const t = stripAnsi(td.stdout).trim()
    if (t) touchDiffParts.push(t)
  }
  for (const f of untracked) {
    if (!touchSet.has(f)) continue
    const d = sh(exec, cwd, env, quiet, 'git', [
      'diff',
      '--no-index',
      '--',
      '/dev/null',
      f,
    ])
    const body = stripAnsi(d.stdout || d.stderr).trim()
    if (body) touchDiffParts.push(body)
  }

  const outsideParts = []
  if (outside.length) {
    const trackedOutside = outside.filter((f) => !untracked.includes(f))
    if (trackedOutside.length) {
      const od = sh(exec, cwd, env, quiet, 'git', [
        'diff',
        'HEAD',
        '--',
        ...trackedOutside,
      ])
      const t = stripAnsi(od.stdout).trim()
      if (t) outsideParts.push(t)
    }
    for (const f of outside.filter((f) => untracked.includes(f))) {
      const d = sh(exec, cwd, env, quiet, 'git', [
        'diff',
        '--no-index',
        '--',
        '/dev/null',
        f,
      ])
      const body = stripAnsi(d.stdout || d.stderr).trim()
      if (body) outsideParts.push(body)
    }
  }

  const statBits = [
    stripAnsi(headStat.stdout).trim(),
    untracked.length
      ? `Untracked:\n${untracked.map((f) => `?? ${f}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    slug,
    changePath,
    rules,
    rulesNote: rules.length
      ? null
      : 'pass --rules-json from openspec instructions',
    diffStat: statBits || '(empty)',
    touchSetPaths: touchPaths,
    touchNote,
    inTouchSet: inTouch,
    outsideTouchSet: outside,
    touchDiff: touchDiffParts.join('\n\n') || '(empty)',
    outsideDiff: outsideParts.join('\n\n') || '(empty)',
    headDiff: stripAnsi(headDiff.stdout).trim(),
    untracked,
  }
}

function fmtPreflight(r) {
  const ruleList = Array.isArray(r.instructions.rules)
    ? r.instructions.rules
    : []
  const rules =
    ruleList.length === 0
      ? '  (none)'
      : ruleList.map((x, i) => `  ${i + 1}. ${x}`).join('\n')
  const goalLines = Array.isArray(r.item.goal)
    ? r.item.goal.map((g) => `goal: ${g}`)
    : [`goal: ${r.item.goal}`]
  return [
    `ok: ${r.ok}`,
    `branch: ${r.branch}`,
    `slug: ${r.item.slug}`,
    `tag: ${r.item.tag}`,
    `title: ${r.item.title}`,
    `file: ${r.item.file}`,
    `milestone: ${r.item.milestone}`,
    ...goalLines,
    `skips: ${r.skips.join(',')}`,
    `touchSet: ${r.touchSet}`,
    '--- rules ---',
    rules,
    '--- template ---',
    String(r.instructions.template),
    '--- body ---',
    String(r.item.body),
  ].join('\n')
}

function fmtFinish(r) {
  return [
    `ok: ${r.ok}`,
    `stage: ${r.stage}`,
    `pushAttempts: ${r.pushAttempts}`,
    `branch: ${r.branch}`,
    `ahead: ${r.ahead}`,
    `pr: ${r.prUrl}`,
    ...(r.checks || []),
    `summary: ${r.summary}`,
    '--- log-failed (tail) ---',
    String(r.logTail),
  ].join('\n')
}

function fmtBrief(r) {
  return [
    `slug: ${r.slug}`,
    `changePath: ${r.changePath}`,
    `rules: ${JSON.stringify(r.rules)}`,
    `rulesNote: ${r.rulesNote}`,
    '--- diff --stat ---',
    String(r.diffStat),
    `touchNote: ${r.touchNote}`,
    `touchSet: ${(r.touchSetPaths || []).join(', ')}`,
    `inTouchSet: ${(r.inTouchSet || []).join(', ')}`,
    '--- touch-set diff ---',
    String(r.touchDiff),
    '--- outsideTouchSet ---',
    (r.outsideTouchSet || []).join(', '),
    '--- outsideTouchSet diff ---',
    String(r.outsideDiff),
  ].join('\n')
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

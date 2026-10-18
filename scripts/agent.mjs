// Agent pipeline CLI library: composite preflight / finish / review-brief.
// Entry: scripts/agent-cli.mjs (`pnpm agent`). Zero deps, Node 22, ESM.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

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
  'slug',
  'base',
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
  preflight [--slug S] [--skip a,b]   env + roadmap next (+ branch from origin/main); --slug skips local main sync
  finish --title T --body-file F   verify:fast:quiet → push (≤2/branch) → PR (no CI watch)
  review-brief [--change S] [--base REF] [--rules-json '[…]']   reviewer brief in one call
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
    return { code: 0, stdout: String(stdout), stderr: '' }
  } catch (e) {
    const code = typeof e.status === 'number' ? e.status : 1
    const stdout = String(e.stdout ?? '')
    const stderr = String(e.stderr ?? '')
    if (!stdout && !stderr && e.message)
      return { code, stdout: '', stderr: String(e.message) }
    return { code, stdout, stderr }
  }
}

/** `git diff --no-index` exits 1 when files differ; treat 0/1 as success. */
export function mustOkDiffNoIndex(r, label) {
  if (r.code === 0 || r.code === 1) return r
  fail(
    `${label} failed (exit ${r.code}):\n${tailOutput(r.stdout, r.stderr)}`,
    r.code || 1,
  )
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
  const maj = Number.parseInt(v.split('.')[0], 10)
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

export function slugFromFeatFix(name) {
  const m = /^(?:feat|fix)\/(.+)$/.exec(String(name).trim())
  return m ? m[1] : null
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
  const local = sh(exec, cwd, env, quiet, 'git', [
    'branch',
    '--format=%(refname:short)',
  ])
  if (local.code !== 0)
    fail(
      `git branch failed:\n${tailOutput(local.stdout, local.stderr)}`,
      local.code || 1,
    )
  const localSlugs = local.stdout
    .split('\n')
    .map((l) => slugFromFeatFix(l))
    .filter(Boolean)
  const wt = sh(exec, cwd, env, quiet, 'git', [
    'worktree',
    'list',
    '--porcelain',
  ])
  if (wt.code !== 0)
    fail(
      `git worktree list failed:\n${tailOutput(wt.stdout, wt.stderr)}`,
      wt.code || 1,
    )
  const worktreeSlugs = []
  for (const line of wt.stdout.split('\n')) {
    const m = /^branch refs\/heads\/(.+)$/.exec(line.trim())
    if (!m) continue
    const s = slugFromFeatFix(m[1])
    if (s) worktreeSlugs.push(s)
  }
  return [
    ...new Set([
      ...fromExtra,
      ...prSlugs,
      ...remoteSlugs,
      ...localSlugs,
      ...worktreeSlugs,
    ]),
  ]
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

const PUSH_FAIL_FILE = 'agent-finish-push-failures.json'
const RUN_STARTED_FILE = 'agent-run-started.json'
const PR_BODY_METRICS_FILE = 'agent-pr-body-with-metrics.md'

/** Resolve a path inside the git dir (works when `.git` is a file / linked worktree). */
export function gitPath(root, relPath, exec = defaultExec) {
  const r = exec('git', ['rev-parse', '--git-path', relPath], {
    cwd: root,
    env: process.env,
  })
  if (r.code === 0) {
    const out = r.stdout.trim()
    return path.isAbsolute(out) ? out : path.resolve(root, out)
  }
  const fallbackDir = path.join(root, '.git')
  if (fs.existsSync(fallbackDir) && fs.statSync(fallbackDir).isDirectory())
    return path.join(fallbackDir, relPath)
  fail(
    `git rev-parse --git-path ${relPath} failed under ${root}:\n${tailOutput(r.stdout, r.stderr)}`,
  )
}

export function pushFailPath(root, exec = defaultExec) {
  return gitPath(root, PUSH_FAIL_FILE, exec)
}

export function readPushFailures(root, exec = defaultExec) {
  const p = pushFailPath(root, exec)
  if (!fs.existsSync(p)) return {}
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

export function writePushFailures(root, map, exec = defaultExec) {
  const p = pushFailPath(root, exec)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(map, null, 0) + '\n')
}

function resolveGitRelPath(root, relPath, exec = defaultExec) {
  try {
    return gitPath(root, relPath, exec)
  } catch {
    return path.join(root, '.git', relPath)
  }
}

export function writeRunStarted(
  root,
  startedAtMs = Date.now(),
  exec = defaultExec,
) {
  const p = resolveGitRelPath(root, RUN_STARTED_FILE, exec)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify({ startedAtMs }) + '\n')
  return p
}

export function readRunStartedMs(root, exec = defaultExec) {
  const p = resolveGitRelPath(root, RUN_STARTED_FILE, exec)
  if (!fs.existsSync(p)) return null
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'))
    return typeof j.startedAtMs === 'number' ? j.startedAtMs : null
  } catch {
    return null
  }
}

/**
 * Build a PR body with an auto-filled ## Metrics section.
 * @returns {{ bodyPath: string, wallTimeSec: number | null, tokens: string | null }}
 */
export function buildPrBodyWithMetrics(
  bodyPath,
  root,
  env = process.env,
  exec = defaultExec,
  nowMs = Date.now(),
) {
  const raw = fs.readFileSync(bodyPath, 'utf8')
  const startedAtMs = readRunStartedMs(root, exec)
  const wallTimeSec =
    startedAtMs == null
      ? null
      : Math.max(0, Math.round((nowMs - startedAtMs) / 1000))
  const tokensRaw = env.AGENT_TOKEN_USAGE
  const tokens =
    tokensRaw != null && String(tokensRaw).trim() !== ''
      ? String(tokensRaw).trim()
      : null
  const metricLines = ['## Metrics', '']
  metricLines.push(
    wallTimeSec == null
      ? '- wall_time_sec: unknown'
      : `- wall_time_sec: ${wallTimeSec}`,
  )
  if (tokens != null) metricLines.push(`- tokens: ${tokens}`)
  metricLines.push('')
  const block = `${metricLines.join('\n')}\n`
  let body
  if (/^## Metrics\b/m.test(raw)) {
    body = raw.replace(/^## Metrics\b[\s\S]*?(?=^## )/m, block)
    if (body === raw) {
      body = raw.replace(/^## Metrics\b[\s\S]*$/m, `${block.trimEnd()}\n`)
    }
  } else {
    body = `${raw.trimEnd()}\n\n${block}`
  }
  const out = resolveGitRelPath(root, PR_BODY_METRICS_FILE, exec)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, body)
  return { bodyPath: out, wallTimeSec, tokens }
}

/** Path of another worktree that has `branch` checked out, or null. */
export function branchHeldInOtherWorktree(exec, cwd, env, quiet, branch) {
  const wt = sh(exec, cwd, env, quiet, 'git', [
    'worktree',
    'list',
    '--porcelain',
  ])
  if (wt.code !== 0)
    fail(
      `git worktree list failed:\n${tailOutput(wt.stdout, wt.stderr)}`,
      wt.code || 1,
    )
  const cwdAbs = path.resolve(cwd)
  let blockPath = null
  let held = null
  for (const line of wt.stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      blockPath = line.slice('worktree '.length).trim()
      continue
    }
    const m = /^branch refs\/heads\/(.+)$/.exec(line.trim())
    if (m && m[1] === branch && blockPath) {
      if (path.resolve(blockPath) !== cwdAbs) held = blockPath
    }
  }
  return held
}

/**
 * Reuse an existing local branch only when it shares history with origin/main
 * and is not checked out elsewhere. Never reset or delete.
 */
function reuseExistingFeatureBranch(exec, cwd, env, quiet, branch, createFail) {
  const cur = sh(exec, cwd, env, quiet, 'git', ['branch', '--show-current'])
  if (cur.code === 0 && cur.stdout.trim() === branch) return

  const exists = sh(exec, cwd, env, quiet, 'git', [
    'show-ref',
    '--verify',
    '--quiet',
    `refs/heads/${branch}`,
  ])
  if (exists.code !== 0) {
    fail(
      `cannot create branch ${branch} and it does not exist locally:\n${tailOutput(createFail.stdout, createFail.stderr)}`,
      createFail.code || 1,
    )
  }

  const mb = sh(exec, cwd, env, quiet, 'git', [
    'merge-base',
    branch,
    'origin/main',
  ])
  if (mb.code !== 0) {
    fail(
      `local branch ${branch} does not share history with origin/main; refusing to switch (never reset/delete):\n${tailOutput(mb.stdout, mb.stderr)}\n${tailOutput(createFail.stdout, createFail.stderr)}`,
      mb.code || 1,
    )
  }

  const held = branchHeldInOtherWorktree(exec, cwd, env, quiet, branch)
  if (held) {
    fail(
      `branch ${branch} is checked out in another worktree (${held}); refusing to switch`,
      1,
    )
  }

  mustOk(
    sh(exec, cwd, env, quiet, 'git', ['switch', branch]),
    `git switch ${branch}`,
  )
}

export function switchFeatureBranch(
  exec,
  cwd,
  env,
  quiet,
  branch,
  fromOriginMain,
) {
  if (fromOriginMain) {
    const create = sh(exec, cwd, env, quiet, 'git', [
      'switch',
      '-c',
      branch,
      '--no-track',
      'origin/main',
    ])
    if (create.code === 0) return
    reuseExistingFeatureBranch(exec, cwd, env, quiet, branch, create)
    return
  }
  const sw = sh(exec, cwd, env, quiet, 'git', ['switch', '-c', branch])
  if (sw.code === 0) return
  reuseExistingFeatureBranch(exec, cwd, env, quiet, branch, sw)
}

export function cmdPreflight(o, deps) {
  const { root, cwd, env, exec, quiet } = deps
  const envInfo = assertEnv(exec, root, cwd, env, quiet)
  const dirty = porcelain(exec, cwd, env, quiet)
  if (dirty) fail(`working tree not clean:\n${dirty}`)

  mustOk(sh(exec, cwd, env, quiet, 'git', ['fetch', 'origin']), 'git fetch')
  const slugMode = Boolean(o.slug)
  if (!slugMode) {
    mustOk(
      sh(exec, cwd, env, quiet, 'git', ['switch', 'main']),
      'git switch main',
    )
    mustOk(
      sh(exec, cwd, env, quiet, 'git', ['pull', '--ff-only']),
      'git pull --ff-only',
    )
  }

  const skips = collectSkipSlugs(exec, cwd, env, quiet, o.skip)
  const nextArgs = ['-s', 'roadmap', 'next', '--json']
  if (slugMode) nextArgs.push('--slug', o.slug)
  else if (skips.length) nextArgs.push('--skip', skips.join(','))
  const nextR = mustOk(
    sh(exec, cwd, env, quiet, 'pnpm', nextArgs),
    'roadmap next',
  )
  const item = parseRoadmapNext(nextR.stdout)
  const branch = `${branchPrefixForItem(item)}/${item.slug}`
  switchFeatureBranch(exec, cwd, env, quiet, branch, slugMode)

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

  writeRunStarted(root, Date.now(), exec)

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

const TRIVIAL_MERGE_FILES = new Set(['docs/roadmap.md', 'pnpm-lock.yaml'])

function splitFileLines(text) {
  const lines = String(text).split('\n')
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function joinFileLines(lines) {
  return lines.length ? `${lines.join('\n')}\n` : ''
}

/** Insert segments between successive base lines; null if a base line was dropped. */
function insertSegments(side, base) {
  const segs = []
  let si = 0
  for (let bi = 0; bi < base.length; bi++) {
    const insert = []
    while (si < side.length && side[si] !== base[bi]) insert.push(side[si++])
    if (si >= side.length || side[si] !== base[bi]) return null
    segs.push(insert)
    si++
  }
  segs.push(side.slice(si))
  return segs
}

function unionInserts(oursIns, theirsIns) {
  const seen = new Set(oursIns)
  return [...oursIns, ...theirsIns.filter((l) => !seen.has(l))]
}

/**
 * Auto-resolve docs/roadmap.md only when both sides purely ADD distinct whole
 * lines relative to the merge base (parallel `roadmap add`).
 * @returns {string|null}
 */
export function resolvePureAddIndexConflict(baseText, oursText, theirsText) {
  const base = splitFileLines(baseText)
  const ours = splitFileLines(oursText)
  const theirs = splitFileLines(theirsText)
  const oSeg = insertSegments(ours, base)
  const tSeg = insertSegments(theirs, base)
  if (!oSeg || !tSeg) return null
  const out = []
  for (let i = 0; i < base.length; i++) {
    out.push(...unionInserts(oSeg[i], tSeg[i]))
    out.push(base[i])
  }
  out.push(...unionInserts(oSeg[base.length], tSeg[base.length]))
  return joinFileLines(out)
}

function readGitStages(root, rel, exec) {
  const stages = []
  for (const stage of [1, 2, 3]) {
    const r = exec('git', ['show', `:${stage}:${rel}`], {
      cwd: root,
      env: process.env,
    })
    if (r.code !== 0) return null
    stages.push(r.stdout)
  }
  return { base: stages[0], ours: stages[1], theirs: stages[2] }
}

/**
 * Auto-resolve only pure-add `docs/roadmap.md` conflicts and `pnpm-lock.yaml`
 * (via install later). Refuses item files, lessons, RULES, modified-line hunks,
 * and any package.json conflict. Leaves the merge in progress on failure.
 */
export function tryResolveTrivialConflicts(
  root,
  conflicted,
  exec = defaultExec,
) {
  const files = [...new Set(conflicted)]
  if (files.includes('package.json')) return false
  if (!files.every((f) => TRIVIAL_MERGE_FILES.has(f))) return false

  if (files.includes('docs/roadmap.md')) {
    const stages = readGitStages(root, 'docs/roadmap.md', exec)
    if (!stages) return false
    const resolved = resolvePureAddIndexConflict(
      stages.base,
      stages.ours,
      stages.theirs,
    )
    if (resolved === null) return false
    fs.writeFileSync(path.join(root, 'docs/roadmap.md'), resolved)
  }
  return true
}

function refuseMergeConflict(files) {
  fail(
    `cannot auto-resolve conflict with origin/main (files: ${files.join(', ') || 'unknown'}). Resolve per git-finish.mdc, then run finish again.`,
    1,
  )
}

export function mergeOriginMainIfNeeded(exec, root, cwd, env, quiet) {
  mustOk(sh(exec, cwd, env, quiet, 'git', ['fetch', 'origin']), 'git fetch')
  const anc = sh(exec, cwd, env, quiet, 'git', [
    'merge-base',
    '--is-ancestor',
    'origin/main',
    'HEAD',
  ])
  if (anc.code === 0) return { merged: false }
  const merge = sh(exec, cwd, env, quiet, 'git', ['merge', 'origin/main'])
  if (merge.code === 0) return { merged: true }
  const unmerged = sh(exec, cwd, env, quiet, 'git', [
    'diff',
    '--name-only',
    '--diff-filter=U',
  ])
  const files = unmerged.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!files.length || !tryResolveTrivialConflicts(root, files, exec))
    refuseMergeConflict(files)
  if (files.includes('pnpm-lock.yaml')) {
    mustOk(sh(exec, cwd, env, quiet, 'pnpm', ['install']), 'pnpm install')
  }
  if (files.includes('docs/roadmap.md')) {
    const check = sh(exec, cwd, env, quiet, 'pnpm', ['-s', 'roadmap', 'check'])
    if (check.code !== 0) {
      fail(
        `roadmap check failed after auto-resolving docs/roadmap.md (semantic conflict). Resolve per git-finish.mdc, then run finish again.\n${tailOutput(check.stdout, check.stderr)}`,
        1,
      )
    }
  }
  for (const f of files) {
    mustOk(sh(exec, cwd, env, quiet, 'git', ['add', '--', f]), `git add ${f}`)
  }
  mustOk(
    sh(exec, cwd, env, quiet, 'git', [
      'commit',
      '--no-edit',
      '-m',
      'merge origin/main (trivial conflicts)',
    ]),
    'git commit merge',
  )
  mustOk(
    sh(exec, cwd, env, quiet, 'pnpm', ['verify:fast:quiet']),
    'verify:fast:quiet after merge',
  )
  return { merged: true, resolved: files }
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

  const fails = readPushFailures(root, exec)
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

  // Merge origin/main when HEAD is behind before push; on non-FF reject, merge and retry once.
  try {
    mergeOriginMainIfNeeded(exec, root, cwd, env, quiet)
  } catch (e) {
    if (!(e instanceof AgentError)) throw e
    const next = prior + 1
    writePushFailures(root, { ...fails, [branch]: next }, exec)
    return {
      ok: false,
      stage: 'push',
      pushAttempts: next,
      branch,
      ahead,
      summary: e.message,
    }
  }
  let lastPush = sh(exec, cwd, env, quiet, 'git', [
    'push',
    '-q',
    '-u',
    'origin',
    'HEAD',
  ])
  const pushMsg = `${lastPush.stdout}\n${lastPush.stderr}`
  if (
    lastPush.code !== 0 &&
    /non-fast-forward|fetch first|\[rejected\]|updates were rejected/i.test(
      pushMsg,
    )
  ) {
    try {
      mergeOriginMainIfNeeded(exec, root, cwd, env, quiet)
      lastPush = sh(exec, cwd, env, quiet, 'git', [
        'push',
        '-q',
        '-u',
        'origin',
        'HEAD',
      ])
    } catch (e) {
      if (!(e instanceof AgentError)) throw e
      const next = prior + 1
      writePushFailures(root, { ...fails, [branch]: next }, exec)
      return {
        ok: false,
        stage: 'push',
        pushAttempts: next,
        branch,
        ahead,
        summary: e.message,
      }
    }
  }
  if (lastPush.code !== 0) {
    const next = prior + 1
    writePushFailures(root, { ...fails, [branch]: next }, exec)
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
    writePushFailures(root, rest, exec)
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

  let metrics = null
  if (!prNumber) {
    if (!o.title) fail('finish create needs --title')
    if (!o['body-file']) fail('finish create needs --body-file')
    const bodyPath = path.resolve(cwd, o['body-file'])
    if (!fs.existsSync(bodyPath)) fail(`body file missing: ${bodyPath}`)
    metrics = buildPrBodyWithMetrics(bodyPath, root, env, exec)
    const createdPr = mustOk(
      sh(exec, cwd, env, quiet, 'gh', [
        'pr',
        'create',
        '--title',
        o.title,
        '--body-file',
        metrics.bodyPath,
      ]),
      'gh pr create',
    )
    prUrl = createdPr.stdout.trim()
    created = true
  }

  return {
    ok: true,
    stage: 'pr',
    pushAttempts: prior,
    branch,
    ahead,
    prUrl,
    created,
    metrics: metrics
      ? { wallTimeSec: metrics.wallTimeSec, tokens: metrics.tokens }
      : null,
    summary: created
      ? `PR created: ${prUrl}`
      : `PR updated (existing): ${prUrl}`,
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

  const base = o.base ?? 'HEAD'
  if (base.startsWith('-'))
    fail(`--base must not start with '-' (got ${JSON.stringify(base)})`)

  const mergeBaseR = mustOk(
    sh(exec, cwd, env, quiet, 'git', ['merge-base', base, 'HEAD']),
    'git merge-base',
  )
  const mergeBase = mergeBaseR.stdout.trim()
  if (!mergeBase) fail('git merge-base produced empty output')

  const headStat = mustOk(
    sh(exec, cwd, env, quiet, 'git', ['diff', mergeBase, '--stat']),
    'git diff --stat',
  )
  const untrackedR = mustOk(
    sh(exec, cwd, env, quiet, 'git', [
      'ls-files',
      '--others',
      '--exclude-standard',
    ]),
    'git ls-files',
  )
  const untracked = untrackedR.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const touchSet = new Set(touchPaths)
  const changedTracked = []
  const nameOnly = mustOk(
    sh(exec, cwd, env, quiet, 'git', ['diff', mergeBase, '--name-only']),
    'git diff --name-only',
  )
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
    const td = mustOk(
      sh(exec, cwd, env, quiet, 'git', [
        'diff',
        mergeBase,
        '--',
        ...touchPaths,
      ]),
      'git diff touch-set',
    )
    const t = stripAnsi(td.stdout).trim()
    if (t) touchDiffParts.push(t)
  }
  for (const f of untracked) {
    if (!touchSet.has(f)) continue
    const d = mustOkDiffNoIndex(
      sh(exec, cwd, env, quiet, 'git', [
        'diff',
        '--no-index',
        '--',
        '/dev/null',
        f,
      ]),
      `git diff --no-index ${f}`,
    )
    const body = stripAnsi(d.stdout || d.stderr).trim()
    if (body) touchDiffParts.push(body)
  }

  const outsideParts = []
  if (outside.length) {
    const trackedOutside = outside.filter((f) => !untracked.includes(f))
    if (trackedOutside.length) {
      const od = mustOk(
        sh(exec, cwd, env, quiet, 'git', [
          'diff',
          mergeBase,
          '--',
          ...trackedOutside,
        ]),
        'git diff outside touch-set',
      )
      const t = stripAnsi(od.stdout).trim()
      if (t) outsideParts.push(t)
    }
    for (const f of outside.filter((f) => untracked.includes(f))) {
      const d = mustOkDiffNoIndex(
        sh(exec, cwd, env, quiet, 'git', [
          'diff',
          '--no-index',
          '--',
          '/dev/null',
          f,
        ]),
        `git diff --no-index ${f}`,
      )
      const body = stripAnsi(d.stdout || d.stderr).trim()
      if (body) outsideParts.push(body)
    }
  }

  const untrackedBlock = untracked.length
    ? `Untracked:\n${untracked.map((f) => `?? ${f}`).join('\n')}`
    : ''
  const statBits = [stripAnsi(headStat.stdout).trim(), untrackedBlock]
    .filter(Boolean)
    .join('\n')

  return {
    slug,
    changePath,
    rules,
    rulesNote: rules.length
      ? null
      : 'pass --rules-json from openspec instructions',
    base,
    mergeBase,
    diffStat: statBits || '(empty)',
    touchSetPaths: touchPaths,
    touchNote,
    inTouchSet: inTouch,
    outsideTouchSet: outside,
    touchDiff: touchDiffParts.join('\n\n') || '(empty)',
    outsideDiff: outsideParts.join('\n\n') || '(empty)',
    untracked,
  }
}

function fmtPreflight(r) {
  const ruleList = r.instructions.rules
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
    `created: ${r.created}`,
    `summary: ${r.summary}`,
  ].join('\n')
}

function fmtBrief(r) {
  return [
    `slug: ${r.slug}`,
    `changePath: ${r.changePath}`,
    `base: ${r.base}`,
    `mergeBase: ${r.mergeBase}`,
    `rules: ${JSON.stringify(r.rules)}`,
    `rulesNote: ${r.rulesNote}`,
    '--- diff --stat ---',
    String(r.diffStat),
    `touchNote: ${r.touchNote}`,
    `touchSet: ${r.touchSetPaths.join(', ')}`,
    `inTouchSet: ${r.inTouchSet.join(', ')}`,
    '--- touch-set diff ---',
    String(r.touchDiff),
    '--- outsideTouchSet ---',
    r.outsideTouchSet.join(', '),
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

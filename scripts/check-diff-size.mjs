#!/usr/bin/env node
/** Changed-line budget vs merge-base (initial scope ≤ 1500). */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripGitKeys } from './strip-git-env.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DIFF_SIZE_MAX = 1500
export const DIFF_SIZE_WARN = 1000
export const DEFAULT_EXCLUDED_EXACT = Object.freeze(['pnpm-lock.yaml'])
export const DEFAULT_EXCLUDED_PREFIXES = Object.freeze([
  'openspec/changes/',
  'uikit/',
])
export const BINARY_EXTENSIONS = Object.freeze(
  new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.avif',
    '.ico',
    '.bmp',
    '.svg',
    '.pdf',
    '.wasm',
    '.zip',
    '.gz',
    '.tgz',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.mp4',
    '.webm',
    '.bin',
  ]),
)

export function loadDiffSizeExclusionGlobs(root) {
  const file = path.join(root, 'quality', 'diff-size-exclusions.json')
  if (!fs.existsSync(file)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(raw?.globs)
      ? raw.globs.filter((g) => typeof g === 'string')
      : []
  } catch {
    return []
  }
}

export function matchSimpleGlob(file, glob) {
  const f = file.replaceAll('\\', '/')
  const g = glob.replaceAll('\\', '/')
  if (g.endsWith('/**')) {
    const prefix = g.slice(0, -3)
    return f === prefix || f.startsWith(prefix + '/')
  }
  return !g.includes('*') && f === g
}

export function isExcludedDiffPath(rel, extraGlobs = []) {
  const n = String(rel).replaceAll('\\', '/')
  if (DEFAULT_EXCLUDED_EXACT.includes(n)) return true
  for (const p of DEFAULT_EXCLUDED_PREFIXES) {
    if (n === p.slice(0, -1) || n.startsWith(p)) return true
  }
  if (BINARY_EXTENSIONS.has(path.posix.extname(n).toLowerCase())) return true
  return extraGlobs.some((g) => matchSimpleGlob(n, g))
}

export function parseNumstat(text) {
  /** @type {{ file: string, added: number, deleted: number }[]} */
  const rows = []
  for (const raw of String(text ?? '').split('\n')) {
    if (!raw.trim()) continue
    const parts = raw.split('\t')
    if (parts.length < 3) continue
    const [a, d, ...fileParts] = parts
    let file = fileParts.join('\t').replaceAll('\\', '/')
    if (file.includes(' => '))
      file = file.slice(file.lastIndexOf(' => ') + 4).replace(/[{}]/g, '')
    const added = a === '-' ? 0 : Number.parseInt(a, 10)
    const deleted = d === '-' ? 0 : Number.parseInt(d, 10)
    if (!Number.isFinite(added) || !Number.isFinite(deleted)) continue
    rows.push({ file: file.trim(), added, deleted })
  }
  return rows
}

function git(args, cwd) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: stripGitKeys({ ...process.env }),
  })
}

/** @param {Record<string, unknown>} [opts] */
export function computeDiffSize(opts = {}) {
  const root = /** @type {string} */ (opts.root ?? ROOT)
  const max = /** @type {number} */ (opts.max ?? DIFF_SIZE_MAX)
  const warnAt = /** @type {number} */ (opts.warnAt ?? DIFF_SIZE_WARN)
  const warnOnly = Boolean(opts.warnOnly)
  const gitFn = /** @type {typeof git} */ (opts.git ?? git)
  const extra = loadDiffSizeExclusionGlobs(root)

  let numstatText = opts.numstatText
  if (numstatText === undefined) {
    const base = /** @type {string} */ (opts.baseRef ?? 'origin/main')
    const head = /** @type {string} */ (opts.headRef ?? 'HEAD')
    const merge = gitFn(['merge-base', base, head], root)
    if ((merge.status ?? 1) !== 0) {
      return {
        ok: false,
        lines: 0,
        max,
        warnAt,
        reason: `merge-base failed: ${merge.stderr || merge.stdout}`,
      }
    }
    const ns = gitFn(
      ['diff', '--numstat', '--find-renames', merge.stdout.trim(), head],
      root,
    )
    if ((ns.status ?? 1) !== 0) {
      return {
        ok: false,
        lines: 0,
        max,
        warnAt,
        reason: `numstat failed: ${ns.stderr || ns.stdout}`,
      }
    }
    numstatText = ns.stdout
  }

  let lines = 0
  for (const row of parseNumstat(/** @type {string} */ (numstatText))) {
    if (!isExcludedDiffPath(row.file, extra)) lines += row.added + row.deleted
  }
  const overMax = lines > max
  return {
    ok: warnOnly ? true : !overMax,
    lines,
    max,
    warnAt,
    overMax,
    overWarn: lines > warnAt,
    warnOnly,
    reason: overMax
      ? `diff size ${lines} > ${max} (split with pnpm roadmap add --after)`
      : null,
  }
}

export function parsePlanSizeEstimate(text) {
  const m =
    /\*\*Size estimate:\*\*[^\n=]*=\s*(\d+)/i.exec(String(text ?? '')) ||
    /^Size estimate:[^\n=]*=\s*(\d+)/im.exec(String(text ?? ''))
  if (!m) return null
  const n = Number.parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

/** @param {Record<string, unknown>} [opts] */
export function checkPlanSize(opts = {}) {
  const root = /** @type {string} */ (opts.root ?? ROOT)
  const max = /** @type {number} */ (opts.max ?? DIFF_SIZE_MAX)
  let text = opts.proposalText
  if (text === undefined) {
    const slug = opts.changeSlug
    if (!slug) return { ok: false, total: null, reason: 'missing change slug' }
    const file = path.join(
      root,
      'openspec',
      'changes',
      /** @type {string} */ (slug),
      'proposal.md',
    )
    if (!fs.existsSync(file)) {
      return {
        ok: true,
        total: null,
        reason: 'no proposal.md (skip plan size)',
        skipped: true,
      }
    }
    text = fs.readFileSync(file, 'utf8')
  }
  const total = parsePlanSizeEstimate(/** @type {string} */ (text))
  if (total == null) {
    return {
      ok: false,
      total: null,
      reason: 'proposal.md missing **Size estimate:** … = <total> (max 1500)',
    }
  }
  if (total > max) {
    return {
      ok: false,
      total,
      reason: `plan size ${total} > ${max} (pnpm roadmap add --after)`,
    }
  }
  return { ok: true, total, reason: null }
}

export function runDiffSizeCheck(opts = {}) {
  const write = opts.write ?? ((s) => process.stdout.write(s))
  const error = opts.error ?? ((s) => process.stderr.write(s))
  const result = computeDiffSize(opts)
  if (!result.ok) {
    error(`diff-size: fail — ${result.reason}\n`)
    return 1
  }
  if (result.overMax && result.warnOnly) {
    write(
      `diff-size: warn — ${result.lines} lines (review-fix; initial cap ${result.max})\n`,
    )
  } else if (result.overWarn) {
    write(
      `diff-size: warn — ${result.lines} lines (target ≤ ${result.warnAt})\n`,
    )
  } else {
    write(`diff-size: OK ${result.lines} lines (max ${result.max})\n`)
  }
  return 0
}

export function main(argv = process.argv.slice(2)) {
  return runDiffSizeCheck({ warnOnly: argv.includes('--warn-only') })
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main()
}

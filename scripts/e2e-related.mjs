#!/usr/bin/env node
/**
 * Local B companion to the rig's `e2e-changed` gate: runs the existing e2e
 * specs whose test ids appear in the changed `src/` hunks. The rig selects
 * only changed specs and their changed support files, so a `src/` diff that
 * breaks an untouched spec was found by CI alone.
 *
 * Ids come from hunk lines only (added, removed, context), never whole files.
 * Specs are ranked by matched ids and capped (`E2E_RELATED_MAX`, default 12).
 *
 * Usage: `node scripts/e2e-related.mjs [--list] [--range <a>..<b>]`
 * (`--list` prints the selection without running; `--range` replays a past
 * diff and keeps specs changed in it).
 *
 * Sunset: when the rig's own e2e-changed selection maps `src/` → specs,
 * delete this script and call the rig.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { delimiter, dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFlakySpecPaths } from '@albasov/ts-agent-rig/e2e-flaky-list'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_MAX = 12
const SRC_FILE = /^src\/.*\.(?:ts|tsx|css)$/
const PRODUCER =
  /\b(?:data-testid|testId|testid|dataTestId)['"]?\s*[:=]\s*\{?\s*(?:(['"])([^'"\n]+)\1|`([^`\n]*)`)/g
const BY_TEST_ID = /getByTestId\(\s*(?:(['"])([^'"\n]+)\1|`([^`\n]*)`)/g
const ATTR_SELECTOR = /\[data-testid(\^?)=\s*(['"]?)([^'"\]\n]+)\2\]/g
const IMPORT = /(?:from|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g

/**
 * Splits a unified diff into the hunk lines (prefix stripped) of each
 * `src/**\/*.{ts,tsx,css}` file. Headers are never hunk lines.
 * @param {string} diff
 * @returns {Map<string, string[]>}
 */
export function hunkLinesByFile(diff) {
  /** @type {Map<string, string[]>} */
  const out = new Map()
  let file = ''
  let inHunk = false
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      file = line.slice(line.lastIndexOf(' b/') + 3)
      inHunk = false
    } else if (line.startsWith('@@')) {
      inHunk = true
    } else if (inHunk && SRC_FILE.test(file) && /^[ +-]/.test(line)) {
      const lines = out.get(file) ?? []
      lines.push(line.slice(1))
      out.set(file, lines)
    }
  }
  return out
}

/**
 * A quoted value becomes an exact id; a template literal with `${` becomes
 * the prefix before it. Empty prefixes are dropped.
 * @param {string | undefined} quoted
 * @param {string | undefined} template
 * @returns {string | null} exact id, or `prefix*`
 */
function idOf(quoted, template) {
  if (quoted !== undefined) return quoted
  const cut = (template ?? '').indexOf('${')
  if (cut === -1) return template || null
  return cut > 0 ? `${(template ?? '').slice(0, cut)}*` : null
}

/**
 * Test ids produced by source lines: `data-testid="x"`, `testId: 'x'`,
 * `` data-testid={`x-${…}`} `` (→ `x-*`), CSS `[data-testid="x"]`.
 * @param {string[]} lines
 * @returns {Set<string>}
 */
export function extractSrcIds(lines) {
  const ids = new Set()
  for (const match of lines.join('\n').matchAll(PRODUCER)) {
    const id = idOf(match[2], match[3])
    if (id) ids.add(id)
  }
  return ids
}

/**
 * Test ids an e2e file looks up: `getByTestId('x')`, `` getByTestId(`x-${…}`) ``,
 * `[data-testid="x"]`, `[data-testid^="x"]` (prefix ids end with `*`).
 * @param {string} text
 * @returns {Set<string>}
 */
export function extractE2eRefs(text) {
  const refs = new Set()
  for (const match of text.matchAll(BY_TEST_ID)) {
    const id = idOf(match[2], match[3])
    if (id) refs.add(id)
  }
  for (const match of text.matchAll(ATTR_SELECTOR)) {
    const id = idOf(undefined, match[3])
    if (id) refs.add(match[1] === '^' && !id.endsWith('*') ? `${id}*` : id)
  }
  return refs
}

/**
 * @param {string} srcId
 * @param {string} ref
 */
function idMatches(srcId, ref) {
  const srcPrefix = srcId.endsWith('*') ? srcId.slice(0, -1) : null
  const refPrefix = ref.endsWith('*') ? ref.slice(0, -1) : null
  if (srcPrefix !== null && refPrefix !== null) {
    return srcPrefix.startsWith(refPrefix) || refPrefix.startsWith(srcPrefix)
  }
  if (srcPrefix !== null) return ref.startsWith(srcPrefix)
  if (refPrefix !== null) return srcId.startsWith(refPrefix)
  return srcId === ref
}

/**
 * @param {Set<string>} srcIds
 * @param {Set<string>} refs
 * @returns {string[]} the source ids some ref matches
 */
export function matchedIds(srcIds, refs) {
  return [...srcIds].filter((id) => [...refs].some((ref) => idMatches(id, ref)))
}

/**
 * Relative imports of an e2e file, resolved to repo paths in `files`.
 * @param {string} path
 * @param {string} text
 * @param {Set<string>} files
 * @returns {string[]}
 */
export function resolveImports(path, text, files) {
  const out = []
  for (const match of text.matchAll(IMPORT)) {
    const base = normalize(join(dirname(path), match[1]))
    const stem = base.replace(/\.(?:m?js|ts)$/, '')
    const hit = [base, `${stem}.ts`, `${stem}.mjs`, `${base}/index.ts`].find(
      (candidate) => files.has(candidate),
    )
    if (hit) out.push(hit)
  }
  return out
}

/**
 * Ranks specs by the source ids they (or the support files they reach
 * through relative imports) look up; caps the list.
 * @param {{
 *   srcIds: Set<string>
 *   e2eFiles: Map<string, string>
 *   skip?: Set<string>
 *   max?: number
 * }} input
 * @returns {{
 *   selected: { path: string, ids: string[] }[]
 *   dropped: { path: string, ids: string[] }[]
 *   skipped: string[]
 * }}
 */
export function selectRelated({
  srcIds,
  e2eFiles,
  skip = new Set(),
  max = DEFAULT_MAX,
}) {
  const paths = new Set(e2eFiles.keys())
  /** @type {Map<string, string[]>} */
  const direct = new Map()
  /** @type {Map<string, string[]>} */
  const imports = new Map()
  for (const [path, text] of e2eFiles) {
    direct.set(path, matchedIds(srcIds, extractE2eRefs(text)))
    imports.set(path, resolveImports(path, text, paths))
  }
  const ranked = []
  const skipped = []
  for (const path of [...paths].filter((p) => p.endsWith('.spec.ts')).sort()) {
    const seen = new Set([path])
    const queue = [path]
    const ids = new Set()
    while (queue.length > 0) {
      const current = /** @type {string} */ (queue.shift())
      for (const id of direct.get(current) ?? []) ids.add(id)
      for (const next of imports.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    if (ids.size === 0) continue
    if (skip.has(path)) skipped.push(path)
    else ranked.push({ path, ids: [...ids].sort() })
  }
  ranked.sort(
    (a, b) => b.ids.length - a.ids.length || a.path.localeCompare(b.path),
  )
  return { selected: ranked.slice(0, max), dropped: ranked.slice(max), skipped }
}

/**
 * @param {string | undefined} raw
 */
export function parseMax(raw) {
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX
}

/**
 * @param {string[]} args
 * @returns {string[]}
 */
function defaultGit(args) {
  const result = spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  if (result.status !== 0)
    throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`)
  return [result.stdout]
}

/**
 * @param {{ selected: { path: string, ids: string[] }[], dropped: { path: string, ids: string[] }[], skipped: string[] }} result
 * @returns {string}
 */
export function formatSelection({ selected, dropped, skipped }) {
  const row = (/** @type {{ path: string, ids: string[] }} */ s) =>
    `  ${s.path} (${String(s.ids.length)}: ${s.ids.join(', ')})`
  const lines = [
    `related-e2e: selected ${String(selected.length)}`,
    ...selected.map(row),
  ]
  if (dropped.length > 0) {
    lines.push(
      `related-e2e: dropped ${String(dropped.length)} over the cap`,
      ...dropped.map(row),
    )
  }
  if (skipped.length > 0) {
    lines.push(
      `related-e2e: skipped ${String(skipped.length)} (flaky or changed)`,
    )
    lines.push(...skipped.map((path) => `  ${path}`))
  }
  return `${lines.join('\n')}\n`
}

/**
 * @param {string[]} [argv]
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{
 *   git?: (args: string[]) => string[]
 *   readFile?: (path: string) => string
 *   loadFlaky?: () => string[]
 *   spawn?: typeof spawnSync
 *   writeLog?: (text: string) => void
 *   write?: (text: string) => void
 *   now?: () => number
 * }} [io]
 * @returns {number} exit code
 */
export function main(argv = process.argv.slice(2), env = process.env, io = {}) {
  const git = io.git ?? defaultGit
  const readFile =
    io.readFile ?? ((path) => readFileSync(join(ROOT, path), 'utf8'))
  const loadFlaky = io.loadFlaky ?? (() => loadFlakySpecPaths({ root: ROOT }))
  const spawn = io.spawn ?? spawnSync
  const write = io.write ?? ((text) => process.stdout.write(text))
  const rangeAt = argv.indexOf('--range')
  const range = rangeAt === -1 ? null : argv[rangeAt + 1]
  const listOnly = argv.includes('--list')

  const out = (/** @type {string[]} */ args) => git(args).join('\n')
  const lines = (/** @type {string[]} */ args) =>
    out(args).split('\n').filter(Boolean)
  let diff
  const skip = new Set(loadFlaky())
  if (range) {
    diff = out(['diff', '-U3', range, '--', 'src'])
  } else {
    const base = out([
      'merge-base',
      env.STRYKER_DIFF_BASE ?? 'origin/main',
      'HEAD',
    ]).trim()
    diff = out(['diff', '-U3', base, '--', 'src'])
    for (const path of lines([
      'ls-files',
      '--others',
      '--exclude-standard',
      '--',
      'src',
    ])) {
      const added = readFile(path)
        .split('\n')
        .map((line) => `+${line}`)
      diff += `\ndiff --git a/${path} b/${path}\n@@ new @@\n${added.join('\n')}\n`
    }
    for (const path of lines(['diff', '--name-only', base, '--', 'e2e']))
      skip.add(path)
    for (const path of lines([
      'ls-files',
      '--others',
      '--exclude-standard',
      '--',
      'e2e',
    ])) {
      skip.add(path)
    }
  }

  const srcIds = extractSrcIds([...hunkLinesByFile(diff).values()].flat())
  const e2eFiles = new Map()
  for (const path of lines(['ls-files', '--', 'e2e'])) {
    if (/\.(?:ts|mjs)$/.test(path) && !path.includes('burn-in-fixtures/')) {
      e2eFiles.set(path, readFile(path))
    }
  }
  const selection = selectRelated({
    srcIds,
    e2eFiles,
    skip,
    max: parseMax(env.E2E_RELATED_MAX),
  })
  write(`related-e2e: ${String(srcIds.size)} changed test id(s)\n`)
  write(formatSelection(selection))
  if (listOnly) return 0
  if (selection.selected.length === 0) {
    write('related-e2e: no targets\n')
    return 0
  }

  const wrapper = join(
    dirname(
      fileURLToPath(import.meta.resolve('@albasov/ts-agent-rig/package.json')),
    ),
    'src',
    'with-playwright-env.mjs',
  )
  const now = io.now ?? Date.now
  const startedAt = now()
  const result = spawn(
    process.execPath,
    [
      wrapper,
      'playwright',
      'test',
      '--project=chromium',
      '--workers=1',
      '--pass-with-no-tests',
      ...selection.selected.map((s) => s.path),
      '--reporter=dot',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      env: {
        ...env,
        PATH: [join(ROOT, 'node_modules', '.bin'), env.PATH ?? ''].join(
          delimiter,
        ),
      },
      maxBuffer: 256 * 1024 * 1024,
    },
  )
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const writeLog =
    io.writeLog ??
    ((text) => {
      const dir = join(ROOT, '.cache', 'checks')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'e2e-related.log'), text)
    })
  writeLog(log)
  const n = String(selection.selected.length)
  const took = `${((now() - startedAt) / 1000).toFixed(1)}s`
  if (result.status === 0) {
    write(`related-e2e: ${n} passed (${took})\n`)
    return 0
  }
  write(`${log.trimEnd().split('\n').slice(-40).join('\n')}\n`)
  write(
    `related-e2e: ${n} failed (exit ${String(result.status)}, ${took}); full log: .cache/checks/e2e-related.log\n`,
  )
  return 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main())
}

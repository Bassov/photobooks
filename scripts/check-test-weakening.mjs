/**
 * Test-level weakening + item-criteria helpers for gate ratchet.
 * Parses file text only (TypeScript AST) — never executes head code.
 */
import { createHash } from 'node:crypto'
import path from 'node:path'
import ts from 'typescript'

export const WEAKENING_SUFFIXES = Object.freeze([
  'skip',
  'only',
  'todo',
  'fixme',
  'fail',
])

export const TEST_ROOT_NAMES = Object.freeze(['test', 'it', 'describe'])

export const OWNER_APPROVAL_PREFIX = 'Owner-approved scope change:'

/**
 * @param {unknown} v
 * @returns {string}
 */
export function coerceText(v) {
  if (v == null) return ''
  return typeof v === 'string' ? v : String(v)
}

/**
 * @param {string} rel
 * @returns {boolean}
 */
export function isTrackedTestPath(rel) {
  const p = rel.replaceAll('\\', '/')
  if (p.includes('node_modules/') || p.includes('/burn-in-fixtures/')) {
    return false
  }
  const isVitestSrc =
    p.startsWith('src/') &&
    p.includes('.test.') &&
    (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.mjs'))
  const isScriptTest =
    p.startsWith('scripts/') &&
    p.includes('.test.') &&
    (p.endsWith('.mjs') || p.endsWith('.js') || p.endsWith('.ts'))
  const isE2e = p.startsWith('e2e/') && p.endsWith('.spec.ts')
  return isVitestSrc || isScriptTest || isE2e
}

/**
 * Companion source paths that justify deleting a test file.
 * @param {string} testPath
 * @returns {string[]}
 */
export function companionPathsFor(testPath) {
  const p = testPath.replaceAll('\\', '/')
  const dir = path.posix.dirname(p)
  const base = path.posix.basename(p)
  /** @type {string[]} */
  const out = []
  let stem = null
  const testMatch = /^(.*)\.test\.(ts|tsx|mjs|js)$/.exec(base)
  const specMatch = /^(.*)\.spec\.(ts|tsx)$/.exec(base)
  if (testMatch) stem = testMatch[1]
  else if (specMatch) stem = specMatch[1]
  if (stem != null) {
    for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
      out.push(path.posix.join(dir, `${stem}${ext}`))
    }
  }
  if (p.startsWith('e2e/') && stem != null) {
    out.push(`src/${stem}.ts`, `src/${stem}.tsx`, `src/${stem}/index.ts`)
  }
  return [...new Set(out)]
}

/**
 * True when any companion path for `testPath` exists on base and is absent on head.
 * For e2e specs, also accept any deleted src file whose basename matches the stem.
 * @param {string} testPath
 * @param {Record<string, string | undefined>} baseFiles
 * @param {Record<string, string | undefined>} headFiles
 * @returns {boolean}
 */
export function companionDeletedFor(testPath, baseFiles, headFiles) {
  const companions = companionPathsFor(testPath)
  if (
    companions.some(
      (c) => baseFiles[c] !== undefined && headFiles[c] === undefined,
    )
  ) {
    return true
  }
  const p = testPath.replaceAll('\\', '/')
  if (!p.startsWith('e2e/') || !p.endsWith('.spec.ts')) return false
  const stem = path.posix.basename(p, '.spec.ts').toLowerCase()
  for (const key of Object.keys(baseFiles)) {
    const rel = key.replaceAll('\\', '/')
    if (!rel.startsWith('src/')) continue
    if (headFiles[rel] !== undefined) continue
    const base = path.posix.basename(rel).toLowerCase()
    if (base === stem || base.startsWith(`${stem}.`)) return true
  }
  return false
}

/**
 * @param {string} text
 * @returns {string}
 */
export function hashBody(text) {
  return createHash('sha256').update(coerceText(text)).digest('hex')
}

/**
 * @param {ts.Expression} expr
 * @returns {string[]}
 */
export function calleeParts(expr) {
  /** @type {string[]} */
  const parts = []
  let cur = expr
  while (cur) {
    if (ts.isIdentifier(cur)) {
      parts.unshift(cur.text)
      break
    }
    if (ts.isPropertyAccessExpression(cur)) {
      parts.unshift(cur.name.text)
      cur = cur.expression
      continue
    }
    break
  }
  return parts
}

/**
 * @param {ts.Expression | undefined} expr
 * @returns {string | null}
 */
export function staticStringArg(expr) {
  if (!expr) return null
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text
  }
  return null
}

/**
 * @param {ts.Node | undefined} node
 * @returns {boolean}
 */
export function objectHasRetries(node) {
  if (!node || !ts.isObjectLiteralExpression(node)) return false
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = prop.name
    if (ts.isIdentifier(name) && name.text === 'retries') return true
    if (ts.isStringLiteral(name) && name.text === 'retries') return true
  }
  return false
}

/**
 * @param {ts.Expression | undefined} expr
 * @param {ts.SourceFile} sf
 * @returns {string}
 */
function bodyTextOf(expr, sf) {
  if (!expr) return ''
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    return expr.getText(sf)
  }
  return ''
}

/**
 * @param {string} source
 * @param {string} fileName
 * @returns {{
 *   titles: { title: string, bodyHash: string }[],
 *   weakening: { suffix: string, title: string | null }[],
 *   retries: number,
 * }}
 */
export function parseTestFile(source, fileName = 'file.ts') {
  const text = coerceText(source)
  const sf = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  /** @type {{ title: string, bodyHash: string }[]} */
  const titles = []
  /** @type {{ suffix: string, title: string | null }[]} */
  const weakening = []
  let retries = 0

  /**
   * @param {ts.Node} node
   */
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const parts = calleeParts(node.expression)
      const root = parts[0]
      if (!TEST_ROOT_NAMES.includes(root)) {
        ts.forEachChild(node, visit)
        return
      }

      const weak = parts.find((p) => WEAKENING_SUFFIXES.includes(p))
      const title = staticStringArg(node.arguments[0])

      if (weak) {
        weakening.push({ suffix: weak, title })
      }

      if (parts.includes('configure') && objectHasRetries(node.arguments[0])) {
        retries += 1
      }

      const isTestOrIt =
        (root === 'test' || root === 'it') &&
        !parts.includes('describe') &&
        !parts.includes('configure')
      if (isTestOrIt && title != null) {
        let bodyArg = node.arguments[1]
        if (bodyArg && objectHasRetries(bodyArg)) {
          if (!weak) retries += 1
          bodyArg = node.arguments[2]
        }
        titles.push({
          title,
          bodyHash: hashBody(bodyTextOf(bodyArg, sf)),
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)

  return { titles, weakening, retries }
}

/**
 * Extract a boolean config key written as `key: true|false`.
 * @param {string} source
 * @param {string} key
 * @returns {'true' | 'false' | 'other' | null}
 */
export function extractConfigBool(source, key) {
  const src = coerceText(source)
  const re = new RegExp(`\\b${key}\\s*:\\s*([^,\\n}/]+)`, 'm')
  const m = re.exec(src)
  if (!m) return null
  const raw = m[1].trim()
  if (raw === 'true') return 'true'
  if (raw === 'false') return 'false'
  return 'other'
}

/**
 * @param {string} prBody
 * @returns {boolean}
 */
export function hasOwnerApprovedScopeChange(prBody) {
  const lines = coerceText(prBody).split(/\r?\n/)
  for (const line of lines) {
    if (!line.startsWith(OWNER_APPROVAL_PREFIX)) continue
    if (line.slice(OWNER_APPROVAL_PREFIX.length).trim().length > 0) return true
  }
  return false
}

/**
 * @param {string} branch
 * @returns {string | null}
 */
export function slugFromBranch(branch) {
  const m = /^(?:feat|fix)\/([^/]+)$/.exec(coerceText(branch).trim())
  return m ? m[1] : null
}

/**
 * @param {string} baseText
 * @param {string} headText
 * @returns {boolean}
 */
export function isAllowedItemEdit(baseText, headText) {
  const base = coerceText(baseText).replaceAll('\r\n', '\n').split('\n')
  const head = coerceText(headText).replaceAll('\r\n', '\n').split('\n')
  let bi = 0
  let hi = 0
  let inDoneNote = false
  while (bi < base.length && hi < head.length) {
    const b = base[bi]
    const h = head[hi]
    if (b === h) {
      bi++
      hi++
      continue
    }
    if (
      b.startsWith('- [ ]') &&
      h.startsWith('- [x]') &&
      b.slice(5) === h.slice(5)
    ) {
      bi++
      hi++
      continue
    }
    if (/^Status:\s*\S+/i.test(b) && /^Status:\s*done\s*$/i.test(h)) {
      bi++
      hi++
      continue
    }
    // Insert Status: done when base had no Status line (roadmap done).
    if (/^Status:\s*done\s*$/i.test(h) && !/^Status:/i.test(b)) {
      hi++
      continue
    }
    return false
  }
  if (bi < base.length) return false
  while (hi < head.length) {
    const h = head[hi]
    if (
      h.trim() === '' ||
      /^##\s*Done\b/i.test(h) ||
      /^Done note:/i.test(h) ||
      /^Done:\s*/i.test(h)
    ) {
      inDoneNote = true
      hi++
      continue
    }
    if (inDoneNote) {
      hi++
      continue
    }
    return false
  }
  return true
}

/**
 * @param {string} text
 * @param {string} slug
 * @returns {boolean}
 */
export function isDeferralRoadmapText(text, slug) {
  const t = coerceText(text)
  if (slug && t.includes(slug)) return true
  const defers = /\b(defer|follow-?up|instead of meeting)\b/i.test(t)
  const bar = /\b(coverage|mutation|NoCoverage|e2e)\b/i.test(t)
  return defers && bar
}

/**
 * @param {Record<string, string | undefined>} files
 * @returns {string[]}
 */
export function listTrackedTestPaths(files) {
  return Object.keys(files)
    .map((p) => p.replaceAll('\\', '/'))
    .filter(isTrackedTestPath)
    .sort()
}

/**
 * @param {Record<string, string | undefined>} baseFiles
 * @param {Record<string, string | undefined>} headFiles
 * @param {(ruleId: string, message: string) => void} fail
 */
export function compareTestWeakening(baseFiles, headFiles, fail) {
  const paths = new Set([
    ...listTrackedTestPaths(baseFiles),
    ...listTrackedTestPaths(headFiles),
  ])

  for (const p of paths) {
    const bRaw = baseFiles[p]
    const hRaw = headFiles[p]
    if (bRaw !== undefined && hRaw === undefined) {
      if (!companionDeletedFor(p, baseFiles, headFiles)) {
        fail(
          'test-title-removed',
          `test file deleted without companion source: ${p}`,
        )
      }
      continue
    }
    if (bRaw === undefined || hRaw === undefined) continue
    if (bRaw === hRaw) continue

    const b = parseTestFile(bRaw, p)
    const h = parseTestFile(hRaw, p)

    const bSuffixCounts = countBySuffix(b.weakening)
    const hSuffixCounts = countBySuffix(h.weakening)
    for (const suffix of WEAKENING_SUFFIXES) {
      if ((hSuffixCounts.get(suffix) ?? 0) > (bSuffixCounts.get(suffix) ?? 0)) {
        fail('test-skip-added', `weakening marker added in ${p}`)
        break
      }
    }

    if (h.retries > b.retries) {
      fail('test-retries-added', `retries added in ${p}`)
    }

    /** @type {{ title: string, bodyHash: string }[]} */
    const headRemaining = [...h.titles]
    for (const t of b.titles) {
      const exactIdx = headRemaining.findIndex((x) => x.title === t.title)
      if (exactIdx >= 0) {
        headRemaining.splice(exactIdx, 1)
        continue
      }
      const renameIdx = headRemaining.findIndex(
        (x) => x.bodyHash === t.bodyHash,
      )
      if (renameIdx >= 0) {
        headRemaining.splice(renameIdx, 1)
        continue
      }
      fail('test-title-removed', `test title removed in ${p}: ${t.title}`)
    }
  }

  const bAllow = extractConfigBool(
    coerceText(baseFiles['vite.config.ts']),
    'allowOnly',
  )
  const hAllow = extractConfigBool(
    coerceText(headFiles['vite.config.ts']),
    'allowOnly',
  )
  if (bAllow === 'false' && hAllow !== 'false') {
    fail('allow-only-weaker', `vite allowOnly weakened: ${bAllow} → ${hAllow}`)
  }

  const bForbid = extractConfigBool(
    coerceText(baseFiles['playwright.config.ts']),
    'forbidOnly',
  )
  const hForbid = extractConfigBool(
    coerceText(headFiles['playwright.config.ts']),
    'forbidOnly',
  )
  if (bForbid === 'true' && hForbid !== 'true') {
    fail(
      'forbid-only-weaker',
      `playwright forbidOnly weakened: ${bForbid} → ${hForbid}`,
    )
  }
}

/**
 * @param {{ suffix: string }[]} items
 * @returns {Map<string, number>}
 */
function countBySuffix(items) {
  const m = new Map()
  for (const it of items) {
    m.set(it.suffix, (m.get(it.suffix) ?? 0) + 1)
  }
  return m
}

/**
 * @param {Record<string, string | undefined>} baseFiles
 * @param {Record<string, string | undefined>} headFiles
 * @param {{ prBody?: string, branch?: string }} opts
 * @param {(ruleId: string, message: string) => void} fail
 */
export function compareItemCriteria(baseFiles, headFiles, opts, fail) {
  if (hasOwnerApprovedScopeChange(opts.prBody ?? '')) return

  const slug =
    slugFromBranch(opts.branch ?? '') ??
    detectSlugFromChangedItems(baseFiles, headFiles)
  if (!slug) return

  const itemPath = findItemPath(baseFiles, headFiles, slug)
  if (itemPath) {
    const b = baseFiles[itemPath]
    const h = headFiles[itemPath]
    if (b !== undefined && h !== undefined && b !== h) {
      if (!isAllowedItemEdit(b, h)) {
        fail(
          'item-criteria-loosened',
          `roadmap item criteria loosened: ${itemPath}`,
        )
      }
    }
  }

  for (const p of Object.keys(headFiles)) {
    const rel = p.replaceAll('\\', '/')
    if (!rel.startsWith('docs/roadmap/') || !rel.endsWith('.md')) continue
    if (baseFiles[rel] !== undefined) continue
    if (rel.endsWith('/INTRO.md') || rel.endsWith('/README.md')) continue
    const baseName = path.posix.basename(rel, '.md')
    if (baseName === slug) continue
    if (isDeferralRoadmapText(coerceText(headFiles[rel]), slug)) {
      fail('item-criteria-loosened', `deferral roadmap item added: ${rel}`)
    }
  }
}

/**
 * @param {Record<string, string | undefined>} baseFiles
 * @param {Record<string, string | undefined>} headFiles
 * @returns {string | null}
 */
function detectSlugFromChangedItems(baseFiles, headFiles) {
  for (const p of Object.keys(headFiles)) {
    const rel = p.replaceAll('\\', '/')
    const m = /^docs\/roadmap\/[^/]+\/([^/]+)\.md$/.exec(rel)
    if (!m) continue
    if (m[1] === 'INTRO' || m[1] === 'README') continue
    if (baseFiles[rel] !== headFiles[rel]) return m[1]
  }
  return null
}

/**
 * @param {Record<string, string | undefined>} baseFiles
 * @param {Record<string, string | undefined>} headFiles
 * @param {string} slug
 * @returns {string | null}
 */
function findItemPath(baseFiles, headFiles, slug) {
  for (const files of [headFiles, baseFiles]) {
    for (const p of Object.keys(files)) {
      const rel = p.replaceAll('\\', '/')
      if (rel.endsWith(`/${slug}.md`) && rel.startsWith('docs/roadmap/')) {
        return rel
      }
    }
  }
  return null
}

/**
 * Inventory all titles across a file map (for real-repo smoke).
 * @param {Record<string, string | undefined>} files
 * @returns {{ path: string, title: string }[]}
 */
export function inventoryAllTitles(files) {
  /** @type {{ path: string, title: string }[]} */
  const out = []
  for (const p of listTrackedTestPaths(files)) {
    const raw = files[p]
    if (raw == null) continue
    const parsed = parseTestFile(raw, p)
    for (const t of parsed.titles) {
      out.push({ path: p, title: t.title })
    }
  }
  return out
}

/**
 * Count weakening markers across a file map.
 * @param {Record<string, string | undefined>} files
 * @returns {number}
 */
export function countWeakeningMarkers(files) {
  let n = 0
  for (const p of listTrackedTestPaths(files)) {
    const raw = files[p]
    if (raw == null) continue
    n += parseTestFile(raw, p).weakening.length
  }
  return n
}

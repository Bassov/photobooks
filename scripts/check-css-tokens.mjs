#!/usr/bin/env node
/**
 * Fail when product CSS under src/ uses raw colors, font-sizes, or border-radii
 * outside the token files (docs/design.md Theme B).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

const ALLOWED_FILES = new Set([
  path.join(SRC, 'ui', 'tokens.css'),
  path.join(ROOT, 'public', 'fonts', 'fonts.css'),
])

const COLOR_RE =
  /(?:^|[^-\w])(?:#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\()/g
const FONT_SIZE_RE = /font-size\s*:\s*[^;{}]*?\d+(?:\.\d+)?(?:px|rem|em)\b/gi
const RADIUS_RE = /border-radius\s*:\s*[^;{}]*?\d+(?:\.\d+)?(?:px|rem|em)\b/gi

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkCss(dir) {
  /** @type {string[]} */
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name)
    const st = fs.statSync(abs)
    if (st.isDirectory()) out.push(...walkCss(abs))
    else if (name.endsWith('.css')) out.push(abs)
  }
  return out
}

/**
 * Strip comments so false positives in docs do not fail the gate.
 * @param {string} css
 */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * @param {string} file
 * @param {string} css
 * @returns {{ rule: string, match: string }[]}
 */
export function findCssTokenViolations(file, css) {
  if (ALLOWED_FILES.has(path.resolve(file))) return []
  const body = stripComments(css)
  /** @type {{ rule: string, match: string }[]} */
  const hits = []
  for (const re of [
    ['color', COLOR_RE],
    ['font-size', FONT_SIZE_RE],
    ['border-radius', RADIUS_RE],
  ]) {
    const [rule, pattern] = re
    pattern.lastIndex = 0
    let m
    while ((m = pattern.exec(body)) !== null) {
      hits.push({ rule, match: m[0].trim() })
    }
  }
  return hits
}

/**
 * @param {string} [root]
 */
export function checkCssTokens(root = ROOT) {
  const src = path.join(root, 'src')
  /** @type {{ file: string, rule: string, match: string }[]} */
  const violations = []
  for (const file of walkCss(src)) {
    const css = fs.readFileSync(file, 'utf8')
    for (const hit of findCssTokenViolations(file, css)) {
      violations.push({
        file: path.relative(root, file),
        rule: hit.rule,
        match: hit.match,
      })
    }
  }
  return violations
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const violations = checkCssTokens()
  if (violations.length > 0) {
    console.error('check-css-tokens: raw values outside token files:')
    for (const v of violations) {
      console.error(`  ${v.file}: [${v.rule}] ${v.match}`)
    }
    process.exit(1)
  }
  console.log('check-css-tokens: ok')
}

#!/usr/bin/env node
/**
 * Validate codecov.yml via Codecov API (first line must be exactly "Valid!").
 * On network error only: pinned top-level key allowlist.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

export const CODECOV_YML_REL = 'codecov.yml'

/** Known Codecov top-level keys (pinned fallback). */
export const PINNED_TOP_LEVEL_KEYS = Object.freeze([
  'codecov',
  'coverage',
  'parsers',
  'ignore',
  'flags',
  'flag_management',
  'component_management',
  'comment',
  'github_checks',
  'slack_app',
  'cli',
  'bundle_analysis',
  'profiling',
])

const VALIDATE_URL = 'https://api.codecov.io/validate'

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isNetworkError(err) {
  if (!err || typeof err !== 'object') return false
  const e = /** @type {any} */ (err)
  if (
    e.name === 'TypeError' &&
    /fetch|network|ECONN|ENOTFOUND|ETIMEDOUT/i.test(String(e.message))
  ) {
    return true
  }
  if (
    typeof e.code === 'string' &&
    /ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR/i.test(e.code)
  ) {
    return true
  }
  if (e.cause && isNetworkError(e.cause)) return true
  return false
}

/**
 * @param {string} yamlText
 * @returns {string[]}
 */
export function findUnknownTopLevelKeys(yamlText) {
  const doc = parseYaml(yamlText)
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return ['<root-not-object>']
  }
  const allowed = new Set(PINNED_TOP_LEVEL_KEYS)
  /** @type {string[]} */
  const unknown = []
  for (const key of Object.keys(doc)) {
    if (!allowed.has(key)) unknown.push(key)
  }
  return unknown
}

/**
 * @param {string} yamlText
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   validateUrl?: string,
 * }} [opts]
 * @returns {Promise<{ ok: boolean, mode: 'api' | 'fallback', detail: string }>}
 */
export async function validateCodecovYml(yamlText, opts = {}) {
  const fetchImpl = opts.fetchImpl == null ? globalThis.fetch : opts.fetchImpl
  const url = opts.validateUrl == null ? VALIDATE_URL : opts.validateUrl
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: yamlText,
    })
    const raw = await res.text()
    const body = String(raw).trim()
    // Success token is the first line exactly "Valid!" (API may append a config dump).
    const nl = body.indexOf('\n')
    const firstLine = nl === -1 ? body : body.slice(0, nl).replace(/\r$/, '')
    if (firstLine === 'Valid!') {
      return { ok: true, mode: 'api', detail: 'Valid!' }
    }
    const snippet = body.length > 500 ? body.slice(0, 500) : body
    return {
      ok: false,
      mode: 'api',
      detail: `Codecov validator rejected (HTTP ${res.status}): ${snippet}`,
    }
  } catch (err) {
    if (!isNetworkError(err)) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        mode: 'api',
        detail: `Codecov validator error: ${msg}`,
      }
    }
    const unknown = findUnknownTopLevelKeys(yamlText)
    if (unknown.length > 0) {
      return {
        ok: false,
        mode: 'fallback',
        detail: `network error; unknown top-level keys: ${unknown.join(', ')}`,
      }
    }
    return {
      ok: true,
      mode: 'fallback',
      detail: 'network error; pinned top-level keys OK',
    }
  }
}

export function defaultCodecovRoot() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
}

/**
 * @param {{
 *   root?: string,
 *   readFile?: (p: string) => string,
 *   fetchImpl?: typeof fetch,
 *   validateUrl?: string,
 * }} [opts]
 */
export async function checkCodecovYml(opts = {}) {
  const root = opts.root == null ? defaultCodecovRoot() : opts.root
  const readFile =
    opts.readFile == null ? (p) => fs.readFileSync(p, 'utf8') : opts.readFile
  const filePath = path.join(root, CODECOV_YML_REL)
  let yamlText
  try {
    yamlText = readFile(filePath)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      mode: 'api',
      detail: `missing ${CODECOV_YML_REL}: ${msg}`,
    }
  }
  return validateCodecovYml(yamlText, {
    fetchImpl: opts.fetchImpl,
    validateUrl: opts.validateUrl,
  })
}

/**
 * @param {{
 *   root?: string,
 *   readFile?: (p: string) => string,
 *   fetchImpl?: typeof fetch,
 *   log?: (msg: string) => void,
 *   error?: (msg: string) => void,
 * }} [opts]
 * @returns {Promise<number>}
 */
export async function runCodecovYmlCli(opts = {}) {
  const result = await checkCodecovYml(opts)
  const log = opts.log == null ? console.log : opts.log
  const error = opts.error == null ? console.error : opts.error
  if (result.ok) {
    log(`Codecov YAML: OK (${result.mode})`)
    return 0
  }
  error(`Codecov YAML: FAIL (${result.mode}) ${result.detail}`)
  return 1
}

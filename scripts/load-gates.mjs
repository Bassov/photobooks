#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const GATES_RELATIVE_PATH = 'quality/gates.json'

const ROOT_DEFAULT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * @param {unknown} value
 * @param {string} label
 */
function assertPositiveInt(value, label) {
  if (!Number.isInteger(value) || /** @type {number} */ (value) < 1) {
    throw new Error(`${label} must be a positive integer`)
  }
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function assertNonNegInt(value, label) {
  if (!Number.isInteger(value) || /** @type {number} */ (value) < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}

/**
 * @param {unknown} raw
 * @param {string} [pathLabel]
 */
export function validateGates(raw, pathLabel = GATES_RELATIVE_PATH) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${pathLabel} must be a JSON object`)
  }
  const gates = /** @type {Record<string, unknown>} */ (raw)

  const coverage = gates.coverage
  if (
    coverage === null ||
    typeof coverage !== 'object' ||
    Array.isArray(coverage)
  ) {
    throw new Error(`${pathLabel} coverage must be an object`)
  }
  const cov = /** @type {Record<string, unknown>} */ (coverage)
  for (const key of ['statements', 'branches', 'functions', 'lines']) {
    assertNonNegInt(cov[key], `${pathLabel} coverage.${key}`)
  }

  const stryker = gates.stryker
  if (
    stryker === null ||
    typeof stryker !== 'object' ||
    Array.isArray(stryker)
  ) {
    throw new Error(`${pathLabel} stryker must be an object`)
  }
  const thresholds = /** @type {Record<string, unknown>} */ (stryker).thresholds
  if (
    thresholds === null ||
    typeof thresholds !== 'object' ||
    Array.isArray(thresholds)
  ) {
    throw new Error(`${pathLabel} stryker.thresholds must be an object`)
  }
  const thr = /** @type {Record<string, unknown>} */ (thresholds)
  for (const key of ['high', 'low', 'break']) {
    assertNonNegInt(thr[key], `${pathLabel} stryker.thresholds.${key}`)
  }

  const lighthouse = gates.lighthouse
  if (
    lighthouse === null ||
    typeof lighthouse !== 'object' ||
    Array.isArray(lighthouse)
  ) {
    throw new Error(`${pathLabel} lighthouse must be an object`)
  }
  const lh = /** @type {Record<string, unknown>} */ (lighthouse)
  assertPositiveInt(lh.numberOfRuns, `${pathLabel} lighthouse.numberOfRuns`)
  if (
    lh.assertions === null ||
    typeof lh.assertions !== 'object' ||
    Array.isArray(lh.assertions)
  ) {
    throw new Error(`${pathLabel} lighthouse.assertions must be an object`)
  }
  if (!Array.isArray(lh.budgets)) {
    throw new Error(`${pathLabel} lighthouse.budgets must be an array`)
  }

  const playwright = gates.playwright
  if (
    playwright === null ||
    typeof playwright !== 'object' ||
    Array.isArray(playwright)
  ) {
    throw new Error(`${pathLabel} playwright must be an object`)
  }
  const pw = /** @type {Record<string, unknown>} */ (playwright)
  assertNonNegInt(pw.retries, `${pathLabel} playwright.retries`)
  assertNonNegInt(pw.flakyRetries, `${pathLabel} playwright.flakyRetries`)

  const e2e = gates.e2e
  if (e2e === null || typeof e2e !== 'object' || Array.isArray(e2e)) {
    throw new Error(`${pathLabel} e2e must be an object`)
  }
  const e2eObj = /** @type {Record<string, unknown>} */ (e2e)
  assertPositiveInt(e2eObj.burnInDefault, `${pathLabel} e2e.burnInDefault`)
  if (!Array.isArray(e2eObj.flakySpecs)) {
    throw new Error(`${pathLabel} e2e.flakySpecs must be an array`)
  }
  for (const entry of e2eObj.flakySpecs) {
    if (typeof entry !== 'string') {
      throw new Error(`${pathLabel} e2e.flakySpecs entries must be strings`)
    }
  }

  return gates
}

/**
 * @param {{
 *   root?: string,
 *   readFile?: (path: string) => string,
 * }} [io]
 */
export function loadGates(io = {}) {
  const root = io.root ?? ROOT_DEFAULT
  const readFile = io.readFile ?? ((path) => readFileSync(path, 'utf8'))
  const filePath = join(root, GATES_RELATIVE_PATH)
  let raw
  try {
    raw = JSON.parse(readFile(filePath))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to load ${GATES_RELATIVE_PATH}: ${message}`)
  }
  return validateGates(raw, GATES_RELATIVE_PATH)
}

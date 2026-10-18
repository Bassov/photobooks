import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FLAKY_PATH = 'e2e/flaky.json'

/**
 * @param {string} path
 */
export function normalizeFlakyPath(path) {
  return String(path).trim().replaceAll('\\', '/').replace(/^\.\//, '')
}

/**
 * Load repo-relative spec paths from e2e/flaky.json.
 * @param {{
 *   root?: string,
 *   readFile?: (path: string) => string,
 *   exists?: (path: string) => boolean,
 * }} [io]
 * @returns {string[]}
 */
export function loadFlakySpecPaths(io = {}) {
  const root = io.root ?? process.cwd()
  const exists = io.exists ?? ((path) => existsSync(path))
  const readFile = io.readFile ?? ((path) => readFileSync(path, 'utf8'))
  const filePath = join(root, FLAKY_PATH)
  if (!exists(filePath)) {
    throw new Error(`${FLAKY_PATH} is required`)
  }
  const raw = JSON.parse(readFile(filePath))
  if (!Array.isArray(raw)) {
    throw new Error(`${FLAKY_PATH} must be a JSON array of spec paths`)
  }
  const paths = raw.map(normalizeFlakyPath).filter((path) => path.length > 0)
  for (const path of paths) {
    if (!path.startsWith('e2e/') || !path.endsWith('.spec.ts')) {
      throw new Error(
        `${FLAKY_PATH} entry must be an e2e/**/*.spec.ts path, got ${path}`,
      )
    }
  }
  return [...new Set(paths)].sort()
}

/**
 * Playwright testDir-relative globs for listed specs.
 * @param {string[]} repoPaths
 */
export function flakyTestDirGlobs(repoPaths) {
  return repoPaths.map((path) =>
    path.startsWith('e2e/') ? path.slice('e2e/'.length) : path,
  )
}

/**
 * @param {string[]} targets
 * @param {string[]} flakyPaths
 */
export function excludeFlakyFromTargets(targets, flakyPaths) {
  const blocked = new Set(flakyPaths.map(normalizeFlakyPath))
  return targets.map(normalizeFlakyPath).filter((path) => !blocked.has(path))
}

/**
 * Done-when probe: a new `scripts/foo.mjs` enters coverage and mutate via globs.
 */

/**
 * @param {string} file
 */
export function isScriptTestPath(file) {
  return typeof file === 'string' && file.endsWith('.test.mjs')
}

/**
 * @param {string} file
 */
export function isScriptProductionPath(file) {
  return (
    typeof file === 'string' &&
    file.startsWith('scripts/') &&
    file.endsWith('.mjs') &&
    !isScriptTestPath(file)
  )
}

/**
 * ≤10 lines, sole relative sibling `.mjs` import, and an invoke (`(`) of that import.
 * @param {unknown} content
 */
export function isThinDelegatingCli(content) {
  const text = String(content ?? '')
  if (!text) return false
  const lines = text.split('\n')
  if (lines.length > 10) return false
  /** @type {string | null} */
  let fromPath = null
  for (const line of lines) {
    const fromIdx = line.indexOf(' from ')
    if (fromIdx === -1) continue
    const after = line.slice(fromIdx + ' from '.length).trim()
    const quote = after[0]
    if (quote !== "'" && quote !== '"') return false
    const end = after.indexOf(quote, 1)
    if (end === -1) return false
    const spec = after.slice(1, end)
    if (fromPath !== null) return false
    fromPath = spec
  }
  if (fromPath === null) return false
  if (!fromPath.startsWith('./')) return false
  if (!fromPath.endsWith('.mjs')) return false
  if (!text.includes('(')) return false
  return true
}

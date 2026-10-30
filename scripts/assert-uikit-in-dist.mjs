/**
 * Fail the build when the UI kit is missing from the deploy bundle.
 * The Worker serves ./dist with SPA fallback, so a missing dist/uikit/
 * silently serves the app at /uikit/ instead of the kit (regressed in #290).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function checkUikitInDist(distDir) {
  const index = join(distDir, 'uikit', 'index.html')
  if (!existsSync(index)) return `missing ${index}`
  const html = readFileSync(index, 'utf8')
  if (!html.includes('assets/kit.js'))
    return `${index} does not load the kit bundle (assets/kit.js)`
  if (!existsSync(join(distDir, 'uikit', 'assets', 'kit.js')))
    return `missing ${join(distDir, 'uikit', 'assets', 'kit.js')}`
  return null
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const err = checkUikitInDist(process.argv[2] ?? 'dist')
  if (err) {
    console.error(`assert-uikit-in-dist: ${err}`)
    process.exit(1)
  }
  console.log('assert-uikit-in-dist: ok')
}

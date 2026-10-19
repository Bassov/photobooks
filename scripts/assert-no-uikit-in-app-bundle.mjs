#!/usr/bin/env node
/**
 * Fail if the app Rollup output under dist/assets contains uikit markers.
 * Does not scan dist/uikit/ (kit's own bundle).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const MARKERS = Object.freeze([
  'photobooks-ui-kit',
  'uikit/src/',
  '/uikit/src/',
])

/**
 * @param {string} root
 * @param {{ readFileSync?: typeof fs.readFileSync, readdirSync?: typeof fs.readdirSync, statSync?: typeof fs.statSync, existsSync?: typeof fs.existsSync }} [io]
 * @returns {{ ok: true } | { ok: false, hits: { file: string, marker: string }[] }}
 */
export function assertNoUikitInAppBundle(root, io = {}) {
  const existsSync = io.existsSync ?? fs.existsSync
  const readdirSync = io.readdirSync ?? fs.readdirSync
  const statSync = io.statSync ?? fs.statSync
  const readFileSync = io.readFileSync ?? fs.readFileSync

  const assetsDir = path.join(root, 'dist', 'assets')
  if (!existsSync(assetsDir)) {
    return {
      ok: false,
      hits: [{ file: 'dist/assets', marker: 'missing-app-assets-dir' }],
    }
  }

  /** @type {string[]} */
  const files = []
  /** @param {string} dir */
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = path.join(dir, name)
      const st = statSync(abs)
      if (st.isDirectory()) walk(abs)
      else if (/\.(js|mjs|cjs|css|map)$/.test(name)) files.push(abs)
    }
  }
  walk(assetsDir)

  /** @type {{ file: string, marker: string }[]} */
  const hits = []
  for (const abs of files) {
    const rel = path.relative(root, abs).split(path.sep).join('/')
    if (rel.startsWith('dist/uikit/')) continue
    const text = readFileSync(abs, 'utf8')
    for (const marker of MARKERS) {
      if (text.includes(marker)) hits.push({ file: rel, marker })
    }
  }
  return hits.length === 0 ? { ok: true } : { ok: false, hits }
}

export function main(
  root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
) {
  const result = assertNoUikitInAppBundle(root)
  if (!result.ok) {
    for (const h of result.hits) {
      console.error(`uikit-in-app-bundle: ${h.file} contains ${h.marker}`)
    }
    return 1
  }
  console.log('OK assert-no-uikit-in-app-bundle')
  return 0
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main()
}

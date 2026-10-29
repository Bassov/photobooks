#!/usr/bin/env node
/**
 * Fail if the deploy `dist/` (built without VITE_TEST_FIXTURES) contains test
 * fixture or test-hook markers. Does not scan dist/uikit/ (the kit's own bundle).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const MARKERS = Object.freeze([
  '__photobooksProject',
  '__photobooksThumbs',
  '__photobooksRelink',
  'painter-fixture',
  'painter-a',
  'e2e-photo-folder-input',
])

/**
 * @param {string} root
 * @param {{ readFileSync?: typeof fs.readFileSync, readdirSync?: typeof fs.readdirSync, statSync?: typeof fs.statSync, existsSync?: typeof fs.existsSync }} [io]
 * @returns {{ ok: true } | { ok: false, hits: { file: string, marker: string }[] }}
 */
export function assertDistClean(root, io = {}) {
  const existsSync = io.existsSync ?? fs.existsSync
  const readdirSync = io.readdirSync ?? fs.readdirSync
  const statSync = io.statSync ?? fs.statSync
  const readFileSync = io.readFileSync ?? fs.readFileSync

  const dist = path.join(root, 'dist')
  if (!existsSync(path.join(dist, 'assets'))) {
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
      if (abs === path.join(dist, 'uikit')) continue
      if (statSync(abs).isDirectory()) walk(abs)
      else if (/\.(js|mjs|cjs|css|html|map)$/.test(name)) files.push(abs)
    }
  }
  walk(dist)

  /** @type {{ file: string, marker: string }[]} */
  const hits = []
  for (const abs of files) {
    const rel = path.relative(root, abs).split(path.sep).join('/')
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
  const result = assertDistClean(root)
  if (!result.ok) {
    for (const h of result.hits) {
      console.error(`dist-clean: ${h.file} contains ${h.marker}`)
    }
    return 1
  }
  console.log('OK assert-dist-clean')
  return 0
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main()
}

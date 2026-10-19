#!/usr/bin/env node
/**
 * Done-when proof: preview-serve dist/, open all kit pages at /uikit/ in Light + Dark,
 * assert zero console errors/pageerrors. Manual evidence helper (not in pnpm check).
 *
 * Run: pnpm build && node scripts/with-playwright-env.mjs node scripts/uikit-preview-proof.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const requireFromUikit = createRequire(
  pathToFileURL(path.join(root, 'uikit/package.json')).href,
)
const { chromium } = requireFromUikit('playwright-core')
const pages = JSON.parse(
  fs.readFileSync(path.join(root, 'uikit/src/kit/pages.json'), 'utf8'),
)
const slugs = pages.map((p) => p.slug)
const port = Number(process.env.UIKIT_PROOF_PORT ?? '4173')
const base = `http://127.0.0.1:${String(port)}/uikit/`
const chrome =
  process.env.CHROME_PATH ??
  (() => {
    throw new Error(
      'CHROME_PATH required (use scripts/with-playwright-env.mjs)',
    )
  })()

const preview = spawn(
  'pnpm',
  ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
)

/** @type {string[]} */
const previewLog = []
preview.stdout.on('data', (d) => previewLog.push(String(d)))
preview.stderr.on('data', (d) => previewLog.push(String(d)))

async function waitReady() {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}index.html`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`preview not ready\n${previewLog.join('')}`)
}

try {
  await waitReady()
  const browser = await chromium.launch({
    executablePath: chrome,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  /** @type {string[]} */
  const errs = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    // Browsers request /favicon.ico on the preview origin; not a kit asset.
    if (text.includes('favicon.ico')) return
    errs.push(`console: ${text.slice(0, 200)}`)
  })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))

  await page.goto(`${base}#/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)

  const themes = ['Light', 'Dark']
  /** @type {Record<string, number>} */
  const byTheme = {}
  for (const th of themes) {
    const before = errs.length
    await page
      .locator(`[data-testid="theme-toggle"] [aria-label="${th}"]`)
      .click()
    for (const slug of slugs) {
      await page.evaluate((h) => {
        location.hash = h
      }, `#/feature/${slug}`)
      await page.waitForTimeout(350)
      const visible = await page.locator('[data-testid="demo"]').isVisible()
      if (!visible) errs.push(`missing demo: ${th} ${slug}`)
    }
    byTheme[th] = errs.length - before
  }

  await page.evaluate(() => {
    location.hash = '#/'
  })
  await page.waitForTimeout(300)
  const indexOk = await page.locator('[data-testid="index-search"]').isVisible()

  await browser.close()
  const summary = {
    base,
    pages: slugs.length,
    themes,
    consoleErrors: errs.length,
    errorsByTheme: byTheme,
    indexSearchVisible: indexOk,
    sampleErrs: errs.slice(0, 20),
  }
  console.log(JSON.stringify(summary, null, 2))
  if (errs.length > 0 || !indexOk || slugs.length !== 77) process.exitCode = 1
} finally {
  preview.kill('SIGTERM')
  setTimeout(() => {
    try {
      preview.kill('SIGKILL')
    } catch {
      // already gone
    }
    process.exit(process.exitCode ?? 0)
  }, 1500).unref()
}

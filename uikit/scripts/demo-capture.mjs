// Deterministic #/demo walk → numbered PNGs. Shared by demo-baseline.mjs and demo-diff.mjs.
// Fixed viewport 1440x900, light theme (the demo has no theme toggle), DPR 1, animations/transitions zeroed,
// caret hidden, fonts settled, mouse parked, fixed Date. Every step is listed in STEPS (name → action); a failed step aborts.
import { chromium } from "playwright-core"
import fs from "node:fs"
import { chromePath } from "./chrome.mjs"
export const URL_ = "file://" + new URL("../dist/index.html", import.meta.url).pathname + "?theme=procreate-light#/demo"
const CSS = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}`
const FIXED = Date.UTC(2026, 9, 29, 12, 0, 0)

export async function capture(out, { log = console.log } = {}) {
  fs.mkdirSync(out, { recursive: true })
  for (const f of fs.readdirSync(out)) if (f.endsWith(".png")) fs.unlinkSync(`${out}/${f}`)
  const browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox", "--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"] })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "en-US", timezoneId: "UTC" })
  await ctx.addInitScript(() => { const pn = performance.now.bind(performance); window.__pt = null; performance.now = () => (window.__pt ?? pn()) })
  await ctx.addInitScript((t) => { const D = Date; const off = t - D.now(); class FD extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off])) } static now() { return D.now() + off } } window.Date = FD; Math.random = (() => { let s = 42; return () => ((s = (s * 16807) % 2147483647) / 2147483647) })() }, FIXED)
  const page = await ctx.newPage(); page.setDefaultTimeout(6000)
  const errs = []
  page.on("pageerror", (e) => errs.push(e.message))
  const settle = async (ms = 350) => {
    await page.waitForTimeout(ms)
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r }))) })
    await page.waitForTimeout(120)
  }
  const park = () => page.mouse.move(1439, 899)
  const c = (sel) => page.locator(sel).first().click()
  const dlgBtn = (re) => page.locator("[role=dialog]").getByRole("button", { name: re }).last()
  const shots = []; let n = 0
  const shot = async (name, keep) => { if (!keep) await park(); const wait = undefined; await settle(wait); n++; const f = `${String(n).padStart(2, "0")}-${name}.png`; await page.screenshot({ path: `${out}/${f}` }); shots.push(f); log(f) }

  await page.goto(URL_); await page.addStyleTag({ content: CSS })
  await page.evaluate(() => window.__demo.reset()); await settle(600)
  // progress dialogs: freeze performance.now at t0, start, jump to t0+half, shoot, then release (real now ≫ t0 → done)
  const midRun = async (go) => { await page.evaluate(() => { window.__pt = Math.floor(performance.now()) }); await c(go); await page.waitForTimeout(300); await page.evaluate(() => { window.__pt += 700 }); await page.waitForTimeout(300) }
  const release = () => page.evaluate(() => { window.__pt = null })
  const STEPS = [
    ["welcome", async () => {}],
    ["welcome-folder-picker", () => c('[data-testid="create-library"]')],
    ["library-empty", () => c('[data-testid="picker-select"]')],
    ["library-change-folder-confirm", () => c('[data-testid="change-library"]')],
    ["create-book-dialog", async () => { await page.keyboard.press("Escape"); await settle(); await c('[data-testid="demo"] [data-testid="new-book"]'); await settle(); await page.locator("[role=dialog] input").first().fill("Lake trip") }],
    ["create-book-size-menu", () => page.locator("[role=dialog]").getByRole("button", { name: /A5|A4|Square|cm/ }).first().click()],
    ["create-book-custom-size", async () => { await page.getByRole("option", { name: /Custom size/ }).click(); await settle(200); await page.fill('[data-testid="create-custom-w"]', "19"); await page.fill('[data-testid="create-custom-h"]', "23") }],
    ["editor-new-blank-book", () => c('[data-testid="create-book"]')],
    ["editor-cover-selected", () => c('[data-item="cover"]')],
    ["editor-add-folder-picker", () => c('[data-testid="demo-add-folder"]')],
    ["editor-photos-added", () => dlgBtn(/Choose|Select|Use|Add/i).click()],
    ["editor-filmstrip-hover", async () => { const b = await page.locator('[data-testid="filmstrip"] [role="row"]').nth(2).boundingBox(); await page.mouse.move(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)); return "keep" }],
    ["editor-cover-photo-and-title", async () => {
      await c('[data-item="cover"]'); await settle(250)
      await page.locator('[data-testid="filmstrip"] [role="row"]').nth(3).dragTo(page.locator('[data-testid="cover-front"]')); await settle(450)
      if (!(await page.locator('[data-testid="cover-text-front"]').count())) { await c('[data-item="cover"]'); await settle(250) }
      await page.fill('[data-testid="cover-text-front"]', "Lake trip 2026"); await page.locator('[data-testid="cover-text-front"]').blur() }],
    ["editor-spread-1", () => c('[data-item="p1"]')],
    ["editor-photo-dropped-in-frame", () => page.locator('[data-testid="filmstrip"] [role="row"]').nth(5).dragTo(page.locator('[data-testid="canvas"] [data-testid="frame"]').first())],
    ["editor-frame-selected", () => c('[data-testid="canvas"] [data-testid="frame"]')],
    ["editor-frame-mid-drag", async () => { const b = await page.locator('[data-testid="canvas"] [data-testid="frame"]').first().boundingBox(); const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2); await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 6; i++) await page.mouse.move(x - 10 * i, y + 6 * i); return "keep" }],
    ["editor-frame-drag-cancelled", async () => { await page.keyboard.press("Escape"); await page.mouse.up(); await settle(200); await c('[data-testid="canvas"] [data-testid="frame"]') }],
    ["editor-crop-mode", () => c('[data-testid="crop-toggle"]')],
    ["editor-spread-selected", async () => { await page.keyboard.press("Escape"); await settle(200); await page.keyboard.press("Escape"); await settle(200); await page.locator('[data-testid="canvas"]').click({ position: { x: 20, y: 20 } }) }],
    ["editor-masters-mode", () => page.locator('[data-testid="mode-seg"]').getByText("Masters", { exact: true }).click()],
    ["editor-master-grid-5-cols", async () => { const col = page.locator('[data-testid="master-field-grid"] input').first(); await col.fill("5"); await col.press("Enter"); await col.blur() }],
    ["editor-pages-mode", () => page.locator('[data-testid="mode-seg"]').getByText("Pages", { exact: true }).click()],
    ["editor-inspector-book", () => c('[data-testid="book-title"]')],
    ["editor-endpaper-selected", async () => { await c('[data-testid="book-title"]'); await settle(200); await c('[data-item="ef"]') }],
    // kit10: the views, spread menu / reorder, master guides + Page numbers, overrides, missing photo and Relink that #/demo used to hide
    ["editor-view-rulers-guide", async () => { await c('[data-item="p1"]'); await settle(250); await c('[data-testid="toggle-rulers"]'); await settle(200); const r = await page.locator('[data-testid="ruler-x"]').boundingBox(); const t = await page.locator('[data-testid="spread"]').first().boundingBox(); await page.mouse.move(Math.round(r.x + r.width / 2), Math.round(r.y + 10)); await page.mouse.down(); await page.mouse.move(Math.round(r.x + r.width / 2), Math.round(t.y + t.height * 0.4), { steps: 6 }); await page.mouse.up(); return "keep" }],
    ["editor-view-dpi-badge", async () => { await page.locator('[data-testid="filmstrip"] [role="row"]').nth(1).dragTo(page.locator('[data-testid="canvas"] [data-testid="frame"]').first()); await settle(400); await c('[data-testid="toggle-dpi"]') }], // p02 is the 800 px low-res photo
    ["editor-view-bleed-trim-safe", async () => { await c('[data-testid="toggle-overlays"]') }],
    ["editor-spread-row-menu", async () => { await c('[data-testid="toggle-overlays"]'); await c('[data-testid="toggle-dpi"]'); await c('[data-testid="toggle-rulers"]'); await page.locator('[data-item="p1"]').hover(); await c('[data-item="p1"] [data-testid="spread-menu"]') }],
    ["editor-spread-duplicated", async () => { await page.getByRole("menuitem", { name: /Duplicate/ }).click() }],
    ["editor-spread-reordered", async () => { await page.locator('[data-item="p2"]').dragTo(page.locator('[data-item="p4"]')); await settle(300) }],
    ["editor-master-guides-edit", async () => { await page.locator('[data-testid="mode-seg"]').getByText("Masters", { exact: true }).click(); await settle(250); await c('[data-testid="toggle-rulers"]'); await settle(200); const r = await page.locator('[data-testid="ruler-y"]').boundingBox(); const t = await page.locator('[data-testid="canvas-master"]').boundingBox(); await page.mouse.move(Math.round(r.x + 10), Math.round(r.y + r.height / 2)); await page.mouse.down(); await page.mouse.move(Math.round(t.x + t.width * 0.3), Math.round(r.y + r.height / 2), { steps: 6 }); await page.mouse.up(); return "keep" }],
    ["editor-master-page-numbers-on", async () => { await c('[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]') }],
    ["editor-spread-inherits-master", async () => { await page.locator('[data-testid="mode-seg"]').getByText("Pages", { exact: true }).click(); await settle(250); await c('[data-item="p1"]') }],
    ["editor-parent-item-overridden", async () => { await page.locator('[data-testid="master-frame"]').first().click({ modifiers: ["Alt"], force: true }) }],
    ["editor-missing-photos", async () => { await page.evaluate(() => window.__demo.missing(2)); await settle(400) }],
    ["editor-relink-dialog", () => c('[data-testid="demo-relink"]')],
    ["editor-relink-rescan-picker", () => c('[data-testid="relink-rescan"]')],
    ["editor-relink-found", () => dlgBtn(/Choose|Select|Use|Open/i).click()],
    ["editor-relinked", () => c('[data-testid="relink-resolve"]')],
    ["editor-preview", () => c('[data-testid="demo-preview"]')],
    ["print-options", async () => { await page.keyboard.press("Escape"); await settle(); if (await page.locator('[data-testid="book-preview"]').count()) { await page.locator('[data-testid="book-preview"]').getByRole("button", { name: /close|back/i }).first().click() ; await settle() } await c('[data-testid="demo-print"]') }],
    ["print-options-4up-no-bleed", async () => { await page.locator("[role=dialog]").getByText("4-up", { exact: true }).click(); await page.locator("[role=dialog]").getByText(/Add 3 mm bleed/).click() }],
    ["print-running-50pct", () => midRun('[data-testid="print-go"]')],
    ["print-done", async () => { await release(); await page.waitForSelector('[data-testid="print-dialog"][data-step="done"]', { timeout: 8000 }) }],
    ["print-done-shown-in-folder", () => c('[data-testid="print-show"]')],
    ["publish-options", async () => { await c('[data-testid="print-close"]'); await settle(); await c('[data-testid="demo-publish"]') }],
    ["publish-running-50pct", () => midRun('[data-testid="publish-go"]')],
    ["publish-done", async () => { await release(); await page.waitForSelector('[data-testid="publish-dialog"][data-step="done"]', { timeout: 8000 }) }],
    ["site-catalog", () => c('[data-testid="publish-open-site"]')],
    ["site-book", () => c('[data-testid="site-book"]')],
    ["site-share", () => c('[data-testid="site-share"]')],
    ["site-fullscreen", async () => { await page.keyboard.press("Escape"); await settle(200); await c('[data-testid="site-fullscreen-btn"]') }],
    ["editor-after-site", async () => { await page.keyboard.press("Escape"); await settle(); await c('[data-testid="demo-site-back"]') }],
    ["settings-from-editor", () => c('[data-testid="demo-editor-settings"]')],
    ["library-one-book", async () => { await c('[data-testid="demo-settings-back"]'); await settle(); await c('[data-testid="editor-library"]') }],
    ["library-book-menu", async () => { await page.locator('[data-testid="demo"] [data-testid="book-cover"]').first().hover(); await c('[data-testid="demo"] [data-testid="book-menu"]') }],
    ["library-rename", () => page.getByRole("menuitem", { name: "Rename" }).click()],
    ["library-duplicated", async () => { await page.locator('[data-testid="rename-input"]').fill("Lake trip ’26"); await page.locator('[data-testid="rename-input"]').press("Enter"); await settle(); await c('[data-testid="demo"] [data-testid="book-menu"]'); await settle(); await page.getByRole("menuitem", { name: "Duplicate" }).click() }],
    ["library-sort-menu", async () => { const s = page.locator('[data-testid="demo"] [data-testid="library-bar"]').getByRole("button", { name: /sort|edited/i }).first(); await s.click() }],
    ["library-search-no-results", async () => { await page.keyboard.press("Escape"); await settle(); await page.fill('[data-testid="lib-search-input"]', "zzz") }],
    ["library-remove-confirm", async () => { await page.fill('[data-testid="lib-search-input"]', ""); await settle(); await c('[data-testid="demo"] [data-testid="book-menu"]'); await settle(); await page.getByRole("menuitem", { name: /Remove/ }).click() }],
    ["library-after-remove", () => page.getByRole("button", { name: "Remove book" }).click()],
    ["settings-from-library", () => c('[data-testid="demo"] [data-testid="home-settings"]')],
  ]
  for (const [name, act] of STEPS) {
    try { const r = await act(); await shot(name, r === "keep") } catch (e) { await browser.close(); throw new Error(`step ${n + 1} ${name}: ${e.message.split("\n")[0]}`) }
  }
  await browser.close()
  return { shots, errs }
}

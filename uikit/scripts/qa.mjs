// Headless QA over file:// (needs a built dist/ and Chrome; see scripts/chrome.mjs).  node scripts/qa.mjs [--quick]
//  1. manifest ↔ registry consistency, index links
//  2. every page at 1440×900 and 1280×800: no console errors / page errors, demo root visible and non-empty,
//     nothing clipped by the demo frame, no horizontal page overflow, title = slug
//  3. index: search, "/" + Esc, filter, collapse, scroll/state restore after Back; prev/next walk; Alt+←/→
//  4. key interaction smoke per page where it exists
import { chromium } from "playwright-core"
import fs from "node:fs"
import { chromePath } from "./chrome.mjs"
const url = "file://" + new URL("../../dist/uikit/index.html", import.meta.url).pathname
const pages = JSON.parse(fs.readFileSync(new URL("../src/kit/pages.json", import.meta.url)))
const slugs = pages.map((p) => p.slug)
const quick = process.argv.includes("--quick")
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []; let where = ""
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${where}] ${m.type()}: ${m.text().slice(0, 240)}`) })
page.on("pageerror", (e) => errs.push(`[${where}] pageerror: ${e.message}`))
page.on("requestfailed", (r) => errs.push(`[${where}] requestfailed: ${r.url()}`))
const res = []; let fails = 0
const ok = (name, cond, extra = "") => { if (!cond) fails++; res.push(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`) }
const hash = () => page.evaluate(() => location.hash)
const go = async (h, wait = 450) => { where = h; await page.evaluate((h) => { location.hash = h }, h); await page.waitForTimeout(wait) }
const demo = '[data-testid="demo"]'
const feat = (s) => `#/feature/${s}`
await page.goto(url + "#/"); await page.waitForTimeout(600)

// ---------------------------------------------------------------- 1. manifest / registry / index links
const kit = await page.evaluate(() => window.__kit)
ok("manifest ↔ registry", kit.missingDemo.length === 0 && kit.orphanDemo.length === 0, `${kit.pages.length} pages; missing demo: ${kit.missingDemo.join(",") || "-"}; orphan demo: ${kit.orphanDemo.join(",") || "-"}`)
ok("manifest slugs unique", new Set(slugs).size === slugs.length)
const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))
const linked = hrefs.filter((h) => h.startsWith("#/feature/")).map((h) => h.slice(10))
const bad = hrefs.filter((h) => !(h === "#/" || h === "#/components" || (h.startsWith("#/feature/") && slugs.includes(h.slice(10)))))
ok("index links resolve", bad.length === 0, `${hrefs.length} links, bad: ${bad.join(",") || "-"}`)
ok("index lists every page in manifest order", JSON.stringify(linked) === JSON.stringify(slugs), `${linked.length}/${slugs.length}`)
await go("#/f/missing-assets-relink"); ok("legacy #/f/<slug> alias", await page.isVisible('[data-testid="feature-title"]'))
await go("#/feature/no-such-slug"); ok("unknown slug → not-found page", await page.isVisible('[data-testid="not-found"]'))

// ---------------------------------------------------------------- 2. per-page render checks, two viewports
const probe = () => page.evaluate(() => {
  const d = document.querySelector('[data-testid="demo"]')
  if (!d) return { demo: false }
  const r = d.getBoundingClientRect()
  const visible = r.width > 200 && r.height > 80 && getComputedStyle(d).visibility !== "hidden"
  const content = d.querySelectorAll("*").length
  const text = (d.innerText || "").trim().length
  const media = d.querySelectorAll("img, svg, canvas").length
  // elements cut off by the demo frame itself (no clipping/scrolling ancestor in between)
  const clipped = []
  for (const el of d.querySelectorAll("*")) {
    const er = el.getBoundingClientRect()
    if (er.width < 4 || er.height < 4) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue
    if (er.right <= r.right + 2 && er.bottom <= r.bottom + 2 && er.left >= r.left - 2 && er.top >= r.top - 2) continue
    let a = el.parentElement, inner = false
    while (a && a !== d) { const s = getComputedStyle(a); if (s.overflowX !== "visible" || s.overflowY !== "visible" || s.clipPath !== "none") { inner = true; break } a = a.parentElement }
    if (inner) continue
    const pr = el.parentElement.getBoundingClientRect()
    if (pr.right > r.right + 2 || pr.bottom > r.bottom + 2) continue // report the outermost offender only
    clipped.push(`${el.tagName.toLowerCase()}${el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}]` : el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""} ${Math.round(er.right - r.right)}/${Math.round(er.bottom - r.bottom)}`)
  }
  return {
    demo: true, visible, content, text, media, clipped: clipped.slice(0, 4),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    brokenImgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    title: document.querySelector('[data-testid="feature-title"]')?.textContent,
  }
})
for (const [w, h] of (quick ? [[1440, 900]] : [[1440, 900], [1280, 800]])) {
  await page.setViewportSize({ width: w, height: h })
  const failsHere = []
  for (const s of slugs) {
    const e0 = errs.length
    await go(feat(s), 420)
    const p = await probe()
    const problems = []
    if (!p.demo || !p.visible) problems.push("demo not visible")
    if (p.demo && (p.content < 3 || (p.text < 10 && p.media === 0))) problems.push(`demo empty (${p.content} nodes, ${p.text} chars)`)
    if (p.overflowX) problems.push("horizontal page overflow")
    if (p.brokenImgs) problems.push(`${p.brokenImgs} broken images`)
    if (p.clipped?.length) problems.push(`clipped by demo frame: ${p.clipped.join(", ")}`)
    if (p.title !== s) problems.push(`title "${p.title}"`)
    if (errs.length > e0) problems.push(`${errs.length - e0} console errors`)
    if (problems.length) failsHere.push(`${s}: ${problems.join("; ")}`)
  }
  ok(`all ${slugs.length} pages render cleanly at ${w}×${h}`, failsHere.length === 0, failsHere.slice(0, 12).join(" | "))
}
await page.setViewportSize({ width: 1440, height: 900 })
for (const [h, n] of [["#/", "index"], ["#/components", "components"]]) {
  await go(h); ok(`${n} page: no horizontal overflow`, !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)))
}
await go("#/components"); ok("components page renders", (await page.locator("h2").count()) > 10)

// ---------------------------------------------------------------- 3. navigation, search, restore
await page.evaluate(() => sessionStorage.clear())
await go("#/")
const rows = () => page.locator("[data-feature-link]").count()
const n0 = await rows()
ok("index shows all pages", n0 === slugs.length, `${n0}`)
await page.keyboard.press("/")
ok("'/' focuses search", await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "index-search-input"))
await page.keyboard.type("relink"); await page.waitForTimeout(150)
ok("search filters by slug", (await rows()) === 1 && (await page.locator('[data-feature-link="missing-assets-relink"]').count()) === 1, `${await rows()} rows`)
await page.keyboard.press("Escape"); await page.waitForTimeout(150)
ok("Esc clears search", (await rows()) === n0 && (await page.inputValue('[data-testid="index-search-input"]')) === "")
await page.fill('[data-testid="index-search-input"]', "lightbox"); await page.waitForTimeout(150)
ok("search filters by title", (await page.locator('[data-feature-link="site-lightbox"]').count()) === 1)
await page.fill('[data-testid="index-search-input"]', "zzzz-nothing"); await page.waitForTimeout(150)
ok("no-results state", await page.isVisible('[data-testid="no-results"]'))
await page.fill('[data-testid="index-search-input"]', ""); await page.locator("body").click({ position: { x: 5, y: 300 } })
await page.click('[data-testid="index-filter"] [role="tab"]:has-text("Static")'); await page.waitForTimeout(150)
const nStatic = pages.filter((p) => p.kind === "static").length
ok("filter: static", (await rows()) === nStatic, `${await rows()} / ${nStatic}`)
await page.click('[data-testid="index-filter"] [role="tab"]:has-text("All")'); await page.waitForTimeout(150)
// collapse M1, set a search, scroll, open a page, come back
await page.locator('[data-group^="M1 "] [data-testid="group-toggle"]').click(); await page.waitForTimeout(150)
const n1 = await rows()
ok("collapse a group", n1 === n0 - pages.filter((p) => p.group.startsWith("M1 ")).length, `${n0}→${n1}`)
await page.click('[data-testid="index-filter"] [role="tab"]:has-text("Interactive")'); await page.waitForTimeout(150)
const target = page.locator('[data-feature-link="preflight-panel"]')
await target.scrollIntoViewIfNeeded(); await page.evaluate(() => scrollBy(0, 120)); await page.waitForTimeout(250)
const y0 = await page.evaluate(() => Math.round(scrollY))
const rows0 = await rows()
await target.click(); await page.waitForTimeout(450)
ok("index row opens the page", (await hash()) === feat("preflight-panel"))
await page.click('[data-nav="next"]'); await page.waitForTimeout(300)
await page.goBack(); await page.waitForTimeout(250); await page.goBack(); await page.waitForTimeout(500)
const y1 = await page.evaluate(() => Math.round(scrollY))
ok("browser Back restores index scroll position", (await hash()) === "#/" && Math.abs(y1 - y0) <= 4, `y ${y0} → ${y1}`)
ok("Back restores filter + collapsed groups", (await rows()) === rows0 && (await page.locator('[data-testid="index-filter"] [aria-selected="true"]').textContent()) === "Interactive", `${await rows()} rows`)
ok("Back focuses the last opened row", await page.evaluate(() => document.activeElement?.getAttribute("data-feature-link") === "preflight-panel"))
await page.locator('[data-feature-link="dpi-badge"]').click(); await page.waitForTimeout(400)
await page.click('[data-nav="footer-index"]'); await page.waitForTimeout(450)
const y2 = await page.evaluate(() => Math.round(scrollY))
ok("Index link from a page restores position too", Math.abs(y2 - y0) <= 60 && y2 > 100, `y ${y2}`)
await page.click('[data-testid="toggle-all"]'); await page.waitForTimeout(100)
await page.click('[data-testid="index-filter"] [role="tab"]:has-text("All")'); await page.waitForTimeout(100)
if ((await rows()) === 0) await page.click('[data-testid="toggle-all"]')
await page.waitForTimeout(100); ok("expand / collapse all", (await rows()) === n0, `${await rows()}`)
await page.evaluate(() => sessionStorage.clear())

// prev / next walk
await go(feat(slugs[0]))
const mism = []
for (let i = 0; i < slugs.length - 1; i++) {
  where = slugs[i + 1]
  await page.click('[data-nav="next"]'); await page.waitForTimeout(90)
  if ((await hash()) !== feat(slugs[i + 1])) mism.push(`${slugs[i]}→${await hash()}`)
}
ok("next walk through all pages", mism.length === 0, `${slugs.length - 1} steps ${mism.slice(0, 5).join(" ")}`)
await page.click('[data-nav="prev"]'); await page.waitForTimeout(150)
ok("prev works", (await hash()) === feat(slugs[slugs.length - 2]))
await page.keyboard.press("Alt+ArrowLeft"); await page.waitForTimeout(150)
ok("Alt+← works", (await hash()) === feat(slugs[slugs.length - 3]))
await page.keyboard.press("Alt+ArrowRight"); await page.waitForTimeout(150)
ok("Alt+→ works", (await hash()) === feat(slugs[slugs.length - 2]))

// notes collapse persists
await go(feat("inspector"))
await page.click('[data-testid="notes-toggle"]'); await page.waitForTimeout(100)
const closed = !(await page.isVisible('[data-testid="notes-body"]'))
await go(feat("guides"))
const stillClosed = !(await page.isVisible('[data-testid="notes-body"]'))
await page.click('[data-testid="notes-toggle"]'); await page.waitForTimeout(100)
ok("UX notes collapse and the choice persists across pages", closed && stillClosed && (await page.isVisible('[data-testid="notes-body"]')))
const nb = await page.locator('[data-testid="ux-notes"]').boundingBox(), db = await page.locator(demo).boundingBox()
ok("notes sit above a full-width demo", nb.y + nb.height <= db.y && Math.abs(nb.width - db.width) < 2)

// ---------------------------------------------------------------- 4. interaction smoke
const smoke = async (name, slug, fn) => {
  await go(feat(slug))
  const e0 = errs.length
  let pass = false, info = ""
  try { const r = await fn(); pass = r === true || (Array.isArray(r) && r[0]); info = Array.isArray(r) ? r[1] : "" } catch (e) { info = e.message.split("\n")[0].slice(0, 160) }
  ok(`${slug}: ${name}`, pass && errs.length === e0, info + (errs.length > e0 ? ` (+${errs.length - e0} console errors)` : ""))
  await page.keyboard.press("Escape").catch(() => {})
}
const D = (s) => page.locator(`${demo} ${s}`)
const txt = (s) => page.textContent(s).catch(() => "")

await smoke("relink dialog fits the demo, Rescan → Resolve relinks", "missing-assets-relink", async () => {
  const dlg = await D('[role="dialog"]').boundingBox(), box = await page.locator(demo).boundingBox()
  const fits = dlg && dlg.x >= box.x && dlg.y >= box.y && dlg.x + dlg.width <= box.x + box.width + 1 && dlg.y + dlg.height <= box.y + box.height + 1
  await D('[data-testid="rescan"]').click(); await page.waitForTimeout(1900)
  await D('[data-testid="resolve"]').click(); await page.waitForTimeout(400)
  return [fits && !(await D('[data-testid="missing-pill"]').count()), `fits=${fits}`]
})
await smoke("photo card opens EXIF-rotated photo", "m0-photo-card", async () => { await D('[data-testid="open-rotated"]').click(); await page.waitForTimeout(1100); return D('[data-testid="photo-card"]').isVisible() })
await smoke("progressive import fills the filmstrip", "editor-shell-filmstrip", async () => { await D('[data-testid="choose-photo-folder"]').click(); await page.waitForTimeout(3600); return [(await D('[data-testid="filmstrip"] [role="row"]').count()) >= 20, `${await D('[data-testid="filmstrip"] [role="row"]').count()} rows`] })
await smoke("start a book creates spreads", "spread-templates-ui", async () => { await D('[data-testid="start-create"]').click(); await page.waitForTimeout(300); return !(await D('[data-testid="start-card"]').count()) })
await smoke("drag photo onto frame + undo", "drag-place-replace", async () => {
  await D('[data-testid="filmstrip"] [role="row"]').nth(0).dragTo(D('[data-testid="frame"]').first()); await page.waitForTimeout(400)
  const st = await txt(`${demo} [data-testid="status"]`)
  await D('[data-testid="undo"]').click(); await page.waitForTimeout(200)
  return [/Placed|Replaced/.test(st ?? ""), `status="${st}"`]
})
await smoke("add spread button", "add-spread-camera", async () => { const a = await D('[data-testid="spreads-panel"] [role="row"]').count(); await D('[data-testid="fab-add"]').click(); await page.waitForTimeout(300); const b = await D('[data-testid="spreads-panel"] [role="row"]').count(); return [b === a + 1, `${a}→${b}`] })
await smoke("select frame → inspector X edits", "inspector", async () => {
  await D('[data-testid="frame"]').nth(2).click({ position: { x: 20, y: 20 } }); await page.waitForTimeout(200)
  const x = D('[data-testid="geometry"] input').first(); await x.fill("50"); await x.press("Enter"); await page.waitForTimeout(200)
  return (await x.inputValue()) === "50"
})
await smoke("grid toggle", "layout-grids-render-snap", async () => { const g1 = await D('[data-testid="grid-overlay"]').first().isVisible(); await D('[data-testid="toggle-grid"]').click(); await page.waitForTimeout(150); return g1 && !(await D('[data-testid="grid-overlay"]').first().isVisible().catch(() => false)) })
await smoke("remove from gallery → dialog / toast", "filmstrip-sort-filter", async () => {
  await D('[data-testid="filmstrip"] [role="row"]').first().hover()
  const rm = D('[data-testid="filmstrip"] button[aria-label^="Remove"]').first(); await rm.click({ force: true }); await page.waitForTimeout(300)
  return (await D('[role="alertdialog"], [role="dialog"]').count()) > 0 || /removed/i.test(await txt(demo))
})
await smoke("panels: collapse + keyboard resize", "ui-panels", async () => {
  const sep = D('[data-testid="resize-l"]'); await sep.focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(150)
  const t = await txt(demo); return [/left 204px/.test(t), (t.match(/left [^·]+/) ?? [""])[0]]
})
await smoke("presentation opens, Esc closes", "presentation-mode", async () => {
  await D('[data-testid="present"]').click(); await page.waitForTimeout(200); const o = await D('[data-testid="presentation"]').isVisible()
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Escape"); await page.waitForTimeout(200)
  return o && !(await D('[data-testid="presentation"]').isVisible().catch(() => false))
})
await smoke("spread menu → duplicate", "spread-list-panel", async () => {
  const a = await D('[data-testid="spreads-panel"] [role="row"]').count()
  await D('[data-testid="spread-menu"]').first().click({ force: true }); await page.waitForTimeout(200)
  await page.getByRole("menuitem", { name: /Duplicate/ }).click(); await page.waitForTimeout(250)
  const b = await D('[data-testid="spreads-panel"] [role="row"]').count(); return [b === a + 1, `${a}→${b}`]
})
await smoke("edit parent → banner → done", "parent-spreads", async () => {
  await D('[data-testid="edit-pa"]').click(); await page.waitForTimeout(200); const ban = await D('[data-testid="parent-banner"]').isVisible()
  await D('[data-testid="parent-done"]').click(); await page.waitForTimeout(200); return ban && !(await D('[data-testid="parent-banner"]').count())
})
await smoke("static export reaches done", "static-export", async () => {
  await D('[data-testid="export-start"]').click(); await page.waitForTimeout(250)
  await page.getByRole("button", { name: /^(Choose|Select|Open)/ }).last().click().catch(() => {}); await page.waitForTimeout(250)
  if (await D('[data-testid="export-run"]').count()) { await D('[data-testid="export-run"]').click(); await page.waitForTimeout(3600) }
  return /Site exported/.test(await txt(demo))
})
await smoke("site → book → lightbox", "site-viewer", async () => { await D('[data-testid="site-book"]').first().click(); await page.waitForTimeout(200); await D('[data-testid="site-spread"]').click(); await page.waitForTimeout(200); return D('[data-testid="lightbox"]').isVisible() })
await smoke("preflight fix removes an issue", "preflight-fixes", async () => { const a = await D('[data-testid="fix"]').count(); await D('[data-testid="fix"]').first().click(); await page.waitForTimeout(300); const b = await D('[data-testid="fix"]').count(); return [b < a, `${a}→${b}`] })
await smoke("scenario switcher works while a modal is open", "permissions-locks-ux", async () => {
  const m0 = await D('[data-testid="scenario-stage"] [role="dialog"], [data-testid="scenario-stage"] [role="alertdialog"]').count()
  await D('[data-testid="scenarios"] [role="tab"]').nth(2).click(); await page.waitForTimeout(250)
  const sel = await D('[data-testid="scenarios"] [role="tab"][aria-selected="true"]').textContent()
  return [m0 > 0 && /another tab/i.test(sel ?? ""), `modal=${m0} selected="${sel}"`]
})
fs.writeFileSync(new URL("../qa-report.txt", import.meta.url), res.join("\n") + "\n\nCONSOLE:\n" + (errs.join("\n") || "none") + "\n")
console.log(res.join("\n")); console.log(`\n${res.length - fails} passed, ${fails} failed; console errors/warnings: ${errs.length}`); if (errs.length) console.log(errs.slice(0, 20).join("\n"))
await browser.close()
process.exit(fails || errs.length ? 1 : 0)

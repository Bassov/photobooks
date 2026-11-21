// Headless QA over file:// (needs a built dist/ and Chrome; see scripts/chrome.mjs).  node scripts/qa.mjs [--quick]
//  1. manifest ↔ registry ↔ screens consistency, index links (screens + features)
//  2. every feature page AND every screen page at 1440×900 and 1280×800, Procreate light theme: no console errors / page errors,
//     demo root visible and non-empty, nothing clipped by the demo frame, no horizontal page overflow, title = slug / screen title
//  3. index: search, "/" + Esc, kind + milestone filters, collapse, scroll/state restore after Back; prev/next walk; Alt+←/→;
//     feature → screen links, screen pages list their features, screen prev/next walk
//  4. key interaction smoke per page where it exists (v4: single library, folder-only import, unsupported browser)
import { chromium } from "playwright-core"
import fs from "node:fs"
import { chromePath } from "./chrome.mjs"
const url = "file://" + new URL("../dist/index.html", import.meta.url).pathname
const pages = JSON.parse(fs.readFileSync(new URL("../src/kit/pages.json", import.meta.url)))
const screens = JSON.parse(fs.readFileSync(new URL("../src/kit/screens.json", import.meta.url)))
const screenIds = screens.map((s) => s.id)
const quick = process.argv.includes("--quick")
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"], ignoreDefaultArgs: ["--hide-scrollbars"] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []; let where = ""
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${where}] ${m.type()}: ${m.text().slice(0, 240)}`) })
page.on("pageerror", (e) => errs.push(`[${where}] pageerror: ${e.message}`))
page.on("requestfailed", (r) => errs.push(`[${where}] requestfailed: ${r.url()}`))
const res = []; let fails = 0
const ok = (name, cond, extra = "") => { if (!cond) fails++; res.push(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`) }
const hash = () => page.evaluate(() => location.hash)
const go = async (h, wait = 450) => {
  where = h
  // same hash → hashchange never fires and the demo keeps stale state; bounce through a throwaway route to force a fresh mount
  if (await page.evaluate(() => location.hash) === h) { await page.evaluate(() => { location.hash = "#/__remount" }); await page.waitForTimeout(60) }
  await page.evaluate((h) => { location.hash = h }, h); await page.waitForTimeout(wait)
}
const demo = '[data-testid="demo"]'
const feat = (s) => `#/feature/${s}`
const scr = (s) => `#/screen/${s}`
await page.goto(url + "#/"); await page.waitForTimeout(600)
await page.evaluate(() => sessionStorage.clear()); await page.reload(); await page.waitForTimeout(600)

// ---------------------------------------------------------------- 0. token lint (v4.1 audit): no arbitrary type sizes, shadows, radii or transition-all in src
{
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : /\.(tsx?|css)$/.test(e.name) ? [`${d}/${e.name}`] : [])
  const files = walk(new URL("../src", import.meta.url).pathname)
  const rules = [["text-[Npx]", /\btext-\[\d+(\.\d+)?px\]/g], ["shadow-[…]", /\bshadow-\[(?!var)[^\]]+\]/g], ["rounded-[Npx]", /\brounded-\[\d+(\.\d+)?px\]/g], ["transition-all", /\btransition-all\b/g], ["arbitrary p/m/gap", /\b(p|m|gap)[xytblr]?-\[(?!\d+%)[^\]]+\]/g], ["duration-N", /\bduration-\d/g]]
  for (const [name, re] of rules) {
    const hits = files.flatMap((f) => (fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").match(re) ?? []).map(() => f.split("/src/")[1]))
    ok(`token lint: no ${name}`, hits.length === 0, hits.length ? `${hits.length} in ${[...new Set(hits)].join(", ")}` : "0")
  }  // v6: primary/select/ring are neutral ink; still never used as text colour; links use text-accent-text
  const strip = (f) => fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  const accentText = files.filter((f) => /\.tsx?$/.test(f)).flatMap((f) => (strip(f).match(/\btext-(primary|select|ring)(?![-\w])(\/\d+)?/g) ?? []).map((m) => `${f.split("/src/")[1]}:${m}`))
  ok("token lint: accent is never text (no text-primary / text-select / text-ring)", accentText.length === 0, accentText.slice(0, 6).join(", ") || "0")
  // v5.1: scrollbar-width only in .no-scrollbar (anywhere else it would override the custom ::-webkit-scrollbar look)
  const css = files.filter((f) => f.endsWith(".css")).map(strip).join("\n")
  const sw = (css.match(/[^{}]*\{[^{}]*scrollbar-width[^{}]*\}/g) ?? []).map((r) => r.trim().split("{")[0].trim())
  const swTsx = files.filter((f) => /\.tsx?$/.test(f)).flatMap((f) => strip(f).match(/scrollbar-width|scrollbarWidth|\[scrollbar-width/g) ?? [])
  ok("scrollbar-width appears only in .no-scrollbar", sw.length === 1 && sw[0] === ".no-scrollbar" && swTsx.length === 0, `css=${JSON.stringify(sw)} tsx=${swTsx.length}`)
  const dead = (css.match(/--(?!shadow-stage-dark)[\w-]+-dark\s*:|Theme B-dark|#fbfaf8|#f3f1ec|#e9e9e8/g) ?? [])
  ok("no dead dark / warm tokens in index.css", dead.length === 0, dead.join(", ") || "0")
  const theme = (css.match(/\[data-theme="procreate-light"\][^{]*\{/g) ?? []).length
  ok("one procreate-light token block", theme === 1, `${theme}`)
  const moon = ["kit/Shell.tsx", "features/screens.tsx", "demo-parts/settings.tsx"].filter((f) => /\b(Moon|Sun)\b/.test(fs.readFileSync(new URL("../src/" + f, import.meta.url), "utf8")))
  ok("no Moon / Sun icons outside the site-theme demo", moon.length === 0, moon.join(", ") || "0")
}

// ---------------------------------------------------------------- 1. manifest / registry / index links
const kit = await page.evaluate(() => window.__kit)
const slugs = kit.order // kit reading order: screen by screen, roadmap order inside a screen
ok("manifest ↔ registry", kit.missingDemo.length === 0 && kit.orphanDemo.length === 0, `${kit.pages.length} pages; missing demo: ${kit.missingDemo.join(",") || "-"}; orphan demo: ${kit.orphanDemo.join(",") || "-"}`)
ok("manifest slugs unique", new Set(pages.map((p) => p.slug)).size === pages.length)
ok("every feature sits on exactly one known screen", kit.noScreen.length === 0 && slugs.length === pages.length && new Set(slugs).size === pages.length, `unassigned: ${kit.noScreen.join(",") || "-"}`)
ok("screens ↔ screen demos", kit.missingScreenDemo.length === 0 && kit.orphanScreenDemo.length === 0 && new Set(screenIds).size === screenIds.length, `${screenIds.length} screens; missing: ${kit.missingScreenDemo.join(",") || "-"}; orphan: ${kit.orphanScreenDemo.join(",") || "-"}`)
ok("12 roadmap screens", screenIds.length === 12)
const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))
const linked = hrefs.filter((h) => h.startsWith("#/feature/")).map((h) => h.slice(10))
const linkedScreens = [...new Set(hrefs.filter((h) => h.startsWith("#/screen/")).map((h) => h.slice(9)))]
const bad = hrefs.filter((h) => !(h === "#/" || h === "#/components" || h === "#/credits" || h === "#/demo" || h === "#/guide" || /^#\/guide\/[a-z-]+$/.test(h) || (h.startsWith("#/feature/") && slugs.includes(h.slice(10))) || (h.startsWith("#/screen/") && screenIds.includes(h.slice(9)))))
ok("index links resolve", bad.length === 0, `${hrefs.length} links, bad: ${bad.join(",") || "-"}`)
ok("index lists every feature, grouped by screen, in kit order", JSON.stringify(linked) === JSON.stringify(slugs), `${linked.length}/${slugs.length}`)
ok("index links every screen in order", JSON.stringify(linkedScreens) === JSON.stringify(screenIds), `${linkedScreens.length}/${screenIds.length}`)
const domGroups = await page.$$eval("[data-screen]", (ss) => ss.map((s) => [s.getAttribute("data-screen"), [...s.querySelectorAll("[data-feature-link]")].map((a) => a.getAttribute("data-feature-link"))]))
const grpBad = domGroups.filter(([id, fs]) => JSON.stringify(fs) !== JSON.stringify(pages.filter((p) => p.screen === id).map((p) => p.slug))).map(([id]) => id)
ok("index groups match the manifest screen field", grpBad.length === 0 && domGroups.length === screenIds.length, grpBad.join(",") || `${domGroups.length} groups`)
await go("#/f/recents-home"); ok("legacy #/f/<slug> alias", await page.isVisible('[data-testid="feature-title"]'))
for (const s of ["recents-home", "open-save-project"]) { await go(feat(s)); ok(`#/feature/${s} still resolves`, (await page.textContent('[data-testid="feature-title"]').catch(() => "")) === s) }
await go("#/feature/no-such-slug"); ok("unknown slug → not-found page", await page.isVisible('[data-testid="not-found"]'))
await go("#/screen/no-such-screen"); ok("unknown screen → not-found page", await page.isVisible('[data-testid="not-found"]'))

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
const themes = ["Light"] // v5: single Procreate-light theme
for (const [w, h, th] of (quick ? [[1440, 900]] : [[1440, 900], [1280, 800]]).flatMap(([w, h]) => themes.map((t) => [w, h, t]))) {
  await page.setViewportSize({ width: w, height: h })
  const failsHere = [], failsScr = []
  const check = (p, want, e0) => {
    const problems = []
    if (!p.demo || !p.visible) problems.push("demo not visible")
    if (p.demo && (p.content < 3 || (p.text < 10 && p.media === 0))) problems.push(`demo empty (${p.content} nodes, ${p.text} chars)`)
    if (p.overflowX) problems.push("horizontal page overflow")
    if (p.brokenImgs) problems.push(`${p.brokenImgs} broken images`)
    if (p.clipped?.length) problems.push(`clipped by demo frame: ${p.clipped.join(", ")}`)
    if (p.title !== want) problems.push(`title "${p.title}"`)
    if (errs.length > e0) problems.push(`${errs.length - e0} console errors`)
    return problems
  }
  for (const s of slugs) {
    const e0 = errs.length
    await go(feat(s), 420)
    const problems = check(await probe(), s, e0)
    if (problems.length) failsHere.push(`${s}: ${problems.join("; ")}`)
  }
  ok(`all ${slugs.length} feature pages render cleanly at ${w}×${h}, ${th.toLowerCase()}`, failsHere.length === 0, failsHere.slice(0, 12).join(" | "))
  for (const sc of screens) {
    const e0 = errs.length
    await go(scr(sc.id), 520)
    const p = await probe()
    p.title = await page.textContent('[data-testid="screen-title"]').catch(() => null)
    const problems = check(p, sc.title, e0)
    if (problems.length) failsScr.push(`${sc.id}: ${problems.join("; ")}`)
  }
  ok(`all ${screens.length} screen pages render cleanly at ${w}×${h}, ${th.toLowerCase()}`, failsScr.length === 0, failsScr.slice(0, 12).join(" | "))
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
await page.keyboard.type("shell-filmstrip"); await page.waitForTimeout(150)
ok("search filters by slug", (await rows()) === 1 && (await page.locator('[data-feature-link="editor-shell-filmstrip"]').count()) === 1, `${await rows()} rows`)
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
await page.fill('[data-testid="index-search-input"]', "Layout grids, masters"); await page.waitForTimeout(150)
ok("search matches a screen title", await page.isVisible('[data-screen="layout-grids"]'))
await page.fill('[data-testid="index-search-input"]', ""); await page.locator("body").click({ position: { x: 5, y: 300 } })
// milestone (secondary) filter
await page.click('[data-testid="milestone-filter"] button'); await page.waitForTimeout(200)
await page.getByRole("option", { name: "M6 — Print" }).click(); await page.waitForTimeout(200)
const nM6 = pages.filter((p) => p.group === "M6 — Print").length
ok("milestone filter", (await rows()) === nM6, `${await rows()} / ${nM6}`)
await page.click('[data-testid="milestone-filter"] button'); await page.waitForTimeout(200)
await page.getByRole("option", { name: "All milestones" }).click(); await page.waitForTimeout(200)
ok("milestone filter reset", (await rows()) === n0)
// collapse the Import screen group, set a filter, scroll, open a page, come back
await page.locator('[data-screen="canvas"] [data-testid="group-toggle"]').click(); await page.waitForTimeout(150)
const n1 = await rows()
ok("collapse a screen group", n1 === n0 - pages.filter((p) => p.screen === "canvas").length, `${n0}→${n1}`)
await page.click('[data-testid="index-filter"] [role="tab"]:has-text("Interactive")'); await page.waitForTimeout(150)
const target = page.locator('[data-feature-link="cover-editor"]')
await target.scrollIntoViewIfNeeded(); await page.evaluate(() => scrollBy(0, 120)); await page.waitForTimeout(250)
const y0 = await page.evaluate(() => Math.round(scrollY))
const rows0 = await rows()
await target.click(); await page.waitForTimeout(450)
ok("index row opens the page", (await hash()) === feat("cover-editor"))
await page.click('[data-nav="next"]'); await page.waitForTimeout(300)
await page.goBack(); await page.waitForTimeout(250); await page.goBack(); await page.waitForTimeout(600)
const y1 = await page.evaluate(() => Math.round(scrollY))
ok("browser Back restores index scroll position", (await hash()) === "#/" && Math.abs(y1 - y0) <= 4, `y ${y0} → ${y1}`)
ok("Back restores filter + collapsed groups", (await rows()) === rows0 && (await page.locator('[data-testid="index-filter"] [aria-selected="true"]').textContent()) === "Interactive", `${await rows()} rows`)
ok("Back focuses the last opened row", await page.evaluate(() => document.activeElement?.getAttribute("data-feature-link") === "cover-editor"))
await page.locator('[data-feature-link="pdf-export"]').click(); await page.waitForTimeout(400)
await page.click('[data-nav="footer-index"]'); await page.waitForTimeout(450)
const y2 = await page.evaluate(() => Math.round(scrollY))
ok("Index link from a page restores position too", Math.abs(y2 - y0) <= 60 && y2 > 100, `y ${y2}`)
await page.click('[data-testid="toggle-all"]'); await page.waitForTimeout(100)
await page.click('[data-testid="index-filter"] [role="tab"]:has-text("All")'); await page.waitForTimeout(100)
if ((await rows()) === 0) await page.click('[data-testid="toggle-all"]')
await page.waitForTimeout(100); ok("expand / collapse all", (await rows()) === n0, `${await rows()}`)
await page.locator('[data-screen-link="settings"]').click(); await page.waitForTimeout(500)
ok("index screen heading opens the screen page", (await hash()) === scr("settings") && (await page.textContent('[data-testid="screen-title"]')) === "Settings")
await page.evaluate(() => sessionStorage.clear())

// screen pages: feature list, feature ↔ screen links, prev/next screen walk
const scrBad = []
for (const sc of screens) {
  await go(scr(sc.id), 300)
  const fs = await page.$$eval('[data-testid="screen-features"] [data-feature-link]', (as) => as.map((a) => a.getAttribute("data-feature-link")))
  const want = pages.filter((p) => p.screen === sc.id).map((p) => p.slug)
  if (JSON.stringify(fs) !== JSON.stringify(want)) scrBad.push(sc.id)
  if (!want.length && !(await page.isVisible('[data-testid="screen-features-empty"]'))) scrBad.push(`${sc.id}(empty state)`)
}
ok("each screen page lists exactly its features", scrBad.length === 0, scrBad.join(",") || `${screens.length} screens`)
await go(scr("filmstrip"), 400); await page.locator('[data-testid="screen-features"] [data-feature-link="editor-shell-filmstrip"]').click(); await page.waitForTimeout(400)
ok("screen → feature link", (await hash()) === feat("editor-shell-filmstrip"))
const linkBad = []
for (const p of pages) {
  await go(feat(p.slug), 120)
  const h = await page.getAttribute('[data-testid="on-screen"]', "href").catch(() => null)
  if (h !== scr(p.screen)) linkBad.push(`${p.slug}→${h}`)
}
ok("every feature page links back to its screen", linkBad.length === 0, linkBad.slice(0, 5).join(" ") || `${pages.length} pages`)
await go(feat("inspector")); await page.click('[data-testid="on-screen"]'); await page.waitForTimeout(400)
ok("feature → screen link opens the screen", (await hash()) === scr("inspector"))
await go(scr(screenIds[0]))
const smism = []
for (let i = 0; i < screenIds.length - 1; i++) {
  await page.click('[data-nav="next-screen"]'); await page.waitForTimeout(160)
  if ((await hash()) !== scr(screenIds[i + 1])) smism.push(`${screenIds[i]}→${await hash()}`)
}
ok("next-screen walk through all screens", smism.length === 0, `${screenIds.length - 1} steps ${smism.slice(0, 4).join(" ")}`)
await page.keyboard.press("Alt+ArrowLeft"); await page.waitForTimeout(200)
ok("Alt+← on a screen page goes to the previous screen", (await hash()) === scr(screenIds[screenIds.length - 2]))

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
await go(feat("layout-grids-render-snap"))
const stillClosed = !(await page.isVisible('[data-testid="notes-body"]'))
await page.click('[data-testid="notes-toggle"]'); await page.waitForTimeout(100)
ok("UX notes collapse and the choice persists across pages", closed && stillClosed && (await page.isVisible('[data-testid="notes-body"]')))
const nb = await page.locator('[data-testid="ux-notes"]').boundingBox(), db = await page.locator(demo).boundingBox()
ok("notes sit above a full-width demo", nb.y + nb.height <= db.y && Math.abs(nb.width - db.width) < 2)

// theme toggle
ok("v6 tokens: surround #C8CACB, text #393738, ink #232223, no accent token, paper white", await page.evaluate(() => { const c = getComputedStyle(document.documentElement); const g = (v) => c.getPropertyValue(v).trim().toLowerCase(); return g("--t-bg") === "#c8cacb" && g("--t-text") === "#393738" && g("--select") !== "" && g("--t-accent") === "" && g("--t-ink") === "#232223" && g("--t-on-ink") === "#f2f2f2" && g("--t-ink-hover") === "#3a3839" && /^#f{3}(f{3})?$/.test(g("--paper")) }))
ok("no scrollbar-color in stylesheets (breaks custom webkit scrollbars)", await page.evaluate(() => { let bad = 0; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (/scrollbar-color/.test(r.cssText)) bad++ } catch { } } return bad === 0 }))
// v5.1: contrast — secondary text token ≥ 4.5:1 on every surface; accent-text ≥ 4.5:1 on panels and bars
{
  const r = await page.evaluate(() => {
    const cv = document.createElement("canvas").getContext("2d")
    const rgb = (c) => { cv.fillStyle = "#000"; cv.fillStyle = c; const h = cv.fillStyle; return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) }
    const lum = (c) => { const [r, g, b] = rgb(c).map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
    const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
    const surf = ["--t-bg", "--cover-empty", "--t-panel", "--t-raised", "--t-bar", "--paper"]
    const out = []
    for (const fg of ["--muted-foreground", "--muted-foreground-on-app", "--foreground"]) for (const bg of surf) out.push([fg, bg, cr(v(fg), v(bg))])
    for (const bg of ["--t-panel", "--t-raised", "--t-bar", "--paper"]) out.push(["--accent-text", bg, cr(v("--accent-text"), v(bg))])
    return out
  })
  const bad = r.filter((x) => x[2] < 4.5)
  ok("contrast: secondary / body / accent-text ≥ 4.5:1 on every surface", bad.length === 0, bad.length ? bad.map((x) => `${x[0]} on ${x[1]} ${x[2].toFixed(2)}`).join("; ") : `min ${Math.min(...r.map((x) => x[2])).toFixed(2)}:1`)
}

// ---------------------------------------------------------------- 4. interaction smoke
// Frozen: no new checks here. The §4 / v4–v0.6.1 checks moved to e2e/kit-{library,editor-canvas,tokens,credits,personal-site}.spec.ts
// (uikit-qa-split-1), the v7–v0.10 spread list / book settings / sliders / toggles / tokens checks to
// e2e/kit-{spread-list,book-settings,sliders,toggle-size,tokens}.spec.ts (uikit-qa-split-2), the editor chrome / credits /
// library / settings / masters checks to e2e/kit-{editor-chrome,credits,library,settings,masters}.spec.ts (uikit-qa-split-3),
// the editor canvas / parent overrides / #/demo sandbox / site preview / personal site checks to
// e2e/kit-{editor-canvas,parent-overrides,demo-sandbox,site-preview,personal-site}.spec.ts (uikit-qa-split-4; the kit10 and W4
// walks keep only the steps the checks left here need), the filmstrip / layout picker / frame style / cover / static export
// checks to e2e/kit-{filmstrip,layout-picker,frame-style,cover,static-export}.spec.ts (uikit-qa-split-5), the text frames /
// default master / printer presets checks to e2e/kit-{text-frames,default-master,print-presets}.spec.ts (uikit-qa-split-6);
// map in docs/roadmap/P3/uikit-qa-split-1.md. Only sections 0–3 run here.

fs.writeFileSync(new URL("../qa-report.txt", import.meta.url), res.join("\n") + "\n\nCONSOLE:\n" + (errs.join("\n") || "none") + "\n")
console.log(res.join("\n")); console.log(`\n${res.length - fails} passed, ${fails} failed; console errors/warnings: ${errs.length}`); if (errs.length) console.log(errs.slice(0, 20).join("\n"))

await browser.close()
process.exit(fails || errs.length ? 1 : 0)

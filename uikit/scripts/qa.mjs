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
const bad = hrefs.filter((h) => !(h === "#/" || h === "#/components" || h === "#/credits" || h === "#/demo" || (h.startsWith("#/feature/") && slugs.includes(h.slice(10))) || (h.startsWith("#/screen/") && screenIds.includes(h.slice(9)))))
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
const smoke = async (name, slug, fn) => {
  await go(feat(slug))
  const e0 = errs.length
  let pass = false, info = ""
  try { const r = await fn(); pass = r === true || (Array.isArray(r) && r[0]); info = Array.isArray(r) ? r[1] : "" } catch (e) { info = e.message.split("\n").filter((l) => !/^\s*$/.test(l)).slice(0, 8).join(" | ").slice(0, 700) }
  ok(`${slug}: ${name}`, pass && errs.length === e0, info + (errs.length > e0 ? ` (+${errs.length - e0} console errors)` : ""))
  await page.keyboard.press("Escape").catch(() => {})
}
const D = (s) => page.locator(`${demo} ${s}`)
const txt = (s) => page.textContent(s).catch(() => "")

const smokeS = async (name, id, fn) => {
  await go(scr(id), 600)
  const e0 = errs.length
  let pass = false, info = ""
  try { const r = await fn(); pass = r === true || (Array.isArray(r) && r[0]); info = Array.isArray(r) ? r[1] : "" } catch (e) { info = e.message.split("\n").filter((l) => !/^\s*$/.test(l)).slice(0, 8).join(" | ").slice(0, 700) }
  ok(`screen ${id}: ${name}`, pass && errs.length === e0, info + (errs.length > e0 ? ` (+${errs.length - e0} console errors)` : ""))
  await page.keyboard.press("Escape").catch(() => {})
}
// Frozen: no new checks here. The §4 / v4–v0.6.1 checks moved to e2e/kit-{library,editor-canvas,tokens,credits,personal-site}.spec.ts
// (uikit-qa-split-1), the v7–v0.10 spread list / book settings / sliders / toggles / tokens checks to
// e2e/kit-{spread-list,book-settings,sliders,toggle-size,tokens}.spec.ts (uikit-qa-split-2), the editor chrome / credits /
// library / settings / masters checks to e2e/kit-{editor-chrome,credits,library,settings,masters}.spec.ts (uikit-qa-split-3),
// the editor canvas / parent overrides / #/demo sandbox / site preview / personal site checks to
// e2e/kit-{editor-canvas,parent-overrides,demo-sandbox,site-preview,personal-site}.spec.ts (uikit-qa-split-4; the kit10 and W4
// walks keep only the steps the checks left here need); the blocks below move by feature in uikit-qa-split-5…, map in
// docs/roadmap/P3/uikit-qa-split-1.md.
const walk6 = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk6(`${d}/${e.name}`) : /\.(tsx?|css)$/.test(e.name) ? [`${d}/${e.name}`] : [])

// ───────── v7: editor redesign, kit chrome, sliders, toggles, black-only-for-selection ─────────
const E = (s) => D(`[data-testid="editor7"] ${s}`)
// Stage 3: the old "editor" screen scenarios now live on feature pages (label → [page, scenario])
const SCEN3 = { "Photo": ["frame-selection-handles", "Frame selected"], "Book settings": ["inspector", "Book settings"], "Cover": ["pasteboard-workspace", "Cover"], "Masters": ["layout-grids-settings", "Master grid"], "Nothing selected": ["pasteboard-workspace", "Spread"], "Endpaper": ["inspector", "Endpaper"] }
const scen = async (l) => { const m = SCEN3[l]; if (m) { await go(feat(m[0]), 700); l = m[1] } await D('[data-testid="scenarios"]').getByRole("tab", { name: l, exact: true }).click(); await page.waitForTimeout(250) }
const bg = (loc) => loc.evaluate((e) => getComputedStyle(e).backgroundColor)

// ───────── v0.7.1: one editor, scenario states ─────────
{
  await smokeS("layout-tile-states (Owner 2026-11-02): the tile stays transparent, hover rings the paper, the paper fills a trim-shaped box, page 1 goes 3 columns", "canvas", async () => {
    const tile = () => E('[data-testid="layout-section"] [data-testid="tpl-tile"]').nth(1)
    const read = () => tile().evaluate((t) => {
      const th = t.querySelector('[data-testid="tpl-thumb"]').getBoundingClientRect(), p = t.querySelector('[data-testid="tpl-paper"]')
      const ps = getComputedStyle(p), liftProp = ps.translate !== "none" ? "translate" : "transform" // the lift eases only if the transition lists the property that moves
      return { bg: getComputedStyle(t.querySelector("button")).backgroundColor, shadow: ps.boxShadow, lift: ps.translate !== "none" ? ps.translate : ps.transform, eased: ps.transitionProperty.split(", ").includes(liftProp) && parseFloat(ps.transitionDuration) > 0, fill: Math.abs(th.width - p.getBoundingClientRect().width) <= 1, cols: getComputedStyle(t.parentElement).gridTemplateColumns.split(" ").length }
    })
    const open = async (k) => { await E(`[data-item="${k}"]`).scrollIntoViewIfNeeded(); await E(`[data-item="${k}"]`).click(); await page.waitForTimeout(250) }
    await open("p3"); const spread = await read()
    await tile().locator("button").hover(); await page.waitForTimeout(250); const hover = await read()
    await open("p0"); const page1 = await read()
    return [spread.cols === 2 && spread.fill && page1.cols === 3 && page1.fill && hover.bg === "rgba(0, 0, 0, 0)" && hover.shadow.includes("rgba(0, 0, 0, 0.22) 0px 0px 0px 1px") && hover.lift !== "none" && hover.eased, JSON.stringify({ spread, hover, page1 })]
  })
}
// ───────── v0.7.2: designer review of v0.7.1 (uikit-audit/v7.1-review.md) ─────────
{
  // P0-2 Replace (frame) + Replace (cover)
  await smokeS("v0.9 §4: no Replace button/picker; filmstrip drag onto a frame swaps the photo", "canvas", async () => {
    await scen("Photo"); await page.waitForTimeout(300)
    const noReplace = (await D('[data-testid="replace"]').count()) === 0 && (await page.locator('[data-testid="replace-picker"]').count()) === 0
    // kit screen chrome clips filmstrip+frame; DnD on the dedicated feature page
    await go(feat("drag-place-replace"), 700)
    const fid0 = await page.evaluate(() => [...document.querySelectorAll('[data-testid="demo"] [data-testid="frame"]')].map((f) => f.querySelector("img")?.getAttribute("src")))
    await D('[data-testid="filmstrip"] [role="row"]').nth(0).dragTo(D('[data-testid="frame"]').first()); await page.waitForTimeout(400)
    const fid1 = await page.evaluate(() => [...document.querySelectorAll('[data-testid="demo"] [data-testid="frame"]')].map((f) => f.querySelector("img")?.getAttribute("src")))
    const changed = fid0.filter((s, i) => s !== fid1[i]).length
    const st = await txt(`${demo} [data-testid="status"]`)
    return [noReplace && changed >= 1 && /Placed|Replaced/.test(st ?? ""), `noReplace=${noReplace} changed=${changed} status="${st}"`]
  })
  await smokeS("v0.9 §4: cover has no Replace; filmstrip drag onto the cover swaps the front photo", "canvas", async () => {
    await scen("Cover"); await page.waitForTimeout(300)
    const noReplace = (await D('[data-testid="cover-replace"]').count()) === 0 && (await page.locator('[data-testid="replace-picker"]').count()) === 0
    // #/demo fits cover + filmstrip (kit screen page scrolls filmstrip under the viewport)
    await go("#/demo", 500)
    await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Cover drag", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; d.state().open = "s1"; d.go("editor") })
    await page.waitForTimeout(700)
    await page.click('[data-testid="demo-add-folder"]'); await page.waitForTimeout(250)
    await page.locator("[role=dialog]").getByRole("button", { name: /Select/i }).last().click(); await page.waitForTimeout(500)
    await page.click('[data-item="cover"]'); await page.waitForTimeout(300)
    const id0 = await page.locator('[data-testid="cover-front"]').getAttribute("data-photo-id")
    await page.locator('[data-testid="filmstrip"] [role="row"]').nth(2).dragTo(page.locator('[data-testid="cover-front"]')); await page.waitForTimeout(450)
    const id1 = await page.locator('[data-testid="cover-front"]').getAttribute("data-photo-id")
    return [noReplace && id1 && id0 !== id1, `noReplace=${noReplace} ${id0} → ${id1}`]
  })
  // P1-5 inspector back to spec
  await smokeS("v7.2 P1-5: Photo inspector has Fill/Fit, Rotate & flip, Adjust, Caption — and they work", "canvas", async () => {
    await scen("Photo"); await page.waitForTimeout(300)
    const titles = (await D('[data-testid="ctx-inspector"]').innerText()).toLowerCase()
    const has = ["Fill", "Fit", "Flip H", "Flip V", "Adjust", "Caption"].filter((t) => !titles.includes(t.toLowerCase()))
    const img = () => page.evaluate(() => { const i = document.querySelector('[data-testid="demo"] [data-testid="sel-outline"]') ? [...document.querySelectorAll('[data-testid="demo"] [data-testid="frame"] img')].map((x) => x.style.transform + "|" + x.style.filter).join(";") : ""; return i })
    const t0 = await img()
    await D('[data-testid="flip-h"]').click(); await page.waitForTimeout(200); const t1 = await img()
    await D('[data-testid="ctx-inspector"]').getByRole("button", { name: "Caption" }).click(); await page.waitForTimeout(200)
    await D('[data-testid="caption-input"]').fill("Sunset at Zoutelande"); await page.waitForTimeout(250)
    const cap = await D('[data-testid="frame-caption"]').first().textContent().catch(() => "")
    await D('[data-testid="ctx-inspector"]').getByRole("button", { name: "Adjust" }).click(); await page.waitForTimeout(200)
    const sl = await D('[data-testid="adjust"] [role=slider], [data-testid="adjust"] input[type=range]').count()
    return [has.length === 0 && t0 !== t1 && /scale\(-/.test(t1) && cap === "Sunset at Zoutelande" && sl === 3, `missing=${has.join(",") || "-"} flip=${/scale\(-/.test(t1)} caption="${cap}" sliders=${sl}`]
  })
}
// ───────── v0.7.4: designer review of v0.7.3 (uikit-audit/v7.3-review.md) — 4 P2 polish items ─────────
{
  // P2-4 cover Replace updates the filmstrip 'used' count
  await smokeS("v7.4 P2-4 / v0.9: dragging onto the cover updates the filmstrip used count", "canvas", async () => {
    // #/demo: cover + filmstrip both in view (kit screen page clips one or the other)
    await go("#/demo", 500)
    await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Used count", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; d.state().open = "s1"; d.go("editor") })
    await page.waitForTimeout(700)
    await page.click('[data-testid="demo-add-folder"]'); await page.waitForTimeout(250)
    await page.locator("[role=dialog]").getByRole("button", { name: /Select/i }).last().click(); await page.waitForTimeout(500)
    await page.click('[data-item="cover"]'); await page.waitForTimeout(300)
    const cnt = async () => +((await page.locator('[data-testid="placed-count"]').innerText()).match(/(\d+) used/) || [])[1]
    const n0 = await cnt()
    const film = await page.evaluate(() => [...document.querySelectorAll('[data-testid="filmstrip"] [role="row"]')].filter((r) => !r.querySelector('[title="Placed in the book"]')).map((r) => r.dataset.key))
    if (!film[0]) return [false, "no unplaced photo in filmstrip"]
    await page.locator(`[data-testid="filmstrip"] [role="row"][data-key="${film[0]}"]`).dragTo(page.locator('[data-testid="cover-front"]')); await page.waitForTimeout(450)
    const cv = await page.locator('[data-testid="cover-front"]').getAttribute("data-photo-id")
    const n1 = await cnt(), mark = await page.evaluate((k) => !!document.querySelector(`[data-testid="filmstrip"] [role="row"][data-key="${k}"] [title="Placed in the book"]`), film[0])
    const marks = await page.evaluate(() => document.querySelectorAll('[data-testid="filmstrip"] [role="row"] [title="Placed in the book"]').length)
    return [cv === film[0] && mark && n1 === marks && n0 >= 0, `${n0} → ${n1} used (= ${marks} ✓ marks), ${film[0]} marked=${mark} cover=${cv}`]
  })
}
// ───────── v8: filmstrip label, sliders, grid, site fullscreen, #/demo
await smokeS("v8 §3.1 single filmstrip label 'Photos · N · M used'", "canvas", async () => {
  const t = (await D('[data-testid="film-head"]').innerText()).trim(); const n = await D('[data-testid="placed-count"]').count()
  const dup = await D('[data-testid="dock"]').evaluate((d) => (d.innerText.match(/\bused\b/g) || []).length)
  return [/^Photos · \d+ · \d+ used$/.test(t) && n === 1 && dup === 1, `"${t}" n=${n} used×${dup}`]
})
// ───────── v8.2: frame-style Mat / Stroke / Corner radius — change, double-click, back to the style's real default (main editor + #/demo)
{
  const DEF = { Mat: 3, Stroke: 0, "Corner radius": 0 } // "White mat" preset (DEFAULT_STYLES)
  const probe = async (where) => {
    const out = {}
    try {
      out.step = "frame"; await page.locator('[data-testid="frame"]').first().click(); await page.waitForTimeout(250)
      const list = page.locator('[data-testid="style-list"]')
      out.step = "expand"
      if (!(await list.isVisible().catch(() => false))) { await page.getByRole("button", { name: /^Frame style/ }).first().click(); await page.waitForTimeout(300) }
      out.step = "style"
      await list.getByRole("button", { name: "White mat", exact: true }).click(); await page.waitForTimeout(250)
      const sec = list.locator("xpath=.."); delete out.step
      for (const l of Object.keys(DEF)) {
        const sl = sec.locator("[data-reset]").filter({ hasText: l }).first(); const r = sl.locator("input[type=range]").first()
        const v0 = +(await r.inputValue()); await sl.hover(); await page.keyboard.press("Shift+ArrowRight"); await page.waitForTimeout(100)
        const v1 = +(await r.inputValue()); await sl.dblclick(); await page.waitForTimeout(150)
        out[l] = [v0, v1, +(await r.inputValue()), +(await sl.getAttribute("data-reset"))]
      }
    } catch (e) { out.err = e.message.split("\n")[0] }
    return out
  }
  const good = (o) => !o.err && Object.entries(DEF).every(([l, d]) => o[l] && o[l][0] === d && o[l][1] !== d && o[l][2] === d && o[l][3] === d)
  await go(scr("canvas"), 700); const a = await probe("editor")
  await go("#/demo", 500)
  await page.evaluate(() => { const d = window.__demo; d.reset(); const s = d.state(); s.path = "~/Pictures/Photobooks"; s.books = [{ id: "s1", title: "Style probe", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; s.open = "s1"; d.go("editor") }); await page.waitForTimeout(700)
  const b = await probe("demo")
  ok("v8.2 frame style Mat / Stroke / Corner radius: change, double-click → the style's real default (White mat 3 / 0 / 0), main editor and #/demo", good(a) && good(b), JSON.stringify({ editor: a, demo: b }))
}

// ───────── v0.9 acceptance (research/v9/v9-requirements.md) ─────────
{
  // §3 no floating toast for photo-folder events on Add folder (demo)
  await go("#/demo", 500)
  await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Toast probe", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; d.state().open = "s1"; d.go("editor") })
  await page.waitForTimeout(700)
  await page.click('[data-testid="demo-add-folder"]'); await page.waitForTimeout(300)
  await page.locator("[role=dialog]").getByRole("button", { name: /Select/i }).last().click(); await page.waitForTimeout(500)
  // floating toasts live in ToastRegion; folder events must not create one
  const bodyToasts = await page.evaluate(() => {
    const region = document.querySelector('[aria-label="Notifications"], [data-testid="toast-region"]')
    return region ? (region.textContent || "") : ""
  })
  const folderToast = /Added |no new photos|photos from|adds folders, not single/i.test(bodyToasts)
  const statusTxt = await page.locator('[data-testid="status"]').innerText().catch(() => "")
  ok("v0.9 §3 Add folder uses quiet status, not a floating toast", !folderToast && /Added |no new photos/i.test(statusTxt), `folderToast=${folderToast} status="${statusTxt}" region="${bodyToasts.slice(0, 80)}"`)
  // second Add of same folder → "no new photos" still quiet (no toast region text)
  await page.click('[data-testid="demo-add-folder"]'); await page.waitForTimeout(250)
  await page.locator("[role=dialog]").getByRole("button", { name: /Select/i }).last().click(); await page.waitForTimeout(400)
  const bodyToasts2 = await page.evaluate(() => { const region = document.querySelector('[aria-label="Notifications"], [data-testid="toast-region"]'); return region ? (region.textContent || "") : "" })
  const status2 = await page.locator('[data-testid="status"]').innerText().catch(() => "")
  const filmToast2 = /Added |no new photos|photos from|Drag photos|adds folders/i.test(bodyToasts2)
  ok("v0.9 §3 no new photos / filmstrip events stay out of toast region", !filmToast2 && /no new photos/i.test(status2), `toast="${bodyToasts2.slice(0, 80)}" status="${status2}"`)
  // source: chrome + demo must not toast photo-folder / filmstrip import events
  const folderSrc = ["src/sandbox/chrome.tsx", "src/features/demo.tsx", "src/demo-parts/editor.tsx"].map((f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8")).join("\n")
  // flag toast calls whose title/description are photo-folder / filmstrip import or remove-from-gallery notices
  const badToast = /st\.toast\(\{[^\n]{0,200}(?:Added \d+ photo|no new photos|removed from the gallery|adds folders, not single|Drag photos onto)/.test(folderSrc)
  ok("v0.9 §3 source: no st.toast for photo-folder / filmstrip gallery events", !badToast, badToast ? "toast call still present" : "setStatus only")
}

// ───────── v0.9.3: site library home, Space≠panels, outlined cursors, outline cleanup ─────────
{
  // Filmstrip selection: no black ring-select
  await go(scr("canvas"), 700); await scen("Photo").catch(() => {}); await page.waitForTimeout(300)
  const thumb = page.locator('[data-testid="demo"] [data-testid="filmstrip"] [role="row"]').first()
  await thumb.click(); await page.waitForTimeout(150)
  const filmSel = await thumb.evaluate((el) => {
    const s = getComputedStyle(el)
    return { boxShadow: s.boxShadow, outline: s.outlineStyle, bg: s.backgroundColor, cls: el.className }
  })
  const blackRing = await thumb.evaluate((el) => {
    const s = getComputedStyle(el)
    // visible ring/outline in select ink — ignore 0px box-shadow layers from hairline
    if (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && /35,\s*34,\s*35|232223/.test(s.outlineColor)) return true
    return [...s.boxShadow.split(/,(?![^(]*\))/)].some((part) => {
      const m = part.match(/rgb\(\s*35,\s*34,\s*35\s*\).*?(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/)
      if (!m) return false
      return Math.max(...m.slice(1).map(Number).map(Math.abs)) >= 1
    })
  })
  ok("v0.9.3 filmstrip selection: tone only, no black ring-select",
    !blackRing && /202,\s*202,\s*202/.test(filmSel.bg),
    JSON.stringify({ ...filmSel, blackRing }))
}


// kit10: #/demo exposes the sandbox features it used to hide — view toggles, rulers + guides, spread menu / reorder, master guides + Page numbers, overrides, missing photo, Relink
{
  const e0 = errs.length
  await go("#/demo", 500); await page.evaluate(() => window.__demo.reset()); await page.waitForTimeout(500)
  const c = (sel) => page.locator(sel).first().click() // dialogs portal outside the demo root
  await c('[data-testid="create-library"]'); await c('[data-testid="picker-select"]'); await page.waitForTimeout(300)
  await c(`${demo} [data-testid="new-book"]`); await page.waitForTimeout(300); await c('[data-testid="create-book"]'); await page.waitForTimeout(500)
  await c('[data-testid="demo-add-folder"]'); await page.locator("[role=dialog]").getByRole("button", { name: /Choose|Select|Use|Add/i }).last().click(); await page.waitForTimeout(400)
  await c('[data-item="p1"]'); await page.waitForTimeout(250)
  await page.locator(`${demo} [data-testid="filmstrip"] [role="row"]`).nth(1).dragTo(page.locator(`${demo} [data-testid="canvas"] [data-current] [data-testid="frame"]`).first()); await page.waitForTimeout(400) // p02 = the 800 px low-res photo
  // KS1: rulers (Shift+R) and guides (Ctrl+;) are on keys as in prod; guides stay shown for the master guide checks below
  await page.keyboard.press("Shift+R"); await page.keyboard.press("Control+;"); await page.waitForTimeout(200)
  const g0 = await page.locator(`${demo} [data-testid="spread"] [data-guide]`).count()
  const rx = await page.locator(`${demo} [data-testid="ruler-x"]`).boundingBox(), sp = await page.locator(`${demo} [data-testid="spread"]`).first().boundingBox()
  await page.mouse.move(rx.x + rx.width / 2, rx.y + 10); await page.mouse.down(); await page.mouse.move(rx.x + rx.width / 2, sp.y + sp.height * 0.4, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250)
  await page.keyboard.press("Shift+R")
  await page.locator(`${demo} [data-item="p1"]`).hover(); await c('[data-item="p1"] [data-testid="spread-menu"]'); await page.waitForTimeout(250)
  await page.getByRole("menuitem", { name: /Duplicate/ }).click(); await page.waitForTimeout(300)
  // master guides + Page numbers feed every spread on the master
  await page.locator(`${demo} [data-testid="mode-seg"]`).getByText("Masters", { exact: true }).click(); await page.waitForTimeout(250)
  await page.keyboard.press("Shift+R"); await page.waitForTimeout(200)
  const ry = await page.locator(`${demo} [data-testid="ruler-y"]`).boundingBox(), mb = await page.locator(`${demo} [data-testid="canvas-master"]`).boundingBox()
  await page.mouse.move(ry.x + 10, ry.y + ry.height / 2); await page.mouse.down(); await page.mouse.move(mb.x + mb.width * 0.3, ry.y + ry.height / 2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250)
  await c('[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]'); await page.waitForTimeout(200)
  await page.locator(`${demo} [data-testid="mode-seg"]`).getByText("Pages", { exact: true }).click(); await page.waitForTimeout(250); await c('[data-item="p1"]'); await page.waitForTimeout(250)
  await page.keyboard.press("Escape"); await page.waitForTimeout(150)
  await page.locator(`${demo} [data-current] [data-testid="master-frame"]`).first().click({ modifiers: ["Control", "Shift"], force: true }); await page.waitForTimeout(250)
  // missing photo + Relink
  await page.evaluate(() => window.__demo.missing(1)); await page.waitForTimeout(400)
  ok("kit10: a missing photo hatches its frame and the dock offers Relink…", (await page.locator(`${demo} [data-testid="demo-relink"]`).count()) === 1 && (await page.locator(`${demo} [data-testid="canvas"] .hatch-missing`).count()) >= 1)
  await c('[data-testid="demo-relink"]'); await page.waitForTimeout(300)
  const rows = await page.locator('[data-testid="relink-row"]').count(), dis = await page.locator('[data-testid="relink-resolve"]').getAttribute("aria-disabled")
  ok("kit10: Relink dialog lists missing photos; Resolve waits for a rescan", rows === 1 && dis === "true", `rows=${rows} resolve aria-disabled=${dis}`)
  await page.locator('[data-testid="relink-rescan"]').click(); await page.waitForTimeout(250); await page.locator("[role=dialog]").getByRole("button", { name: /Choose|Select|Use|Open/i }).last().click(); await page.waitForTimeout(300)
  ok("kit10: rescanning the library folder marks the photo Found", (await page.locator('[data-testid="relink-row"]').getAttribute("data-status")) === "found")
  await page.locator('[data-testid="relink-resolve"]').click(); await page.waitForTimeout(300)
  ok("kit10: Resolve relinks — Relink… chip and hatch are gone", (await page.locator(`${demo} [data-testid="demo-relink"]`).count()) === 0 && (await page.locator(`${demo} [data-testid="canvas"] .hatch-missing`).count()) === 0)
  ok("kit10: no console errors in the new flows", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
}

// kit-sync W4 (Designer kit-sync Spec 9–11, = prod): no Pastedown caption, cover inspector selects + row tops, read-only pills flush right
{
  await go("#/demo", 500); await page.evaluate(() => window.__demo.reset()); await page.waitForTimeout(500)
  const c = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(300) }
  await c('[data-testid="create-library"]'); await c('[data-testid="picker-select"]')
  await c(`${demo} [data-testid="new-book"]`); await page.locator("[role=dialog] input").first().fill("Lake trip"); await c('[data-testid="create-book"]'); await c('[data-item="cover"]')
  // text-node boxes (Spec measures glyph runs, not padded pills)
  const textBox = (sel, t) => page.evaluate(([sel, t]) => { const e = [...document.querySelectorAll(sel)].find((x) => x.textContent.trim().toLowerCase() === t.toLowerCase()); if (!e) return null; const g = document.createRange(); g.selectNodeContents(e); const b = g.getBoundingClientRect(); return { x: b.x, top: b.top } }, [sel, t])
  const near = (a, b) => a != null && Math.abs(a - b) <= 1
  // cover-editor "Inspector": the print-profile hint under Spine width (6 + 16.8 px) moves Direction and below down 22.8 px (prod item cover-editor follows)
  const TOPS = { "Title font": 285.44, Spine: 343.86, "Spine width": 415.70, Direction: 473.35, Back: 527.19, Fill: 603.03, Material: 656.88, Finish: 741.30 }
  const tops = {}; for (const t of Object.keys(TOPS)) tops[t] = (await textBox('[data-testid="insp-cover"] :is(h3, span)', t))?.top
  ok("kit-sync KS10: cover inspector row tops = prod (±1)", Object.entries(TOPS).every(([t, v]) => near(tops[t], v)), JSON.stringify(tops))
  // r15 M90 (prod .cover-thumb 2.625 × 3.25 rem, flex none): the front thumb keeps 42 × 52, its copy starts 12 px right of it
  const th = await page.locator(`${demo} [data-testid="cover-front-thumb"]`).evaluate((e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, right: b.right } })
  const np = await textBox('[data-testid="insp-cover"] div', "No photo yet"), dg = await textBox('[data-testid="insp-cover"] div', "Drag a photo from the filmstrip onto the cover")
  ok("r15 M90: cover front thumb 42 × 52 (no shrink), «No photo yet» / «Drag a photo…» at x 1210 (thumb right + 12)", th.w === 42 && th.h === 52 && near(np?.x, 1210) && near(dg?.x, 1210) && Math.abs(np.x - th.right - 12) <= 0.5, `thumb ${JSON.stringify(th)} copy ${np?.x} / ${dg?.x}`)
  const sels = await page.locator(`${demo} [data-testid="insp-cover"] select`).evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return { l: e.getAttribute("aria-label"), x: b.x, w: b.width, h: b.height, right: b.right, r: cs.borderRadius, bg: cs.backgroundColor, chev: /svg/.test(cs.backgroundImage) && cs.backgroundSize === "16px 16px" } }))
  const SELS = { "Title font": [1318, 106], Cover: [1309, 115], Finish: [1289, 135] }
  ok("kit-sync KS10: Title font / Cover / Finish are selects h 36, r 8, #D7D7D7, chevron 16, right edge 1424", sels.length === 3 && sels.every((s) => SELS[s.l] && near(s.x, SELS[s.l][0]) && near(s.w, SELS[s.l][1]) && s.h === 36 && s.r === "8px" && s.bg === "rgb(215, 215, 215)" && s.chev && near(s.right, 1424)), JSON.stringify(sels))
  await page.locator(`${demo} [data-testid="cover-material"]`).selectOption("Linen")
  ok("kit-sync KS10: Cover is editable (no coming-later note)", (await page.locator(`${demo} [data-testid="cover-material"]`).inputValue()) === "Linen" && (await page.locator(`${demo} [data-testid="material-readonly"]`).count()) === 0)
  const pw = await textBox('[data-testid="insp-cover"] span', "#3E3C3B")
  await c('[data-testid="book-title"]')
  const hc = await textBox('[data-testid="insp-book"] span', "Hardcover")
  // page-numbers-kit: the Page numbers section makes Book settings taller than the 900 px viewport, so its 10 px scrollbar shifts Hardcover left
  // cover-back-fill: the Back Fill row is a swatch + "#3E3C3B" (no pill, no note), flush right
  ok("kit-sync KS10: read-only rows flush right — Back fill swatch x 1347.86, Hardcover x 1285.45 (Book settings scrolls)", near(pw?.x, 1347.86) && near(hc?.x, 1285.45), `fill ${pw?.x} hardcover ${hc?.x}`)
}

// kit-sync W3 (Designer kit-sync Spec 6, 7, 12, 15, = prod): no Hide inspector in the inspector head, prod layout picker, prod flip glyphs, Page size chevron
{
  const e0 = errs.length
  await go("#/demo", 500); await page.evaluate(() => window.__demo.reset()); await page.waitForTimeout(500)
  const c = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(300) }
  const near = (a, b) => a != null && Math.abs(a - b) <= 1
  await c('[data-testid="create-library"]'); await c('[data-testid="picker-select"]')
  await c(`${demo} [data-testid="new-book"]`); await page.locator("[role=dialog] input").first().fill("Lake trip"); await c('[data-testid="create-book"]')
  await c('[data-testid="demo-add-folder"]'); await page.locator("[role=dialog]").getByRole("button", { name: /Choose|Select|Use|Add/i }).last().click(); await page.waitForTimeout(500)
  const hide = () => page.locator(`${demo} :is([data-testid="inspector-header"], [data-testid="inspector-legacy"]) [aria-label^="Hide inspector"]`).count()
  const hideSpread = await hide(), toggle = await page.locator(`${demo} [data-testid="toggle-r"][aria-label="Hide inspector"]`).count()
  await c('[data-item="p1"]')
  await page.locator('[data-testid="filmstrip"] [role="row"]').nth(5).dragTo(page.locator('[data-testid="canvas"] [data-testid="frame"]').first()); await page.waitForTimeout(400)
  await c('[data-testid="canvas"] [data-testid="frame"]')
  const hidePhoto = await hide()
  ok("kit-sync KS6: inspector head has no Hide inspector button (spread and photo); the top-bar toggle stays", hideSpread === 0 && hidePhoto === 0 && toggle === 1, `spread ${hideSpread} photo ${hidePhoto} toggle ${toggle}`)
  const flips = await page.evaluate(() => ["flip-h", "flip-v"].map((id) => [...document.querySelectorAll(`[data-testid="demo"] [data-testid="${id}"] svg path`)].map((p) => p.getAttribute("d")).join(" ")))
  ok("kit-sync KS12: Flip H / Flip V carry prod's glyphs", flips[0] === "m3 7 5 5-5 5V7 m21 7-5 5 5 5V7 M12 20v2 M12 14v2 M12 8v2 M12 2v2" && flips[1] === "m17 3-5 5-5-5h10 m17 21-5-5-5 5h10 M4 12H2 M10 12H8 M16 12h-2 M22 12h-2", JSON.stringify(flips))
  await c('[data-testid="book-title"]')
  const size = page.locator(`${demo} [data-testid="size-preset"]`)
  await size.selectOption("sq20"); await page.waitForTimeout(300) // a 2:1 spread: prod's tile h 69.5
  await c('[data-item="p1"]')
  const sec = `${demo} [data-testid="layout-section"]`
  // Spec / prod numbers are taken without a scrollbar gutter (demo-capture hides scrollbars; qa shows them): drop it while measuring
  const pick = await page.evaluate((sec) => {
    const s = document.querySelector(sec), scroller = s.closest(".overflow-y-auto"); if (scroller) scroller.style.scrollbarWidth = "none"
    const tiles = [...s.querySelectorAll('[data-testid="tpl-tile"]')], grid = s.querySelector('[data-testid="tpl-grid"]')
    const pressed = s.querySelector('[data-testid="tpl-tile"] button[aria-pressed="true"]')
    const h = tiles.filter((t) => !t.dataset.tid.startsWith("c-")).map((t) => +t.getBoundingClientRect().height.toFixed(2)); if (scroller) scroller.style.scrollbarWidth = ""
    return {
      h,
      cols: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      ids: tiles.map((t) => t.dataset.tid), slots: tiles.map((t) => t.querySelectorAll('[data-testid="tpl-paper"] > div:not(.w-px)').length),
      captions: tiles.filter((t) => t.querySelector('[data-testid="tpl-name"]')).map((t) => t.dataset.tid),
      titles: tiles.every((t) => { const b = t.querySelector("button"); return b.title && b.getAttribute("aria-label") === `Apply layout ${b.title}` }),
      note: document.querySelector('[data-testid="section-note"]')?.textContent, pressed: pressed?.title,
      search: s.querySelectorAll("input[type=search], [role=searchbox]").length, heads: /Suggested for|All layouts/.test(s.textContent),
      hint: s.querySelector('[data-testid="tpl-hint"]')?.textContent, hintBelow: s.querySelector('[data-testid="tpl-hint"]').getBoundingClientRect().top >= grid.getBoundingClientRect().bottom,
    }
  }, sec)
  ok("kit-sync KS7: builtin tiles h 69.5 (2:1 spread), 2 columns, no caption (tooltip + aria-label), saved templates keep theirs", pick.h.length > 0 && pick.h.every((h) => near(h, 69.5)) && pick.cols === 2 && pick.titles && pick.captions.every((id) => id.startsWith("c-")) && pick.captions.length === 3, JSON.stringify({ h: pick.h.slice(0, 4), cols: pick.cols, captions: pick.captions }))
  ok("kit-sync KS7: one list by photo count, Two portraits merged into One per page, no search / Suggested / All layouts", pick.slots.every((n, i) => i === 0 || n >= pick.slots[i - 1]) && !pick.ids.includes("t-2port") && pick.ids.includes("t-pair") && pick.search === 0 && !pick.heads, JSON.stringify({ ids: pick.ids, slots: pick.slots }))
  ok("kit-sync KS7: header LAYOUT · <current name>; hint under the tiles", pick.note === `· ${pick.pressed}` && pick.hintBelow && pick.hint === "Hover a layout to preview it on the spread; click to apply. Photos are kept in order.", `note ${pick.note} pressed ${pick.pressed}`)
  // r15 M86–M88 (prod LayoutSection is the reference): first text run of an element, measured without the scrollbar gutter
  const r15 = (sec) => page.evaluate((sec) => {
    const s = document.querySelector(sec), scroller = s.closest(".overflow-y-auto"); if (scroller) scroller.style.scrollbarWidth = "none"
    const run = (el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n = w.nextNode(); while (n && !n.textContent.trim()) n = w.nextNode(); const g = document.createRange(); g.selectNodeContents(n); const b = g.getBoundingClientRect(); return { x: +b.x.toFixed(2), y: +b.y.toFixed(2) } }
    const save = s.querySelector('[data-testid="tpl-save-button"]'), icon = save.querySelector("svg").getBoundingClientRect()
    const out = {
      icon: [icon.width, icon.height], saveX: run(save).x, mineX: run(s.querySelector('[data-testid="tab-mine"]')).x,
      chipDy: [...s.querySelectorAll("[data-chip]")].map((b) => +(run(b).y - b.getBoundingClientRect().top).toFixed(2)),
    }
    if (scroller) scroller.style.scrollbarWidth = ""
    return out
  }, sec)
  const m86 = await r15(sec)
  ok("design-r16 M86: Save as template icon 14 × 14 (prod <Icon size={14}>, was 24), label x 1247.06 (±0.5, was 1252.06)", m86.icon.join() === "14,14" && Math.abs(m86.saveX - 1247.06) <= 0.5, JSON.stringify(m86))
  ok("design-r16 M87: All / My templates — one space before the count, “My templates” label x 1308.56 (±0.5, was 1305.41)", Math.abs(m86.mineX - 1308.56) <= 0.5, String(m86.mineX))
  ok("design-r16 M88: Layout Photos chips — text 4.5 below the pill top (±0.5, prod .layout-chip line-height normal: 76.75 at top 72.25; was 3.59)", m86.chipDy.length > 0 && m86.chipDy.every((d) => Math.abs(d - 4.5) <= 0.5), JSON.stringify(m86.chipDy))
  const row = await page.evaluate((sec) => {
    const s = document.querySelector(sec), g = s.querySelector('[role=group][aria-label="Contact sheet"]'), save = s.querySelector('[data-testid="tpl-save-button"]')
    if (!g) return null
    const b = g.querySelector('[data-testid="tpl-contact-apply"]').getBoundingClientRect()
    return { inputs: [...g.querySelectorAll("input")].map((i) => { const r = i.getBoundingClientRect(); return `${i.closest("[aria-label]")?.getAttribute("aria-label") ?? i.getAttribute("aria-label")}=${i.value} ${r.width}x${r.height}` }), below: g.getBoundingClientRect().top >= save.getBoundingClientRect().bottom, right: b.right, saveRight: save.getBoundingClientRect().right, btn: g.querySelector('[data-testid="tpl-contact-apply"]').textContent,
      shadows: [save, g.querySelector('[data-testid="tpl-contact-apply"]')].map((e) => getComputedStyle(e).boxShadow) }
  }, sec)
  await c(`${sec} [data-testid="tpl-contact-apply"]`)
  const applied = { note: await page.locator(`${demo} [data-testid="section-note"]`).textContent(), frames: await page.locator(`${demo} [data-testid="spread"][data-current] [data-testid="frame"]`).count() }
  ok("kit-sync KS7: Contact sheet row under Save as template — Columns 3 × Rows 2 (44×32) + Contact sheet at the right edge; applies 3×2", row && row.below && row.inputs.join() === "Columns=3 44x32,Rows=2 44x32" && row.btn === "Contact sheet" && near(row.right, row.saveRight) && applied.note === "· Contact sheet 3×2" && applied.frames === 12, JSON.stringify({ row, applied }))
  ok("kit-sync KS7: Save as template + Contact sheet buttons carry shadow-xs (prod 0 1px 2px rgba(20,20,19,.06))", row && row.shadows.every((s) => s.endsWith("rgba(20, 20, 19, 0.06) 0px 1px 2px 0px")), JSON.stringify(row?.shadows))
  await c(`${sec} [data-testid="tab-mine"]`); await c(`${sec} [data-chip="4"]`)
  const empty = await page.locator(`${sec} [data-testid="tpl-empty"]`).textContent().catch(() => null)
  ok("kit-sync KS7: My templates + 4+ → empty state", empty?.trim() === "No layouts match.", String(empty))
  const m87 = await r15(sec)
  ok("design-r16 M87/M88: My templates selected + 4+ chip on — label x stays 1308.56, chip text stays 4.5 below the pill top (±0.5)", Math.abs(m87.mineX - 1308.56) <= 0.5 && m87.chipDy.every((d) => Math.abs(d - 4.5) <= 0.5), JSON.stringify(m87))
  await c(`${sec} [data-chip="all"]`)
  // Designer review UT4: ••• follows the hovered tile (group/cell), not the pointer anywhere in the section
  const tiles = page.locator(`${sec} [data-testid="tpl-tile"]`)
  const menuOps = async (target) => { await target.hover(); await page.waitForTimeout(400); return tiles.evaluateAll((ts) => ts.map((t) => +getComputedStyle(t.querySelector('[data-testid="tpl-menu"]')).opacity)) }
  const onSave = await menuOps(page.locator(`${sec} [data-testid="tpl-save-button"]`)), onT1 = await menuOps(tiles.nth(0).locator("button").first()), onT2 = await menuOps(tiles.nth(1).locator("button").first())
  const only = (i) => JSON.stringify(onSave.map((_, j) => (j === i ? 1 : 0)))
  ok("user-templates UT4: ••• shows on the hovered tile only — pointer on Save → all 0, tile 1 → [1,0,…], tile 2 → [0,1,…]", onSave.length >= 2 && onSave.every((o) => o === 0) && JSON.stringify(onT1) === only(0) && JSON.stringify(onT2) === only(1), JSON.stringify({ onSave, onT1, onT2 }))
  await c('[data-item="p0"]')
  // Designer spec user-templates UT1/UT2/UT4: page 1 lists no two-page template; Save on page 1 adds one, a second Save flashes it
  const tabMine = () => page.locator(`${sec} [data-testid="tab-mine"]`).textContent()
  const p0Empty = await page.locator(`${sec} [data-testid="tpl-empty"]`).textContent().catch(() => null)
  ok("user-templates UT1: page 1 → My templates 0, “No templates yet. Save a page you like.”", (await tabMine()) === "My templates 0" && p0Empty?.trim() === "No templates yet. Save a page you like.", `${await tabMine()} / ${p0Empty}`)
  // the header + sits in the Section head, outside layout-section
  const saveOff = await page.evaluate(([demo, sec]) => [...document.querySelectorAll(`${demo} [data-testid="tpl-save"], ${sec} [data-testid="tpl-save-button"]`)].map((b) => b.hasAttribute("disabled") || b.hasAttribute("data-disabled")), [demo, sec])
  const p0Photos = await page.locator(`${demo} [data-testid="spread"][data-current] [data-testid="frame"]`).count()
  ok("user-templates UT4: both Save controls are enabled exactly when the spread has image frames", saveOff.length === 2 && saveOff.every((d) => d === (p0Photos === 0)), JSON.stringify({ saveOff, p0Photos }))
  if (p0Photos > 0) {
    await c(`${sec} [data-testid="tpl-save-button"]`); await page.keyboard.press("Enter"); await page.waitForTimeout(200)
    await page.mouse.move(5, 895); await page.waitForTimeout(300)
    const p0Tile = await page.evaluate((sec) => { const t = document.querySelector(`${sec} [data-testid="tpl-tile"]`), p = t?.querySelector('[data-testid="tpl-paper"]').getBoundingClientRect(), m = t?.querySelector('[data-testid="tpl-menu"]'); return t && { aspect: +(p.width / p.height).toFixed(3), slots: t.querySelectorAll('[data-testid="tpl-paper"] > div').length, menu: getComputedStyle(m).opacity } }, sec)
    ok("user-templates UT1/UT4: page 1 save → My templates 1 on page 1, page-shaped thumb, ••• hidden at rest (opacity 0)", (await tabMine()) === "My templates 1" && p0Tile?.slots === p0Photos && p0Tile.menu === "0", JSON.stringify(p0Tile))
    await c(`${demo} [data-testid="tpl-save"]`)
    const flashed = await page.locator(`${sec} [data-testid="tpl-tile"][data-flash]`).count(), status = await page.locator(`${demo} [data-testid="status"]`).allTextContents()
    ok("user-templates UT2: a second Save adds nothing and flashes the tile; status “Already in My templates as …”", (await tabMine()) === "My templates 1" && flashed === 1 && status.some((s) => /Already in My templates as “My layout \d+”/.test(s)), JSON.stringify({ flashed, status }))
    await page.waitForTimeout(1300)
    ok("user-templates UT2: the flash ends after 1200 ms", (await page.locator(`${sec} [data-testid="tpl-tile"][data-flash]`).count()) === 0)
  }
  await c(`${sec} [role=tab]:not([data-testid="tab-mine"])`)
  const cols1 = await page.locator(`${sec} [data-testid="tpl-grid"]`).first().evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length).catch(() => null)
  ok("kit-sync KS7: single page (page 1) → 3 columns", cols1 === 3, String(cols1))
  // prod counts only the frames on that page (LayoutSection.tsx:207): sort and the Photos chips follow the tile
  await c(`${sec} [role=tab]:not([data-testid="tab-mine"])`)
  const tids = () => page.locator(`${sec} [data-testid="tpl-tile"]`).evaluateAll((ts) => ts.map((t) => t.dataset.tid))
  // built-ins only: the kit's sample saved templates have no prod twin
  const p1Order = (await page.locator(`${sec} [data-testid="tpl-tile"]:not([data-tid^="c-"]) button[title]`).evaluateAll((bs) => bs.map((b) => b.title))).slice(0, 7)
  const chipIds = async (n) => { await c(`${sec} [data-chip="${n}"]`); return (await tids()).filter((id) => !id.startsWith("c-")).join() }
  const p1One = await chipIds("1"), p1Two = await chipIds("2"), p1Three = await chipIds("3")
  await c(`${sec} [data-chip="all"]`)
  ok("kit-sync KS7: page 1 lays each template out in the page (prod generateTemplateFrames) — order = prod, \"1\" chip shows 4 built-ins", p1Order.join("|") === "Full bleed|One per page|Panorama|Framed single|Offset pair|Two portraits|Hero + two" && p1One === "t-full,t-pair,t-pano,t-margin", JSON.stringify({ p1Order, p1One }))
  ok("kit-sync KS7: page 1 \"2\" chip = Offset pair, Two portraits; \"3\" chip = Hero + two, Three across, Landscape + 2 portraits", p1Two === "t-offset,t-2port" && p1Three === "t-hero2,t-three,t-land2port", JSON.stringify({ p1Two, p1Three }))
  // tile, hover preview and canvas agree on page 1: same frame count, every frame inside the right page (none clipped at the page edge)
  const inside = (boxes, o) => boxes.every((r) => r.left >= o.left + o.width / 2 - 1 && r.right <= o.right + 1 && r.top >= o.top - 1 && r.bottom <= o.bottom + 1)
  const hero = `${sec} [data-testid="tpl-tile"][data-tid="t-hero2"]`
  const tile = await page.locator(`${hero} [data-testid="tpl-paper"]`).evaluate((p) => { const o = p.getBoundingClientRect(); return [...p.children].map((f) => f.getBoundingClientRect()).every((r) => r.left >= o.left - 1 && r.right <= o.right + 1) ? p.children.length : -1 })
  await page.locator(`${hero} button`).hover(); await page.waitForTimeout(300)
  const prev = await page.locator(`${demo} [data-testid="tpl-preview"]`).first().evaluate((o) => ({ o: o.getBoundingClientRect().toJSON(), boxes: [...o.querySelectorAll(".outline-dashed")].map((b) => b.getBoundingClientRect().toJSON()) })).catch(() => null)
  await c(`${hero} button`)
  const cv = await page.locator(`${demo} [data-testid="spread"][data-current]`).first().evaluate((s) => ({ o: s.getBoundingClientRect().toJSON(), boxes: [...s.querySelectorAll('[data-testid="frame"]')].map((f) => f.getBoundingClientRect().toJSON()) })).catch(() => null)
  const note1 = await page.locator(`${demo} [data-testid="section-note"]`).textContent().catch(() => null)
  ok("kit-sync KS7: page 1 Hero + two — tile, hover preview and canvas all show 3 frames inside the page", tile === 3 && prev && prev.boxes.length === 3 && inside(prev.boxes, prev.o) && cv && cv.boxes.length === 3 && inside(cv.boxes, cv.o) && note1 === "· Hero + two", JSON.stringify({ tile, preview: prev?.boxes.length, prevInside: prev && inside(prev.boxes, prev.o), canvas: cv?.boxes.length, canvasInside: cv && inside(cv.boxes, cv.o), note1 }))
  // kit-thumbgrid-page-select: page 1 stores t-hero2@page; its base tile is the selected one (box-shadow = the shadow-tile-select token)
  const sel1 = await page.locator(hero).evaluate((t) => {
    const q = document.createElement("div"); q.className = "shadow-tile-select"; document.body.append(q); const want = getComputedStyle(q).boxShadow; q.remove()
    return { pressed: [...document.querySelectorAll('[data-testid="tpl-tile"] button[aria-pressed="true"]')].map((b) => b.closest("[data-tid]").dataset.tid), shadow: getComputedStyle(t.querySelector('[data-testid="tpl-paper"]')).boxShadow, want }
  })
  ok("kit-thumbgrid-page-select: page 1 Hero + two (t-hero2@page) → only the t-hero2 tile pressed, paper box-shadow = shadow-tile-select", sel1.pressed.join() === "t-hero2" && sel1.shadow === sel1.want && sel1.want !== "none", JSON.stringify(sel1))
  ok("kit-sync W3: no console errors", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
}

// kit-sync W5 (Designer kit-sync Spec 13, = prod src/editor/FilmstripDock.tsx): filmstrip header Unplaced toggle + sort menu left of Add folder…
{
  const e0 = errs.length
  await go("#/demo", 500)
  await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Chips", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; d.state().open = "s1"; d.go("editor") })
  await page.waitForTimeout(700)
  const dock = `${demo} [data-testid="dock"]`, U = `${dock} [data-testid="film-unplaced-only"]`, S = `${dock} [data-testid="film-sort"]`, A = `${dock} [data-testid="demo-add-folder"]`
  const head = () => page.locator(`${dock} [data-testid="placed-count"]`).innerText()
  const chip = (sel) => page.locator(sel).evaluate((el) => { const b = el.getBoundingClientRect(), s = getComputedStyle(el); return { x: b.x, w: b.width, h: b.height, r: parseFloat(s.borderTopLeftRadius), fs: s.fontSize, fw: s.fontWeight, c: s.color, p: s.padding, text: el.textContent.trim() } })
  // Designer capture = this renderer at 1440 × 900 (prod e2e rounds glyph runs: 786 / 90, 884 / 126, 1018 / 110)
  const SPEC = { Unplaced: [U, 783.92, 90.75, "500", "rgb(83, 81, 82)", "0px 8px"], "Added order": [S, 882.67, 127.08, "400", "rgb(83, 81, 82)", "0px 8px"], "Add folder…": [A, 1017.75, 110.25, "500", "rgb(57, 55, 56)", "0px 10px"] }
  const order = await page.locator(`${dock} :is([data-testid="film-unplaced-only"], [data-testid="film-sort"], [data-testid="demo-add-folder"])`).evaluateAll((els) => els.map((e) => e.textContent.trim()))
  ok("kit-sync KS13: #/demo dock header = Unplaced · Added order · Add folder… (prod order), 8 apart", order.join("|") === "Unplaced|Added order|Add folder…", order.join("|"))
  for (const [name, [sel, x, w, fw, c, p]] of Object.entries(SPEC)) {
    const m = await chip(sel)
    ok(`kit-sync KS13: ${name} x ${x} (±1)`, Math.abs(m.x - x) <= 1, String(m.x))
    ok(`kit-sync KS13: ${name} width ${w} (±1)`, Math.abs(m.w - w) <= 1, String(m.w))
    ok(`kit-sync KS13: ${name} height 28`, m.h === 28, String(m.h))
    ok(`kit-sync KS13: ${name} radius ≥ 9999 (pill, Decided P2)`, m.r >= 9999, String(m.r))
    ok(`kit-sync KS13: ${name} font size 12`, m.fs === "12px", m.fs)
    ok(`kit-sync KS13: ${name} font weight ${fw}`, m.fw === fw, m.fw)
    ok(`kit-sync KS13: ${name} colour ${c}`, m.c === c, m.c)
    ok(`kit-sync KS13: ${name} padding ${p}`, m.p === p, m.p)
  }
  const glyphs = await page.locator(S).evaluate((el) => [...el.querySelectorAll("svg")].map((v) => v.getAttribute("class")))
  ok("kit-sync KS13: sort chip = arrow-up-down icon + label + chevron-down", glyphs.length === 2 && /arrow-down-up/.test(glyphs[0]) && /chevron-down/.test(glyphs[1]), JSON.stringify(glyphs))
  // r15 M88: label text y at prod's line-height (chip's own text run vs its top; prod at top 774: Unplaced 780.0, sort / Add folder… 780.5)
  const runY = (sel) => page.locator(sel).evaluate((el) => { const tn = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim()), g = document.createRange(); g.selectNodeContents(tn); return { y: +g.getBoundingClientRect().y.toFixed(2), top: el.getBoundingClientRect().top } })
  const filmDy = { Unplaced: [U, 6], "Added order": [S, 6.5], "Add folder…": [A, 6.5] }
  // the filmstrip's scrollbar gutter (qa shows scrollbars, demo-capture does not) lifts the dock 10 px: drop it while measuring
  const gutter = (v) => page.locator(`${dock} [data-testid="filmstrip"]`).evaluate((e, v) => { e.style.scrollbarWidth = v }, v)
  const chipsAt = async (top) => { await gutter("none"); const o = {}; for (const [name, [sel, dy]] of Object.entries(filmDy)) { const m = await runY(sel); o[name] = { ...m, ok: (top == null || m.top === top) && Math.abs(m.y - m.top - dy) <= 0.5 } } await gutter(""); return o }
  const fy0 = await chipsAt()
  ok("design-r16 M88: empty book — film chip text sits 6.0 (Unplaced) / 6.5 (Added order, Add folder…) below the chip top (±0.5, prod line-height 1 / normal)", Object.values(fy0).every((m) => m.ok), JSON.stringify(fy0))
  const emptyY = await page.locator(`${dock} [data-testid="film-panel"]`).evaluate((p) => { const e = [...p.querySelectorAll("span")].find((s) => /^No photos yet/.test(s.textContent)); if (!e) return null; const g = document.createRange(); g.selectNodeContents(e); return +g.getBoundingClientRect().y.toFixed(2) })
  ok("design-r16 M88: empty strip “No photos yet…” text y 829.3 (±0.5, prod .pb-empty-title 18 px / 1.3 around 13 px / 1.35; was 827.58)", emptyY != null && Math.abs(emptyY - 829.3) <= 0.5, String(emptyY))
  // empty: no photos → the filter keeps the plain empty copy (prod shows the all-placed copy only with photos)
  const h0 = await head()
  await page.click(U); await page.waitForTimeout(200)
  const h0on = await head(), empty0 = (await page.locator(`${dock} [data-testid="film-panel"]`).innerText()).trim()
  await page.click(U); await page.waitForTimeout(200)
  ok("kit-sync KS13: empty book — head Photos · 0 · 0 used, Unplaced on → Photos · 0 of 0 · 0 used and the no-photos copy", h0 === "Photos · 0 · 0 used" && h0on === "Photos · 0 of 0 · 0 used" && /^No photos yet/.test(empty0), JSON.stringify({ h0, h0on, empty0 }))
  // happy: add the folder, place one photo on the cover, Unplaced drops it and the head reads N of M
  await page.click(A); await page.waitForTimeout(250)
  await page.locator("[role=dialog]").getByRole("button", { name: /Select/i }).last().click(); await page.waitForTimeout(500)
  const rows = () => page.locator(`${dock} [data-testid="filmstrip"] [role="row"]`).evaluateAll((rs) => rs.map((r) => r.dataset.key))
  const all = await rows()
  const fy1 = await chipsAt(774)
  ok("design-r16 M88: with photos the chips sit at top 774 — text y Unplaced 780.0, Added order / Add folder… 780.5 (±0.5; was 779.59)", Object.values(fy1).every((m) => m.ok), JSON.stringify(fy1))
  await page.click(`${demo} [data-item="cover"]`); await page.waitForTimeout(300)
  await page.locator(`${dock} [data-testid="filmstrip"] [role="row"][data-key="${all[0]}"]`).dragTo(page.locator(`${demo} [data-testid="cover-front"]`)); await page.waitForTimeout(450)
  const used = +((await head()).match(/(\d+) used/) || [])[1]
  await page.click(U); await page.waitForTimeout(250)
  const on = await rows(), hOn = await head(), pressed = await page.locator(U).getAttribute("aria-pressed")
  const bgOn = await page.locator(U).evaluate((el) => getComputedStyle(el).backgroundColor)
  const uOn = await runY(U)
  ok("design-r16 M88: Unplaced on keeps its text 6.0 below the chip top (±0.5)", Math.abs(uOn.y - uOn.top - 6) <= 0.5, JSON.stringify(uOn))
  await page.click(U); await page.waitForTimeout(250)
  const off = await rows()
  ok("kit-sync KS13: Unplaced on → the strip shows only unplaced photos, head Photos · N of M · K used; off → all photos again", all.length > 1 && used === 1 && !on.includes(all[0]) && on.length === all.length - 1 && hOn === `Photos · ${all.length - 1} of ${all.length} · 1 used` && off.length === all.length && pressed === "true",
    JSON.stringify({ all: all.length, on: on.length, used, hOn, off: off.length, pressed }))
  ok("kit-sync KS13: Unplaced on = rgb(215, 215, 215) fill (prod .film-chip[data-selected])", bgOn === "rgb(215, 215, 215)", bgOn)
  // interact: the sort menu opens above the chip with prod's options, Added order checked; File name relabels and re-sorts
  const label0 = await page.locator(S).getAttribute("aria-label")
  await page.click(S); await page.waitForTimeout(300)
  const menu = await page.locator('[data-testid="film-sort-menu"]').evaluate((m) => { const b = (m.closest("[data-placement]") ?? m).getBoundingClientRect(); return { bottom: b.bottom, w: b.width, items: [...m.querySelectorAll("[role=menuitemradio]")].map((i) => `${i.textContent.trim()}${i.getAttribute("aria-checked") === "true" ? "*" : ""}`) } }).catch(() => null)
  const chipTop = await page.locator(S).evaluate((el) => el.getBoundingClientRect().top)
  ok("kit-sync KS13: sort chip aria-label Sort photos: Added order; menu above the chip, ≥ 160 wide, Date taken · File name · Added order (checked)", label0 === "Sort photos: Added order" && menu && menu.bottom <= chipTop && menu.w >= 160 && menu.items.join("|") === "Date taken|File name|Added order*", JSON.stringify({ label0, menu, chipTop }))
  const bgc = (sel) => page.locator(sel).evaluate((el) => { const s = getComputedStyle(el); return { bg: s.backgroundColor, c: s.color } })
  const openSt = await bgc(S)
  ok("kit-sync KS13: sort chip stays transparent with text rgb(83, 81, 82) while its menu is open (prod .film-chip has no pressed fill)", openSt.bg === "rgba(0, 0, 0, 0)" && openSt.c === "rgb(83, 81, 82)", JSON.stringify(openSt))
  await page.getByRole("menuitemradio", { name: "File name" }).click(); await page.waitForTimeout(300)
  const names = await page.locator(`${dock} [data-testid="filmstrip"] [role="row"]`).evaluateAll((rs) => rs.map((r) => r.getAttribute("aria-label") ?? r.textContent.trim()))
  const label1 = (await page.locator(S).textContent()).trim()
  ok("kit-sync KS13: File name relabels the chip and sorts the strip by name", label1 === "File name" && names.length === all.length && names.every((n, i) => i === 0 || names[i - 1].localeCompare(n, undefined, { numeric: true }) <= 0), JSON.stringify({ label1, names: names.slice(0, 4) }))
  // hover: all three header chips fill rgb(215, 215, 215) with text rgb(57, 55, 56) (prod .film-chip:hover); Add folder… pressed too
  const hov = {}
  for (const [name, sel] of [["Unplaced", U], ["File name", S], ["Add folder…", A]]) { await page.hover(sel); await page.waitForTimeout(250); hov[name] = await bgc(sel) }
  await page.mouse.move(0, 0); await page.waitForTimeout(250)
  ok("kit-sync KS13: hover fills Unplaced · sort · Add folder… rgb(215, 215, 215), text rgb(57, 55, 56)", Object.values(hov).every((s) => s.bg === "rgb(215, 215, 215)" && s.c === "rgb(57, 55, 56)"), JSON.stringify(hov))
  const ab = await page.locator(A).boundingBox()
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2); await page.mouse.down(); await page.waitForTimeout(250)
  const pressA = await bgc(A)
  await page.mouse.move(0, 0); await page.mouse.up(); await page.waitForTimeout(250)
  ok("kit-sync KS13: Add folder… pressed fills rgb(215, 215, 215), text rgb(57, 55, 56)", pressA.bg === "rgb(215, 215, 215)" && pressA.c === "rgb(57, 55, 56)", JSON.stringify(pressA))
  // all placed: the gallery keeps only the cover photo → Unplaced on shows prod's all-placed copy
  await page.evaluate((id) => { const d = window.__demo, b = d.state().books[0]; b.doc = { ...b.doc, gallery: [id] }; d.go("library") }, all[0]); await page.waitForTimeout(300)
  await page.evaluate(() => window.__demo.go("editor")); await page.waitForTimeout(700)
  await page.click(U); await page.waitForTimeout(250)
  const hAll = await head(), copyAll = (await page.locator(`${dock} [data-testid="film-panel"]`).innerText()).trim()
  ok("kit-sync KS13: every photo placed + Unplaced on → Photos · 0 of 1 · 1 used and “Every photo is placed. Turn off “Unplaced” to see all.”", hAll === "Photos · 0 of 1 · 1 used" && copyAll === "Every photo is placed. Turn off “Unplaced” to see all.", JSON.stringify({ hAll, copyAll }))
  ok("kit-sync W5: no console errors", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
}

// text-frames (Designer text-frames Spec "Kit changes"): Text click / drag, edit look, whole lines, Overflow chip, grow, inspector
{
  const e0 = errs.length
  await go("#/demo", 500); await page.evaluate(() => window.__demo.reset()); await page.waitForTimeout(500)
  const c = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(300) }
  await c('[data-testid="create-library"]'); await c('[data-testid="picker-select"]')
  await c(`${demo} [data-testid="new-book"]`); await page.locator("[role=dialog] input").first().fill("Lake trip")
  await page.locator("[role=dialog]").getByRole("button", { name: /A5|A4|Square|cm/ }).first().click(); await page.waitForTimeout(200)
  await page.getByRole("option", { name: /Custom size/ }).click(); await page.waitForTimeout(200)
  await page.fill('[data-testid="create-custom-w"]', "19"); await page.fill('[data-testid="create-custom-h"]', "23")
  await c('[data-testid="create-book"]'); await c('[data-item="p1"]')
  const paperSel = '[data-testid="canvas"] [data-testid="spread"][data-current]'
  const paper = await page.locator(paperSel).boundingBox(), sc = paper.width / 380 // 19 × 23 cm book: a spread is 380 mm wide
  const read = () => page.evaluate((ps) => {
    const p = document.querySelector(ps), r = (e) => e && (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(e.getBoundingClientRect())
    // own text frames only (the master's inherited caption is a master-frame)
    const tf = [...p.querySelectorAll('[data-testid="frame"]')].filter((f) => f.querySelector('[data-testid="text-body"], [data-testid="text-edit"]'))
    const ta = p.querySelector('[data-testid="frame"] [data-testid="text-edit"] textarea'), body = tf.at(-1)?.querySelector('[data-testid="text-body"]'), chip = p.querySelector('[data-testid="text-overflow-chip"]')
    const cs = ta && getComputedStyle(ta), bs = body && getComputedStyle(body)
    return {
      frames: p.querySelectorAll('[data-testid="frame"]').length, texts: tf.map(r), editing: !!ta, focused: !!ta && document.activeElement === ta, handles: p.querySelectorAll('[data-testid="handles"]').length,
      edit: ta && { bg: cs.backgroundColor, ph: ta.placeholder, value: ta.value, outline: getComputedStyle(ta.parentElement).outlineWidth, box: r(ta.parentElement) },
      body: body && { h: body.getBoundingClientRect().height, lh: parseFloat(bs.lineHeight), sh: body.scrollHeight }, chip: chip && { ...r(chip), text: chip.textContent, color: getComputedStyle(chip).color },
      meta: document.querySelector('[data-testid="inspector-meta"]')?.textContent ?? null, metaColor: (() => { const m = document.querySelector('[data-testid="inspector-meta"] span'); return m ? getComputedStyle(m).color : null })(),
    }
  }, paperSel)
  const s0 = await read()
  const tool = () => c('[aria-label="Text (T)"]')
  // a click near the bottom-right corner: 60 × 14 mm, clamped into the right page's 6 mm safe area, editing at once
  await tool(); await page.mouse.click(Math.round(paper.x + paper.width - 3), Math.round(paper.y + paper.height - 3)); await page.waitForTimeout(300)
  const s1 = await read(), t1 = s1.texts.at(-1)
  ok("text-frames: Text click → one 60 × 14 mm frame in edit mode (focused, `Type text`, transparent, 1 px outline, no handles)",
    s1.frames === s0.frames + 1 && s1.focused && s1.edit?.ph === "Type text" && s1.edit?.value === "" && s1.edit?.bg === "rgba(0, 0, 0, 0)" && s1.edit?.outline === "1px" && s1.handles === 0 && Math.abs(t1.w - 60 * sc) <= 1 && Math.abs(t1.h - 14 * sc) <= 1, JSON.stringify({ s0: s0.frames, ...s1, sc }))
  ok("text-frames: the click frame is clamped inside the page's 6 mm safe area", t1 && paper.x + paper.width - (t1.x + t1.w) >= 6 * sc - 1 && paper.y + paper.height - (t1.y + t1.h) >= 6 * sc - 1, JSON.stringify({ t1, paper }))
  await page.keyboard.press("Escape"); await page.waitForTimeout(300)
  const s2 = await read()
  ok("text-frames: Esc on an empty new frame removes it", s2.frames === s0.frames && !s2.editing, JSON.stringify(s2))
  // a drag (over whatever lies there, photo frames included) + typing, Esc, Title → whole lines + Overflow chip + inspector meta
  await tool()
  const x = Math.round(paper.x + paper.width * 0.56), y = Math.round(paper.y + paper.height * 0.62)
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 200, y + 36, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300)
  await page.keyboard.type("Morning on the lake, 6:40"); await page.keyboard.press("Escape"); await page.waitForTimeout(300)
  const s3 = await read()
  ok("text-frames: drag + type + Esc keeps the frame selected with handles, no chip (caption fits)", s3.frames === s0.frames + 1 && !s3.editing && s3.handles === 1 && !s3.chip, JSON.stringify(s3))
  await page.locator('[data-testid="ctx-inspector"]').getByText("Title", { exact: true }).click(); await page.waitForTimeout(400)
  const s4 = await read(), t4 = s4.texts.at(-1), lines = s4.body && s4.body.h / s4.body.lh
  ok("text-frames: Title in a 36 px box shows whole lines only (visible height = n × line height ≤ box)", s4.body && Math.abs(lines - Math.round(lines)) < 0.01 && Math.round(lines) >= 1 && s4.body.h <= t4.h + 0.5 && s4.body.sh > s4.body.h, JSON.stringify({ body: s4.body, t4 }))
  ok("text-frames: Overflow chip 4 px below the frame, right-aligned, amber", s4.chip?.text === "Overflow" && Math.abs(s4.chip.y - (t4.y + t4.h + 4)) <= 1 && Math.abs(s4.chip.x + s4.chip.w - (t4.x + t4.w)) <= 1 && s4.chip.color === "rgb(132, 85, 16)" && Math.abs(s4.chip.h - 14) <= 0.5, JSON.stringify({ chip: s4.chip, t4 }))
  ok("text-frames: inspector meta `Text overflows the frame` rgb(132, 85, 16)", s4.meta === "Text overflows the frame" && s4.metaColor === "rgb(132, 85, 16)", JSON.stringify({ meta: s4.meta, c: s4.metaColor }))
  // a content edit grows the box to whole lines: no overflow after the edit
  await page.locator(paperSel).locator('[data-testid="text-body"]').last().dblclick(); await page.waitForTimeout(300)
  await page.keyboard.press("End"); await page.keyboard.type(" by the pier"); await page.keyboard.press("Escape"); await page.waitForTimeout(400)
  const s5 = await read(), t5 = s5.texts.at(-1), n5 = s5.body && s5.body.h / s5.body.lh
  ok("text-frames: a content edit grows the box to whole lines (taller, no chip, no meta)", t5.h > t4.h + 1 && !s5.chip && s5.meta === null && Math.abs(n5 - Math.round(n5)) < 0.01 && Math.abs(t5.h - s5.body.h) <= 1, JSON.stringify({ t4, t5, body: s5.body }))
  // inspector TEXT textarea: grows to 160 then scrolls; focus = inset 1 px #535152
  const ita = page.locator('[data-testid="ctx-inspector"] textarea[aria-label="Text"]')
  await ita.focus(); await page.waitForTimeout(150)
  const ti = await ita.evaluate((e) => { const s = getComputedStyle(e); return { max: s.maxHeight, oy: s.overflowY, shadow: s.boxShadow } })
  ok("text-frames: inspector textarea max-height 160, scrolls, focus ring inset 1 px #535152", ti.max === "160px" && ti.oy === "auto" && /rgb\(83, 81, 82\) 0px 0px 0px 1px inset/.test(ti.shadow), JSON.stringify(ti))
  await ita.blur()
  // review #445: an inspector content edit grows the box to whole lines like the canvas edit, capped at the paper bottom
  await ita.fill(["Lake", "Pier", "Boats", "Dock", "Pines", "Dusk"].join("\n")); await page.waitForTimeout(400)
  const s6 = await read(), t6 = s6.texts.at(-1), n6 = s6.body && s6.body.h / s6.body.lh
  ok("text-frames: inspector TEXT edit grows the box to whole lines (taller, no chip, no meta)", t6.h > t5.h + 1 && !s6.chip && s6.meta === null && Math.abs(n6 - Math.round(n6)) < 0.01 && Math.round(n6) >= 6, JSON.stringify({ t5, t6, body: s6.body }))
  await ita.fill(Array.from({ length: 14 }, (_, i) => `Line ${i + 1}`).join("\n")); await page.waitForTimeout(400)
  const s7 = await read(), t7 = s7.texts.at(-1)
  ok("text-frames: inspector TEXT growth stops at the paper bottom (then the chip shows)", Math.abs(t7.y + t7.h - (paper.y + paper.height)) <= 1 && !!s7.chip, JSON.stringify({ t7, paper, chip: s7.chip }))
  await ita.blur()
  // review #445: Enter on one selected text frame (Select tool) edits it, caret at the end
  await page.locator(paperSel).locator('[data-testid="text-body"]').last().click(); await page.waitForTimeout(200)
  await page.keyboard.press("Enter"); await page.waitForTimeout(300)
  const s8 = await read(), caret = await page.evaluate(() => { const t = document.activeElement; return t?.tagName === "TEXTAREA" ? { at: t.selectionStart, len: t.value.length } : null })
  ok("text-frames: Enter on a selected text frame starts editing, caret at the end", s8.editing && s8.focused && caret?.at === caret?.len && caret?.len > 0, JSON.stringify({ editing: s8.editing, caret }))
  await page.keyboard.press("Escape"); await page.waitForTimeout(300)
  // review #445 (Designer decision): Text pressed on a text frame edits it and the tool returns to Select
  await tool(); await page.locator(paperSel).locator('[data-testid="text-body"]').last().click(); await page.waitForTimeout(300)
  const s9 = await read(), toolSel = await page.locator('[aria-label="Select (V)"]').getAttribute("data-selected")
  ok("text-frames: Text press on a text frame edits it, the tool returns to Select", s9.editing && toolSel === "true", JSON.stringify({ editing: s9.editing, toolSel }))
  await page.keyboard.press("Escape"); await page.waitForTimeout(300)
  // review #445: Esc during a Text drag cancels (no frame, no undo step)
  const undoLabel = () => page.locator(`${demo} [data-testid="undo"]`).first().getAttribute("aria-label")
  const undo0 = await undoLabel(), s10a = await read()
  await tool(); await page.mouse.move(x - 120, y - 120); await page.mouse.down(); await page.mouse.move(x - 20, y - 90, { steps: 5 })
  await page.keyboard.press("Escape"); await page.mouse.up(); await page.waitForTimeout(300)
  const s10 = await read(), undo1 = await undoLabel()
  ok("text-frames: Esc during a Text drag cancels (no frame, no edit, no undo step)", s10.frames === s10a.frames && !s10.editing && undo1 === undo0, JSON.stringify({ before: s10a.frames, after: s10.frames, undo0, undo1 }))
  ok("text-frames: no console errors", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
}
// ───────── default-master (Designer spec 2026-11-04 + Owner amendment: the Master control is always a select) ─────────
{
  const e0 = errs.length
  await go("#/demo", 500)
  await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Default master", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; d.state().open = "s1"; d.go("editor") })
  await page.waitForTimeout(700)
  const L = (s) => page.locator(`${demo} ${s}`)
  const seg = (i) => L('[data-testid="mode-seg"] button').nth(i).click()
  await L('[data-item="p1"]').click(); await page.waitForTimeout(250)
  const sel = L('[data-testid="spread-master-select"]')
  const status = () => L('[data-testid="spread-master-status"]').evaluate((e) => ({ t: e.firstElementChild.textContent, h: e.getBoundingClientRect().height, edit: !!e.querySelector('[data-testid="spread-master-edit"]') }))
  const opts = await sel.locator("option").allTextContents(), w = await sel.evaluate((e) => e.getBoundingClientRect().width), s0 = await status()
  const col = await L('[data-testid="spread-spacing"]').evaluate((e) => e.getBoundingClientRect().width)
  ok("default-master S1: spread 2–3 Master is a select (Master A · default, Master B, None), full section width (prod 268), no radiogroup", opts.join("|") === "Master A · default|Master B|None" && Math.abs(w - col) <= 0.5 && w > 250 && (await L('[role=radiogroup][aria-label="Master"]').count()) === 0, `${opts.join("|")} w=${w} col=${col}`)
  ok("default-master S2/S3: status \"Book default\" 16.8 tall with Edit master", s0.t === "Book default" && Math.abs(s0.h - 16.8) < 0.05 && s0.edit, JSON.stringify(s0))
  await sel.selectOption("B"); await page.waitForTimeout(200); const s1 = await status()
  await sel.selectOption("none"); await page.waitForTimeout(200); const s2 = await status()
  ok("default-master S2: \"Instead of Master A\", then \"No master on this spread\" without Edit master", s1.t === "Instead of Master A" && s1.edit && s2.t === "No master on this spread" && !s2.edit, `${s1.t} | ${s2.t} edit=${s2.edit}`)
  await sel.selectOption("A"); await page.waitForTimeout(200)
  await L('[data-testid="spread-master-edit"]').click(); await page.waitForTimeout(300)
  const intro = await L('[data-testid="masters-intro"]').textContent(), tagOn = await L('[data-item="mA"] [data-testid="master-default-tag"]').count(), head = await L('[data-testid="master-usage"]').textContent()
  ok("default-master S3/P1/P2/I1: Edit master opens Masters on Master A; the note names it; Master A tagged Default; head \"Default · all N pages\"", intro.includes("Spreads use the default, Master A, unless") && tagOn === 1 && /^Default · all \d+ pages$/.test(head) && (await L('[data-testid="master-make-default"]').count()) === 0, `${intro} tag=${tagOn} head=${head}`)
  await L('[data-testid="master-menu-A"]').click(); await page.waitForTimeout(200)
  const aMenu = { make: await page.getByTestId("master-menu-make-default").count(), del: await page.getByTestId("master-menu-delete").getAttribute("aria-disabled") }
  await page.keyboard.press("Escape"); await page.waitForTimeout(150)
  ok("default-master P3: the default's row menu has no Make default and a disabled Delete", aMenu.make === 0 && aMenu.del === "true", JSON.stringify(aMenu))
  await L('[data-item="mB"]').click(); await page.waitForTimeout(250)
  const hb = await L('[data-testid="master-usage"]').textContent(), hint = await L('[data-testid="master-hint"]').count()
  await L('[data-testid="master-make-default"]').click(); await page.waitForTimeout(250)
  const after = { tag: await L('[data-item="mB"] [data-testid="master-default-tag"]').count(), tagA: await L('[data-item="mA"] [data-testid="master-default-tag"]').count(), intro: await L('[data-testid="masters-intro"]').textContent(), button: await L('[data-testid="master-make-default"]').count(), order: await L('[data-testid="list"] [data-item]').evaluateAll((els) => els.map((e) => e.dataset.item).join()) }
  ok("default-master I2/I3/P2: Master B \"Not used yet\" + hint; Make default moves the tag and the note, list order kept, button gone", hb === "Not used yet" && hint === 1 && after.tag === 1 && after.tagA === 0 && after.intro.includes("default, Master B,") && after.button === 0 && after.order === "mA,mB", JSON.stringify({ hb, hint, ...after }))
  await seg(0); await page.waitForTimeout(250); await L('[data-item="p1"]').click(); await page.waitForTimeout(250)
  const follow = { v: await sel.inputValue(), opts: (await sel.locator("option").allTextContents()).join("|"), s: (await status()).t }
  ok("default-master: spread 2–3 follows the new default Master B", follow.v === "B" && follow.opts === "Master A|Master B · default|None" && follow.s === "Book default", JSON.stringify(follow))
  ok("default-master: no console errors", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
}

{ // static-export (Designer static-export §1–2): the Export site pill keeps one rect in every state; the dialog is the kit Publish frame
  const tabs = { "opts-empty": "Options, no folder", "run-hidden": "Hidden, 42 %", done: "Exported", failed: "Failed", opts: "Options" }
  const pick = async (id) => { await page.locator(`[data-testid="scenarios"] [role="tab"]:text-is("${tabs[id]}")`).evaluate((t) => t.click()); await page.waitForTimeout(300) }
  const pill = () => page.locator('[data-scenario] [data-testid="demo-export-site"]').first().evaluate((e) => { const r = e.getBoundingClientRect(); return [e.dataset.state, +r.x.toFixed(2), +r.width.toFixed(2), r.height] })
  const out = {}
  for (const w of [1440, 1200]) {
    await page.setViewportSize({ width: w, height: 900 }); await page.goto(url + feat("static-export")); await page.waitForTimeout(500)
    for (const id of ["opts-empty", "run-hidden", "done", "failed"]) { await pick(id); out[`${w} ${id}`] = await pill() }
  }
  const same = (w, ww) => Object.entries(out).filter(([k]) => k.startsWith(`${w} `)).every(([, [, x, pw, h]]) => Math.abs(x - out[`${w} opts-empty`][1]) <= 0.5 && Math.abs(pw - ww) <= 0.5 && h === 32)
  ok("static-export: Export site pill rect identical in idle / running 42 % / done / failed, 112.33 × 32 at 1440, 40 × 32 at 1200", Object.values(out).map((v) => v[0]).join() === "idle,running,done,failed,idle,running,done,failed" && same(1440, 112.33) && same(1200, 40), JSON.stringify(out))
  await page.setViewportSize({ width: 1440, height: 900 }); await pick("opts")
  const dlg = await page.locator('[data-testid="export-site-dialog"]').evaluate((d) => {
    const cs = getComputedStyle(d), hs = getComputedStyle(d.firstElementChild)
    return { w: d.closest("[role=dialog]").getBoundingClientRect().width, pad: `${cs.paddingTop} ${cs.paddingRight}`, h: `${hs.fontFamily.split(",")[0].replace(/"/g, "")} ${hs.fontSize}/${hs.lineHeight} ${hs.fontWeight}`, btns: [...d.querySelectorAll("button")].slice(-2).map((b) => `${b.getBoundingClientRect().height} ${getComputedStyle(b).borderRadius}`) }
  })
  ok("static-export: dialog 480 wide, padding 20 / 24, heading Lora 21/26.25 500, buttons 36 h r8", dlg.w === 480 && dlg.pad === "20px 24px" && dlg.h === "Lora Variable 21px/26.25px 500" && dlg.btns.join() === "36 8px,36 8px", JSON.stringify(dlg))
  // Designer review 2: the done step's "To open it…" block sits 16 px under the summary (kit Publish done mt-4)
  await pick("done")
  const gap = await page.locator('[data-testid="export-site-summary"]').evaluate((s) => +(s.nextElementSibling.getBoundingClientRect().top - s.getBoundingClientRect().bottom).toFixed(2))
  ok("static-export: done step's open-it block 16 px under the summary", Math.abs(gap - 16) <= 0.5, `gap ${gap}`)
}

{ // cover-editor (Designer cover-editor "Geometry" / "Layers" / "Spine text" / "Inspector"): the printed cover sheet at 1440 × 900, 19 × 23 cm
  const S = "[data-scenario]"
  await page.setViewportSize({ width: 1440, height: 900 }); await go("#/full/cover-editor", 600)
  const top = await page.locator(S).first().evaluate((e) => e.getBoundingClientRect().top)
  await page.setViewportSize({ width: 1440, height: 900 + top }); await page.waitForTimeout(300)
  const pick = async (l) => { await page.locator(`[data-testid="scenarios"] [role="tab"]:text-is("${l}")`).evaluate((t) => t.click()); await page.waitForTimeout(350) }
  const geo = () => page.evaluate((S) => {
    const r = (id) => { const e = document.querySelector(`${S} [data-testid="${id}"]`); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom } }
    const t = document.querySelector(`${S} [data-testid="cover-spine-text"]`), labels = [...document.querySelectorAll(`${S} [data-testid="page-labels"] span`)].map((s) => [s.textContent, s.getBoundingClientRect().top])
    const veil = document.querySelector(`${S} [data-testid="cover-wrap"]`), photo = document.querySelector(`${S} [data-testid="cover-front"] .cover-front-photo`)
    return { sheet: r("cover-sheet"), cover: r("canvas-cover"), spine: r("cover-spine"), text: r("cover-spine-text"), hb: r("cover-hinge-back"), hf: r("cover-hinge-front"), sb: r("cover-safe-back"), sf: r("cover-safe-front"), chip: r("cover-wrap-chip"), front: r("cover-front"),
      photo: photo && photo.getBoundingClientRect().toJSON(), labels, veilPe: veil && getComputedStyle(veil).pointerEvents, veilN: veil?.children.length, ell: t && getComputedStyle(t).textOverflow, clip: t && t.scrollWidth > t.clientWidth,
      sub: document.querySelector(`${S} [data-testid="cover-head-sub"]`)?.textContent, sw: document.querySelector(`${S} [data-testid="cover-spine-width"]`)?.textContent, hint: document.querySelector(`${S} [data-testid="cover-spine-hint"]`)?.textContent }
  }, S)
  const n5 = (a, b) => a != null && Math.abs(a - b) <= 0.5, cx = (b) => b.x + b.w / 2, cy = (b) => b.y + b.h / 2
  const centred = (g) => n5(cx(g.text), cx(g.spine)) && n5(cy(g.text), cy(g.spine))
  await pick("New cover"); const e = await geo()
  ok("cover-editor: empty cover — sheet, hinges, safe frames, 4-strip veil (pointer-events none) and chip; no photo layer", !!e.sheet && !!e.hb && !!e.hf && !!e.sb && !!e.sf && e.veilN === 4 && e.veilPe === "none" && !!e.chip && !e.photo, JSON.stringify({ veil: e.veilN, pe: e.veilPe, photo: !!e.photo }))
  await pick("Photo + title"); const g = await geo(), wrap = g.cover.x - g.sheet.x
  ok("cover-editor: 20 pages — sheet 848 × 522.47, cover 787.73 × 462.18, spine 24.11, wrap 30.14, hinge 16.08 px (±0.5)",
    n5(g.sheet.w, 848) && n5(g.sheet.h, 522.47) && n5(g.cover.w, 787.73) && n5(g.cover.h, 462.18) && n5(g.spine.w, 24.11) && n5(wrap, 30.14) && n5(g.cover.y - g.sheet.y, 30.14) && n5(g.hb.w, 16.08) && n5(g.hb.r, g.spine.x) && n5(g.hf.x, g.spine.r),
    JSON.stringify({ sheet: [g.sheet.w, g.sheet.h], cover: [g.cover.w, g.cover.h], spine: g.spine.w, wrap, hinge: g.hb.w }))
  ok("cover-editor: safe frames 355.68 × 442.08 at sheet + (40.19, 40.19) and (452.13, 40.19); chip 8 px from the sheet's right, centred in the band",
    n5(g.sb.x - g.sheet.x, 40.19) && n5(g.sb.y - g.sheet.y, 40.19) && n5(g.sb.w, 355.68) && n5(g.sb.h, 442.08) && n5(g.sf.x - g.sheet.x, 452.13) && n5(g.sf.w, 355.68) && n5(g.sheet.r - g.chip.r, 8) && n5(g.chip.y - g.sheet.y, (wrap - 14) / 2),
    JSON.stringify({ sb: g.sb, sf: g.sf, chip: g.chip }))
  ok("cover-editor: front photo = front board + the wrap on top, outer and bottom edges; labels 10 px under the sheet",
    !!g.photo && n5(g.photo.x, g.front.x) && n5(g.photo.right, g.sheet.r) && n5(g.photo.top, g.sheet.y) && n5(g.photo.bottom, g.sheet.b) && g.labels.map((l) => l[0]).join() === "Back,Spine,Front" && g.labels.every((l) => n5(l[1] - g.sheet.b, 10)),
    JSON.stringify({ photo: g.photo, labels: g.labels, sheetB: g.sheet.b }))
  ok("cover-editor: spine text centre = spine centre (±0.5) at 20 pages; inspector sub, Spine width and hint", centred(g) && g.sub === "Hardcover · wrap 15 mm · hinge 8 mm" && g.sw === "12 mm" && g.hint === "Generic print profile · 20 pages", JSON.stringify({ text: [cx(g.text), cy(g.text)], spine: [cx(g.spine), cy(g.spine)], sub: g.sub, sw: g.sw, hint: g.hint }))
  await page.fill(`${S} [data-testid="cover-text-spine"]`, "Lake trip · Summer 2026 · Karelia, Ladoga, Valaam, the islands of Lake Ladoga and the long road home"); await page.waitForTimeout(200)
  const l = await geo()
  ok("cover-editor: a long spine text stays centred and ends in an ellipsis within trim height − 2 × safe", centred(l) && l.ell === "ellipsis" && l.clip && l.text.h <= g.cover.h * (22 / 23) + 0.5, JSON.stringify({ h: l.text.h, ell: l.ell, clip: l.clip }))
  await pick("120 pages"); const t = await geo()
  ok("cover-editor: 120 pages — spine 61.39 px, sheet 848 × 498.82, wrap 28.78, text centred, Spine width 32 mm", n5(t.spine.w, 61.39) && n5(t.sheet.h, 498.82) && n5(t.cover.x - t.sheet.x, 28.78) && centred(t) && t.sw === "32 mm" && t.hint === "Generic print profile · 120 pages", JSON.stringify({ spine: t.spine.w, sheet: t.sheet.h, wrap: t.cover.x - t.sheet.x, sw: t.sw, hint: t.hint }))
  await pick("Photo + title")
  await page.locator(`${S} [data-testid="book-title"]`).click(); await page.waitForTimeout(250)
  await page.selectOption(`${S} [data-testid="size-preset"]`, "A3"); await page.waitForTimeout(150)
  await page.locator(`${S} [data-testid="size-orientation"]`).getByText("Landscape", { exact: true }).click(); await page.waitForTimeout(150)
  await page.locator(`${S} [data-item="cover"]`).click(); await page.waitForTimeout(400)
  const a3 = await geo()
  ok("cover-editor: A3 landscape — sheet 848 × 314.4, band 14.42 px < 18, chip not rendered", n5(a3.sheet.w, 848) && n5(a3.sheet.h, 314.4) && n5(a3.cover.x - a3.sheet.x, 14.42) && !a3.chip, JSON.stringify({ sheet: a3.sheet && [a3.sheet.w, a3.sheet.h], wrap: a3.cover && a3.cover.x - a3.sheet.x, chip: !!a3.chip }))
  await page.setViewportSize({ width: 1440, height: 900 })
}
{ // printer-presets-kit (Designer printer-presets §Settings, §Profile editor, §Kit PrintDialog): DOM measured at 1440 × 900
  const e0 = errs.length
  const tabs = { print: "Print presets", "print-empty": "No custom profiles", "print-edit": "Edit profile", "print-invalid": "Invalid values" }
  const pick = async (id) => { await page.locator(`[data-testid="scenarios"] [role="tab"]:text-is("${tabs[id]}")`).evaluate((t) => t.click()); await page.waitForTimeout(350) }
  const S = (tid) => page.locator(`[data-scenario] [data-testid="${tid}"]`).first()
  /** box-shadow without Tailwind's transparent ring / shadow layers */
  const solid = (s) => s.split(/,(?![^(]*\))/).map((x) => x.trim()).filter((x) => !x.startsWith("rgba(0, 0, 0, 0)")).join(", ")
  const box = (l) => l.evaluate((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { w: +r.width.toFixed(2), h: +r.height.toFixed(2), bg: cs.backgroundColor, r: cs.borderRadius, pad: cs.padding, font: `${cs.fontSize}/${cs.lineHeight} ${cs.fontWeight}`, color: cs.color, shadow: cs.boxShadow } })
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(url + feat("site-settings")); await page.waitForTimeout(500); await pick("print")
  const sel = await box(S("print-default"))
  ok("printer-presets: default select 240 × 32, bg #D7D7D7, r8, padding 0 32 0 10, 13/400", sel.w === 240 && sel.h === 32 && sel.bg === "rgb(215, 215, 215)" && sel.r === "8px" && sel.pad === "0px 32px 0px 10px" && sel.font.startsWith("13px") && sel.font.endsWith(" 400"), JSON.stringify(sel))
  const opts = await S("print-default").evaluate((s) => [...s.querySelectorAll("optgroup")].map((g) => `${g.label}:${g.children.length}`).join() + " = " + s.value)
  ok("printer-presets: select optgroups Print shops (3) / Custom (1), Lulu selected", opts === "Print shops:3,Custom:1 = lulu-photo-book", opts)
  const shops = await S("print-shops").evaluate((c) => [...c.querySelectorAll('[data-testid^="print-shop-"]')].map((r) => {
    const [name, sum] = r.firstElementChild.children, ns = getComputedStyle(name), ss = getComputedStyle(sum), b = r.querySelector("button")
    return { id: r.dataset.testid.slice(11), name: `${ns.fontSize} ${ns.fontWeight}`, sum: `${ss.fontSize}/${ss.lineHeight} ${ss.color} ${ss.textOverflow} ${ss.whiteSpace}`, title: sum.title === sum.textContent, badge: r.textContent.includes("Default"), btn: `${b.textContent} ${b.getBoundingClientRect().height} ${getComputedStyle(b).backgroundColor} ${getComputedStyle(b).paddingLeft}` }
  }))
  ok("printer-presets: shops Generic, Lulu, Saal; name 13/500, summary 12/16.8 #535152 ellipsis + title; Default badge on Lulu only; Duplicate h32 bg #D7D7D7 pad 12",
    shops.map((s) => s.id).join() === "generic,lulu-photo-book,saal-photo-book" && shops.every((s) => s.name === "13px 500" && s.sum === "12px/16.8px rgb(83, 81, 82) ellipsis nowrap" && s.title && s.btn === "Duplicate 32 rgb(215, 215, 215) 12px") && shops.map((s) => s.badge).join() === "false,true,false", JSON.stringify(shops))
  const gsum = await S("print-shop-generic").locator('[data-testid="print-summary-line"]').textContent()
  ok("printer-presets: Generic summary line", gsum === "5–50 cm · bleed 0–10 mm · safe 5 mm · 20–120 pages · photos ≥ 200 ppi", gsum)
  const eyebrow = await page.locator('[data-scenario] h2:text-is("Print shops")').first().evaluate((e) => { const cs = getComputedStyle(e); return `${cs.fontSize} ${cs.fontWeight} ${cs.letterSpacing} ${cs.textTransform} ${cs.color}` })
  ok("printer-presets: eyebrow 11/600 .12em uppercase #535152", eyebrow === "11px 600 1.32px uppercase rgb(83, 81, 82)", eyebrow)
  const more = await box(S("print-more-custom-lulu-copy")), edit = await box(S("print-edit-custom-lulu-copy"))
  ok("printer-presets: custom row Edit… h32 + ••• 28 × 28 r8 #535152", edit.h === 32 && more.w === 28 && more.h === 28 && more.r === "8px" && more.color === "rgb(83, 81, 82)", JSON.stringify({ edit, more }))
  const nav = await page.locator('[data-scenario] [data-testid^="settings-nav-"][aria-current="page"]').evaluateAll((ns) => ns.map((n) => n.dataset.testid).join())
  const stub = await page.locator("[data-scenario]").first().evaluate((s) => /Home printer|Default profile/.test(s.textContent))
  ok("printer-presets: aria-current only on settings-nav-print; stub rows gone (D7)", nav === "settings-nav-print" && !stub, JSON.stringify({ nav, stub }))
  await S("print-more-custom-lulu-copy").click(); await page.waitForTimeout(300)
  const menu = await page.locator('[data-testid="print-menu"]').evaluate((m) => { const r = m.parentElement.getBoundingClientRect(), is =[...m.querySelectorAll('[role="menuitem"]')]
    return { w: r.width, items: is.map((i) => i.textContent).join(), del: getComputedStyle(is[1]).color, rowH: +is[0].getBoundingClientRect().height.toFixed(2) } })
  ok("printer-presets: ••• menu 176 wide, Duplicate / Delete… #a8403a", menu.w === 176 && menu.items === "Duplicate,Delete…" && menu.del === "rgb(168, 64, 58)", JSON.stringify(menu))
  await page.keyboard.press("Escape"); await page.waitForTimeout(250)
  // deleting the default custom profile asks first, then Generic becomes the default
  await S("print-default").selectOption("custom-lulu-copy"); await page.waitForTimeout(200)
  await S("print-more-custom-lulu-copy").click(); await page.waitForTimeout(300)
  await page.locator('[data-testid="print-menu"] [role="menuitem"]:has-text("Delete")').click(); await page.waitForTimeout(350)
  const ad = page.locator('[role="alertdialog"]')
  const adText = await ad.textContent()
  const still = await S("print-custom-custom-lulu-copy").count()
  await ad.getByRole("button", { name: "Delete" }).click(); await page.waitForTimeout(350)
  const after = { v: await S("print-default").inputValue(), empty: await S("print-custom-empty").count(), badge: await S("print-shop-generic").textContent() }
  ok("printer-presets: Delete… confirms (title + Generic sentence), row kept until Delete; then gone and Generic is the default",
    adText.includes("Delete “Lulu · Photo book (copy)”?") && adText.includes("Books that use it keep its values. New books will start with Generic.") && still === 1 && after.v === "generic" && after.empty === 1 && after.badge.includes("Default"), JSON.stringify({ adText, still, ...after }))
  // Duplicate on a table-spine shop opens the editor on the copy; the spine row is read-only text
  await S("print-duplicate-saal-photo-book").click(); await page.waitForTimeout(350)
  const tbl = { t: await page.locator('[data-testid="pp-spine-table"]').textContent(), f: await page.locator('[data-testid="pp-spineBase"]').count(), name: await page.locator('[data-testid="pp-name"] input').inputValue() }
  const added = await page.locator('[data-scenario] [data-testid^="print-custom-custom-"]').count()
  await page.locator('[data-testid="pp-save"]').click(); await page.waitForTimeout(300)
  const saved = await page.locator('[data-scenario] [data-testid^="print-custom-custom-"]').count()
  ok("printer-presets: Duplicate Saal adds the copy row and opens the editor on “… (copy)”, table spine read-only; Save keeps one row", tbl.t === "From the Saal Digital · Photo Book table · 7–13 mm" && tbl.f === 0 && tbl.name === "Saal Digital · Photo Book (copy)" && added === 1 && saved === 1, JSON.stringify({ ...tbl, added, saved }))
  await pick("print-empty")
  const empty = await S("print-custom-empty").evaluate((e) => `${e.textContent} ${getComputedStyle(e).fontSize} ${getComputedStyle(e).color}`)
  ok("printer-presets: print-empty row text 13 #535152", empty === "No custom profiles yet. Duplicate a print shop’s profile, or start a new one. 13px rgb(83, 81, 82)", empty)
  await pick("print-edit")
  const dlg = await page.locator('[data-testid="print-profile-dialog"]').evaluate((d) => {
    let m = d; while (m.style.width !== "560px") m = m.parentElement
    const mr = m.getBoundingClientRect(), ms = getComputedStyle(m), cs = getComputedStyle(d), form = d.querySelector('[data-testid="pp-form"]'), w = (t) => d.querySelector(`[data-testid="pp-${t}"]`).getBoundingClientRect()
    const f = getComputedStyle(d.querySelector('[data-testid="pp-trimMin"]')), lab = getComputedStyle(form.firstElementChild)
    return { w: mr.width, r: ms.borderRadius, bg: ms.backgroundColor, pad: cs.padding, cols: getComputedStyle(form).gridTemplateColumns.split(" ")[0], lab: `${lab.fontSize} ${lab.color}`, f96: [w("trimMin").width, w("trimMin").height, w("pMax").width], f64: w("pStep").width, field: [`${f.backgroundColor} ${f.borderRadius}`, f.boxShadow], title: d.firstElementChild.textContent, sub: d.querySelector('[data-testid="pp-sub"]').textContent }
  })
  ok("printer-presets: editor 560 wide, r14, bg #E1E1E1, padding 20 24, label column 132 (13 #535152), fields 96 × 32 / 64, field bg #D7D7D7 r8 shadow .06",
    dlg.w === 560 && dlg.r === "14px" && dlg.bg === "rgb(225, 225, 225)" && dlg.pad === "20px 24px" && dlg.cols === "132px" && dlg.lab === "13px rgb(83, 81, 82)" && dlg.f96.join() === "96,32,96" && dlg.f64 === 64 && `${dlg.field[0]} ${solid(dlg.field[1])}` === "rgb(215, 215, 215) 8px rgba(20, 20, 19, 0.06) 0px 1px 2px 0px" && dlg.title === "Edit print profile" && dlg.sub === "Based on Lulu · Photo book. Books that use this profile follow your changes.", JSON.stringify(dlg))
  const hint = () => page.locator('[data-testid="pp-spine-hint"]').textContent()
  const h0 = await hint(); await page.locator('[data-testid="pp-spinePer"] input').fill("0.3"); const h1 = await hint()
  ok("printer-presets: spine hint updates live", h0 === "24 pages = 12.8 mm · 240 pages = 56 mm" && h1 === "24 pages = 15.2 mm · 240 pages = 80 mm", JSON.stringify({ h0, h1 }))
  await page.locator('[data-testid="pp-name"] input').fill("")
  const inv = { ring: await page.locator('[data-testid="pp-name"]').evaluate((e) => getComputedStyle(e).boxShadow), msg: await page.locator('[data-testid="pp-error"]').allTextContents(), save: await page.locator('[data-testid="pp-save"]').isDisabled() }
  ok("printer-presets: empty name → #a8403a inset ring + message, Save disabled", solid(inv.ring) === "rgb(168, 64, 58) 0px 0px 0px 1px inset" && inv.msg.join() === "Give the profile a name." && inv.save, JSON.stringify(inv))
  await pick("print-invalid")
  const bad = { msg: await page.locator('[data-testid="pp-error"]').allTextContents(), save: await page.locator('[data-testid="pp-save"]').isDisabled(), title: await page.locator('[data-testid="print-profile-dialog"] > div').first().textContent(),
    color: await page.locator('[data-testid="pp-error"]').first().evaluate((e) => `${getComputedStyle(e).fontSize}/${getComputedStyle(e).lineHeight} ${getComputedStyle(e).color}`) }
  ok("printer-presets: print-invalid shows name / trim / page-count messages 12/16.8 #a8403a, Save disabled", bad.title === "New print profile" && bad.save && bad.color === "12px/16.8px rgb(168, 64, 58)" &&
    bad.msg.join("|") === "Give the profile a name.|The largest side can’t be smaller than the smallest.|20 to 121 isn’t whole steps of 2. Try 120 or 122.", JSON.stringify(bad))
  // Designer review (PR #500): Save stays in view on a short viewport; the form body scrolls instead
  await page.setViewportSize({ width: 1440, height: 700 }); await page.waitForTimeout(300)
  const short = await page.locator('[data-testid="print-profile-dialog"]').evaluate((d) => {
    let m = d; while (m.style.width !== "560px") m = m.parentElement
    const body = d.querySelector('[data-testid="pp-form"]').parentElement
    return { gap: +(m.getBoundingClientRect().bottom - d.querySelector('[data-testid="pp-save"]').getBoundingClientRect().bottom).toFixed(2), sh: body.scrollHeight, ch: body.clientHeight }
  })
  ok("printer-presets: at 1440 × 700 Save sits ≥ 20 px above the modal bottom and the form scrolls", short.gap >= 20 && short.sh > short.ch, JSON.stringify(short))
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(300)
  // Generic spine = core genericPrintProfile (8 + 0.2 mm per page); fields keep the stored value (Duplicate Lulu + Save keeps bleed 3.175)
  await pick("print")
  await S("print-new").click(); await page.waitForTimeout(350)
  const newHint = await page.locator('[data-testid="pp-spine-hint"]').textContent()
  await page.getByRole("button", { name: "Cancel" }).click(); await page.waitForTimeout(300)
  ok("printer-presets: New profile spine hint = Generic 20 pages = 12 mm · 120 pages = 32 mm", newHint === "20 pages = 12 mm · 120 pages = 32 mm", newHint)
  const field = (k) => page.locator(`[data-testid="pp-${k}"] input`).inputValue()
  await S("print-duplicate-lulu-photo-book").click(); await page.waitForTimeout(350)
  const dup = { bleed: await field("bleed"), safe: await field("safe") }
  await page.locator('[data-testid="pp-save"]').click(); await page.waitForTimeout(300)
  await page.locator('[data-scenario] [data-testid^="print-edit-custom-"]').last().click(); await page.waitForTimeout(350)
  const kept = { bleed: await field("bleed"), name: await page.locator('[data-testid="pp-name"] input').inputValue() }
  await page.getByRole("button", { name: "Cancel" }).click(); await page.waitForTimeout(300)
  ok("printer-presets: Duplicate Lulu shows bleed 3.175 / safe 12.7 unrounded; after Save the copy still has bleed 3.175", dup.bleed === "3.175" && dup.safe === "12.7" && kept.bleed === "3.175" && kept.name.startsWith("Lulu · Photo book (copy"), JSON.stringify({ dup, kept }))
  await page.goto(url + feat("pdf-export")); await page.waitForTimeout(500)
  const P = (q) => page.locator(q).first().textContent()
  const pd = { row: await P('[data-testid="print-profile"]'), sum: await P('[data-testid="print-summary"]'), cb: await P('label:has-text("bleed and crop marks")') }
  ok("printer-presets: PrintDialog Printer · Generic row, 3 mm bleed from the profile", pd.row === "PrinterGeneric" && pd.cb === "Add 3 mm bleed and crop marks" && pd.sum.endsWith("· bleed 3 mm"), JSON.stringify(pd))
  ok("printer-presets: no console errors", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
}
{ // printer-presets-kit-book (Designer printer-presets §Book settings → PRINT): DOM measured at 1440 × 900, offsets from the PRINT title
  const e0 = errs.length
  const B = '[data-scenario] [data-testid="insp-book"]'
  const read = () => page.evaluate((B) => {
    const q = (s) => document.querySelector(`${B} ${s}`), top = (e) => e.getBoundingClientRect().top, h3 = (t) => [...document.querySelectorAll(`${B} h3`)].find((h) => h.textContent === t)
    const p0 = top(h3("Print")), d = (e) => +(top(e) - p0).toFixed(2), sel = q('[data-testid="book-print-profile"]'), sr = sel.getBoundingClientRect(), cs = getComputedStyle(sel)
    return { sel: { y: d(sel), w: +sr.width.toFixed(2), h: +sr.height.toFixed(2), bg: cs.backgroundColor, value: sel.value, groups: [...sel.querySelectorAll("optgroup")].map((g) => `${g.label}:${g.children.length}`).join() },
      hint: { y: d(q('[data-testid="book-print-hint"]')), t: q('[data-testid="book-print-hint"]').textContent, font: ((s) => `${s.fontSize}/${s.lineHeight}`)(getComputedStyle(q('[data-testid="book-print-hint"]'))) },
      /** the Page size select's width and the inspector scrollbar (qa shows scrollbars; prod measures 268 without one) */
      sizeW: q('[data-testid="size-preset"]').getBoundingClientRect().width, sb: ((s) => s.offsetWidth - s.clientWidth)((() => { let e = sel; while (e && !(e.scrollHeight > e.clientHeight && /auto|scroll/.test(getComputedStyle(e).overflowY))) e = e.parentElement; return e })()),
      issues: [...document.querySelectorAll(`${B} [data-testid="book-print-issue"]`)].map((e) => { const s = getComputedStyle(e), i = e.querySelector("svg").getBoundingClientRect(); return { y: d(e), h: +e.getBoundingClientRect().height.toFixed(2), t: e.textContent, c: `${s.fontSize}/${s.lineHeight} ${s.fontWeight} ${s.color}`, icon: `${i.width}×${i.height}` } }),
      bs: d(q('[data-testid="book-bleed"]')), defaults: d(h3("Defaults")), b: q('[data-testid="book-bleed"]').textContent, s: q('[data-testid="book-safe"]').textContent, range: q('[data-testid="book-pages-range"]').textContent,
      size: `${q('[data-testid="size-w"]').value}×${q('[data-testid="size-h"]').value}`, pages: q('[data-testid="book-pages"]').firstChild.textContent }
  }, B)
  const near = (a, b) => Math.abs(a - b) <= 0.5
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(url + feat("inspector")); await page.waitForTimeout(500)
  const tab = async (t) => { await page.locator(`[data-testid="scenarios"] [role="tab"]:text-is("${t}")`).evaluate((e) => e.click()); await page.waitForTimeout(350) }
  await tab("Book settings")
  const g = await read()
  ok("printer-presets-kit-book: Printer select 268 (+ scrollbar) × 32 = Page size select, bg #D7D7D7 under the PRINT title, optgroups Print shops (3) / Custom (1), Generic", g.sel.w + g.sb === 268 && g.sel.w === g.sizeW && g.sel.h === 32 && g.sel.bg === "rgb(215, 215, 215)" && near(g.sel.y, 26.84) && g.sel.groups === "Print shops:3,Custom:1" && g.sel.value === "generic", JSON.stringify({ ...g.sel, sizeW: g.sizeW, sb: g.sb }))
  ok("printer-presets-kit-book: hint 2xs/16 under the select (+38), Generic text", near(g.hint.y, 64.84) && g.hint.t === "5–50 cm · 20–120 pages · photos ≥ 200 ppi" && g.hint.font === "11px/16px", JSON.stringify(g.hint))
  ok("printer-presets-kit-book: no warnings → B/S and DEFAULTS 66 px lower (B/S +92.84, DEFAULTS +195.69 = 788.61 → 854.61 from 658.92), B 3 / S 5, Pages 20–120", !g.issues.length && near(g.bs, 92.84) && near(g.defaults, 195.69) && g.b === "B3mm" && g.s === "S5mm" && g.range === "20–120", JSON.stringify({ bs: g.bs, defaults: g.defaults, b: g.b, s: g.s, range: g.range }))
  await page.locator(`${B} [data-testid="book-print-profile"]`).selectOption("lulu-photo-book"); await page.waitForTimeout(300)
  const lu = await read()
  const live = await page.locator(`${B} [aria-live="polite"]`).textContent()
  await page.keyboard.press("Control+z"); await page.waitForTimeout(300)
  const un = await read()
  ok("printer-presets-kit-book: pick Lulu = one undo step: B 3.175 / S 12.7, size and pages unchanged, 1 warning (+8 + 2 × 16.8), live “Printer: Lulu · Photo book”; Ctrl+Z → Generic, B 3 / S 5",
    lu.sel.value === "lulu-photo-book" && lu.b === "B3.175mm" && lu.s === "S12.7mm" && lu.size === g.size && lu.pages === g.pages && lu.issues.length === 1 && near(lu.defaults - g.defaults, 8 + 2 * 16.8) && live === "Printer: Lulu · Photo book" &&
    un.sel.value === "generic" && un.b === "B3mm" && un.s === "S5mm" && !un.issues.length && near(un.defaults, g.defaults), JSON.stringify({ lu: [lu.b, lu.s, lu.size, lu.pages, lu.issues.length, lu.defaults], live, un: [un.sel.value, un.b, un.s, un.defaults] }))
  await tab("Lulu picked")
  const w = await read()
  ok("printer-presets-kit-book: book-lulu shows 2 warnings 12/16.8 400 #8a5a12 with a 12 px icon, 8 px apart, each adding 8 + 16.8 per line",
    w.issues.length === 2 && w.issues.every((i) => i.c === "12px/16.8px 400 rgb(138, 90, 18)" && i.icon === "12×12") && near(w.issues[0].y, 64.84 + 16 + 8) && near(w.issues[1].y, w.issues[0].y + w.issues[0].h + 8) &&
    near(w.defaults - g.defaults, w.issues.reduce((s, i) => s + 8 + i.h, 0)) && w.issues.every((i) => near(i.h, 16.8 * Math.round(i.h / 16.8))) &&
    w.issues[0].t === "Lulu · Photo book takes pages from 15.2 cm. This page is 15 cm wide." && w.issues[1].t === "Lulu · Photo book prints at least 24 pages; this book’s 20 print as 24.", JSON.stringify(w.issues))
  // paint: scrolled into view, each warning's text and icon are the topmost elements at their centres
  const paint = await page.evaluate((B) => [...document.querySelectorAll(`${B} [data-testid="book-print-issue"]`)].map((e) => {
    e.scrollIntoView({ block: "center" })
    const at = (el) => { const r = el.getBoundingClientRect(), x = el === e ? r.right - 24 : r.left + r.width / 2; return e.contains(document.elementFromPoint(x, r.top + r.height / 2)) }
    return at(e) && at(e.querySelector("svg"))
  }), B)
  ok("printer-presets-kit-book: both warnings paint on top (elementFromPoint at text and icon)", paint.length === 2 && paint.every(Boolean), JSON.stringify(paint))
  ok("printer-presets-kit-book: no console errors", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
}


fs.writeFileSync(new URL("../qa-report.txt", import.meta.url), res.join("\n") + "\n\nCONSOLE:\n" + (errs.join("\n") || "none") + "\n")
console.log(res.join("\n")); console.log(`\n${res.length - fails} passed, ${fails} failed; console errors/warnings: ${errs.length}`); if (errs.length) console.log(errs.slice(0, 20).join("\n"))

await browser.close()
process.exit(fails || errs.length ? 1 : 0)

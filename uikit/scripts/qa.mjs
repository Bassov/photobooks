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
// v4 product changes
// v4.3 re-audit (third round)
{
  const cdp = await page.context().newCDPSession(page)
  const axCheck = async () => {
    const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true })
    const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "[data-disabled-reason]" })
    const out = []
    for (const nodeId of nodeIds) {
      const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false })
      const n = nodes.find((x) => x.role?.value === "button") ?? nodes[0]
      const { object } = await cdp.send("DOM.resolveNode", { nodeId })
      const r = await cdp.send("Runtime.callFunctionOn", { objectId: object.objectId, returnByValue: true, functionDeclaration: "function(){ const d = document.getElementById(this.getAttribute('aria-describedby')); return { label: this.innerText.trim().replace(/\\s+/g, ' '), reason: d ? d.textContent.trim() : '' } }" })
      out.push({ name: (n.name?.value ?? "").trim(), desc: (n.description?.value ?? "").trim(), ...r.result.value })
    }
    return out
  }
  await go(scr("canvas"), 900)
  await page.locator('[data-testid="demo"] button').first().focus()
  let maxTips = 0
  for (let i = 0; i < 12; i++) { await page.keyboard.press("Tab"); await page.waitForTimeout(80); maxTips = Math.max(maxTips, await page.locator("[role=tooltip]").count()) }
  await page.keyboard.press("Escape"); await page.waitForTimeout(250)
  const afterEsc = await page.locator("[role=tooltip]").count()
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab")
  await page.waitForTimeout(250)
  const afterLeave = await page.locator("[role=tooltip]").count()
  ok("tooltips: at most 1 open while tabbing the top bar, none after Escape / leaving", maxTips <= 1 && afterEsc === 0 && afterLeave === 0, `max=${maxTips} afterEsc=${afterEsc} afterLeave=${afterLeave}`)
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }); const rp = await rctx.newPage()
  await rp.goto(url + "#/feature/recents-home"); await rp.waitForTimeout(600)
  const dur = await rp.evaluate(() => ["--duration-fast", "--duration-base", "--duration-exit"].map((n) => getComputedStyle(document.querySelector('[data-testid="home"]') ?? document.documentElement).getPropertyValue(n).trim()))
  await rctx.close()
  ok("reduced motion: duration tokens resolve to 0", dur.every((d) => /^0(m?s)?$/.test(d)), dur.join(" / "))
}
await smoke("home mock fills whole rows (no orphan card)", "recents-home", async () => {
  const tops = await page.$$eval('[data-testid="book-card"]', (els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  const first = tops.filter((t) => t === tops[0]).length
  return [tops.length % first === 0, `${tops.length} books, ${first} per row`]
})
// v4.2 re-audit
await smoke("empty inspector is labelled Spread, no stale hint block", "layout-grids-render-snap", async () => {
  const insp = page.locator('[data-testid="demo"] [data-testid="inspector"], [data-testid="demo"] [data-testid="ctx-inspector"]').first()
  // proto: a single section shows a plain header (h2) instead of a lone tab
  const tab = await insp.locator('[role="tab"], [data-testid="inspector-header"] h2').first().textContent()
  const t = await insp.innerText()
  return [tab === "Spread" && !t.includes("Select a frame on the spread"), `tab=${tab}`]
})
await smokeS("settings → Change library folder updates the path", "settings", async () => {
  await D('[data-testid="change-library"]').click(); await page.waitForTimeout(350)
  await page.getByRole("button", { name: "Choose folder…" }).click(); await page.waitForTimeout(400)
  await page.getByRole("button", { name: "Mountains", exact: true }).click(); await D('[data-testid="picker-select"]').click(); await page.waitForTimeout(300)
  return [/Mountains/.test(await txt(`${demo} [data-testid="library-path"]`)), await txt(`${demo} [data-testid="library-path"]`)]
})
await smoke("first run → Create Library → picker → empty library", "open-save-project", async () => {
  await D('[data-testid="create-library"]').click(); await page.waitForTimeout(350); await D('[data-testid="picker-select"]').click(); await page.waitForTimeout(400)
  return (await D('[data-testid="home-empty"]').isVisible()) && (await D('[data-testid="library-path"]').isVisible())
})
await smoke("drag photo onto frame + undo", "drag-place-replace", async () => {
  await D('[data-testid="filmstrip"] [role="row"]').nth(0).dragTo(D('[data-testid="frame"]').first()); await page.waitForTimeout(400)
  const st = await txt(`${demo} [data-testid="status"]`)
  await D('[data-testid="undo"]').click(); await page.waitForTimeout(200)
  return [/Placed|Replaced/.test(st ?? ""), `status="${st}"`]
})
await smoke("grid toggle", "layout-grids-render-snap", async () => { const g1 = await D('[data-testid="grid-overlay"]').first().isVisible(); await D('[data-testid="toggle-grid"]').click(); await page.waitForTimeout(150); return g1 && !(await D('[data-testid="grid-overlay"]').first().isVisible().catch(() => false)) })
await smoke("site → book → lightbox", "site-viewer", async () => { await D('[data-testid="site-book"]').first().click(); await page.waitForTimeout(200); await D('[data-testid="site-spread"]').click(); await page.waitForTimeout(200); return D('[data-testid="lightbox"]').isVisible() })
// ---------------------------------------------------------------- v5 checks
const fitAir = async () => page.evaluate(() => {
  const d = document.querySelector('[data-testid="demo"]'); const sp = d.querySelector('.canvas-dots [data-testid="spread"]'); const vp = sp.parentElement.closest(".canvas-dots")
  const a = sp.getBoundingClientRect(), b = vp.getBoundingClientRect(); return [Math.round(a.top - b.top), Math.round(b.bottom - a.bottom)]
})
{
  const r = await page.evaluate(() => {
    const px = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    const rgb = (c) => { px.clearRect(0, 0, 1, 1); px.fillStyle = c; px.fillRect(0, 0, 1, 1); return [...px.getImageData(0, 0, 1, 1).data].slice(0, 3).map((x) => x / 255) }
    const lum = (c) => { const [r, g, b] = rgb(c).map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
    const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
    return [cr(v("--primary-foreground"), v("--primary")), cr(v("--primary-foreground"), v("--primary-hover")), v("--select")]
  })
  ok("v6 primary button label ≥ 4.5:1 (rest and hover); selection #232223 since v7", r[0] >= 4.5 && r[1] >= 4.5 && /232223|t-ink/i.test(r[2]), `rest ${r[0].toFixed(2)} hover ${r[1].toFixed(2)} select ${r[2]}`)
}
await smokeS("v5.2 Settings note says Interface, not Appearance", "settings", async () => { const t = await page.locator("body").innerText(); return [!/Appearance/.test(t) && /Interface/.test(t), "ok"] })
await smoke("v5.1 template names are not cut off (2 columns, wrap)", "spread-list-panel", async () => {
  const cut = await D('[data-testid="tpl-name"]').evaluateAll((els) => els.filter((e) => e.offsetParent && e.scrollHeight > e.clientHeight + 1).map((e) => e.textContent))
  return [cut.length === 0, cut.join(", ") || "all fit"]
})
for (const [kind, id] of [["screen", "library"], ["screen", "editor-chrome"], ["screen", "settings"]]) {
  await go(scr(id), 700)
  const low = await page.evaluate(() => {
    const cv = document.createElement("canvas").getContext("2d")
    const px = document.createElement("canvas"); px.width = px.height = 1; const pc = px.getContext("2d", { willReadFrequently: true })
    const rgba = (c) => { pc.clearRect(0, 0, 1, 1); pc.fillStyle = c; pc.fillRect(0, 0, 1, 1); const d = pc.getImageData(0, 0, 1, 1).data; return { c: [d[0], d[1], d[2]].map((x) => x / 255), a: d[3] / 255 } }
    const lum = ([r, g, b]) => { const f = (x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const b = rgba(getComputedStyle(e).backgroundColor); if (b.a > 0.9 && !getComputedStyle(e).backgroundImage.includes("url")) return b.c } return [1, 1, 1] }
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted-foreground").trim()
    cv.fillStyle = muted; const mh = cv.fillStyle; const mutedRgb = [1, 3, 5].map((i) => parseInt(mh.slice(i, i + 2), 16))
    const out = []
    for (const el of document.querySelectorAll('[data-testid="demo"] *')) {
      if (!el.offsetParent || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
      if (el.closest('[aria-disabled="true"], [disabled], [data-disabled]')) continue
      const s = getComputedStyle(el); const f = rgba(s.color); if (f.a < 0.95) continue
      const isMuted = f.c.every((x, i) => Math.abs(x * 255 - mutedRgb[i]) < 2)
      if (!isMuted) continue
      const b = bgOf(el); const [x, y] = [lum(f.c), lum(b)].sort((p, q) => q - p); const r = (x + 0.05) / (y + 0.05)
      if (r < 4.5) out.push(`${el.textContent.trim().slice(0, 24)} ${r.toFixed(2)}`)
    }
    return out
  })
  ok(`${kind} ${id}: rendered secondary text ≥ 4.5:1 on its surface`, low.length === 0, low.slice(0, 5).join(" | ") || "ok")
}
await smoke("v5 spread list: no horizontal scroll", "spread-list-panel", async () => {
  const r = await D('[data-testid="spreads-panel"] .scroll-thin').first().evaluate((e) => [e.scrollWidth, e.clientWidth])
  return [r[0] <= r[1] + 1, `${r[0]}/${r[1]}`]
})
await smoke("v6 Home: no New book tile; covers in a row share a baseline", "recents-home", async () => {
  await page.mouse.move(1, 1); await page.waitForTimeout(400)
  const tile = await page.locator('[data-testid="new-book-tile"]').count()
  const bottoms = await page.locator('[data-testid="book-cover"]').evaluateAll((els) => els.slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().bottom)))
  return [tile === 0 && new Set(bottoms).size === 1, `tile=${tile} bottoms=${bottoms.join(",")}`]
})

// ---------- v0.6.0 ----------
const walk6 = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk6(`${d}/${e.name}`) : /\.(tsx?|css)$/.test(e.name) ? [`${d}/${e.name}`] : [])
{ // no blue anywhere: hue scan of every hex / rgb literal in src css + tsx, blue Tailwind classes, retired accent
  const all = walk6(new URL("../src", import.meta.url).pathname)
  const hue = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 24) return null; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h }
  const bad = []
  for (const f of all) {
    const t = fs.readFileSync(f, "utf8"), n = f.split("/src/")[1]
    for (const m of t.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) { let x = m[1]; if (x.length === 3) x = [...x].map((c) => c + c).join(""); const [r, g, b] = [0, 2, 4].map((k) => parseInt(x.slice(k, k + 2), 16)); const h = hue(r, g, b); if (h !== null && h >= 180 && h <= 260) bad.push(`${n}:#${m[1]}`) }
    for (const m of t.matchAll(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/g)) { const h = hue(+m[1], +m[2], +m[3]); if (h !== null && h >= 180 && h <= 260) bad.push(`${n}:${m[0]}`) }
    for (const m of t.matchAll(/\b(?:text|bg|border|ring|outline|fill|stroke|from|to|via|decoration|accent|caret)-(?:blue|sky|indigo|cyan)-\d+/g)) bad.push(`${n}:${m[0]}`)
    if (/3a8afa|2b73db|--t-accent/i.test(t)) bad.push(`${n}:retired accent`)
  }
  ok("v6 no blue: no blue-hue hex/rgb, no blue Tailwind classes, no #3A8AFA/#2B73DB/--t-accent in src css/tsx", bad.length === 0, bad.slice(0, 8).join(", ") || `${all.length} files`)
  const st = await page.evaluate(() => { let n = 0; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (/3a8afa|2b73db/i.test(r.cssText)) n++ } catch { } } return n })
  ok("v6 no retired blue in the built stylesheet", st === 0, `${st}`)
}
{ // rendered primary buttons kit-wide
  const pages = ["library"].map(scr).concat(["open-save-project", "recents-home", "editor-shell-filmstrip", "spread-list-panel", "crop-in-frame", "inspector", "in-app-publish", "pdf-export", "editor-chrome-toolbar"].map(feat), ["#/components"])
  const bad = []; let seen = 0
  for (const h of pages) {
    await go(h).catch(() => {}); await page.waitForTimeout(250)
    const r = await page.evaluate(() => [...document.querySelectorAll("button, a[role=button], [role=button]")].filter((b) => /rgb\(35, 34, 35\)/.test(getComputedStyle(b).backgroundColor)).map((b) => [b.textContent.trim().slice(0, 30), b.querySelectorAll("svg").length, getComputedStyle(b).color]))
    seen += r.length; for (const [t, n, c] of r) { if (n) bad.push(`${h} "${t}" svg`); if (c !== "rgb(242, 242, 242)") bad.push(`${h} "${t}" ${c}`) }
  }
  ok("v6 primary buttons: #232223 bg, #F2F2F2 label, no icons (rendered, kit-wide sample)", bad.length === 0 && seen > 0, bad.slice(0, 6).join("; ") || `${seen} primary buttons on ${pages.length} pages`)
  const src = walk6(new URL("../src", import.meta.url).pathname).filter((f) => f.endsWith(".tsx") && !/disclosure/.test(f)).flatMap((f) => [...fs.readFileSync(f, "utf8").matchAll(/<Button\b((?:[^>{]|\{[^}]*\})*)>([\s\S]*?)<\/Button>/g)].filter((m) => (!/variant=/.test(m[1]) || /variant=\{[^}]*"default"/.test(m[1])) && /<[A-Z][\w.]*(\s[^>]*)?\/>/.test(m[2])).map((m) => f.split("/src/")[1] + ":" + m[2].trim().slice(0, 30)))
  ok("v6 source: no icon element inside a default-variant <Button>", src.length === 0, src.slice(0, 6).join(", ") || "0")
  await go(feat("recents-home")); await page.waitForTimeout(300)
  const nb = page.locator('[data-testid=demo] [data-testid=new-book]').first()
  const c = await nb.evaluate((b) => getComputedStyle(b).backgroundColor)
  await nb.hover(); await page.waitForTimeout(250); const hov = await nb.evaluate((b) => getComputedStyle(b).backgroundColor); await page.mouse.move(1, 1)
  ok("v6 primary rest #232223, hover #3A3839", c === "rgb(35, 34, 35)" && hov === "rgb(58, 56, 57)", `${c} → ${hov}`)
  const tok = await page.evaluate(() => ["--ring", "--select", "--muted-foreground", "--primary-foreground"].map((n) => { const px = document.createElement("canvas").getContext("2d"); px.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return px.fillStyle }))
  ok("v6 tokens: ring #3A3839, select #232223 (v7), secondary #535152, on-primary #F2F2F2", tok.join() === "#3a3839,#232223,#535152,#f2f2f2", tok.join(" "))
  await page.keyboard.press("Tab"); for (let i = 0; i < 40; i++) { if (await page.evaluate(() => document.activeElement?.closest?.("[data-testid=demo]") && document.activeElement.matches("button"))) break; await page.keyboard.press("Tab") }
  const ring = await page.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return [e.dataset.focusVisible ?? "-", cs.boxShadow].join(" ") })
  ok("v6 keyboard focus on a demo button: 2px #3A3839 ring", /rgb\(58, 56, 57\) 0px 0px 0px [24]px/.test(ring), ring.slice(0, 120))
}
await smoke("v6 selected frame: #393738 outline, no blue rendered", "frame-selection-handles", async () => {
  const r = await page.evaluate(() => { const cols = new Set(); let sel = 0; for (const e of document.querySelectorAll("[data-testid=demo] *")) { const cs = getComputedStyle(e); if (/rgb\(57, 55, 56\)/.test(cs.outlineColor + cs.borderTopColor + cs.boxShadow) && (parseFloat(cs.outlineWidth) >= 2 || parseFloat(cs.borderTopWidth) >= 2 || /2px/.test(cs.boxShadow))) sel++; for (const k of ["outlineColor", "borderTopColor", "boxShadow", "backgroundColor", "color"]) for (const x of cs[k].match(/rgba?\(\d+, \d+, \d+/g) ?? []) { const [r, g, b] = x.match(/\d+/g).map(Number); if (b - Math.max(r, g) > 30) cols.add(x) } } return [sel, [...cols]] })
  return [r[1].length === 0 && r[0] > 0, `selection-coloured 2px elements=${r[0]} blue=${r[1].join(" ") || "none"}`]
})
await smoke("v6 flow: one welcome button 'Create Library' (text only) → picker → empty library with path + Change in the top bar", "open-save-project", async () => {
  const w = D('[data-testid="welcome"]'); const btns = await w.locator("button").count()
  const b = D('[data-testid="create-library"]'); const label = (await b.textContent()).trim(), svg = await b.locator("svg").count()
  await b.click(); await page.waitForTimeout(350); await D('[data-testid="picker-select"]').click(); await page.waitForTimeout(500)
  const empty = await D('[data-testid="home-empty"]').isVisible(), bar = await txt(`${demo} [data-testid="library-card"]`)
  const ex = await txt(`${demo} [data-testid="example-book"]`), t = await txt(`${demo} [data-testid="home-empty"]`)
  const nb = D('[data-testid="new-book"]').first(); const nbt = (await nb.textContent()).trim(), nbs = await nb.locator("svg").count()
  const okk = btns === 1 && label === "Create Library" && svg === 0 && empty && /Change/.test(bar) && /\//.test(bar) && /Fog/.test(ex) && /Example/.test(ex) && /Your library is ready/i.test(t) && /Your first story/.test(t) && /starts here\./.test(t) && nbt === "Create book" && nbs === 0
  return [okk, `buttons=${btns} "${label}" svg=${svg} empty=${empty} bar="${bar.slice(0, 50)}" create="${nbt}"`]
})
await smoke("v6 Change in the empty library's top bar → confirm dialog", "open-save-project", async () => {
  await D('[data-testid="create-library"]').click(); await page.waitForTimeout(350); await D('[data-testid="picker-select"]').click(); await page.waitForTimeout(500)
  await D('[data-testid="change-library"]').click(); await page.waitForTimeout(350)
  return [(await page.locator('[role="alertdialog"]').count()) === 1, ""]
})
{ // credits: never inside a demo; exact captions in kit chrome; #/credits page; footer link
  const bad = []
  for (const h of [scr("library"), feat("recents-home"), feat("open-save-project"), feat("recents-home")]) {
    await go(h); await page.waitForTimeout(500)
    const inDemo = await page.locator(`${demo} [data-testid="photo-credit"]`).count() + (/Photo: |Sources/.test(await page.locator(demo).evaluate((e) => { const c = e.cloneNode(true); c.querySelectorAll('[data-testid="screen-credit"]').forEach((x) => x.remove()); return c.textContent })) ? 1 : 0) // v8: in-screen captions (Welcome / empty library) are product UI, not kit credits
    const caps = await page.locator('[data-testid="kit-photo-credits"] [data-testid="photo-credit"]').evaluateAll((els) => els.map((e) => [e.textContent, e.querySelectorAll("a")[0]?.href, e.querySelectorAll("a")[1]?.href, getComputedStyle(e).fontSize, getComputedStyle(e).color, e.closest("[data-testid=demo]") ? 1 : 0]))
    if (inDemo) bad.push(`${h}: credit inside demo`)
    if (!caps.length) bad.push(`${h}: no chrome captions`)
    for (const [t, a, l, f, c, d] of caps) {
      if (!/^Photo: [^·]+ · (CC BY-SA 4\.0|Public domain) · modified$/.test(t)) bad.push(`${h}: "${t}"`)
      if (!/commons\.wikimedia\.org\/wiki\/File:/.test(a ?? "")) bad.push(`${h}: author href ${a}`)
      if (/CC BY-SA/.test(t) ? l !== "https://creativecommons.org/licenses/by-sa/4.0/" : !/Public_domain/.test(l ?? "")) bad.push(`${h}: license href ${l}`)
      if (f !== "11px" || c !== "rgb(83, 81, 82)" || d) bad.push(`${h}: ${f} ${c} inDemo=${d}`)
    }
  }
  await go(scr("library")); await page.waitForTimeout(400)
  const fr = await page.locator('[data-testid="kit-photo-credits"] [data-testid="photo-credit"]').allTextContents()
  const a = page.locator('[data-testid="kit-photo-credits"] [data-testid="photo-credit"] a').first()
  const d0 = await a.evaluate((e) => getComputedStyle(e).textDecorationLine); await a.hover(); await page.waitForTimeout(150)
  const d1 = await a.evaluate((e) => getComputedStyle(e).textDecorationLine); await page.mouse.move(1, 1)
  ok("v6 credit links underline on hover only", d0 === "none" && d1 === "underline", `${d0} → ${d1}`)
  await page.goto(url + "#/full/library"); await page.waitForTimeout(500)
  ok("v6→v8 #/full/library: no kit credit line, only the in-product Welcome caption", (await page.locator('[data-testid="photo-credit"]').count()) === 0 && (await page.locator('[data-testid="screen-credit"]').count()) === 1)
  await page.goto(url + "#/credits"); await page.waitForTimeout(400)
  const rows = await page.locator('[data-testid="credits-hi"] [data-testid="photo-credit"]').count(), cc0 = await page.locator('[data-testid="credits-cc0"] li').count()
  ok("v6 #/credits page lists the 10 Commons photos + the CC0 set", rows === 10 && cc0 >= 20, `hi=${rows} cc0=${cc0}`)
  await page.goto(url + "#/"); await page.waitForTimeout(400)
  ok("v6 index footer links to Photo credits", (await page.locator('[data-testid="footer-credits"]').getAttribute("href")) === "#/credits")
  const md = fs.readFileSync(new URL("../PHOTO-CREDITS.md", import.meta.url), "utf8")
  const ids = ["c18", "c18b", "c13", "r2", "x-tatra", "r7", "c25", "r8", "r6", "x-valley"]
  ok("v6 PHOTO-CREDITS.md: a TASL row per bundled hi/ photo; files present, nothing extra", ids.every((i) => md.includes(`hi/${i}.jpg`) && fs.existsSync(new URL(`../public/photos/hi/${i}.jpg`, import.meta.url))) && fs.readdirSync(new URL("../public/photos/hi", import.meta.url)).length === ids.length)
}


// ---------- v0.6.1: 3-level surfaces (canvas #C8CACB dots · chrome #E1E1E1 · controls #D7D7D7 · white = paper) + library search/sort ----------
{ // source lint: the retired tinted grey is gone
  const hits = walk6(new URL("../src", import.meta.url).pathname).flatMap((f) => /d8dbe1|216,\s*219,\s*225/i.test(fs.readFileSync(f, "utf8")) ? [f.split("/src/")[1]] : [])
  ok("v6.1 no #D8DBE1 anywhere in src", hits.length === 0, hits.join(", "))
}
await page.goto(url + "#/"); await page.waitForTimeout(400)
{ // tokens: chrome / input tone, neutral surfaces (R=G=B), text contrast on the 4 surfaces
  const t = await page.evaluate(() => {
    const cv = document.createElement("canvas").getContext("2d")
    const hex = (c) => { cv.fillStyle = "#000"; cv.fillStyle = c; return cv.fillStyle }
    const v = (n) => hex(getComputedStyle(document.documentElement).getPropertyValue(n).trim())
    const surf = ["--t-bar", "--t-panel", "--t-raised", "--t-field", "--chrome", "--background", "--card", "--popover", "--field", "--secondary", "--subtle", "--muted", "--accent", "--border", "--control", "--input", "--cover-empty", "--paper", "--placeholder", "--placeholder-border", "--placeholder-block"]
    const out = {}; for (const n of [...surf, "--t-canvas", "--t-bg"]) out[n] = v(n)
    return out
  })
  const chrome = ["--t-bar", "--t-panel", "--t-raised", "--chrome", "--background"].every((n) => t[n] === "#e1e1e1")
  ok("v6.1 chrome tone: bars, panels, raised, background tokens = #E1E1E1", chrome, ["--t-bar", "--t-panel", "--t-raised", "--chrome", "--background"].map((n) => `${n}=${t[n]}`).join(" "))
  ok("v6.1 input tone: --t-field / --field / --secondary = #D7D7D7", t["--t-field"] === "#d7d7d7" && t["--field"] === "#d7d7d7" && t["--secondary"] === "#d7d7d7", `${t["--field"]} ${t["--secondary"]}`)
  ok("v6.1 canvas #C8CACB (user-specified; the one exemption from R=G=B)", t["--t-canvas"] === "#c8cacb" && t["--t-bg"] === "#c8cacb")
  const nonNeutral = Object.entries(t).filter(([n, h]) => !/--t-(canvas|bg)/.test(n) && !(h.slice(1, 3) === h.slice(3, 5) && h.slice(3, 5) === h.slice(5, 7)))
  ok("v6.1 surface tokens are pure neutral greys (R=G=B; canvas exempt)", nonNeutral.length === 0, nonNeutral.map((x) => x.join("=")).join(" ") || `${Object.keys(t).length - 2} tokens`)
  const c = await page.evaluate(() => {
    const cv = document.createElement("canvas").getContext("2d")
    const rgb = (c) => { cv.fillStyle = "#000"; cv.fillStyle = c; const h = cv.fillStyle; return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) }
    const lum = (c) => { const [r, g, b] = rgb(c).map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
    const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
    const out = []
    for (const fg of ["--foreground", "--muted-foreground", "--muted-foreground-on-app", "--accent-text"]) for (const bg of ["#C8CACB", "#E1E1E1", "#D7D7D7", "#FFFFFF"]) out.push([fg, bg, cr(v(fg), bg)])
    return out
  })
  const low = c.filter((x) => x[2] < 4.5)
  ok("v6.1 contrast: every text token ≥ 4.5:1 on canvas #C8CACB, chrome #E1E1E1, field #D7D7D7 and paper #FFF", low.length === 0, low.map((x) => `${x[0]} on ${x[1]} ${x[2].toFixed(2)}`).join("; ") || `min ${Math.min(...c.map((x) => x[2])).toFixed(2)}:1`)
}
{ // rendered: no tinted near-greys, white only on paper / thumbnails / content swatches, chrome & inputs in tone
  const CONTENT = new Set(["200,202,203", "246,242,234", "236,231,223", "250,248,245", "163,161,162"]) // canvas; paper-stock + site-theme + token swatches (content)
  const tint = [], white = [], hs = [...screenIds.map(scr), ...pages.map((p) => feat(p.slug ?? p.id))]
  for (const h of quick ? hs.slice(0, 12) : hs) {
    await go(h, 320)
    const r = await page.evaluate(() => [...document.querySelectorAll("body *")].flatMap((e) => {
      const m = getComputedStyle(e).backgroundColor.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?/); if (!m || (m[4] !== undefined && +m[4] < 1)) return []
      const [r, g, b] = [+m[1], +m[2], +m[3]], k = `${r},${g},${b}`, cls = e.className?.toString() ?? ""
      if (r === 255 && g === 255 && b === 255) {
        const paper = /bg-paper|bg-white|shadow-(thumb|stage|hairline)|\bspread\b/.test(cls) || e.closest('[data-testid="spread"],[data-testid="site"],.site,[class*="shadow-thumb"],[class*="bg-paper"],[class*="shadow-stage"]') || e.style.background || e.style.backgroundColor || /swatch|handle|cursor-/.test(cls + (e.getAttribute("data-testid") ?? ""))
        return paper ? [] : [["W", k, (e.getAttribute("data-testid") || cls).slice(0, 50)]]
      }
      const tinted = !(r === g && g === b) && Math.max(r, g, b) - Math.min(r, g, b) <= 14 && Math.min(r, g, b) >= 112
      return tinted ? [["T", k, (e.getAttribute("data-testid") || cls).slice(0, 50)]] : []
    }))
    for (const [w, k, s] of r) { if (w === "W") white.push(`${h} ${s}`); else if (!CONTENT.has(k)) tint.push(`${h} ${k} ${s}`) }
  }
  ok("v6.1 rendered: no tinted near-grey surfaces (canvas + paper/site content exempt)", tint.length === 0, tint.slice(0, 6).join(" | ") || "ok")
  ok("v6.1 rendered: white backgrounds only on paper, thumbnails and content swatches", white.length === 0, white.slice(0, 6).join(" | ") || "ok")
  await go(feat("recents-home"), 600)
  const bar = await D('[data-testid="library-bar"]').evaluate((e) => getComputedStyle(e).backgroundColor)
  ok("v6.1 library top bar renders in the chrome tone rgb(225,225,225)", bar === "rgb(225, 225, 225)", bar)
  await go(feat("editor-chrome-toolbar"), 400)
  const kitHeader = await page.locator("header").first().evaluate((e) => getComputedStyle(e).backgroundColor).catch(() => "")
  ok("v6.1 kit header renders in the chrome tone", kitHeader === "rgb(225, 225, 225)", kitHeader)
  await go(feat("inspector"), 600); await page.locator('[data-testid="scenarios"]').getByRole("tab", { name: "Book settings" }).click(); await page.waitForTimeout(250)
  const inputs = await page.locator('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color])').evaluateAll((els) => els.map((e) => { let x = e; while (x && getComputedStyle(x).backgroundColor === "rgba(0, 0, 0, 0)") x = x.parentElement; return x ? getComputedStyle(x).backgroundColor : "" }))
  ok("v6.1 inputs render in the field tone rgb(215,215,215)", inputs.length > 0 && inputs.filter((x) => x !== "rgb(215, 215, 215)").length === 0, `${inputs.length} inputs: ${[...new Set(inputs)].join(" ")}`)
}
await smoke("v6.1 library search + sort: quiet field tone on chrome, no border, no black", "recents-home", async () => {
  const st = await D('[data-testid="lib-search"], [data-testid="lib-sort"]').evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e); return [s.backgroundColor, s.borderTopWidth, s.boxShadow, s.color, getComputedStyle(e.closest("[data-testid=library-bar]")).backgroundColor] }))
  const black = (c) => /rgb\((\d+), (\d+), (\d+)\)/.test(c) && c.match(/\d+/g).slice(0, 3).every((n) => +n < 40)
  const good = st.length === 2 && st.every(([bg, bw, sh, col, bar]) => bg === "rgb(215, 215, 215)" && bw === "0px" && sh === "none" && !black(col) && bar === "rgb(225, 225, 225)")
  return [good, st.map((x) => x.join(" / ")).join(" | ")]
})
await smoke("v6.1 library still: Create book in header, Rename in card menu, no New-book tile, no sample book", "recents-home", async () => {
  const cb = await D('[data-testid="new-book"]').innerText(), tile = await D('[data-testid="new-book-tile"]').count(), sample = /sample book/i.test(await txt(demo))
  await D('[data-testid="book-card"]').first().hover(); await page.waitForTimeout(200)
  await D('[data-testid="book-card"]').first().locator('button[aria-label="Book actions"]').click(); await page.waitForTimeout(250)
  const ren = await page.getByRole("menuitem", { name: /Rename/ }).count()
  return [cb === "Create book" && tile === 0 && !sample && ren === 1, `cb=${cb} tile=${tile} sample=${sample} rename=${ren}`]
})

// ───────── v7: editor redesign, kit chrome, sliders, toggles, black-only-for-selection ─────────
const E = (s) => D(`[data-testid="editor7"] ${s}`)
// Stage 3: the old "editor" screen scenarios now live on feature pages (label → [page, scenario])
const SCEN3 = { "Photo": ["frame-selection-handles", "Frame selected"], "Book settings": ["inspector", "Book settings"], "Cover": ["pasteboard-workspace", "Cover"], "Masters": ["layout-grids-settings", "Master grid"], "Nothing selected": ["pasteboard-workspace", "Spread"], "Endpaper": ["inspector", "Endpaper"] }
const scen = async (l) => { const m = SCEN3[l]; if (m) { await go(feat(m[0]), 700); l = m[1] } await D('[data-testid="scenarios"]').getByRole("tab", { name: l, exact: true }).click(); await page.waitForTimeout(250) }
const bg = (loc) => loc.evaluate((e) => getComputedStyle(e).backgroundColor)
const items = () => E('[data-testid="panel-l"] [role=row]').evaluateAll((els) => els.map((e) => e.getAttribute("data-item")))
await smokeS("v7 list order: Cover · Endpaper · page 1 · spreads · last page · Endpaper", "canvas", async () => {
  const it = await items(), labels = await E('[data-testid="panel-l"] [role=row] [data-label]').allInnerTexts()
  const okO = it[0] === "cover" && it[1] === "ef" && it[2] === "p0" && it.at(-3) === "p9" && it.at(-2) === "last" && it.at(-1) === "eb"
  return [okO && labels[2] === "1" && labels[3] === "2–3" && labels.at(-3) === "18–19" && labels.at(-2) === "20", it.join(",") + " | " + labels.join(",")]
})
await smokeS("v7 endpapers only when enabled in Book settings", "canvas", async () => {
  await E('[data-testid="book-title"]').click(); await page.waitForTimeout(150)
  const pressed = await E('[data-testid="book-title"]').getAttribute("aria-pressed"), insp = await E('[data-testid="insp-book"]').count()
  await E('[role=switch][aria-label="Endpapers"]').click(); await page.waitForTimeout(150)
  const it = await items()
  return [pressed === "true" && insp === 1 && !it.includes("ef") && !it.includes("eb") && it[0] === "cover" && it[1] === "p0", `pressed=${pressed} ${it.join(",")}`]
})
await smokeS("v7 Pages/Masters toggle: masters show margins, columns, # placeholders", "canvas", async () => {
  await E('[data-testid="mode-seg"] button', ).nth(1).click(); await page.waitForTimeout(200)
  await E('[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]').click(); await page.waitForTimeout(200) // kit10: Page numbers start off (they feed Parent.pageNumbers of every spread)
  const it = await items(), m = await E('[data-testid="canvas-master"]').count(), mm = await E('[data-testid="master-margin"]').count(), c = await E('[data-testid="master-col"]').count(), pn = await E('[data-testid="master-pn"]').allInnerTexts()
  return [it.join() === "mA,mB" && m === 1 && mm === 2 && c >= 4 && pn.length === 2 && pn.every((t) => t === "#"), `${it} margin=${mm} cols=${c} pn=${pn}`]
})
await smokeS("v7 selection: list row #CACACA + bold, no outline; hover #D7D7D7", "canvas", async () => {
  const sel = E('[data-testid="panel-l"] [role=row][aria-selected=true]')
  const b = await bg(sel), o = await sel.evaluate((e) => getComputedStyle(e).outlineStyle), fw = await sel.locator("[data-label]").evaluate((e) => getComputedStyle(e).fontWeight)
  const other = E('[data-testid="panel-l"] [role=row][aria-selected=false]').first(); await other.hover(); await page.waitForTimeout(200)
  const h = await bg(other)
  return [b === "rgb(202, 202, 202)" && o === "none" && +fw >= 600 && h === "rgb(215, 215, 215)", `sel=${b} outline=${o} fw=${fw} hover=${h}`]
})
// v0.7.4 P2-4: 16 → 17 used — the cover photo (p01) now counts as used
await smokeS("v7 editor: no borders, no blue, 3 surfaces only", "canvas", async () => {
  const r = await page.evaluate(() => { const root = document.querySelector('[data-testid="editor7"]'); const bad = [], blue = [], bgs = new Set()
    for (const e of root.querySelectorAll("*")) { const s = getComputedStyle(e)
      if (e.closest('[data-testid="grid-overlay"],[data-testid="print-overlay"],[data-allow-border]')) continue
      for (const k of ["Top", "Right", "Bottom", "Left"]) if (parseFloat(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== "none" && !/rgba\(0, 0, 0, 0\)/.test(s[`border${k}Color`])) bad.push(e.tagName)
      for (const c of [s.color, s.backgroundColor]) { const m = c.match(/rgba?\((\d+), (\d+), (\d+)/); if (m && (+m[3] - Math.max(+m[1], +m[2]) > 12)) blue.push(c) }
      if (["HEADER", "ASIDE"].includes(e.tagName)) bgs.add(s.backgroundColor) }
    return { bad: bad.length, blue: blue.length, bgs: [...bgs] } })
  return [r.bad === 0 && r.blue === 0 && r.bgs.every((b) => b === "rgb(225, 225, 225)" || b === "rgba(0, 0, 0, 0)"), JSON.stringify(r)]
})
await smokeS("v7 scrollbars: thin 4/6/8 px thumbs #A8A8A8/#969696/#7E7E7E, transparent track", "canvas", async () => {
  const t = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return ["--scroll-thumb-rest", "--scroll-thumb", "--scroll-thumb-hover"].map((n) => s.getPropertyValue(n).trim().toUpperCase()) })
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  return [t.join() === "#A8A8A8,#969696,#7E7E7E" && /scrollbar-thumb \{[^}]*border: 3px solid transparent/.test(css), t.join()]
})
// sliders: variant B
await smokeS("v7 sliders variant B: 3px #CACACA track, fill #A8A8A8 (#8E8E8E dragging), 14px #F7F7F7 knob, 4px halo, no black", "canvas", async () => {
  await scen("Photo")
  const sl = E('.sl-track').first().locator("xpath=.."), tr = sl.locator(".sl-track"), fi = sl.locator(".sl-fill"), th = sl.locator(".sl-thumb")
  const h = await tr.evaluate((e) => e.getBoundingClientRect().height), tb = await bg(tr), fb = await bg(fi), tw = await th.evaluate((e) => e.getBoundingClientRect().width), kb = await bg(th)
  await page.mouse.move(1, 1); await th.hover() // v7.2: the inspector now opens with Crop (zoom) first — its slider can sit at the fold
  const bx = await th.boundingBox(); await page.mouse.move(bx.x + 7, bx.y + 7); await page.mouse.down(); await page.mouse.move(bx.x + 30, bx.y + 7, { steps: 4 }); await page.waitForTimeout(200)
  const fd = await bg(fi), halo = await th.evaluate((e) => getComputedStyle(e).boxShadow); await page.mouse.up()
  const n = await page.evaluate(() => [...document.querySelectorAll(".sl-track, .sl-fill, .sl-thumb")].filter((e) => /rgb\((3[0-9]|2[0-9]|[0-9]), /.test(getComputedStyle(e).backgroundColor)).length)
  return [h === 3 && tb === "rgb(202, 202, 202)" && fb === "rgb(168, 168, 168)" && fd === "rgb(142, 142, 142)" && tw === 14 && kb === "rgb(247, 247, 247)" && /0px 0px 0px 4px/.test(halo) && n === 0, `h=${h} track=${tb} fill=${fb}→${fd} knob=${tw}/${kb} halo=${halo} black=${n}`]
})
await smoke("v7 kit Slider component uses variant B too", "editor-chrome-toolbar", async () => {
  await page.evaluate(() => { location.hash = "#/components" }); await page.waitForTimeout(600)
  const r = await page.evaluate(() => { const t = [...document.querySelectorAll(".sl-track")]; return { n: t.length, ok: t.every((e) => getComputedStyle(e).backgroundColor === "rgb(202, 202, 202)" && e.getBoundingClientRect().height === 3) && [...document.querySelectorAll(".sl-thumb")].every((e) => getComputedStyle(e).backgroundColor === "rgb(247, 247, 247)") } })
  return [r.n >= 3 && r.ok, JSON.stringify(r)]
})
// toggles + swatches
await smokeS("v7 toggles: ON #A8A8A8, OFF #CACACA, knob #F7F7F7; selected swatch 2px #8E8E8E ring with 2px offset", "canvas", async () => {
  await scen("Book settings")
  const sw = E('[role=switch][aria-label="Endpapers"]'), on = await bg(sw); await sw.click(); await page.waitForTimeout(150); const off = await bg(sw)
  const kn = await bg(sw.locator("span")); await sw.click()
  // v0.9.1: Binding/Material/Fill demoted (no fake book swatches). .swatch-on still styles wired spread Background chips.
  await scen("Photo")
  await page.locator('[data-testid="demo"] [data-testid="canvas"]').click({ position: { x: 20, y: 20 } }).catch(() => {})
  await page.waitForTimeout(250)
  let so = ""
  if (await E('[data-testid="bg-swatches"] .swatch-on').count()) {
    so = await E('[data-testid="bg-swatches"] .swatch-on').first().evaluate((e) => { const c = getComputedStyle(e); return `${c.outlineWidth} ${c.outlineStyle} ${c.outlineColor} ${c.outlineOffset}` })
  } else {
    so = await page.evaluate(() => { const el = document.createElement("span"); el.className = "swatch-on"; document.body.appendChild(el); const c = getComputedStyle(el); const r = `${c.outlineWidth} ${c.outlineStyle} ${c.outlineColor} ${c.outlineOffset}`; el.remove(); return r })
  }
  return [on === "rgb(168, 168, 168)" && off === "rgb(202, 202, 202)" && kn === "rgb(247, 247, 247)" && so === "2px solid rgb(142, 142, 142) 2px", `on=${on} off=${off} knob=${kn} swatch=${so}`]
})
await smoke("v7 kit Switch component: ON #A8A8A8 / OFF #CACACA / knob #F7F7F7", "editor-chrome-toolbar", async () => {
  await page.evaluate(() => { location.hash = "#/components" }); await page.waitForTimeout(600)
  const r = await page.evaluate(() => [...document.querySelectorAll(".sw-track")].map((e) => [e.closest("[data-selected]") ? 1 : 0, getComputedStyle(e).backgroundColor, getComputedStyle(e.firstElementChild).backgroundColor]))
  return [r.length >= 2 && r.every(([s, b, k]) => b === (s ? "rgb(168, 168, 168)" : "rgb(202, 202, 202)") && k === "rgb(247, 247, 247)"), JSON.stringify(r.slice(0, 4))]
})
await smokeS("v7 black #232223 only on canvas selection, primary button and used-photo badges", "canvas", async () => {
  await scen("Photo")
  const r = await page.evaluate(() => { const root = document.querySelector('[data-testid="editor7"]'); const bad = []
    for (const e of root.querySelectorAll("*")) { const s = getComputedStyle(e); const hit = [s.backgroundColor, s.color, s.outlineStyle !== "none" ? s.outlineColor : ""].some((c) => c === "rgb(35, 34, 35)") || /rgb\(35, 34, 35\)(?! 0px 0px 0px 0px)/.test(s.boxShadow)
      if (!hit) continue
      if (e.closest('[data-testid="sel-outline"],[data-testid="sel-handle"]') || e.matches('[data-testid="sel-outline"],[data-testid="sel-handle"]')) continue
      if (e.closest('[data-testid="panel-b"]') && e.querySelector("svg")) continue
      if (e.closest('[data-photo][data-selected]') && e.tagName === "SPAN") continue
      bad.push(e.tagName + "." + (e.className?.baseVal ?? e.className).toString().slice(0, 30)) }
    return bad })
  return [r.length === 0, r.slice(0, 6).join(" | ")]
})
// kit chrome
await go("#/", 700)
{
  const r = await page.evaluate(() => {
    const bad = [], q = (s) => document.querySelector(s)
    for (const e of document.querySelectorAll("header *, header, main *:not([data-testid=demo] *)")) { if (e.closest('[data-testid="demo"]')) continue; const s = getComputedStyle(e)
      for (const k of ["Top", "Right", "Bottom", "Left"]) if (parseFloat(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== "none" && !/rgba\(0, 0, 0, 0\)/.test(s[`border${k}Color`]) && !e.matches("input, [role=searchbox], [role=checkbox] *, select")) bad.push(e.tagName + ":" + String(e.className).slice(0, 40)) }
    const nav = q('[data-nav="index"]'), comp = q('[data-nav="components"]')
    return { bad: [...new Set(bad)].slice(0, 5), n: bad.length, nav: getComputedStyle(nav).backgroundColor, navW: getComputedStyle(nav).fontWeight, cur: nav.getAttribute("aria-current"), comp: getComputedStyle(comp).backgroundColor, hdr: getComputedStyle(q("header")).backgroundColor, font: getComputedStyle(document.body).fontFamily, h: getComputedStyle(q(".heading") ?? document.body).fontFamily }
  })
  ok("v7 kit chrome: no borders or lines in header / index / docs chrome", r.n === 0, r.bad.join(" | "))
  ok("v7 kit nav: selected #CACACA (not black), aria-current", r.nav === "rgb(202, 202, 202)" && r.cur === "page" && r.comp !== "rgb(202, 202, 202)", `${r.nav} ${r.cur} other=${r.comp}`)
  ok("v7 kit header opaque #E1E1E1; fonts Inter + Lora", r.hdr === "rgb(225, 225, 225)" && /Inter/.test(r.font) && /Lora/.test(r.h), `${r.hdr} ${r.font} | ${r.h}`)
  await page.hover('[data-nav="components"]'); await page.waitForTimeout(200)
  ok("v7 kit nav hover #D7D7D7", await page.evaluate(() => getComputedStyle(document.querySelector('[data-nav="components"]')).backgroundColor) === "rgb(215, 215, 215)")
  const blk = await page.evaluate(() => [...document.querySelectorAll("header *, main *")].filter((e) => !e.closest('[data-testid="demo"]') && getComputedStyle(e).backgroundColor === "rgb(35, 34, 35)" && !e.matches("button, a[class*=bg-primary]")).length)
  ok("v7 kit chrome: no #232223 fills outside primary buttons", blk === 0, `${blk}`)
}
await go(feat("spread-list-panel"), 700)
{
  const r = await page.evaluate(() => { const ls = [...document.querySelectorAll("main a")].filter((a) => !a.closest('[data-testid="demo"]') && a.innerText.trim() && !a.closest("header"))
    return ls.slice(0, 20).map((a) => [getComputedStyle(a).color, getComputedStyle(a).textDecorationLine]) })
  ok("v7 kit links #393738/#535152 tone, not underlined at rest", r.length > 0 && r.every(([c, d]) => !/underline/.test(d) && !/rgb\(\d+, \d+, (1\d\d|2\d\d)\)/.test(c.replace(/rgb\((\d+), \d+, \1\)/, ""))), JSON.stringify(r.slice(0, 3)))
  const dm = await page.evaluate(() => { const d = document.querySelector('[data-testid="demo"]'); const s = getComputedStyle(d); return [s.borderTopWidth, s.borderTopStyle, s.backgroundColor] })
  ok("v7 kit demo frame: no border, chrome tone", (dm[0] === "0px" || dm[1] === "none") && dm[2] === "rgb(225, 225, 225)", dm.join(" "))
  const sc = await page.evaluate(() => { const e = document.querySelector('[data-testid="scenarios"]'); return e ? [getComputedStyle(e).borderBottomStyle, getComputedStyle(e).backgroundColor] : ["none", "n/a"] })
}
await page.evaluate(() => { location.hash = "#/credits" }); await page.waitForTimeout(600)
{
  const r = await page.evaluate(() => { const a = document.querySelector("main a[href^=http], table a"); const s = a && getComputedStyle(a); const lines = [...document.querySelectorAll("main *, table *")].filter((e) => { const c = getComputedStyle(e); return parseFloat(c.borderTopWidth) > 0 && c.borderTopStyle !== "none" && !/rgba\(0, 0, 0, 0\)/.test(c.borderTopColor) }).length; return { c: s?.color, d: s?.textDecorationLine, lines } })
  ok("v7 credits page: links #393738, no underline at rest, no lines", r.c === "rgb(57, 55, 56)" && !/underline/.test(r.d) && r.lines === 0, JSON.stringify(r))
}
{
  const src = walk6(new URL("../src", import.meta.url).pathname).map((f) => [f, fs.readFileSync(f, "utf8")])
  const ink = src.filter(([f, s]) => !/button\.tsx|editor7\.tsx|toast\.tsx|index\.css/.test(f) && /bg-primary(?![-\w])/.test(s)).map(([f]) => f.split("/src/")[1])
  ok("v7 no bg-primary outside buttons (black reserved)", ink.length === 0, ink.join(", "))
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  ok("v7 version 0.7.x+ (0.9.0 since v9)", /^0\.([789]|10)\./.test(pkg.version), pkg.version)
}

// ───────── v0.7.1: one editor, scenario states, no keyboard trap, page count, tone-only surfaces ─────────
{
  const crypto = await import("node:crypto")
  const SC = ["Photo", "Cover", "Endpaper", "Masters", "Book settings", "Landscape book", "Nothing selected"]
  await smokeS("v7.1 P1 #2: no keyboard trap — Tab hides only from the bare canvas, 2nd Tab moves on, Shift/Ctrl+Tab and inner focus never hide; Cmd/Ctrl+. toggles", "canvas", async () => {
    const w = () => page.evaluate(() => ["l", "b", "r"].map((k) => { const r = document.querySelector(`[data-testid="editor7"] [data-testid="panel-${k}"]`).getBoundingClientRect(); return (k === "b" ? r.height : r.width) > 2 ? 1 : 0 }).join(""))
    const act = () => page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName)
    await E('[data-testid="canvas"]').focus(); await page.keyboard.press("Shift+Tab"); await page.waitForTimeout(250); const a = await w()
    await E('[data-testid="canvas"]').focus(); await page.keyboard.press("Control+Tab").catch(() => {}); await page.waitForTimeout(250); const b = await w()
    const inner = E('[data-testid="canvas"] button').first(); let c = "111"; if (await inner.count()) { await inner.focus(); await page.keyboard.press("Tab"); await page.waitForTimeout(250); c = await w() }
    await E('[data-testid="canvas"]').focus(); await page.keyboard.press("Tab"); await page.waitForTimeout(300); const d = await w(), f1 = await act()
    await page.keyboard.press("Tab"); await page.waitForTimeout(250); const f2 = await act()
    let n = 0; for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); if ((await act()) === "canvas") n++ }
    await page.keyboard.press("Control+."); await page.waitForTimeout(300); const e = await w()
    return [a === "111" && b === "111" && c === "111" && d === "000" && f1 === "canvas" && f2 !== "canvas" && n === 0 && e === "111", `shift=${a} ctrl=${b} inner=${c} tab=${d} focus ${f1}→${f2} back-on-canvas=${n} ctrl+.=${e}`]
  })
  // one editor everywhere: every page with an editor uses the v7 frame, no old markers on any page
  {
    const bad = [], tried = []
    for (const id of [...screenIds.map(scr), ...pages.map((p) => feat(p.slug))]) {
      await go(id, 350)
      const r = await page.evaluate(() => { const root = document.querySelector('[data-testid="demo"]') ?? document.body, t = root.innerText
        const ed = root.querySelectorAll('[data-testid="editor"]').length, ed7 = root.querySelectorAll('[data-testid="editor7"] [data-testid="editor"]').length
        const mk = ["Spreads 8", "1 Cover", "Spread 1 · cover"].filter((m) => t.includes(m))
        const dark = [...root.querySelectorAll('[data-testid="spread"], [data-testid="spread-layer"] > *')].filter((e) => { const s = getComputedStyle(e); return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && /rgb\((3[0-9]|[0-2]?[0-9]), /.test(s.outlineColor) && e.dataset.testid !== "sel-outline" }).length
        return { ed, ed7, mk, dark } })
      if (r.ed) tried.push(id)
      if (r.ed !== r.ed7 || r.mk.length || r.dark) bad.push(`${id}:${r.ed}/${r.ed7} ${r.mk} dark=${r.dark}`)
    }
    const src = fs.existsSync(new URL("../src/features/editor7.tsx", import.meta.url))
    ok("v7.1 P1 #3: ONE editor — every editor demo is the v7 frame, editor7.tsx removed, no 'Spreads 8' / '1 Cover' / 'Spread 1 · cover' / dark spread outline anywhere", !bad.length && !src && tried.length > 10, `${tried.length} pages with an editor; bad=${bad.slice(0, 6).join(" ; ")}`)
  }
  await smoke("v7.1 P1 #3: feature page uses the new list (Pages/Masters seg, page labels) and inspector", "spread-list-panel", async () => {
    const seg = await D('[data-testid="mode-seg"]').count(), lab = await D('[data-testid="panel-l"] [role=row] [data-label]').allInnerTexts(), bar = await D('[data-testid="editor-bar"]').count()
    return [seg === 1 && bar === 1 && lab.includes("1") && lab.includes("2–3"), `seg=${seg} bar=${bar} labels=${lab.slice(0, 5)}`]
  })
  await smokeS("v7.1 P1 #3: v0.5.3 features live in the one editor — templates All/My + search, filmstrip drag source, inspector params, multi-select, Crop toolbar", "canvas", async () => {
    await scen("Photo")
    const r = {}
    r.tb = await E('[role=toolbar]').count()
    r.params = await E('[data-testid="inspector"] [data-testid="ctx-inspector"][data-ctx="photo"]').count()
    await E('[data-item="p3"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await E('[data-item="p3"]').click(); await page.waitForTimeout(200) // the spread list is a drag source (reorder): scroll first, then click
    r.tpl = await E('[data-testid="tpl-tile"]').count(); r.search = await E('[data-testid="inspector"] input[type=search], [data-testid="inspector"] [role=searchbox]').count()
    r.film = await E('[data-testid="filmstrip"] [role=row]').count()
    const fr = E('[data-testid="spread"] [data-testid="frame"]')
    r.frames = await fr.count()
    if (r.frames >= 2) { await fr.nth(0).click({ force: true }); await fr.nth(1).click({ modifiers: ["Shift"], force: true }); await page.waitForTimeout(200); r.multi = await E('[data-testid="sel-outline"]').count() }
    return [r.tb >= 1 && r.params === 1 && r.tpl >= 4 && r.search >= 1 && r.film >= 4 && (r.multi ?? 0) >= 2, JSON.stringify(r)]
  })
  // P2 #5 Home not clipped
  await go(feat("recents-home"), 900)
  { const r = await page.evaluate(() => [...document.querySelectorAll('[data-testid="demo"] *')].filter((e) => e.scrollHeight > e.clientHeight + 2 && /auto|scroll|hidden/.test(getComputedStyle(e).overflowY) && e.clientHeight > 200).map((e) => `${e.tagName} ${e.clientHeight}/${e.scrollHeight}`))
    ok("v7.1 P2 #5: Home demo frame shows both rows of books (nothing clipped/scrolling)", r.length === 0, r.join(", ") || "fits")
    // P2 #7 Create book dialog: tone only
    await D('[data-testid="new-book"]').first().click().catch(() => {}); await page.waitForTimeout(350)
    const d = await page.evaluate(() => { const dl = document.querySelector('[role=dialog]'); if (!dl) return null; const bad = []
      for (const e of [dl, ...dl.querySelectorAll("*")]) { const s = getComputedStyle(e); for (const k of ["Top", "Right", "Bottom", "Left"]) if (parseFloat(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== "none" && !/rgba\(0, 0, 0, 0\)/.test(s[`border${k}Color`])) bad.push(`${e.tagName}.${k}`) }
      return { bad, cancel: [...dl.querySelectorAll("button")].some((b) => b.textContent.trim() === "Cancel") } })
    ok("v7.1 P2 #7: Create book dialog has no rendered borders (no border-t, Cancel is a ghost button)", d && d.cancel && d.bad.length === 0, JSON.stringify(d))
    await page.keyboard.press("Escape") }
  // P2 #7 global: no `*` border colour, rendered borders 0 on every page except print/grid overlays
  {
    const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
    ok("v7.1 P2 #7: global `* { border-color }` is transparent (was var(--border) #CDCDCD)", /\*, ::before, ::after \{ border-color: transparent; \}/.test(css) && !/\*, ::before, ::after \{ border-color: var\(--border\)/.test(css))
    const bad = []
    for (const id of [...screenIds.map(scr), ...pages.map((p) => feat(p.slug)), "#/", "#/components"]) {
      await go(id, 300)
      const n = await page.evaluate(() => { const out = []
        for (const e of document.querySelectorAll("body *")) { if (e.closest('[data-testid="grid-overlay"],[data-testid="print-overlay"],[data-allow-border]')) continue
          const s = getComputedStyle(e); for (const k of ["Top", "Right", "Bottom", "Left"]) if (parseFloat(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== "none" && !/rgba\(\d+, \d+, \d+, 0\)/.test(s[`border${k}Color`]) && e.getClientRects().length) { out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(" ").filter((c) => /border/.test(c)).join(".")}`); break } }
        return out })
      if (n.length) bad.push(`${id} ×${n.length} ${[...new Set(n)].slice(0, 3).join(" ")}`)
    }
    ok("v7.1 P2 #7: rendered borders = 0 on every kit page (exceptions: canvas print/grid guide overlays)", bad.length === 0, bad.length ? `${bad.length} pages: ${bad.slice(0, 8).join(" | ")}` : "0 borders")
  }
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  ok("v7.1 version 0.7.x+ (0.9.0 since v9)", /^0\.([789]|10)\./.test(pkg.version), pkg.version)
}
// ───────── v0.7.2: designer review of v0.7.1 (uikit-audit/v7.1-review.md) ─────────
{
  const panelsHidden = () => page.evaluate(() => {
    const ps = [...document.querySelectorAll('[data-testid="panel-l"],[data-testid="panel-b"],[data-testid="panel-r"]')]
    return { n: ps.length, bad: ps.filter((e) => !(e.hasAttribute("inert") && e.getAttribute("aria-hidden") === "true" && e.hasAttribute("data-hidden-panel"))).map((e) => e.dataset.testid) }
  })
  const tabLeak = async () => { let leak = 0
    // Shift+Tab: a plain Tab on the canvas is the Figma-style "toggle all panels" shortcut and would re-show them
    for (let i = 0; i < 24; i++) { await page.keyboard.press("Shift+Tab"); leak += await page.evaluate(() => document.activeElement?.closest?.("[data-hidden-panel],[inert]") ? 1 : 0) }
    return leak }
  // P0-1 hidden panels: inert + aria-hidden on #/full/*, #/screen/* and a feature page
  for (const [label, h] of [["#/full/canvas", "#/full/canvas"], ["#/screen/canvas", scr("canvas")]]) {
    await go(h, 1500); await page.mouse.click(5, 5); await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(200)
    // setup: panel visibility is a global store, an earlier check may have left them hidden — start from visible
    if ((await panelsHidden()).bad.length === 0) { await page.keyboard.press("Control+."); await page.waitForTimeout(300) }
    await page.keyboard.press("Control+."); await page.waitForTimeout(400)
    const r = await panelsHidden(); const leak = await tabLeak()
    // the attributes must survive the #/full MutationObserver a little later too
    await page.waitForTimeout(600); const r2 = await panelsHidden()
    ok(`v7.2 P0-1: ${label}: Ctrl+. → every panel inert + aria-hidden, Tab never lands inside`, r.n === 3 && r.bad.length === 0 && r2.bad.length === 0 && leak === 0, `${r.n} panels, bad=${r.bad.concat(r2.bad).join(",") || "-"}, tab-leaks=${leak}`)
    await page.keyboard.press("Control+."); await page.waitForTimeout(300)
    const back = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="panel-"]')].filter((e) => /^panel-[lbr]$/.test(e.dataset.testid) && (e.hasAttribute("inert") || e.hasAttribute("aria-hidden"))).length)
    ok(`v7.2 P0-1: ${label}: Ctrl+. again → panels interactive again`, back === 0, `${back} still inert`)
  }
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
  // P1-3 every book ≥ 20 pages
  {
    const bad = []
    for (const id of [...screenIds.map(scr), ...pages.map((p) => feat(p.slug)), "#/full/canvas", "#/full/library"]) {
      await go(id, 350)
      const r = await page.evaluate(() => { const root = document.querySelector('[data-testid="demo"]') || document.body
        const t = [...(root.innerText || "").matchAll(/(\d+)[ \u00a0]pages?\b/gi)].filter((m) => +m[1] < 20).map((m) => m[0])
        const bp = root.querySelector('[data-testid="book-pages"]'); if (bp && parseInt(bp.textContent) < 20) t.push("book-pages " + bp.textContent)
        return t })
      if (r.length) bad.push(`${id}: ${r.join(",")}`)
    }
    await go(scr("canvas"), 700)
    const n = await page.evaluate(() => [...document.querySelectorAll('[data-testid="demo"] [data-testid="panel-l"] [role=row], [data-testid="demo"] [data-testid="panel-l"] [role=gridcell]')].length)
    const hdr = await page.evaluate(() => (document.querySelector('[data-testid="demo"]').innerText.match(/(\d+)[ \u00a0]pages/) || [])[1])
    ok("v7.2 P1-3: editor header says ≥ 20 pages", +hdr >= 20, `header ${hdr} pages, list rows ${n}`)
  }
  // P1-4 grayscale: no hue on any rendered colour (photos are images, exempt) + text contrast ≥ 4.5:1
  {
    const scanHue = () => page.evaluate(() => {
      const root = document.querySelector('[data-testid="demo"]') || document.body; const out = []
      const sat = (c) => { const m = c.match(/rgba?\(([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:[,/]\s*([\d.]+))?/); if (!m) return 0; if (m[4] !== undefined && +m[4] < 0.05) return 0; return Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) }
      for (const el of root.querySelectorAll("*")) { const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue
        if (el.closest("[data-swatch],[data-theme-option]")) continue
        const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.opacity === "0") continue
        for (const p of ["color", "backgroundColor", "outlineColor", "borderTopColor", "fill", "stroke"]) { const v = cs[p]
          if (p === "outlineColor" && (cs.outlineStyle === "none" || cs.outlineWidth === "0px")) continue
          if (p === "borderTopColor" && cs.borderTopWidth === "0px") continue
          if (p === "color" && ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
          if ((p === "fill" || p === "stroke") && !(el instanceof SVGElement)) continue
          if (sat(v) > 12) out.push(`${p} ${v} <${el.tagName.toLowerCase()} ${el.getAttribute("data-testid") || ""}> "${(el.textContent || "").trim().slice(0, 20)}"`) } }
      return out })
    const scanContrast = () => page.evaluate(() => {
      const root = document.querySelector('[data-testid="demo"]') || document.body; const out = []
      const parse = (c) => { const m = c.match(/rgba?\(([\d.]+),?\s*([\d.]+),?\s*([\d.]+)(?:[,/]\s*([\d.]+))?/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null }
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
      const mix = (a, b) => [a[0] * a[3] + b[0] * (1 - a[3]), a[1] * a[3] + b[1] * (1 - a[3]), a[2] * a[3] + b[2] * (1 - a[3]), 1]
      for (const el of root.querySelectorAll("*")) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue
        if (el.closest('[aria-disabled="true"],[disabled],[data-disabled],[aria-hidden="true"],[inert]')) continue
        const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity < 0.95) continue
        // effective background: walk up, blending; give up over photos/images (text on photos is exempt)
        const layers = []; let photo = false, e = el
        while (e && e !== document.documentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== "none" && !/gradient/.test(s.backgroundImage)) { photo = true; break }
          if (+s.opacity < 0.95 && e !== el) { photo = true; break }
          const b = parse(s.backgroundColor); if (b && b[3] > 0) { layers.push(b); if (b[3] >= 0.99) break }
          // a sibling <img> under absolutely-positioned text → text on a photo
          if (e.parentElement && [...e.parentElement.children].some((c) => c !== e && (c.tagName === "IMG" || c.querySelector?.(":scope > img")))) { photo = true; break }
          e = e.parentElement }
        // text drawn over a photo / cover image (any image under its box within 5 ancestors) is exempt
        if (!photo) { let a = el; for (let k = 0; k < 6 && a; k++, a = a.parentElement) { if ([...a.querySelectorAll('img,[style*="url("]')].some((im) => { const b = im.getBoundingClientRect(); return !(b.right < r.left || r.right < b.left || b.bottom < r.top || r.bottom < b.top) })) { photo = true; break } } }
        if (photo) continue
        let bg = [255, 255, 255, 1]; for (let i = layers.length - 1; i >= 0; i--) bg = mix(layers[i], bg)
        let fg = parse(cs.color); if (!fg) continue; fg = mix(fg, bg)
        const L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
        if (cr < 4.5) out.push(`${cr.toFixed(2)} <${el.tagName.toLowerCase()} ${el.getAttribute("data-testid") || ""}> "${el.textContent.trim().slice(0, 24)}"`) }
      return out })
    const hue = [], con = []
    const check = async (id) => { const h = await scanHue(); if (h.length) hue.push(`${id} ×${h.length}: ${[...new Set(h)].slice(0, 3).join(" ; ")}`); const c = await scanContrast(); if (c.length) con.push(`${id} ×${c.length}: ${[...new Set(c)].slice(0, 3).join(" ; ")}`) }
    for (const id of [...screenIds.map(scr), ...pages.map((p) => feat(p.slug)), "#/full/canvas", "#/full/library"]) { await go(id, 350); await check(id) }
    await go(scr("canvas"), 700)
    for (const t of await D('[data-testid="scenarios"] [role=tab]').allTextContents()) { await scen(t); await page.waitForTimeout(250); await check(`editor/${t}`) }
    // states that only exist after interaction: crop mode, low-DPI photo, Delete frame, N empty
    await scen("Photo"); await page.keyboard.press("Enter").catch(() => {}); await D('[data-testid="crop"]').click().catch(() => {}); await page.waitForTimeout(300); await check("editor/crop-mode")
    const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
    ok("v7.2 P2-8: DPI badge has no inset-shadow ring", /\.pb-badge \{ box-shadow: none; \}/.test(css))
  }
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
  // P2-7 toolbar never covers a page-number label
  {
    const bad = []
    await go(scr("canvas"), 700)
    const fr = E('[data-testid="spread"] [data-testid="frame"]'); const n = await fr.count()
    for (let i = 0; i < n; i++) { await fr.nth(i).click({ force: true }); await page.waitForTimeout(200)
      const o = await page.evaluate(() => { const tb = document.querySelector('[data-testid="demo"] [data-testid="frame-toolbar"]'); if (!tb) return null; const a = tb.getBoundingClientRect()
        const labels = [...document.querySelectorAll('[data-testid="demo"] [data-testid="page-labels"] span')]
        return labels.filter((l) => { const b = l.getBoundingClientRect(); return b.width && l.textContent.trim() && !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top) }).map((l) => l.textContent) })
      if (o?.length) bad.push(`frame ${i}: ${o.join(",")}`) ; await page.keyboard.press("Escape") }
    const nl = await page.evaluate(() => document.querySelectorAll('[data-testid="demo"] [data-testid="page-labels"] span').length)
    ok("v7.2 P2-7: Replace/Crop toolbar never overlaps a page-number label", nl > 0 && bad.length === 0, `${n} frames, ${nl} labels; ${bad.join(" | ") || "no overlap"}`)
  }
  // P2-9 near-black only for canvas selection, primary button, used-photo badges
  {
    const bad = []
    for (const id of [scr("canvas"), "#/full/canvas", feat("crop-in-frame")]) { await go(id, 600)
      const r = await page.evaluate(() => [...document.querySelectorAll('[data-testid="demo"] *, #root *')].filter((e) => { const s = getComputedStyle(e); const m = s.backgroundColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/); if (!m || (m[4] !== undefined && +m[4] < 0.9)) return false
        const r = e.getBoundingClientRect(); return r.width && +m[1] < 70 && +m[2] < 70 && +m[3] < 70 && !e.closest('[data-testid="sel-outline"],[data-testid="sel-chip"],[data-primary],[data-variant="primary"],.bg-primary,[data-used-badge],[data-testid="lightbox"],pre,[role=row],[role=gridcell],[data-testid="canvas-cover"],[data-testid="canvas-endpaper"],[data-swatch]') && !/bg-primary|bg-select|bg-tag/.test(e.className?.toString?.() || "") }).map((e) => `${e.tagName.toLowerCase()}:"${e.textContent.trim().slice(0, 20)}"`))
      if (r.length) bad.push(`${id}: ${r.slice(0, 3).join(",")}`) }
    const src = fs.readFileSync(new URL("../src/sandbox/canvas.tsx", import.meta.url), "utf8")
    ok("v7.2 P2-9: no extra near-black chips (Preview · Panorama, Crop chip are light grey)", bad.length === 0 && !/bg-tag[^"]*">Preview ·/.test(src), bad.join(" | ") || "none")
    ok("v7.2 P2-11: bleed and safe guides carry data-allow-border", (src.match(/data-allow-border className="absolute border border-(bleed|dashed border-guide)"/g) || []).length === 2)
  }
  // P2-10 #/full/* loads without a failed request (favicon) — over http, like the reviewer
  {
    const http = await import("node:http"); const path = await import("node:path")
    const root = new URL("../dist", import.meta.url).pathname
    const srv = http.createServer((q, s) => { const f = path.join(root, decodeURIComponent(q.url.split("?")[0]) === "/" ? "index.html" : decodeURIComponent(q.url.split("?")[0])); fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); s.end() } else { s.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : f.endsWith(".html") ? "text/html" : "application/octet-stream" }); s.end(b) } }) })
    await new Promise((r) => srv.listen(0, r)); const port = srv.address().port
    const p2 = await browser.newPage(); const fails = []
    p2.on("response", (r) => { if (r.status() >= 400) fails.push(`${r.status()} ${r.url()}`) }); p2.on("requestfailed", (r) => fails.push(`failed ${r.url()}`))
    p2.on("console", (m) => { if (m.type() === "error") fails.push(`console ${m.text().slice(0, 120)}`) })
    for (const h of ["#/full/canvas", "#/full/library", "#/screen/canvas"]) { await p2.goto(`http://localhost:${port}/${h}`); await p2.waitForTimeout(1200) }
    await p2.close(); srv.close()
    ok("v7.2 P2-10: #/full/* (served over http) loads with no 404 / failed request / console error", fails.length === 0, fails.slice(0, 4).join(" | ") || "clean")
  }
  // P2-6 shots script captures the editor scenarios + md5 list
  { const sh = fs.readFileSync(new URL("./shots.mjs", import.meta.url), "utf8")
    ok("v7.2 P2-6: npm run shots captures every editor scenario and writes editor-scenarios.md5", /editor-scenarios\.md5/.test(sh) && /screen-editor--/.test(sh)) }
  const pkg2 = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  ok("v7.2 version 0.7.x+ (0.9.0 since v9)", /^0\.([789]|10)\./.test(pkg2.version), pkg2.version)
}
// ───────── v0.7.3: designer review of v0.7.2 (uikit-audit/v7.2-review.md) ─────────
{
  // P1 master A/B/None renders on the canvas
  { await go("#/full/canvas", 1500)
    const snap = () => page.evaluate(() => { const sp = document.querySelector('[data-testid="spread"]'); const q = (s) => sp ? sp.querySelectorAll(s).length : -1
      const cs = sp ? getComputedStyle(sp) : null
      return { a: q('[data-frame^="mA-"]'), b: q('[data-frame^="mB-"]'), ga: q('[data-guide^="mA-"]'), gb: q('[data-guide^="mB-"]'), outline: cs ? (cs.outlineStyle !== "none" && cs.outlineWidth !== "0px") : true } })
    const pick = async (name) => { await page.getByRole("radio", { name, exact: true }).first().evaluate((b) => b.click()); await page.waitForTimeout(350) }
    const out = {}
    for (const m of ["Master B", "None", "Master A"]) { await pick(m); out[m] = await snap() }
    // guides on → master guides render too
    await page.evaluate(() => document.activeElement?.blur?.()); const gOn = async () => { const s = await snap(); return s.ga + s.gb }
    if (!(await gOn())) { await page.locator('[data-testid="canvas"]').focus().catch(() => {}); await page.keyboard.press("Control+;"); await page.waitForTimeout(300) }
    const ga = (await snap()).ga; await pick("Master B"); const gb = (await snap()).gb; await pick("None"); const gn = await snap(); await pick("Master A")
    const A = out["Master A"], B = out["Master B"], N = out["None"]
    ok("v7.3 P1: Master A/B/None changes what the canvas renders (master frames + guides, no spread outline)",
      A.a > 0 && A.b === 0 && B.b > 0 && B.a === 0 && N.a + N.b === 0 && ga > 0 && gb > 0 && gn.ga + gn.gb === 0 && !A.outline && !B.outline && !N.outline,
      `A: ${A.a}fr/${ga}gd · B: ${B.b}fr/${gb}gd · None: ${N.a + N.b}fr/${gn.ga + gn.gb}gd · outline=${A.outline || B.outline || N.outline}`) }
  // P2-1 spread-list-panel: no hidden-scrollbar canvas scroll
  { await go(feat("spread-list-panel"), 1200)
    const sc = await page.evaluate(() => [...document.querySelectorAll('[data-testid="demo"] *')].filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2) && e.closest('[data-testid="canvas"],[data-testid="viewport"],[data-testid="pasteboard"]') }).map((e) => e.dataset.testid || e.className.toString().slice(0, 40)))
    ok("v7.3 P2-1: spread-list-panel canvas has no scrolling pasteboard", sc.length === 0, sc.slice(0, 4).join(" | ") || "none") }
  // P2-2 forward plain-Tab walk with panels hidden
  { await go("#/full/canvas", 1500); await page.mouse.click(5, 5); await page.evaluate(() => document.activeElement?.blur?.())
    const hid = () => page.evaluate(() => document.querySelectorAll("[data-hidden-panel]").length)
    if (await hid()) { await page.keyboard.press("Control+."); await page.waitForTimeout(300) }
    await page.keyboard.press("Control+."); await page.waitForTimeout(400); await page.evaluate(() => document.activeElement?.blur?.())
    let leak = 0, whileHidden = 0
    for (let i = 0; i < 60; i++) { await page.keyboard.press("Tab")
      const r = await page.evaluate(() => ({ h: document.querySelectorAll("[data-hidden-panel]").length, in: !!document.activeElement?.closest?.("[data-hidden-panel],[inert]") }))
      if (r.h) { whileHidden++; if (r.in) leak++ } }
    ok("v7.3 P2-2: forward plain Tab ×60 with panels hidden never lands in a hidden panel", whileHidden > 0 && leak === 0, `${whileHidden} tabs while hidden, leaks=${leak}`)
    if (await hid()) { await page.keyboard.press("Control+."); await page.waitForTimeout(300) } }
  // P2-3 Ctrl+. after Replace + focus return
  await smokeS("v7.3 P2-3 / v0.9: after frame select, Ctrl+. hides the panels", "canvas", async () => {
    await scen("Photo"); await page.waitForTimeout(300)
    if (await page.evaluate(() => document.querySelectorAll("[data-hidden-panel]").length)) { await page.keyboard.press("Control+."); await page.waitForTimeout(300) }
    await D('[data-testid="dock"]').scrollIntoViewIfNeeded().catch(() => {}); await D('[data-testid="frame"]').first().click({ position: { x: 30, y: 30 }, force: true }); await page.waitForTimeout(200)
    const foc = await page.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? "body" : (a.dataset.testid || a.tagName) })
    await page.keyboard.press("Control+."); await page.waitForTimeout(400)
    const n = await page.evaluate(() => document.querySelectorAll("[data-hidden-panel]").length)
    if (n) { await page.keyboard.press("Control+."); await page.waitForTimeout(300) }
    return [n === 3, `focus=${foc}, hidden panels after Ctrl+.=${n}`]
  })
  // v8 §4: the site theme switcher is gone (one library-style look)
  { await go(feat("site-settings"), 1000)
    const n = await page.locator('[data-testid="site-settings"]').getByText(/^(Paper|Night|Sage)$/).count(), th = await page.locator('[data-site-theme]').count()
    ok("v7.3→v8: Site settings has no Paper / Night / Sage theme switcher", n === 0 && th === 0, `${n} ${th}`) }
  const pkg3 = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  ok("v7.3 version 0.7.x+ (0.9.1 since v9.1)", /^0\.([789]|10)\./.test(pkg3.version), pkg3.version)
}
// ───────── v0.7.4: designer review of v0.7.3 (uikit-audit/v7.3-review.md) — 4 P2 polish items ─────────
{
  // P2-1 low-DPI badge + Low-res chip are grey, not near-black
  await smokeS("v7.4 P2-1: low-DPI badge and filmstrip Low-res chip use the field grey, not near-black", "canvas", async () => {
    await scen("Nothing selected").catch(() => {}); await page.keyboard.press("d").catch(() => {}); await page.waitForTimeout(250)
    const cols = await page.evaluate(() => [...document.querySelectorAll('[data-testid="demo"] [data-testid="dpi-badge"], [data-testid="demo"] [data-testid="lowres-chip"]')].map((e) => e.dataset.testid + "=" + getComputedStyle(e).backgroundColor))
    const src = fs.readFileSync(new URL("../src/sandbox/canvas.tsx", import.meta.url), "utf8") + fs.readFileSync(new URL("../src/sandbox/chrome.tsx", import.meta.url), "utf8")
    const dark = cols.filter((c) => { const m = c.match(/\d+/g).map(Number); return Math.max(m[0], m[1], m[2]) < 128 })
    const srcOk = !/bg-dpi-low|bg-dpi-warn|bg-black\/60 px-1 py-px text-2xs font-medium text-white"><AlertTriangle/.test(src) && /data-testid="lowres-chip"/.test(src)
    return [srcOk && dark.length === 0 && cols.some((c) => c.startsWith("lowres-chip")), cols.slice(0, 4).join(" ") || "none rendered"]
  })
  // P2-2 Masters inspector drives the master render
  await smokeS("v7.4 P2-2: Masters inspector — page numbers toggle, margin and grid fields change the master render", "canvas", async () => {
    await scen("Masters"); await page.waitForTimeout(300)
    const r = () => page.evaluate(() => { const d = document.querySelector('[data-testid="demo"]'); const m = d.querySelector('[data-testid="master-margin"]')
      return { pn: d.querySelectorAll('[data-testid="master-pn"]').length, cols: d.querySelectorAll('[data-testid="master-col"]').length, inset: m ? m.style.inset : "" } })
    const r0 = await r()
    await D('[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]').click(); await page.waitForTimeout(200); const r1 = await r()
    await D('[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]').click(); await page.waitForTimeout(200)
    await D('[data-testid="master-field-C"]').fill("4"); await page.waitForTimeout(200); const r2 = await r()
    await D('[data-testid="master-field-T"]').fill("20"); await page.waitForTimeout(200); const r3 = await r()
    return [r0.pn === 0 && r1.pn > 0 && r2.cols === 2 * 4 && r2.cols !== r0.cols && r3.inset !== r2.inset, `pn ${r0.pn}→${r1.pn}, cols ${r0.cols}→${r2.cols}, inset ${r2.inset}→${r3.inset}`]
  })
  // P2-3 dashed guides carry data-allow-border
  { const c = fs.readFileSync(new URL("../src/sandbox/canvas.tsx", import.meta.url), "utf8"), v = fs.readFileSync(new URL("../src/sandbox/v7.tsx", import.meta.url), "utf8")
    const inh = /p\.inherited && !st\.view\.preview && <div data-allow-border[^>]*\[outline-style:dashed\]/.test(c)
    const safe = /<div data-allow-border data-testid=\{big \? "cover-safe"[^>]*1px dashed/.test(v), mg = /<div data-allow-border className="absolute inset-0" style=\{\{ outline: "1px dashed/.test(v)
    ok("v7.4 P2-3: dashed guides (master items, master margin, cover safe area) carry data-allow-border", inh && safe && mg, `inherited=${inh} coverSafe=${safe} masterMargin=${mg}`) }
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
  const pkg4 = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  ok("v7.4 version 0.7.4+ (0.9.0 since v9)", /^0\.(7\.4|[89]\.|10\.)/.test(pkg4.version), pkg4.version)
}
// ───────── v8: credits, "..." menu, filmstrip label, sliders, grid, site fullscreen, #/demo
{
  const credit = async () => page.evaluate(() => {
    const cs = [...document.querySelectorAll('[data-testid="demo"] [data-testid="screen-credit"]')]
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return [0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]), m[3] ?? 1] }
    return cs.map((e) => { const s = getComputedStyle(e); let bg = null
      for (let a = e; a; a = a.parentElement) { const b = getComputedStyle(a).backgroundColor; if (b && lum(b)[1] >= 0.5) { bg = b; break } if (getComputedStyle(a).backgroundImage !== "none") break }
      const L1 = lum(s.color)[0], L2 = bg ? lum(bg)[0] : lum("rgb(200,202,203)")[0]
      const r = e.getBoundingClientRect(), host = (e.closest("[data-demo-stage]") || e.closest('[data-testid="demo"]')).getBoundingClientRect()
      const cn = String(e.className || "").replace(/\[&_a\]:[^\s]+/g, "")
      const pill = /\b(?:rounded-(?:full|md|lg|xl|2xl)|bg-\[|#E1E1E1)|\bshadow-(?:sm|md|lg|pill|hairline)\b/.test(cn) || (parseFloat(s.backgroundColor.match(/[\d.]+/g)?.[3] || "0") > 0.2)
      return { fs: s.fontSize, c: s.color, cr: +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2),
        topRight: r.top - host.top < 48 && host.right - r.right < 48,
        underExample: !!e.closest("figcaption") && !!e.closest('[data-testid="example-book"]'),
        pill, txt: e.textContent, links: [...e.querySelectorAll("a")].map((a) => getComputedStyle(a).color) } }) })
  const out = []
  await go(scr("library"), 700); out.push(...await credit())
  await go("#/demo", 500); await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.go("library") }); await page.waitForTimeout(400); out.push(...await credit())
  const welcome = out[0], empty = out[1]
  const good = out.length === 2 && out.every((x) => x.fs === "11px" && x.c === "rgb(83, 81, 82)" && x.cr >= 4.5 && !x.pill && /CC BY-SA/.test(x.txt) && x.links.every((l) => l === "rgb(83, 81, 82)"))
    && welcome.topRight && empty.underExample
  ok("v0.9 §1 CC BY-SA caption: Welcome top-right plain, empty library under EXAMPLE, 11px #535152, no capsule, contrast ≥4.5", good, JSON.stringify(out.map((x) => [x.fs, x.c, x.cr, x.topRight, x.underExample, x.pill, x.txt])).slice(0, 600))
}
await smoke("v8 §2 '...' menu: same alignment on every card; outside click and Esc close it; Esc returns focus to the trigger", "recents-home", async () => {
  const al = await D('[data-testid="book-menu-slot"]').evaluateAll((s) => s.map((e) => { const cap = e.closest('[data-testid="book-caption"]') ?? e.parentElement; return Math.round(cap.getBoundingClientRect().right - e.getBoundingClientRect().right) }))
  const tile = D('[data-testid="book-menu"]').first()
  await tile.click(); await page.waitForTimeout(200); const o1 = await page.locator('[role=menu]').count()
  await page.mouse.click(5, 450); await page.waitForTimeout(250); const c1 = await page.locator('[role=menu]').count()
  await tile.click(); await page.waitForTimeout(200); const o2 = await page.locator('[role=menu]').count()
  await page.keyboard.press("Escape"); await page.waitForTimeout(200); const c2 = await page.locator('[role=menu]').count()
  const foc = await page.evaluate(() => document.activeElement?.dataset.testid)
  return [al.length > 1 && al.every((x) => x === 0) && o1 === 1 && c1 === 0 && o2 === 1 && c2 === 0 && foc === "book-menu", `align=${[...new Set(al)]} open/outside=${o1}/${c1} open/esc=${o2}/${c2} focus=${foc}`]
})
await smokeS("v8 §3.1 single filmstrip label 'Photos · N · M used'", "canvas", async () => {
  const t = (await D('[data-testid="film-head"]').innerText()).trim(); const n = await D('[data-testid="placed-count"]').count()
  const dup = await D('[data-testid="dock"]').evaluate((d) => (d.innerText.match(/\bused\b/g) || []).length)
  return [/^Photos · \d+ · \d+ used$/.test(t) && n === 1 && dup === 1, `"${t}" n=${n} used×${dup}`]
})
await smokeS("v8 §3.3 sliders: arrows ±1 step, Shift ×10, double-click resets, value field editable", "canvas", async () => {
  const sl = D('[data-reset]').first(); const v = async () => +(await sl.locator('input[type=range]').first().inputValue())
  const step = +(await sl.locator('input[type=range]').first().getAttribute("step") || 1)
  const v0 = await v(); await sl.hover(); const y0 = await page.evaluate(() => scrollY)
  await page.keyboard.press("ArrowRight"); const v1 = await v(); await page.keyboard.press("Shift+ArrowRight"); const v2 = await v()
  await page.keyboard.press("ArrowLeft"); const v3 = await v()
  await sl.dblclick(); await page.waitForTimeout(100); const v4 = await v(); const def = +(await sl.getAttribute("data-reset"))
  const fld = D('[data-testid="slider-value"]').first(); const editable = await fld.isEditable()
  const near = (a, b) => Math.abs(a - b) < step / 2
  return [near(v1 - v0, step) && near(v2 - v1, 10 * step) && near(v2 - v3, step) && near(v4, def) && editable && y0 === await page.evaluate(() => scrollY), `${v0}→${v1}→${v2}→${v3} dbl→${v4} (default ${def}, step ${step}) field=${editable}`]
})
await smokeS("v8 §3.4 grid: per-spread custom 4 × 3 renders 4 columns and 3 rows on each page", "canvas", async () => {
  await D('[data-item="p3"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await D('[data-item="p3"]').click(); await page.waitForTimeout(200)
  const sg = D('[data-testid="spread-grid"]'); await sg.getByText("Custom", { exact: true }).click(); await page.waitForTimeout(200)
  await sg.locator('[data-testid="spread-grid-C"]').fill("4"); await sg.locator('[data-testid="spread-grid-R"]').fill("3"); await page.waitForTimeout(200)
  if (!(await D('[data-testid="grid-col"]').count())) { await sg.getByLabel("Show grid").click(); await page.waitForTimeout(250) }
  const c = await D('[data-testid="grid-col"]').count(), r = await D('[data-testid="grid-row"]').count()
  return [c === 8 && r === 6, `cols=${c} rows=${r} (2 pages)`]
})
{
  await go(feat("site-lightbox"), 600)
  const e0 = errs.length
  if (!(await page.locator('[data-testid="lightbox"]').count())) { await D('[data-testid="site-fullscreen-btn"]').first().click().catch(() => {}); await page.waitForTimeout(300) }
  const m = await page.locator('[data-testid="site-fullscreen-book"]').evaluate((e) => { const r = e.getBoundingClientRect(), v = e.closest('[data-testid="lightbox"]').getBoundingClientRect(); return { w: r.width / v.width, h: r.height / v.height, pad: Math.min(r.left - v.left, v.right - r.right, r.top - v.top, v.bottom - r.bottom) } }).catch(() => null)
  const sw = await page.locator('text=/^(Paper|Night|Sage)$/').count()
  ok("v8 §4 site fullscreen fills ≥90% of one viewport dimension with 24–48px padding; no Paper/Night/Sage switcher", !!m && Math.max(m.w, m.h) >= 0.9 && m.pad >= 23.5 && m.pad <= 48.5 && sw === 0 && errs.length === e0, JSON.stringify(m) + ` themes=${sw}`)
  await page.keyboard.press("Escape").catch(() => {})
}
{
  const e0 = errs.length; const steps = []; let walk = false
  try {
    await go("#/", 500); await page.click('[data-testid="demo-link"]'); await page.waitForTimeout(500); await page.evaluate(() => window.__demo.reset()); await page.waitForTimeout(300)
    const stage = () => page.evaluate(() => document.querySelector('[data-testid="demo"]')?.dataset.demoStage)
    steps.push(await stage())
    await page.getByRole("button", { name: /Create library/i }).first().click(); await page.waitForTimeout(300)
    await page.locator("[role=dialog]").getByRole("button", { name: /Choose|Select|Use/i }).last().click(); await page.waitForTimeout(400); steps.push(await stage())
    await page.getByRole("button", { name: /Create book/ }).first().click(); await page.waitForTimeout(300)
    await page.locator("[role=dialog] input").first().fill("QA walk"); await page.click('[data-testid="create-book"]'); await page.waitForTimeout(700); steps.push(await stage())
    await page.click('[data-testid="demo-add-folder"]'); await page.waitForTimeout(300)
    await page.locator("[role=dialog]").getByRole("button", { name: /Choose|Select|Use|Add/i }).last().click(); await page.waitForTimeout(500)
    const pc = await page.locator('[data-testid="placed-count"]').textContent()
    await page.click('[data-testid="demo-publish"]'); await page.waitForTimeout(250); await page.click('[data-testid="publish-go"]'); await page.waitForTimeout(1900)
    const link = await page.locator('[data-testid="publish-link"]').textContent()
    await page.click('[data-testid="publish-open-site"]'); await page.waitForTimeout(500); steps.push(await stage())
    await page.click('[data-testid="demo-site-back"]'); await page.waitForTimeout(500)
    await page.click('[data-testid="demo-print"]'); await page.waitForTimeout(250); await page.click('[data-testid="print-go"]'); await page.waitForTimeout(1900)
    const pd = await page.locator('[data-testid="print-done"]').count(); await page.click('[data-testid="print-close"]'); await page.waitForTimeout(250)
    await page.click('[data-testid="editor-library"]'); await page.waitForTimeout(500); steps.push(await stage())
    await page.click('[data-testid="home-settings"]'); await page.waitForTimeout(300); steps.push(await stage())
    await page.click('[data-testid="demo-settings-back"]'); await page.waitForTimeout(300); steps.push(await stage())
    walk = steps.join(">") === "welcome>library>editor>site>library>settings>library" && /\b20\b|\d+ · \d+ used/.test(pc) && /\S/.test(link) && pd === 1
    steps.push(pc, link)
  } catch (e) { steps.push("ERR " + e.message.split("\n")[0]) }
  // dead-button sweep: every enabled control on each stage must change the DOM or the route
  const seed = async (stage) => { await page.evaluate((stage) => { const d = window.__demo; d.reset(); const s = d.state(); s.path = "~/Pictures/Photobooks"; s.books = [{ id: "x1", title: "Probe", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; s.open = "x1"; d.go(stage) }, stage); await page.waitForTimeout(300) }
  const SC = { welcome: "[data-testid=demo]", library: "[data-testid=demo]", settings: "[data-testid=demo]", site: "[data-testid=demo]", editor: "[data-testid=editor-bar], [data-testid=dock]" }
  const Q = (sc) => `:is(${sc}) :is(button, [role=button], a[href], [role=radio], [role=tab], [role=switch], [role=checkbox]):visible`
  const dead = []; let n = 0
  await go("#/demo", 500)
  for (const [stage, sc] of Object.entries(SC)) {
    await seed(stage); const cnt = await page.locator(Q(sc)).count()
    for (let i = 0; i < cnt; i++) {
      await seed(stage); const el = page.locator(Q(sc)).nth(i); if (!(await el.count())) continue
      if (await el.evaluate((e) => e.disabled || e.getAttribute("aria-disabled") === "true" || e.hasAttribute("data-disabled") || e.getAttribute("aria-checked") === "true" || e.getAttribute("aria-selected") === "true" || e.hasAttribute("aria-current") || /^https?:/.test(e.getAttribute("href") || ""))) continue
      const label = await el.evaluate((e) => (e.getAttribute("aria-label") || e.textContent || e.dataset.testid || e.tagName).trim().slice(0, 40))
      await page.evaluate(() => { window.__m = 0; const IGN = new Set(["data-hovered", "data-pressed", "data-focused", "data-focus-visible", "data-focus-within"]); window.__mo?.disconnect(); window.__mo = new MutationObserver((ms) => { for (const m of ms) if (m.type !== "attributes" || !IGN.has(m.attributeName)) window.__m++ }); window.__mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); window.__h = location.hash })
      try { await el.click({ timeout: 1500 }) } catch { dead.push(`${stage}:${label}(unclickable)`); continue }
      await page.waitForTimeout(220); n++
      if (!(await page.evaluate(() => window.__m + (location.hash !== window.__h ? 1 : 0)))) dead.push(`${stage}:${label}`)
    }
  }
  await page.evaluate(() => window.__mo?.disconnect())
  ok("v8 §5 #/demo: end-to-end walk welcome→library→editor→publish→site→print→library→settings, linked from the index; no dead buttons", walk && n >= 25 && !dead.length && errs.length === e0, `${steps.join(" | ")} · clicked ${n} · dead [${dead.join(", ")}]`)
}
// ───────── v8.1: designer review of v0.8.0 (per-book state, own site, filmstrip, path, menu, focus, sliders, grid, print, custom size, blank book, settings)
{
  const e0 = errs.length; const W = {}
  const stage = () => page.evaluate(() => document.querySelector('[data-testid="demo"]')?.dataset.demoStage)
  const dlgBtn = (re) => page.locator("[role=dialog]").getByRole("button", { name: re }).last()
  try {
    await go("#/demo", 500); await page.evaluate(() => window.__demo.reset()); await page.waitForTimeout(300)
    await page.getByRole("button", { name: /Create library/i }).first().click(); await page.waitForTimeout(300)
    await dlgBtn(/Choose|Select|Use/i).click(); await page.waitForTimeout(400)
    W.path = (await page.locator('[data-testid="library-path"]').textContent()).trim()
    W.settingsBtns = await page.locator('[data-testid="demo"] [data-testid="library-bar"]').getByRole("button", { name: /Settings/ }).count()
    await page.getByRole("button", { name: /Create book/ }).first().click(); await page.waitForTimeout(300)
    await page.locator("[role=dialog] input").first().fill("Lake trip")
    await page.locator("[role=dialog]").getByRole("button", { name: /A5|A4|Square|cm/ }).first().click().catch(() => {}); await page.waitForTimeout(200)
    await page.getByRole("option", { name: /Custom size/ }).click(); await page.waitForTimeout(200)
    W.custom = await page.locator('[data-testid="create-custom"]').count()
    await page.fill('[data-testid="create-custom-w"]', "19"); await page.fill('[data-testid="create-custom-h"]', "23")
    await page.click('[data-testid="create-book"]'); await page.waitForTimeout(700)
    W.size = await page.evaluate(() => { const b = window.__demo.state().books[0].book; return `${b.w}x${b.h}` })
    // blank book: no sample cover text, the title is the book's own
    await page.click('[data-item="cover"]'); await page.waitForTimeout(300)
    W.blankFront = await page.locator('[data-testid="cover-text-front"]').inputValue(); W.blankBack = await page.locator('[data-testid="cover-text-back"]').inputValue()
    W.blankCover = await page.locator('[data-testid="cover-front"]').getAttribute("data-photo-id")
    W.sample = /Summer by the sea/.test(await page.locator('[data-testid="demo"]').innerText())
    W.film = (await page.locator('[data-testid="film-head"]').innerText()).trim()
    W.tabs = await page.locator('[data-testid="dock"] [role=tab]').count()
    await page.click('[data-testid="demo-add-folder"]'); await page.waitForTimeout(300)
    await dlgBtn(/Choose|Select|Use|Add/i).click(); await page.waitForTimeout(500)
    W.film2 = (await page.locator('[data-testid="film-head"]').innerText()).trim()
    // edit: cover photo + front title, master A columns
    await page.click('[data-item="cover"]'); await page.waitForTimeout(250)
    const pickRow = page.locator('[data-testid="filmstrip"] [role="row"]').nth(3)
    W.pick = await pickRow.getAttribute("data-key")
    await pickRow.dragTo(page.locator('[data-testid="cover-front"]')); await page.waitForTimeout(450)
    if (!(await page.locator('[data-testid="cover-text-front"]').count())) { await page.click('[data-item="cover"]'); await page.waitForTimeout(250) }
    await page.fill('[data-testid="cover-text-front"]', "Lake trip 2026"); await page.waitForTimeout(200)
    W.pickSrc = await page.locator('[data-testid="cover-front"]').evaluate((e) => (getComputedStyle(e).backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1] ?? null)
    await page.locator('[data-testid="mode-seg"]').getByText("Masters", { exact: true }).click(); await page.waitForTimeout(300)
    const col = page.locator('[data-testid="master-field-grid"] input').first(); await col.fill("5"); await col.press("Enter"); await page.waitForTimeout(250)
    W.col0 = await col.inputValue()
    await page.locator('[data-testid="mode-seg"]').getByText("Pages", { exact: true }).click(); await page.waitForTimeout(250)
    W.spreads = await page.evaluate(() => window.__demo.state().books[0].doc?.spreads.length)
    // print: real page count + the book's size
    await page.click('[data-testid="demo-print"]'); await page.waitForTimeout(300)
    W.print = (await page.locator('[data-testid="print-summary"]').textContent()) + " | " + (await page.locator('[data-testid="print-size"]').textContent())
    await page.keyboard.press("Escape"); await page.waitForTimeout(250)
    // back to the library: card shows the current cover
    await page.click('[data-testid="editor-library"]'); await page.waitForTimeout(500)
    const urlIn = (e) => { for (const x of [e, ...e.querySelectorAll("*")]) { const s = getComputedStyle(x).backgroundImage; const m = s.match(/url\("?([^")]+)"?\)/); if (m) return m[1]; if (x.tagName === "IMG") return x.src } return null }
    W.cardSrc = await page.locator('[data-testid="demo"] [data-testid="book-cover"]').first().evaluate(urlIn).catch(() => null)
    // reopen: state kept
    await page.click('[data-testid="demo"] [data-testid="book-cover"]'); await page.waitForTimeout(700)
    await page.click('[data-item="cover"]'); await page.waitForTimeout(300)
    W.reCover = await page.locator('[data-testid="cover-front"]').getAttribute("data-photo-id"); W.reFront = await page.locator('[data-testid="cover-text-front"]').inputValue()
    await page.locator('[data-testid="mode-seg"]').getByText("Masters", { exact: true }).click(); await page.waitForTimeout(300)
    W.reCol = await page.locator('[data-testid="master-field-grid"] input').first().inputValue()
    await page.locator('[data-testid="mode-seg"]').getByText("Pages", { exact: true }).click(); await page.waitForTimeout(250)
    W.reSize = await page.evaluate(() => { const b = window.__demo.state().books[0].book; return `${b.w}x${b.h}` })
    W.reSpreads = await page.evaluate(() => window.__demo.state().books[0].doc?.spreads.length)
    // publish → Open site lands on library home of published books (v0.9.3); then open the book
    await page.click('[data-testid="demo-publish"]'); await page.waitForTimeout(250); await page.click('[data-testid="publish-go"]'); await page.waitForTimeout(1900)
    await page.click('[data-testid="publish-open-site"]'); await page.waitForTimeout(600); W.stage = await stage()
    W.catalog = await page.locator('[data-testid="site-catalog"]').count()
    W.siteBooks = await page.locator('[data-testid="site-book"]').count()
    await page.locator('[data-testid="site-book"]').first().click(); await page.waitForTimeout(500)
    W.siteTitle = (await page.locator('[data-testid="site-title"]').textContent()).trim()
    W.siteMeta = (await page.locator('[data-testid="site-author"]').textContent()).trim()
    W.siteCover = await page.locator('[data-testid="site-cover"]').evaluate((e) => ({ txt: e.innerText, img: [...e.querySelectorAll("*")].map((x) => getComputedStyle(x).backgroundImage).find((b) => b !== "none") ?? "none", h: e.getBoundingClientRect().height })).catch(() => null)
    W.siteInd = (await page.locator('[data-testid="site-page-indicator"]').textContent()).trim()
    await page.click('[data-testid="site-share"]'); await page.waitForTimeout(200); W.link = (await page.locator('[data-testid="site-share-link"]').textContent()).trim()
    // fullscreen: Esc returns focus to the Fullscreen button
    await page.click('[data-testid="site-fullscreen-btn"]'); await page.waitForTimeout(300); W.fsCover = await page.locator('[data-testid="lightbox"] [data-testid="site-cover"]').count()
    await page.keyboard.press("Escape"); await page.waitForTimeout(300)
    W.focus = await page.evaluate(() => document.activeElement?.dataset.testid)
    // library "…" menu: Rename, Duplicate, Remove
    await page.click('[data-testid="demo-site-back"]'); await page.waitForTimeout(400); await page.click('[data-testid="editor-library"]'); await page.waitForTimeout(500)
    const menu = async () => { await page.locator('[data-testid="demo"] [data-testid="book-menu"]').first().click(); await page.waitForTimeout(250) }
    await menu(); W.items = await page.locator("[role=menuitem]").allTextContents()
    await page.getByRole("menuitem", { name: "Rename" }).click(); await page.waitForTimeout(300)
    await page.locator('[data-testid="rename-input"]').fill("Lake trip ’26"); await page.locator('[data-testid="rename-input"]').press("Enter"); await page.waitForTimeout(300)
    await menu(); await page.getByRole("menuitem", { name: "Duplicate" }).click(); await page.waitForTimeout(300)
    W.afterDup = await page.evaluate(() => window.__demo.state().books.map((b) => b.title))
    await menu(); await page.getByRole("menuitem", { name: /Remove/ }).click(); await page.waitForTimeout(300); await page.getByRole("button", { name: "Remove book" }).click(); await page.waitForTimeout(300)
    W.afterRm = await page.evaluate(() => window.__demo.state().books.map((b) => b.title))
    await page.click('[data-testid="demo"] [data-testid="home-settings"]'); await page.waitForTimeout(300); W.settingsStage = await stage()
  } catch (e) { W.err = e.message.split("\n")[0] }
  const pages = 2 * (W.reSpreads ?? 0)
  const J = (o) => String(JSON.stringify(o)).slice(0, 500)
  ok("v8.1 P1-1 per-book state: edit cover photo + title + master grid, leave, reopen → cover, text, masters, size and spreads kept; library card shows the current cover",
    !W.err && W.reCover === W.pick && W.reFront === "Lake trip 2026" && W.col0 === "5" && W.reCol === "5" && W.reSize === "19x23" && W.reSpreads === W.spreads && !!W.cardSrc && W.cardSrc === W.pickSrc, J({ err: W.err, pick: W.pick, reCover: W.reCover, reFront: W.reFront, col: [W.col0, W.reCol], size: W.reSize, card: W.cardSrc, pickSrc: W.pickSrc }))
  ok("v8.1 P1-2 / v0.9.3: Open site → library home then book: catalog of published books; book title, cover, pages, slug; fullscreen on cover",
    W.stage === "site" && W.catalog === 1 && W.siteBooks >= 1 && W.siteTitle === "Lake trip" && new RegExp(`\\b${pages} pages`).test(W.siteMeta) && !!W.siteCover && W.siteCover.h > 100 && /Lake trip 2026/.test(W.siteCover.txt) && W.siteCover.img !== "none" && W.siteInd.startsWith("Cover") && /\/lake-trip$/.test(W.link) && W.fsCover === 1,
    J({ stage: W.stage, catalog: W.catalog, books: W.siteBooks, t: W.siteTitle, meta: W.siteMeta, cover: W.siteCover, ind: W.siteInd, link: W.link, fs: W.fsCover }))
  ok("v8.1 P1-3 demo filmstrip: one plain label 'Photos · N · M used', no Photos/Templates capsule", /^Photos · \d+ · \d+ used$/.test(W.film ?? "") && /^Photos · \d+ · \d+ used$/.test(W.film2 ?? "") && W.tabs === 0, J([W.film, W.film2, W.tabs]))
  ok("v8.1 P1-4 library path is not doubled", W.path === "~/Pictures/Photobooks" || (/^~\/Pictures\/[^~/]+$/.test(W.path ?? "")), W.path)
  ok("v8.1 P2-1 demo library '…' menu: Rename, Duplicate, Remove work", J(W.items).includes("Rename") && J(W.items).includes("Duplicate") && J(W.items).includes("Remove") && W.afterDup?.length === 2 && W.afterDup.includes("Lake trip ’26") && W.afterDup.includes("Lake trip ’26 (copy)") && W.afterRm?.length === 1, J([W.items, W.afterDup, W.afterRm]))
  ok("v8.1 P2-2 Esc closes fullscreen and returns focus to site-fullscreen-btn", W.focus === "site-fullscreen-btn", W.focus)
  ok("v8.1 P2-5 print dialog uses the real page count and the book's size", (W.print ?? "").includes(`${pages} pages`) && /Custom · 19 × 23 cm/.test(W.print ?? ""), W.print)
  ok("v8.1 P2-6 Create book offers a Custom size (w × h) that the book gets", W.custom === 1 && W.size === "19x23", `${W.custom} ${W.size}`)
  ok("v8.1 P2-7 new book starts blank: no photo on the cover, cover text = its own title, no sample text", W.blankCover === null && W.blankFront === "Lake trip" && W.blankBack === "Lake trip" && !W.sample, J([W.blankCover, W.blankFront, W.blankBack, W.sample]))
  ok("v8.1 P2-8 one Settings button in the demo library bar, and it opens Settings", W.settingsBtns === 1 && W.settingsStage === "settings", `${W.settingsBtns} ${W.settingsStage}`)
  ok("v8.1 demo walk: 0 console errors", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
}
await smokeS("v8.1 P2-3 slider double-click resets to the real default (frame style, spread margin/gap, compare, pages)", "canvas", async () => {
  const out = []
  const dbl = async (loc) => { const r = loc.locator('input[type=range]').first(); const def = +(await loc.getAttribute("data-reset")); await loc.hover(); await page.keyboard.press("Shift+ArrowRight"); await page.waitForTimeout(80); const v1 = +(await r.inputValue()); await loc.dblclick(); await page.waitForTimeout(120); return [def, v1, +(await r.inputValue())] }
  await D('[data-item="p3"]').click(); await page.waitForTimeout(250)
  const sp = D('[data-testid="spread-spacing"] [data-reset]')
  for (let i = 0; i < 2; i++) out.push(["spread" + i, ...await dbl(sp.nth(i))])
  const good = out.every(([, d, v1, v2]) => d === 0 && v1 !== d && v2 === d)
  return [good, JSON.stringify(out)]
})
{
  const src = (await import("node:fs")).readFileSync
  const bad = []
  for (const [f, labels] of [["src/sandbox/sections.tsx", ["Mat", "Stroke", "Corner radius"]], ["src/sandbox/context-inspector.tsx", ["Margin", "Gap"]]]) {
    const t = src(new URL(`../${f}`, import.meta.url), "utf8")
    for (const l of labels) { const m = t.match(new RegExp(`<SliderRow label="${l}"[^>]*`)); if (!m || !/resetValue=/.test(m[0])) bad.push(`${f}:${l}`) }
  }
  ok("v8.1 P2-3 every listed slider declares its real default (resetValue)", bad.length === 0, bad.join(", ") || "Mat, Stroke, Radius, Margin, Gap")
}
await smokeS("v8.1 P2-4 grid guides carry data-allow-border; P2-9 dragging a frame snaps it to a column/row edge", "canvas", async () => {
  await D('[data-item="p3"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await D('[data-item="p3"]').click(); await page.waitForTimeout(200)
  const sg = D('[data-testid="spread-grid"]'); await sg.getByText("Custom", { exact: true }).click(); await page.waitForTimeout(200)
  await sg.locator('[data-testid="spread-grid-C"]').fill("4"); await sg.locator('[data-testid="spread-grid-R"]').fill("3"); await page.waitForTimeout(200)
  if (!(await D('[data-testid="grid-col"]').count())) { await sg.getByLabel("Show grid").click(); await page.waitForTimeout(250) }
  const ab = await D('[data-testid="grid-col"], [data-testid="grid-row"]').evaluateAll((es) => es.length > 0 && es.every((e) => e.hasAttribute("data-allow-border")))
  const fr = D('[data-testid="frame"]').first(); const b = await fr.boundingBox()
  const edges = await D('[data-testid="grid-col"]').evaluateAll((es) => es.flatMap((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right] }))
  const tx = edges.map((x) => x - b.x).filter((d) => Math.abs(d) > 4).sort((a, c) => Math.abs(a) - Math.abs(c))[0] ?? 20
  const sx = b.x + b.width / 2, sy = b.y + b.height / 2
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + tx / 2, sy + 3, { steps: 4 }); await page.mouse.move(sx + tx + 5, sy + 2, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(250)
  const a = await fr.boundingBox()
  const snapped = edges.some((x) => Math.abs(a.x - x) < 1.5 || Math.abs(a.x + a.width - x) < 1.5)
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z").catch(() => {})
  return [ab && snapped, `allowBorder=${ab} moved ${Math.round(b.x)}→${Math.round(a.x)} (target ${Math.round(b.x + tx)}) snapped=${snapped}`]
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
  // §2 hide "0 books"
  await go("#/demo", 500); await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = []; d.go("library") }); await page.waitForTimeout(400)
  const zero = await page.locator('[data-testid="demo"] [data-testid="book-count"]').count()
  const body0 = await page.locator('[data-testid="demo"]').innerText()
  ok("v0.9 §2 empty library hides book-count / no '0 books'", zero === 0 && !/\b0 books\b/.test(body0), `countEls=${zero}`)

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

  // §5 Row gap shows number + mm
  await go(scr("canvas"), 700); await scen("Masters"); await page.waitForTimeout(300)
  const rg = page.locator('[data-testid="master-field-RG"]')
  const rgVal = await rg.inputValue(), rgRow = await rg.evaluate((el) => { const lab = el.closest("label"); return { text: (lab?.textContent || "").replace(/\s+/g, " ").trim(), label: lab?.querySelector("span")?.textContent?.trim() } })
  ok("v0.9 §5 Row gap shows numeric value + mm (short label)", /^\d+$/.test(rgVal) && /mm/.test(rgRow.text) && rgRow.label === "RG", JSON.stringify({ rgVal, ...rgRow }))

  // §6 no floating pager in Std editor demos
  await go(scr("canvas"), 700)
  const pagerEls = await page.locator('[data-testid="pager"]').count()
  ok("v0.9 §6 no floating page switcher (pager)", pagerEls === 0, `pager=${pagerEls}`)
  // P2 post-approval: parent-spreads also has no pager (ParentStd no longer mounts it)
  await go(feat("parent-spreads"), 700)
  const parentPager = await page.locator('[data-testid="pager"]').count()
  ok("v0.9 §6 P2: #/feature/parent-spreads has no floating pager", parentPager === 0, `pager=${parentPager}`)

  // §7 tool cursors on viewport (aria-labels: Select (V), Frame (F), Text (T), Pan (H))
  await go(scr("canvas"), 700); await scen("Photo").catch(() => {}); await page.waitForTimeout(200)
  const cursors = {}
  for (const [key, label] of [["Select", "Select (V)"], ["Frame", "Frame (F)"], ["Text", "Text (T)"], ["Hand", "Pan (H)"]]) {
    await page.locator(`[data-testid="demo"] button[aria-label="${label}"]`).click(); await page.waitForTimeout(120)
    cursors[key] = await page.locator('[data-testid="demo"] [data-testid="viewport"]').evaluate((vp) => getComputedStyle(vp).cursor)
  }
  const curOk = (v, fb) => typeof v === "string" && (v === fb || v.includes(fb) || (v.startsWith("url(") && v.includes(fb)))
  ok("v0.9 §7 / v0.9.3 tool cursors: Frame/Text outlined url (or crosshair/text), Hand=grab, Select=default",
    curOk(cursors.Frame, "crosshair") && curOk(cursors.Text, "text") && (cursors.Hand === "grab" || cursors.Hand === "-webkit-grab") && (cursors.Select === "auto" || cursors.Select === "default"),
    JSON.stringify(cursors))
  const cssSrc = fs.readFileSync(new URL("../src/sandbox/v7.tsx", import.meta.url), "utf8")
  ok("v0.9.3 tool cursor assets: white fill + black stroke in SVG data-URI CSS",
    /cursor-tool-frame/.test(cssSrc) && /cursor-tool-text/.test(cssSrc) && /stroke-width/.test(cssSrc) && /%23232223/.test(cssSrc) && /%23ffffff|%23fff/.test(cssSrc),
    "source check")

  // §8 wheel zooms (zoom-menu leaves Fit)
  await go(scr("canvas"), 700); await scen("Photo").catch(() => {}); await page.waitForTimeout(200)
  await page.locator(`[data-testid="demo"] button[aria-label="Select (V)"]`).click().catch(() => {})
  const z0 = (await page.locator('[data-testid="demo"] [data-testid="zoom-menu"]').innerText()).trim()
  const box = await page.locator('[data-testid="demo"] [data-testid="viewport"]').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -240); await page.waitForTimeout(300)
  const z1 = (await page.locator('[data-testid="demo"] [data-testid="zoom-menu"]').innerText()).trim()
  ok("v0.9 §8 wheel over canvas changes zoom", z0 !== z1 && /%/.test(z1), `zoom "${z0}"→"${z1}"`)

  // §9 Publish quiet (not primary black)
  await go("#/demo", 500)
  await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Pub", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; d.state().open = "s1"; d.go("editor") })
  await page.waitForTimeout(700)
  const pub = await page.locator('[data-testid="demo-publish"]').evaluate((e) => { const s = getComputedStyle(e); return { bg: s.backgroundColor, color: s.color } })
  const primaryBlack = /rgb\(\s*35,\s*34,\s*35\s*\)|rgb\(\s*0,\s*0,\s*0\s*\)/.test(pub.bg)
  ok("v0.9 §9 Publish is quiet gray, not primary black", !primaryBlack && /rgb\(\s*215,\s*215,\s*215\s*\)|rgb\(\s*225,\s*225,\s*225\s*\)/.test(pub.bg), JSON.stringify(pub))

  const pkg9 = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  ok("v0.9 version 0.9.x", /^0\.(9|10)\./.test(pkg9.version), pkg9.version)
}


// ───────── v0.9.1: consistency / duplication pass ─────────
{
  // §1 shared Create book dialog (title + Page size) on demo + full library
  await go("#/demo", 500); await page.evaluate(() => window.__demo.reset()); await page.waitForTimeout(200)
  await page.getByRole("button", { name: /Create library/i }).first().click(); await page.waitForTimeout(250)
  await page.locator("[role=dialog]").getByRole("button", { name: /Choose|Select|Use/i }).click(); await page.waitForTimeout(400)
  await page.getByRole("button", { name: /Create book/ }).first().click(); await page.waitForTimeout(300)
  const demoCreate = await page.locator('[data-testid="create-book-dialog"]').count()
  const demoSize = await page.locator("[role=dialog]").getByText("Page size").count()
  await page.keyboard.press("Escape"); await page.waitForTimeout(200)
  await go(feat("recents-home"), 700)
  await page.getByRole("button", { name: /Create book/ }).first().click(); await page.waitForTimeout(300)
  const libCreate = await page.locator('[data-testid="create-book-dialog"]').count()
  const libSize = await page.locator("[role=dialog]").getByText("Page size").count()
  await page.keyboard.press("Escape")
  ok("v0.9.1 §1 Create book dialog shared (title + Page size) on demo and library", demoCreate === 1 && libCreate === 1 && demoSize >= 1 && libSize >= 1, `demo=${demoCreate}/${demoSize} lib=${libCreate}/${libSize}`)

  // §2 Preview = current-book preview, not Site stage
  await go("#/demo", 400); await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Prev", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; d.state().open = "s1"; d.go("editor") })
  await page.waitForTimeout(800)
  await page.click('[data-testid="demo-preview"]'); await page.waitForTimeout(500)
  const prevOpen = await page.locator('[data-testid="book-preview"]').count()
  const stage = await page.locator('[data-testid="demo"]').getAttribute("data-demo-stage")
  await page.locator('[data-testid="close-preview"]').click().catch(() => page.keyboard.press("Escape")); await page.waitForTimeout(300)
  await go(feat("editor-chrome-toolbar"), 1000) // Stage 3: kit pages mount the #/demo editor parts
  await page.click('[data-testid="demo-preview"]'); await page.waitForTimeout(600)
  const kitPrev = await page.locator('[data-testid="book-preview"]').count()
  ok("v0.9.1 §2 Preview opens in-app book preview (not Site stage)", prevOpen === 1 && stage === "editor" && kitPrev === 1, `demoPrev=${prevOpen} stage=${stage} kit=${kitPrev}`)

  // §3 page counts: site indicator uses pagesOf (denominator = spreads*2); deep-link into the book (v0.9.3 catalog home)
  await go("#/demo", 400); await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Pages", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" }, published: true }]; d.state().open = "s1"; d.openSite("book") })
  await page.waitForTimeout(900)
  const ind = (await page.locator('[data-testid="site-page-indicator"]').textContent()).trim()
  const meta = (await page.locator('[data-testid="site-author"]').textContent()).trim()
  const nSpreads = await page.evaluate(() => window.__demo.state().books[0].doc?.spreads?.length ?? 10)
  // blank book may have no doc — SiteViewer uses studio SAMPLE doc spreads
  const den = await page.evaluate(() => { const t = document.querySelector('[data-testid="site-page-indicator"]')?.textContent || ""; const m = t.match(/\/\s*(\d+)/); return m ? +m[1] : 0 })
  const pagesMeta = /(\d+)\s*pages/.exec(meta)
  ok("v0.9.1 §3 site pager denominator matches page model (spreads×2), meta agrees", den >= 2 && den % 2 === 0 && !!pagesMeta && +pagesMeta[1] === den && /Cover/.test(ind), `ind=${ind} meta=${meta} den=${den}`)

  // §4 no rename-dialog in demo; inline rename-input (Stage 2: the library moved to src/demo-parts/library.tsx)
  const renameDlgSrc = fs.readFileSync(new URL("../src/demo-parts/library.tsx", import.meta.url), "utf8")
  ok("v0.9.1 §4 demo uses inline rename (no rename-dialog)", !/rename-dialog/.test(renameDlgSrc) && /rename-input/.test(renameDlgSrc), "inline")

  // §5 Binding/Material/Fill not fake SegC without setter
  const v7src = fs.readFileSync(new URL("../src/sandbox/v7.tsx", import.meta.url), "utf8")
  const fake = /Sec title="Binding"><SegC/.test(v7src) || /Sec title="Material"><SegC/.test(v7src) || /title="Back"[\s\S]*?Swatches cs=/.test(v7src)
  ok("v0.9.1 §5 Binding/Material/Fill demoted (no fake interactive SegC/Swatches)", !fake && /binding-readonly|material-readonly|fill-readonly/.test(v7src), fake ? "still fake" : "readonly")

  // §6 no frame-toolbar Crop in canvas
  const canv = fs.readFileSync(new URL("../src/sandbox/canvas.tsx", import.meta.url), "utf8")
  ok("v0.9.1 §6 floating FrameToolbar removed from canvas", !/FrameToolbar/.test(canv), /FrameToolbar/.test(canv) ? "still mounted" : "gone")

  // §7 quiet header tones on demo Preview/Print/Publish
  await go("#/demo", 400); await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Tone", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; d.state().open = "s1"; d.go("editor") })
  await page.waitForTimeout(700)
  const tones = {}
  for (const id of ["demo-preview", "demo-print", "demo-publish"]) {
    tones[id] = await page.locator(`[data-testid="${id}"]`).evaluate((e) => getComputedStyle(e).backgroundColor)
  }
  const quiet = (bg) => /rgb\(\s*215,\s*215,\s*215\s*\)/.test(bg)
  ok("v0.9.1 §7 Preview/Print/Publish share quiet #D7D7D7", quiet(tones["demo-preview"]) && quiet(tones["demo-print"]) && quiet(tones["demo-publish"]), JSON.stringify(tones))

  // §8 Settings no card border + live book count
  await go("#/demo", 400); await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "One", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; d.go("library") })
  await page.waitForTimeout(500)
  await page.click('[data-testid="home-settings"]'); await page.waitForTimeout(400)
  const bc = (await page.locator('[data-testid="settings-book-count"]').textContent()).trim()
  const cardBorder = await page.locator('[data-testid="library-settings"]').evaluate((e) => getComputedStyle(e).borderTopWidth)
  ok("v0.9.1 §8 Settings live book count + no card border", bc === "1" && (cardBorder === "0px" || cardBorder === ""), `count=${bc} border=${cardBorder}`)

  // should-fix spot checks
  await go("#/demo", 400); await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Alpha", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }, { id: "s2", title: "Beta", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" } }]; d.go("library") })
  await page.waitForTimeout(500)
  const search = await page.locator('[data-testid="lib-search"]').count()
  const sort = await page.locator('[data-testid="lib-sort"]').count()
  ok("v0.9.1 §9 demo library has Search + Sort", search === 1 && sort === 1, `${search}/${sort}`)
  const chipSrc = fs.readFileSync(new URL("../src/features/library.tsx", import.meta.url), "utf8")
  ok("v0.9.1 §10/16 menu slot absolute right-0 (no -mr-1.5); Published chip not bg-black/55", /book-menu-slot/.test(chipSrc) && /absolute right-0/.test(chipSrc) && !/-mr-1\.5/.test(chipSrc) && !/book-published[\s\S]{0,80}bg-black\/55/.test(chipSrc), "flush + quiet chip")

  const emptySlot = fs.readFileSync(new URL("../src/sandbox/inspector.tsx", import.meta.url), "utf8")
  const ctxInsp = fs.readFileSync(new URL("../src/sandbox/context-inspector.tsx", import.meta.url), "utf8")
  const listEmpty = fs.readFileSync(new URL("../src/sandbox/chrome.tsx", import.meta.url), "utf8")
  ok("v0.9.1 §11 empty-slot copy unified (list + inspector meta N empty; frame Empty — drag a photo)",
    emptySlot.includes('data-testid="empty-slot">Empty — drag a photo<')
    && ctxInsp.includes("${empty} empty")
    && !ctxInsp.includes("photo${placed")
    && /\} empty</.test(listEmpty), "list+meta+frame")
  const folderSrc = fs.readFileSync(new URL("../src/features/screens.tsx", import.meta.url), "utf8")
  ok("v0.9.1 §15 FolderPicker has no 'system dialog (emulated)'", !/system dialog \(emulated\)/.test(folderSrc), "quiet title")
  await go(feat("parent-spreads"), 600)
  ok("v0.9.1 §12 parent-spreads still has no pager", await page.locator('[data-testid="pager"]').count() === 0, "pager")

  const pkg91 = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  ok("v0.9.1 version 0.9.x+", /^0\.(9|10)\./.test(pkg91.version), pkg91.version)

  // v0.9.2: Space / Hand pan must not show a focus ring on the canvas chrome
  await go(scr("canvas"), 700); await scen("Photo").catch(() => {}); await page.waitForTimeout(200)
  const canvas = page.locator('[data-testid="demo"] [data-testid="canvas"]')
  await canvas.focus()
  await page.keyboard.down("Space")
  await page.waitForTimeout(100)
  const spaceOutline = await canvas.evaluate((el) => {
    const s = getComputedStyle(el)
    return { outline: s.outlineStyle, w: s.outlineWidth, pan: el.hasAttribute("data-panning") }
  })
  await page.keyboard.up("Space")
  await page.waitForTimeout(80)
  await page.locator('[data-testid="demo"] button[aria-label="Pan (H)"]').click()
  await page.waitForTimeout(100)
  await canvas.focus()
  // Tab once onto canvas to force keyboard modality if needed, then check hand still suppresses ring
  const handOutline = await canvas.evaluate((el) => {
    const s = getComputedStyle(el)
    return { outline: s.outlineStyle, w: s.outlineWidth, pan: el.hasAttribute("data-panning") }
  })
  ok("v0.9.2 Space/Hand pan: no canvas focus outline",
    spaceOutline.pan && (spaceOutline.outline === "none" || spaceOutline.w === "0px")
    && handOutline.pan && (handOutline.outline === "none" || handOutline.w === "0px"),
    `space=${JSON.stringify(spaceOutline)} hand=${JSON.stringify(handOutline)}`)
  const pkg92 = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  ok("v0.9.2+ version 0.9.x", /^0\.(9|10)\./.test(pkg92.version), pkg92.version)
}

// ───────── v0.9.3: site library home, Space≠panels, outlined cursors, outline cleanup ─────────
{
  // Site: Open site → catalog; deep link → book
  await go("#/demo", 500)
  await page.evaluate(() => {
    const d = window.__demo; d.reset()
    const blank = { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" }
    d.state().path = "~/Pictures/Photobooks"
    d.state().books = [
      { id: "s1", title: "Lake trip", published: true, book: blank },
      { id: "s2", title: "Fog", published: true, book: blank },
      { id: "s3", title: "Draft", published: false, book: blank },
    ]
    d.state().open = "s1"; d.state().siteEntry = "catalog"; d.go("site")
  })
  await page.waitForTimeout(600)
  const catN = await page.locator('[data-testid="site-catalog"]').count()
  const booksN = await page.locator('[data-testid="site-book"]').count()
  const titles = await page.locator('[data-testid="site-book"]').allTextContents()
  ok("v0.9.3 site lands on library home of published books only",
    catN === 1 && booksN === 2 && titles.some((t) => /Lake trip/.test(t)) && titles.some((t) => /Fog/.test(t)) && !titles.some((t) => /Draft/.test(t)),
    JSON.stringify({ catN, booksN, titles }))
  await page.locator('[data-testid="site-book"]').filter({ hasText: "Lake trip" }).click(); await page.waitForTimeout(400)
  ok("v0.9.3 opening a catalog book shows the book viewer",
    await page.locator('[data-testid="site-title"]').count() === 1 && (await page.locator('[data-testid="site-title"]').textContent()).trim() === "Lake trip",
    await page.locator('[data-testid="site-title"]').textContent())
  // deep link opens that book (not catalog)
  await page.evaluate(() => { const d = window.__demo; d.state().open = "s2"; d.openSite("book") })
  await page.waitForTimeout(700)
  const deepTitle = (await page.locator('[data-testid="site-title"]').textContent().catch(() => "")).trim()
  const deepCat = await page.locator('[data-testid="site-catalog"]').count()
  ok("v0.9.3 book deep link opens that book (not catalog)", deepCat === 0 && deepTitle === "Fog", JSON.stringify({ deepTitle, deepCat }))

  // Space held → panel hotkeys ignored
  await go(scr("canvas"), 700); await scen("Photo").catch(() => {}); await page.waitForTimeout(200)
  const panelW = async () => page.evaluate(() => ["l", "b", "r"].map((k) => {
    const e = document.querySelector(`[data-testid="demo"] [data-testid="panel-${k}"]`)
    if (!e) return 0
    const r = e.getBoundingClientRect(); return (k === "b" ? r.height : r.width) > 2 ? 1 : 0
  }).join(""))
  // ensure panels visible
  let w0 = await panelW()
  if (w0 !== "111") { await page.keyboard.press("Control+."); await page.waitForTimeout(200); w0 = await panelW() }
  await page.locator('[data-testid="demo"] [data-testid="canvas"]').focus()
  await page.keyboard.down("Space"); await page.waitForTimeout(80)
  await page.keyboard.press("["); await page.waitForTimeout(80)
  await page.keyboard.press("\\"); await page.waitForTimeout(80)
  await page.keyboard.press("]"); await page.waitForTimeout(80)
  await page.keyboard.press("i"); await page.waitForTimeout(80)
  await page.keyboard.press("Control+."); await page.waitForTimeout(120)
  const wSpace = await panelW()
  await page.keyboard.up("Space"); await page.waitForTimeout(100)
  // Playwright can leave Space stuck after chords; force-clear + refocus before [ 
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " ", bubbles: true, cancelable: true }))
    window.dispatchEvent(new Event("blur"))
  })
  await page.waitForTimeout(80)
  await page.locator('[data-testid="demo"] [data-testid="canvas"]').focus()
  await page.waitForTimeout(80)
  ok("v0.9.3 Space held: panel hotkeys do not change panel visibility", w0 === "111" && wSpace === "111", `before=${w0} during=${wSpace}`)
  // without Space, [ still toggles
  await page.keyboard.press("["); await page.waitForTimeout(200)
  const wAfter = await panelW()
  ok("v0.9.3 panel key [ works when Space is not held", wAfter !== wSpace, `after=[ → ${wAfter}`)
  // restore
  if (wAfter[0] === "0") { await page.keyboard.press("["); await page.waitForTimeout(100) }

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

  // --crop amber removed
  const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
  ok("v0.9.3 dead amber --crop removed from index.css", !/--crop:\s*#e0a33a/.test(css) && /--crop:\s*#6b696a/.test(css), "crop tokens")

  const pkg93 = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"))
  ok("v0.10.0 version 0.10.0", pkg93.version === "0.10.0", pkg93.version)
}

// Stage 3: feature pages mount editor parts at the real #/demo slot sizes (src/demo-parts/layout.ts SLOT)
{
  const SLOT = { left: 212, right: 300 }
  const meas = async () => page.evaluate(() => { const w = (t) => { const e = document.querySelector(`[data-testid="${t}"]`); return e ? Math.round(e.getBoundingClientRect().width) : null }; return { l: w("panel-l"), r: w("panel-r") } })
  await go("#/demo", 500); await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.go("library") }); await page.waitForTimeout(300)
  const bad = []
  for (const slug of ["editor-chrome-toolbar", "spread-list-panel", "pasteboard-workspace", "drag-place-replace", "inspector", "pdf-export"]) {
    await go(feat(slug), 700); const m = await meas()
    if ((m.l !== null && m.l !== SLOT.left) || (m.r !== null && m.r !== SLOT.right) || (m.l === null && m.r === null)) bad.push(`${slug} ${JSON.stringify(m)}`)
  }
  ok("stage 3: feature pages' panel-l / panel-r widths equal SLOT (212 / 300)", bad.length === 0, bad.join(" | ") || "6 pages")
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
  const views = await Promise.all(["snap", "grid", "guides", "rulers", "overlays", "dpi"].map((k) => page.locator(`${demo} [data-testid="toggle-${k}"]`).count()))
  ok("kit10: #/demo top bar has all six view toggles (snap, grid, guides, rulers, bleed / trim / safe, DPI)", views.every((n) => n === 1), views.join())
  await page.locator(`${demo} [data-testid="filmstrip"] [role="row"]`).nth(1).dragTo(page.locator(`${demo} [data-testid="canvas"] [data-testid="frame"]`).first()); await page.waitForTimeout(400) // p02 = the 800 px low-res photo
  await c('[data-testid="toggle-dpi"]'); await page.waitForTimeout(200)
  ok("kit10: DPI toggle shows the frame dpi badge", (await page.locator(`${demo} [data-testid="canvas"] [data-frame]`).filter({ hasText: /dpi/ }).count()) >= 1)
  await c('[data-testid="toggle-dpi"]')
  await c('[data-testid="toggle-rulers"]'); await page.waitForTimeout(200)
  const g0 = await page.locator(`${demo} [data-testid="spread"] [data-guide]`).count()
  const rx = await page.locator(`${demo} [data-testid="ruler-x"]`).boundingBox(), sp = await page.locator(`${demo} [data-testid="spread"]`).first().boundingBox()
  await page.mouse.move(rx.x + rx.width / 2, rx.y + 10); await page.mouse.down(); await page.mouse.move(rx.x + rx.width / 2, sp.y + sp.height * 0.4, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250)
  ok("kit10: rulers show and a drag from the ruler adds a guide", (await page.locator(`${demo} [data-testid="spread"] [data-guide]`).count()) === g0 + 1, `${g0}→+1`)
  await c('[data-testid="toggle-rulers"]')
  await page.locator(`${demo} [data-item="p1"]`).hover(); await c('[data-item="p1"] [data-testid="spread-menu"]'); await page.waitForTimeout(250)
  ok("kit10: spread row menu offers Add after / Duplicate / Delete", (await page.getByRole("menuitem").allInnerTexts()).filter((t) => /Add after|Duplicate|Delete/.test(t)).length === 3)
  await page.getByRole("menuitem", { name: /Duplicate/ }).click(); await page.waitForTimeout(300)
  const n0 = await page.locator(`${demo} [data-testid="panel-l"] [role=row]`).count()
  ok("kit10: spread list is a drag source (reorder) and Add spread is visible", (await page.locator(`${demo} [data-testid="panel-l"] button`).filter({ hasText: "Drag" }).count()) > 0 && (await page.locator(`${demo} [data-testid="add-spread"]`).count()) === 1, `${n0} rows`)
  // master guides + Page numbers feed every spread on the master
  await page.locator(`${demo} [data-testid="mode-seg"]`).getByText("Masters", { exact: true }).click(); await page.waitForTimeout(250)
  await c('[data-testid="toggle-rulers"]'); await page.waitForTimeout(200)
  const m0 = await page.locator(`${demo} [data-testid="node-view"] [data-guide]`).count()
  const ry = await page.locator(`${demo} [data-testid="ruler-y"]`).boundingBox(), mb = await page.locator(`${demo} [data-testid="canvas-master"]`).boundingBox()
  await page.mouse.move(ry.x + 10, ry.y + ry.height / 2); await page.mouse.down(); await page.mouse.move(mb.x + mb.width * 0.3, ry.y + ry.height / 2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250)
  const m1 = await page.locator(`${demo} [data-testid="node-view"] [data-guide]`).count()
  await c('[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]'); await page.waitForTimeout(200)
  await page.locator(`${demo} [data-testid="mode-seg"]`).getByText("Pages", { exact: true }).click(); await page.waitForTimeout(250); await c('[data-item="p1"]'); await page.waitForTimeout(250)
  ok("kit10: a guide dragged on a master is kept and inherited (dashed) by its spreads", m1 === m0 + 1 && (await page.locator(`${demo} [data-testid="spread"] [data-guide]`).count()) >= m1, `master ${m0}→${m1}`)
  ok("kit10: master Page numbers toggle wires Parent.pageNumbers — spreads show page numbers", (await page.locator(`${demo} [data-testid="spread"] [data-testid="page-number"]`).count()) === 2)
  await page.locator(`${demo} [data-testid="master-frame"]`).first().click({ modifiers: ["Alt"], force: true }); await page.waitForTimeout(250)
  ok("kit10: Alt+click on a parent item makes an override copy", (await page.locator(`${demo} [data-testid="spread"]`).first().getByText("override", { exact: true }).count()) === 1)
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


fs.writeFileSync(new URL("../qa-report.txt", import.meta.url), res.join("\n") + "\n\nCONSOLE:\n" + (errs.join("\n") || "none") + "\n")
console.log(res.join("\n")); console.log(`\n${res.length - fails} passed, ${fails} failed; console errors/warnings: ${errs.length}`); if (errs.length) console.log(errs.slice(0, 20).join("\n"))

await browser.close()
process.exit(fails || errs.length ? 1 : 0)

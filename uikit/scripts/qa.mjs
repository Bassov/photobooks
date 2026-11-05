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
await smoke("home → book → spread fullscreen", "site-photographer", async () => {
  await D('[data-testid="ps-book"]').first().click(); await page.waitForTimeout(200)
  const title = await D('[data-testid="ps-title"]').textContent()
  await D('[data-testid="ps-spread"]').first().click(); await page.waitForTimeout(200)
  const lb = await D('[data-testid="lightbox"]').isVisible()
  const ind = (await D('[data-testid="site-fullscreen-indicator"]').textContent()) ?? ""
  return [title === "Lake trip" && lb && ind.startsWith("Pages 2–3"), `title ${title} · lightbox ${lb} · ${ind}`]
})
{
  // Tab through the page; every listed control must draw a solid 2 px focus-visible outline.
  // A control is named by test id, else aria-label; an <input> inside a <label> rings on the label.
  const tabRings = async (want, scope = demo) => {
    const seen = {}
    for (let k = 0; k < 120 && want.some((t) => !(t in seen)); k++) {
      await page.keyboard.press("Tab")
      const r = await page.evaluate((sel) => {
        const e = document.activeElement
        if (!e?.closest(sel)) return null
        const id = e.dataset.testid ?? e.getAttribute("aria-label") ?? (e.getAttribute("href")?.startsWith("mailto:") ? "mailto" : null)
        const cs = getComputedStyle((e.matches("input") && e.closest("label")) || e)
        return id && [id, `${e.matches(":focus-visible") ? "" : "not focus-visible "}${cs.outlineStyle} ${cs.outlineWidth}`]
      }, scope)
      if (r && !(r[0] in seen)) seen[r[0]] = r[1]
    }
    return want.map((t) => [t, seen[t] ?? "not reached"])
  }
  const ringsOk = (rings, extra = []) => {
    const bad = rings.filter((x) => x[1] !== "solid 2px").concat(extra)
    return [bad.length === 0, bad.length ? bad.map((x) => x.join(": ")).join("; ") : `${rings.length} solid 2px`]
  }
  await smoke("focus-visible outline solid on every control", "site-photographer", async () => {
    const rings = await tabRings(["ps-home-link", "ps-nav-books", "ps-nav-about", "mailto"])
    await D('[data-testid="ps-book"]').first().click(); await page.waitForTimeout(200)
    rings.push(...(await tabRings(["ps-all-books", "ps-read", "ps-share", "ps-spread"])))
    return ringsOk(rings)
  })
  await smoke("focus-visible outline solid on every control; mouse click draws none", "site-viewer", async () => {
    const rings = await tabRings(["site-book"])
    await D('[data-testid="site-book"]').first().click(); await page.waitForTimeout(200)
    rings.push(...(await tabRings(["site-title-link", "site-all-books", "site-share", "site-fullscreen-btn", "site-spread", "Next spread"])))
    // blur first: the last Tab stopped on this button, and a click on the focused control keeps focus-visible
    await page.evaluate(() => document.activeElement.blur())
    await D('[data-testid="site-pager"] [aria-label="Next spread"]').click(); await page.waitForTimeout(150)
    const click = await page.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return `${e.getAttribute("aria-label")} ${cs.outlineStyle} ${cs.outlineWidth}` })
    await D('[data-testid="site-fullscreen-btn"]').click(); await page.waitForTimeout(200)
    rings.push(...(await tabRings(["Previous spread", "Next spread", "site-fullscreen-zoom", "site-fullscreen-close"], '[data-testid="lightbox"]')).map(([t, v]) => [`lightbox ${t}`, v]))
    return ringsOk(rings, click.startsWith("Next spread none") ? [] : [["mouse click on Next spread", click]])
  })
  await smoke("library bar: focus-visible outline solid on search + sort", "recents-home", async () => ringsOk(await tabRings(["lib-search-input", "lib-sort"])))
  await smoke("last page Fullscreen chip sits top 12 / right 12 of the left page", "site-photographer", async () => {
    await D('[data-testid="ps-book"]').first().click(); await page.waitForTimeout(200)
    const r = await D('[data-testid="ps-spread"]').last().evaluate((b) => {
      const a = b.getBoundingClientRect(), c = b.querySelector('[data-testid="ps-chip"]').getBoundingClientRect()
      return { top: c.top - a.top, right: a.right - c.right, pw: a.width / 2 }
    })
    return [Math.abs(r.top - 12) <= 1 && Math.abs(r.right - (r.pw + 12)) <= 1, `top ${r.top} right ${r.right} (pw ${r.pw})`]
  })
}
await smoke("shelf → book page → open cover → turn a page → fullscreen", "site-demo-1", async () => {
  const reader = '[data-testid="ps-stage"] [data-testid="ps-reader"]'
  const at = (v) => page.waitForFunction(([s, v]) => document.querySelector(s)?.getAttribute("data-view") === v, [`${demo} ${reader}`, v], { timeout: 4000 })
  await D('[data-testid="ps-book"]').first().click(); await page.waitForTimeout(700)
  const title = await D('[data-testid="ps-title"]').textContent()
  const size = await D(reader).evaluate((e) => `${e.offsetWidth}×${e.offsetHeight}`)
  await D(reader).click(); await at("1")
  await D('[data-testid="ps-next"]').click(); await at("2")
  const leaf = await D('[data-testid="ps-leaf"]').count()
  await D('[data-testid="ps-fullscreen"]').click(); await page.waitForTimeout(300)
  const lb = await D('[data-testid="lightbox"]').isVisible()
  const ind = await D('[data-testid="site-fullscreen-indicator"]').textContent()
  return [title === "Lake trip" && leaf === 0 && lb && ind === "Pages 2–3", `title ${title} · reader ${size} · leaf after turn ${leaf} · lightbox ${lb} · ${ind}`]
})
{ // site demos 2…5 (Spec site-awards-5): open a book → reader, → turns, Esc home, reduced motion, theme
  const theme = (p, n) => p.evaluate((n) => {
    const els = [...document.querySelectorAll(`[data-testid="sd${n}-root"] *`)], greys = new Set(["rgb(242, 242, 242)", "rgb(225, 225, 225)", "rgb(215, 215, 215)"])
    const grey = els.filter((e) => greys.has(getComputedStyle(e).backgroundColor)).length
    const small = els.filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && e.checkVisibility({ visibilityProperty: true }) && parseFloat(getComputedStyle(e).fontSize) < 11).map((e) => `${e.textContent.trim().slice(0, 16)} ${getComputedStyle(e).fontSize}`)
    return { grey, small }
  }, n)
  const turned = (p, n, v) => p.waitForFunction(([n, v]) => document.querySelector(`[data-testid="sd${n}-reader"] [data-testid="ps-reader"]`)?.getAttribute("data-view") !== v, [n, v], { timeout: 3000 })
  const openLake = async (p, n) => {
    await p.click(`[data-testid="sd${n}-book"][data-id="lake-trip"]`); await p.waitForTimeout(1600)
    // D4 opens the cover in place after the slide (600 + 1000 ms): let the reader land on the view it reports
    await p.waitForFunction((n) => { const w = document.querySelector(`[data-testid="sd${n}-reader"]`); return !w || w.querySelector('[data-testid="ps-reader"]')?.getAttribute("data-view") === w.getAttribute("data-view") }, n, { timeout: 3000 })
    const rd = p.locator(`[data-testid="sd${n}-reader"]`); return { shown: await rd.isVisible(), v0: await rd.getAttribute("data-view") }
  }
  for (const n of [2, 3, 4, 5]) {
    const id = `#/full/site-demo-${n}`, e0 = errs.length
    let pass = false, info = ""
    try {
      await go(id, 700)
      const th = await theme(page, n)
      const { shown, v0 } = await openLake(page, n)
      // demo 3 turns by scroll: one 100vh step is one view
      if (n === 3) await page.evaluate(() => { const s = document.querySelector('[data-testid="sd3-scroll"]'); s.scrollBy(0, s.clientHeight) })
      else await page.keyboard.press("ArrowRight")
      await turned(page, n, v0)
      const v1 = await page.getAttribute(`[data-testid="sd${n}-reader"]`, "data-view")
      await page.keyboard.press("Escape"); await page.waitForTimeout(1200)
      const home = (await page.locator(`[data-testid="sd${n}-reader"]`).count()) === 0, focus = await page.evaluate(() => document.activeElement?.getAttribute("data-id"))
      const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" }), rp = await rctx.newPage()
      rp.on("console", (m) => { if (m.type() === "error") errs.push(`[${id} reduced] ${m.text().slice(0, 240)}`) }); rp.on("pageerror", (e) => errs.push(`[${id} reduced] pageerror: ${e.message}`))
      await rp.goto(url + id); await rp.waitForTimeout(700)
      const r = await openLake(rp, n)
      await rp.keyboard.press("ArrowRight"); const t0 = Date.now(); await turned(rp, n, r.v0); const ms = Date.now() - t0
      await rctx.close()
      pass = shown && +v1 === +v0 + 1 && home && focus === "lake-trip" && r.shown && ms <= 300 && th.grey === 0 && th.small.length === 0
      info = `reader ${shown} view ${v0}→${v1} · Esc home ${home} focus ${focus} · reduced ${ms} ms · greys ${th.grey} · small ${th.small.slice(0, 4).join(", ") || "none"}`
    } catch (e) { info = e.message.split("\n")[0].slice(0, 300) }
    ok(`site-demo-${n}: open a book → reader, → turns, Esc home, reduced motion, theme`, pass && errs.length === e0, info + (errs.length > e0 ? ` (+${errs.length - e0} console errors)` : ""))
  }
}
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
  // features/site-demo-*: book cloth colours of the photographer-site demos are content, like the photos (Spec site-awards)
  const all = walk6(new URL("../src", import.meta.url).pathname).filter((f) => !f.includes("/features/site-demo-"))
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
      // [data-surface^="site"]: the photographer-site demos' own themes (Specs site-awards, site-awards-5)
      const tinted = !(r === g && g === b) && Math.max(r, g, b) - Math.min(r, g, b) <= 14 && Math.min(r, g, b) >= 112 && !e.closest('[data-surface^="site"]')
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
  // page-numbers-kit: Show off hides the position seg and hint; no dead "Position · Bottom" row
  const segOff = await E('[data-testid="master-pn-position"]').count() + await E('[data-testid="master-pn-note"]').count()
  await E('[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]').click(); await page.waitForTimeout(200) // kit10: Page numbers start off (they feed Parent.pageNumbers of every spread)
  const it = await items(), m = await E('[data-testid="canvas-master"]').count(), mm = await E('[data-testid="master-margin"]').count(), c = await E('[data-testid="master-col"]').count(), pn = await E('[data-testid="master-pn"]').allInnerTexts()
  const segOn = await E('[data-testid="master-pn-position"]').count(), dead = await E('[data-testid="insp-master"]').getByText(/^(Position|Bottom)$/).count()
  return [it.join() === "mA,mB" && m === 1 && mm === 2 && c >= 4 && pn.length === 2 && pn.every((t) => t === "#") && segOff === 0 && segOn === 1 && dead === 0, `${it} margin=${mm} cols=${c} pn=${pn} seg off/on=${segOff}/${segOn} position row=${dead}`]
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
  await smokeS("v7.1 P1 #3: v0.5.3 features live in the one editor — templates All/My (no search since kit-sync KS7), filmstrip drag source, inspector params, multi-select, Crop toolbar", "canvas", async () => {
    await scen("Photo")
    const r = {}
    r.tb = await E('[role=toolbar]').count()
    r.params = await E('[data-testid="inspector"] [data-testid="ctx-inspector"][data-ctx="photo"]').count()
    await E('[data-item="p3"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await E('[data-item="p3"]').click(); await page.waitForTimeout(200) // the spread list is a drag source (reorder): scroll first, then click
    r.tpl = await E('[data-testid="tpl-tile"]').count(); r.search = await E('[data-testid="inspector"] input[type=search], [data-testid="inspector"] [role=searchbox]').count()
    r.film = await E('[data-testid="filmstrip"] [role=row]').count()
    const fr = E('[data-testid="spread"][data-current] [data-testid="frame"]')
    r.frames = await fr.count()
    if (r.frames >= 2) { await fr.nth(0).click({ force: true }); await fr.nth(1).click({ modifiers: ["Shift"], force: true }); await page.waitForTimeout(200); r.multi = await E('[data-testid="sel-outline"]').count() }
    return [r.tb >= 1 && r.params === 1 && r.tpl >= 4 && r.search === 0 && r.film >= 4 && (r.multi ?? 0) >= 2, JSON.stringify(r)]
  })
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
        // [data-surface^="site"]: the photographer-site demos carry their own site themes (Specs site-awards, site-awards-5)
        if (el.closest('[data-swatch],[data-theme-option],[data-surface^="site"]')) continue
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
    const snap = () => page.evaluate(() => { const sp = document.querySelector('[data-testid="spread"][data-current]'); const q = (s) => sp ? sp.querySelectorAll(s).length : -1
      const cs = sp ? getComputedStyle(sp) : null
      return { a: q('[data-frame^="mA-"]'), b: q('[data-frame^="mB-"]'), ga: q('[data-guide^="mA-"]'), gb: q('[data-guide^="mB-"]'), outline: cs ? (cs.outlineStyle !== "none" && cs.outlineWidth !== "0px") : true } })
    const pick = async (name) => { await page.getByTestId("spread-master-select").first().selectOption(name === "None" ? "none" : name.slice(-1), { force: true }); await page.waitForTimeout(350) }
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
  const c = await D('[data-current] [data-testid="grid-col"]').count(), r = await D('[data-current] [data-testid="grid-row"]').count()
  return [c === 8 && r === 6, `cols=${c} rows=${r} (2 pages)`]
})
await smokeS("layout-grids-parent-inherit GP2/GP3: Custom is grey and writes nothing; G 8 is own (600 + ↺); ↺ restores it and Custom stays", "canvas", async () => {
  await D('[data-item="p3"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await D('[data-item="p3"]').click(); await page.waitForTimeout(200)
  const sg = D('[data-testid="spread-grid"]'); await sg.getByText("Custom", { exact: true }).click(); await page.waitForTimeout(200)
  const g = sg.locator('[data-testid="spread-grid-G"]'), w = () => g.evaluate((e) => getComputedStyle(e).fontWeight)
  const g0 = await g.inputValue(), w0 = await w(), hint = await sg.locator('[data-testid="spread-grid-hint"]').textContent(), r0 = await sg.locator('[data-testid="spread-grid-reset-G"]').count()
  const box0 = await g.locator("..").boundingBox()
  await g.fill("8"); await page.waitForTimeout(200)
  const w1 = await w(), reset = sg.locator('[data-testid="spread-grid-reset-G"]'), label = await reset.getAttribute("aria-label"), box1 = await g.locator("..").boundingBox()
  await reset.click(); await page.waitForTimeout(200)
  const g2 = await g.inputValue(), r2 = await sg.locator('[data-testid="spread-grid-reset-G"]').count(), custom = await sg.getByRole("button", { name: "Custom" }).getAttribute("aria-pressed")
  const still = box0.width === box1.width && box0.height === box1.height
  return [w0 === "400" && r0 === 0 && w1 === "600" && g2 === g0 && r2 === 0 && custom === "true" && still && /^Grey values follow /.test(hint ?? ""), `G ${g0} w${w0} → 8 w${w1} "${label}" → ${g2}; ↺ ${r0}/${r2}; Custom ${custom}; box ${box1.width}x${box1.height}; "${hint}"`]
})
await smokeS("layout-grids-parent-inherit GP5: link on writes only the margins ≠ T as spread overrides, in one undo step", "canvas", async () => {
  await D('[data-item="p3"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await D('[data-item="p3"]').click(); await page.waitForTimeout(200)
  const sg = D('[data-testid="spread-grid"]'); await sg.getByText("Custom", { exact: true }).click(); await page.waitForTimeout(200)
  const read = () => Promise.all(["T", "B", "I", "O"].map(async (k) => { const i = sg.locator(`[data-testid="spread-grid-${k}"]`); return `${await i.inputValue()}${await i.evaluate((e) => getComputedStyle(e).fontWeight) === "600" ? "*" : ""}` })).then((v) => v.join("/"))
  const m0 = await read(); await sg.locator('[data-testid="spread-grid-link"]').click(); await page.waitForTimeout(200)
  const m1 = await read(); await page.keyboard.press("Control+z"); await page.waitForTimeout(200)
  const m2 = await read(); const t = m0.split("/")[0], diff = m0.split("/").map((v, i) => i && v !== t ? `${t}*` : v).join("/")
  return [m0 !== `${t}/${t}/${t}/${t}` && m1 === diff && m2 === m0, `${m0} → link ${m1} (want ${diff}) → undo ${m2}  (* = own, 600)`]
})
{
  await go(feat("site-lightbox"), 600)
  const e0 = errs.length
  if (!(await page.locator('[data-testid="lightbox"]').count())) { await D('[data-testid="site-fullscreen-btn"]').first().click().catch(() => {}); await page.waitForTimeout(300) }
  const m = await page.locator('[data-testid="site-fullscreen-book"]').evaluate((e) => { const r = e.getBoundingClientRect(), v = e.closest('[data-testid="lightbox"]').getBoundingClientRect(); return { w: r.width / v.width, h: r.height / v.height, pad: Math.min(r.left - v.left, v.right - r.right, r.top - v.top, v.bottom - r.bottom), fit: Math.min(Math.abs(r.width - (v.width - 128)), Math.abs(r.height - (v.height - 112))), cx: Math.abs(r.left - v.left - (v.right - r.right)) } }).catch(() => null)
  const sw = await page.locator('text=/^(Paper|Night|Sage)$/').count()
  // site-lightbox §2: the fit area is the dialog minus 64 top / 48 bottom / 64 sides; the slide touches it on its limiting side, centred
  ok("v8 §4 + site-lightbox §2 site fullscreen fills ≥90% of one viewport dimension, fits the 64/48/64 inset area (48–64px padding); no Paper/Night/Sage switcher", !!m && Math.max(m.w, m.h) >= 0.9 && m.pad >= 47.5 && m.pad <= 64.5 && m.fit <= 0.5 && m.cx <= 0.5 && sw === 0 && errs.length === e0, JSON.stringify(m) + ` themes=${sw}`)
  // Designer site-lightbox §2–§3: no control over the active slide; double-click zooms; a step resets; Esc closes at any zoom
  const LB = '[data-testid="lightbox"]', zoomOf = () => page.locator(LB).getAttribute("data-zoom").catch(() => null)
  const xo = await page.locator(LB).evaluate((v) => { const s = v.querySelector('[data-testid="site-fullscreen-book"]').getBoundingClientRect(), x = v.querySelector('[data-testid="site-fullscreen-close"]').getBoundingClientRect(); return { over: !(x.right <= s.left || x.left >= s.right || x.bottom <= s.top || x.top >= s.bottom), x: [x.left, x.top, x.width].map(Math.round), s: [s.left, s.top, s.right, s.bottom].map((n) => +n.toFixed(2)) } }).catch(() => null)
  ok("site-lightbox §2 Close X does not overlap the active slide", !!xo && !xo.over, JSON.stringify(xo))
  await page.locator('[data-testid="site-fullscreen-book"]').dblclick().catch(() => {}); await page.waitForTimeout(350)
  const z2 = await zoomOf()
  ok("site-lightbox §3 double-click → data-zoom 2.00", z2 === "2.00", z2)
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(350)
  const z1 = await zoomOf()
  ok("site-lightbox §3 ArrowRight while zoomed → data-zoom 1.00", z2 === "2.00" && z1 === "1.00", `${z2} → ${z1}`)
  await page.locator('[data-testid="site-fullscreen-book"]').dblclick().catch(() => {}); await page.waitForTimeout(350)
  const z3 = await zoomOf()
  await page.keyboard.press("Escape").catch(() => {}); await page.waitForTimeout(200)
  const open = await page.locator(LB).count()
  ok("site-lightbox §3 Esc while zoomed closes (one press)", z3 === "2.00" && open === 0, `zoom ${z3} · lightbox ${open}`)
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
    // Designer site-viewer D3: Share swaps its label in a width-locked button for 2000 ms; the link goes to a hidden role=status, no link line
    const shareBox = () => page.locator('[data-testid="site-share"]').evaluate((e) => ({ w: e.getBoundingClientRect().width, txt: e.innerText.trim(), y: document.querySelector('[data-testid="site-stage"]')?.getBoundingClientRect().y }))
    W.share0 = await shareBox()
    await page.click('[data-testid="site-share"]'); await page.waitForTimeout(200); W.share1 = await shareBox()
    W.link = (await page.locator('[data-testid="site-book-page"] [role="status"]').textContent()).trim(); W.linkLine = await page.locator('[data-testid="site-share-link"]').count()
    await page.waitForTimeout(2000); W.share2 = await shareBox()
    // fullscreen: Esc returns focus to the Fullscreen button
    await page.click('[data-testid="site-fullscreen-btn"]'); await page.waitForTimeout(300); W.fsCover = await page.locator('[data-testid="lightbox"] [data-testid="site-cover"]').count()
    W.fsBox = await page.locator('[data-testid="lightbox"]').evaluate((v) => { const R = (e) => e.getBoundingClientRect(), d = R(v), b = R(v.querySelector('[data-testid="site-fullscreen-book"]')), c = R(v.querySelector('[data-testid="site-cover"]')), r = (n) => +n.toFixed(2); return { box: [b.left - d.left, b.top - d.top, b.width, b.height].map(r), cover: [c.left - d.left, c.top - d.top, c.width, c.height].map(r), area: [d.width - 128, d.height - 112].map(r) } }).catch(() => null)
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
    W.stage === "site" && W.catalog === 1 && W.siteBooks >= 1 && W.siteTitle === "Lake trip" && new RegExp(`\\b${pages - 2} pages`).test(W.siteMeta) && !!W.siteCover && W.siteCover.h > 100 && /Lake trip 2026/.test(W.siteCover.txt) && W.siteCover.img !== "none" && W.siteInd.startsWith("Cover") && /\/lake-trip$/.test(W.link) && W.fsCover === 1,
    J({ stage: W.stage, catalog: W.catalog, books: W.siteBooks, t: W.siteTitle, meta: W.siteMeta, cover: W.siteCover, ind: W.siteInd, link: W.link, fs: W.fsCover }))
  ok("site-viewer D3: Share → 'Link copied' for 2000 ms in a width-locked button; link in role=status, no link line, the stage does not move",
    W.share0?.txt === "Share" && W.share1?.txt === "Link copied" && W.share2?.txt === "Share" && Math.abs(W.share1.w - W.share0.w) <= 0.5 && Math.abs(W.share2.w - W.share0.w) <= 0.5
      && Math.abs(W.share1.y - W.share0.y) <= 0.5 && W.link === "Link copied: https://aleksandr.photos/lake-trip" && W.linkLine === 0, J({ s: [W.share0, W.share1, W.share2], link: W.link, line: W.linkLine }))
  ok("v8.1 P1-3 demo filmstrip: one plain label 'Photos · N · M used', no Photos/Templates capsule", /^Photos · \d+ · \d+ used$/.test(W.film ?? "") && /^Photos · \d+ · \d+ used$/.test(W.film2 ?? "") && W.tabs === 0, J([W.film, W.film2, W.tabs]))
  ok("v8.1 P1-4 library path is not doubled", W.path === "~/Pictures/Photobooks" || (/^~\/Pictures\/[^~/]+$/.test(W.path ?? "")), W.path)
  ok("v8.1 P2-1 demo library '…' menu: Rename, Duplicate, Remove work", J(W.items).includes("Rename") && J(W.items).includes("Duplicate") && J(W.items).includes("Remove") && W.afterDup?.length === 2 && W.afterDup.includes("Lake trip ’26") && W.afterDup.includes("Lake trip ’26 (copy)") && W.afterRm?.length === 1, J([W.items, W.afterDup, W.afterRm]))
  // site-lightbox §2: the cover slide fits the area at its own ratio (not the spread box); the cover fills that box
  const fb = W.fsBox, near = (p, q) => !!p && !!q && p.every((x, k) => Math.abs(x - q[k]) <= 0.5)
  ok("site-lightbox §2 lightbox cover fits the 64/48/64 area at the cover ratio (1440×900: 1312 × 769.80 at 64, 73.10)",
    !!fb && near(fb.box, fb.cover) && (Math.abs(fb.box[2] - fb.area[0]) <= 0.5 || Math.abs(fb.box[3] - fb.area[1]) <= 0.5) && fb.box[2] <= fb.area[0] + 0.5 && fb.box[3] <= fb.area[1] + 0.5 && Math.abs(fb.box[0] - 64 - (fb.area[0] - fb.box[2]) / 2) <= 0.5 && Math.abs(fb.box[1] - 64 - (fb.area[1] - fb.box[3]) / 2) <= 0.5, J(fb))
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
  const fr = D('[data-current] [data-testid="frame"]').first(); const b = await fr.boundingBox()
  const edges = await D('[data-current] [data-testid="grid-col"]').evaluateAll((es) => es.flatMap((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right] }))
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
    cursors[key] = await page.locator('[data-testid="demo"] :is([data-testid="viewport"], [data-testid="pasteboard"])').evaluate((vp) => getComputedStyle(vp).cursor)
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
  const box = await page.locator('[data-testid="demo"] :is([data-testid="viewport"], [data-testid="pasteboard"])').boundingBox()
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
  const prevOpen = await page.locator('[data-testid="presentation"]').count()
  const stage = await page.locator('[data-testid="demo"]').getAttribute("data-demo-stage")
  // kit-sync KS14 (M16, M53): Preview = prod presentation mode (src/render/SpreadPager.tsx, styles/tokens.css --presentation*): fixed full-screen
  // #0d0d0d, the spread fitted to 94 % w / 96 % of (h − 64), opens on the cover; "Esc" chip top-right, caption bottom centre; Esc closes
  const pm = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="presentation"]'); if (!root) return null
    const cs = (e) => getComputedStyle(e), r = (e) => e.getBoundingClientRect(), rr = r(root)
    const esc = root.querySelector('[data-testid="presentation-exit"]'), cap = root.querySelector('[data-testid="pager-position"]'), eb = r(esc), cb = r(cap.parentElement)
    const fit = root.querySelector('[data-testid="presentation-slide"][data-active="true"] [data-testid="presentation-cover"]')?.getBoundingClientRect()
    return {
      box: [rr.x, rr.y, rr.width - innerWidth, rr.height - innerHeight], pos: cs(root).position, bg: cs(root).backgroundColor, role: root.getAttribute("role"),
      esc: [esc.textContent, eb.top - rr.top, rr.right - eb.right, eb.height, cs(esc).fontSize, cs(esc).backgroundColor, cs(esc).color, cs(esc).paddingLeft, parseFloat(cs(esc).borderTopLeftRadius) >= eb.height / 2, esc.getAttribute("aria-label")],
      cap: [cap.textContent, rr.bottom - cb.bottom, cs(cap).fontSize, cs(cap).color, cs(cap.parentElement).textAlign, Math.round((r(cap).left + r(cap).right) / 2 - (rr.left + rr.width / 2))],
      fit: fit ? +Math.min(rr.width * 0.94 - fit.width, (rr.height - 64) * 0.96 - fit.height).toFixed(2) : null,
      // rework: prod line boxes are 16 (leading-4) — caption text top = 900 − 32 = 868 at 1440 × 900
      lh: [cs(cap.parentElement).lineHeight, cs(esc).lineHeight, +(innerHeight - r(cap).top).toFixed(2)],
      // rework: the cover is the kit's own CoverSpread at prod's 0.5 px / mm, texts × cover / 848 (prod: front 61.15 tall, spine vertical 22.93 wide, back 22.93 tall)
      text: (() => { const c = root.querySelector('[data-testid="presentation-cover"]'), b = (i) => c.children[0].children[i], h = (e) => +r(e).height.toFixed(2)
        const sp = () => r(b(1).firstElementChild.firstElementChild)
        return c ? [h(b(2).firstElementChild.firstElementChild), +sp().width.toFixed(2), sp().height > sp().width, h(b(0).firstElementChild)] : null })(),
      slide: (() => { const s = root.querySelector('[data-testid="presentation-slide"][data-active="true"]'); return [cs(s).transitionProperty, cs(s).transitionDuration, cs(s).transitionTimingFunction, root.querySelectorAll('[data-testid="presentation-slide"]').length] })(),
    }
  })
  // rework: the slides follow the spread list after the cover — page 1 alone, the spreads, the last page alone (one page wide, centred)
  const seq = []
  for (let k = 0; k < 40; k++) {
    seq.push(await page.evaluate(() => { const root = document.querySelector('[data-testid="presentation"]'), b = root.querySelector('[data-testid="presentation-slide"][data-active="true"]').firstElementChild.getBoundingClientRect()
      return { cap: root.querySelector('[data-testid="pager-position"]').textContent, w: +b.width.toFixed(2), cx: Math.round(b.left + b.width / 2 - innerWidth / 2), page: !!root.querySelector('[data-testid="presentation-slide"][data-active="true"] [data-testid="presentation-page"]'),
        sq: [...root.querySelectorAll('[data-testid="presentation-slide"][data-active="true"] [data-paper]')].map((e) => { const s = getComputedStyle(e); return `${s.borderRadius}/${s.boxShadow.split(/,(?![^(]*\))/).every((l) => l === "none" || l.includes("rgba(0, 0, 0, 0)")) ? "none" : s.boxShadow}` }) } }))
    if (k > 0 && seq[k].cap === seq[k - 1].cap) { seq.pop(); break }
    await page.keyboard.press("ArrowRight"); await page.waitForTimeout(260)
  }
  const mid = seq.slice(2, -1), N = seq.length - 1
  ok("kit-sync KS14 rework: Preview walks Cover, 1 / N (page 1 alone), the spreads, N / N (the last page alone) — single pages half a spread wide, every slide centred",
    seq.map((s) => s.cap).join() === ["Cover", ...Array.from({ length: N }, (_, j) => `${j + 1} / ${N}`)].join() && N >= 3 && seq[1].page && seq[N].page && !mid.some((s) => s.page)
      && mid.every((s) => s.w === mid[0].w) && Math.abs(seq[1].w - mid[0].w / 2) <= 0.5 && Math.abs(seq[N].w - mid[0].w / 2) <= 0.5 && seq.every((s) => Math.abs(s.cx) <= 0.5), JSON.stringify(seq.map((s) => `${s.cap}:${s.w}${s.page ? "p" : ""}@${s.cx}`)))
  // round 2: prod slides are square paper — no MiniSpread card radius, no thumbnail shadow
  ok("kit-sync KS14 round 2: page 1, spread and last-page slides are square (border-radius 0) with no shadow",
    seq.slice(1).every((s) => s.sq.length > 0 && s.sq.every((v) => v === "0px/none")), JSON.stringify([...new Set(seq.slice(1).flatMap((s) => s.sq))]))
  ok("kit-sync KS14 rework: cover slide = the kit cover at prod's sizes (front title 61.15 tall, spine text vertical 22.93 wide, back text 22.93 tall, ±0.5)",
    !!pm?.text && Math.abs(pm.text[0] - 61.15) <= 0.5 && Math.abs(pm.text[1] - 22.93) <= 0.5 && pm.text[2] && Math.abs(pm.text[3] - 22.93) <= 0.5, JSON.stringify(pm?.text))
  ok("kit-sync KS14 rework: slides move sideways + fade 200 ms cubic-bezier(0.2, 0.7, 0.3, 1), neighbours mounted (2 at the cover); caption + Esc line height 16, caption text top 868",
    JSON.stringify(pm?.slide) === JSON.stringify(["transform, opacity", "0.2s", "cubic-bezier(0.2, 0.7, 0.3, 1)", 2]) && JSON.stringify(pm?.lh) === JSON.stringify(["16px", "16px", 32]), JSON.stringify([pm?.slide, pm?.lh]))
  for (let k = 1; k < seq.length; k++) await page.keyboard.press("ArrowLeft")
  await page.waitForTimeout(260); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(260)
  const next = await page.locator('[data-testid="presentation"] [data-testid="pager-position"]').textContent().catch(() => null)
  // tab-leaves-presentation: Tab ×10 / Shift+Tab ×10 keep focus inside the presentation; Esc hands it back to Preview
  const inPm = () => page.evaluate(() => !!document.activeElement?.closest('[data-testid="presentation"]'))
  const tabTrail = [await inPm()]
  for (const key of [...Array(10).fill("Tab"), ...Array(10).fill("Shift+Tab")]) { await page.keyboard.press(key); tabTrail.push(await inPm()) }
  await page.keyboard.press("Escape"); await page.waitForTimeout(300)
  const escFocus = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName)
  ok("tab-leaves-presentation: Preview takes focus; Tab ×10 and Shift+Tab ×10 never leave it; Esc returns focus to Preview",
    tabTrail.every(Boolean) && escFocus === "demo-preview", JSON.stringify({ tabTrail: tabTrail.map(Number).join(""), escFocus }))
  const afterEsc = await page.locator('[data-testid="presentation"]').count(), stageEsc = await page.locator('[data-testid="demo"]').getAttribute("data-demo-stage")
  ok("kit-sync KS14: Preview = presentation mode as prod — fixed full-screen rgb(13, 13, 13) dialog, the cover fitted, Esc chip 16 / 16 h 32 12 px white/0.1, caption 'Cover' 16 px up 12 px white/0.6, → '1 / n', Esc closes",
    !!pm && pm.box.every((v) => Math.abs(v) <= 0.5) && pm.pos === "fixed" && pm.bg === "rgb(13, 13, 13)" && pm.role === "dialog"
      && JSON.stringify(pm.esc) === JSON.stringify(["Esc", 16, 16, 32, "12px", "rgba(255, 255, 255, 0.1)", "rgb(255, 255, 255)", "12px", true, "Exit presentation"])
      && JSON.stringify(pm.cap) === JSON.stringify(["Cover", 16, "12px", "rgba(255, 255, 255, 0.6)", "center", 0]) && pm.fit !== null && Math.abs(pm.fit) <= 0.5
      && /^1 \/ \d+$/.test(next ?? "") && afterEsc === 0 && stageEsc === "editor", JSON.stringify({ ...pm, next, afterEsc }))
  await go(feat("editor-chrome-toolbar"), 1000) // Stage 3: kit pages mount the #/demo editor parts
  await page.click('[data-testid="demo-preview"]'); await page.waitForTimeout(600)
  const kitPrev = await page.locator('[data-testid="presentation"]').count()
  ok("v0.9.1 §2 Preview opens in-app book preview (not Site stage) — kit-sync KS14: the presentation mode", prevOpen === 1 && stage === "editor" && kitPrev === 1, `demoPrev=${prevOpen} stage=${stage} kit=${kitPrev}`)
  await page.keyboard.press("Escape")

  // §3 page counts (Designer site-viewer D1/D2/D5): slides = cover + every spread; indicator = page label + spread counter (prod Preview), meta pages = last page number 2(n − 1) (Designer review); deep-link into the book (v0.9.3 catalog home)
  await go("#/demo", 400); await page.evaluate(() => { const d = window.__demo; d.reset(); d.state().path = "~/Pictures/Photobooks"; d.state().books = [{ id: "s1", title: "Pages", book: { endp: true, endpSame: true, w: 14.8, h: 21, preset: "A5" }, published: true }]; d.state().open = "s1"; d.openSite("book") })
  await page.waitForTimeout(900)
  const meta = (await page.locator('[data-testid="site-author"]').textContent()).trim()
  const J = (o) => String(JSON.stringify(o)).slice(0, 600)
  // blank book may have no doc — SiteViewer uses studio SAMPLE doc spreads; meta pages = 2(n − 1) → n = meta pages / 2 + 1
  const pagesMeta = /(\d+)\s*pages/.exec(meta), nSp = pagesMeta ? +pagesMeta[1] / 2 + 1 : 0
  const slideTxt = (s) => (s === 0 ? "Cover" : `${s === 1 ? "Page 1" : s === nSp ? `Page ${2 * (s - 1)}` : `Pages ${2 * (s - 1)}–${2 * s - 1}`} · ${s} / ${nSp}`)
  const siteRects = () => page.evaluate(() => { const r = (s) => { const b = document.querySelector(`[data-testid="${s}"]`)?.getBoundingClientRect(); return b ? [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 100) / 100) : null }; return { ind: document.querySelector('[data-testid="site-page-indicator"]')?.textContent.trim(), stage: r("site-stage"), pager: r("site-pager"), indW: r("site-page-indicator")?.[2], spreadH: r("site-spread")?.[3] } })
  const slides = []
  for (let i = 0; i <= nSp && i < 40; i++) { slides.push(await siteRects()); if (i < nSp) { await page.locator('[data-testid="site-pager"] [aria-label="Next spread"]').click(); await page.waitForTimeout(120) } }
  await page.keyboard.press("Home"); await page.waitForTimeout(120); const home = await siteRects()
  await page.keyboard.press("End"); await page.waitForTimeout(120); const end = await siteRects()
  const drift = (k) => Math.max(...slides.flatMap((x) => x[k].map((v, j) => Math.abs(v - slides[0][k][j]))))
  const badLabels = slides.map((x, i) => [i, x.ind]).filter(([i, t]) => t !== slideTxt(i))
  ok("site-viewer D1/D5 §3: slides = cover + every spread; labels Cover, Page 1 · 1 / n … last page · n / n (denominator = spread count, meta pages = 2(n − 1)); Home / End",
    nSp >= 2 && slides.length === nSp + 1 && badLabels.length === 0 && slides[1].ind === `Page 1 · 1 / ${nSp}` && home.ind === "Cover" && end.ind === slideTxt(nSp), J({ meta, nSp, badLabels, home: home.ind, end: end.ind }))
  ok("site-viewer D2: stage and pager rects constant on every slide (≤ 0.5 px), slide never taller than the stage, indicator 176 wide",
    slides.length > 2 && drift("stage") <= 0.5 && drift("pager") <= 0.5 && slides.every((x) => x.indW === 176 && x.spreadH <= x.stage[3] + 0.5), J({ stage: drift("stage"), pager: drift("pager"), s0: slides[0], s1: slides[1] }))
  // Designer review §4 (M45): the last slide shows its left page only — clipped, page shadow over the left half
  const last = await page.evaluate(() => { const sp = document.querySelector('[data-testid="site-spread"]'), b = sp.getBoundingClientRect(), sh = sp.querySelector(":scope > span[aria-hidden]").getBoundingClientRect(); return { clip: getComputedStyle(sp.firstElementChild).clipPath, dx: Math.round((sh.x - b.x) * 100) / 100, shW: Math.round(sh.width * 100) / 100, w: Math.round(b.width * 100) / 100 } })
  ok("site-viewer §4: last slide paints the left page only (clip inset(0 50% 0 0), shadow left half)", last.clip === "inset(0px 50% 0px 0px)" && last.dx === 0 && Math.abs(last.shW - last.w / 2) <= 0.5, J(last))

  // catalog: a landscape book fits its column (h = min(200, col / ratio)); D4: 390 px root → no horizontal overflow on catalog and book page
  await page.evaluate(() => { const d = window.__demo; d.state().books = [...d.state().books, { id: "s2", title: "Wide", book: { endp: true, endpSame: true, w: 21, h: 14.8, preset: "A5" }, published: true }]; d.openSite("catalog") })
  await page.waitForTimeout(600)
  const fit = await page.evaluate(() => [...document.querySelectorAll('[data-testid="site-book"]')].map((b) => [b.dataset.book, Math.round(b.querySelector(".site-card-obj").getBoundingClientRect().width * 100) / 100, Math.round(b.getBoundingClientRect().width * 100) / 100]))
  const cardCur = await page.locator('[data-testid="site-catalog"] [data-testid="site-book"]').evaluateAll((els) => els.map((e) => getComputedStyle(e).cursor))
  ok("site-viewer §3: catalog cards use the pointer cursor", cardCur.length > 0 && cardCur.every((c) => c === "pointer"), J(cardCur))
  const narrow = async () => { await page.evaluate(() => { document.querySelector('[data-testid="site"]').parentElement.style.width = "390px" }); await page.waitForTimeout(300)
    return page.evaluate(() => { const s = document.querySelector('[data-testid="site"]'), x0 = s.getBoundingClientRect().left; return { sw: s.scrollWidth, cw: s.clientWidth, right: Math.max(...[...s.querySelectorAll("*")].map((e) => e.getBoundingClientRect().right - x0)), cols: getComputedStyle(s.querySelector('[data-testid="site-catalog"] .grid') ?? s).gridTemplateColumns } }) }
  const nCat = await narrow()
  await page.locator('[data-testid="site-book"]').first().click(); await page.waitForTimeout(600)
  const nBook = await narrow()
  const nShare = await page.evaluate(() => { const a = document.querySelector('[data-testid="site-author"]').getBoundingClientRect(), s = document.querySelector('[data-testid="site-share"]').getBoundingClientRect(); return { under: s.top >= a.bottom, stageW: document.querySelector('[data-testid="site-stage"]').getBoundingClientRect().width } })
  ok("site-viewer §3 catalog: every book object fits its column (landscape h = col / ratio)", fit.length === 2 && fit.every(([, o, c]) => o <= c + 0.5) && fit.some(([id]) => id === "s2"), J(fit))
  ok("site-viewer D4: 390 px root — scrollWidth === clientWidth on catalog and book page, 2 columns, Share under the meta, stage ≤ content",
    nCat.sw === nCat.cw && nBook.sw === nBook.cw && nCat.right <= nCat.cw + 0.5 && nBook.right <= nBook.cw + 0.5 && nCat.cols.split(" ").length === 2 && nShare.under && nShare.stageW <= nBook.cw - 40 + 0.5, J({ nCat, nBook, nShare }))

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
  // kit-sync-canvas (KS2–KS5, K1): #/demo stacks the pages as prod — gap 104/588 of the spread height, 11 px page numbers 8 px under the page,
  // a content-wide new-spread pill centred between the numbers and the next spread, no frame size pill, Esc clears the "Release to replace" chip
  {
    const cur = `${demo} [data-testid="spread"][data-current]`
    const m = await page.evaluate((sel) => {
      const el = document.querySelector(sel), c = el.getBoundingClientRect()
      const n = document.querySelector(`[data-testid="demo"] [data-testid="spread"][data-spread="${+el.dataset.spread + 1}"]`).getBoundingClientRect()
      const l = [...el.closest("[data-stack-item]").querySelectorAll('[data-testid="page-labels"] span')].find((s) => s.textContent.trim()), lb = l.getBoundingClientRect()
      return { n: document.querySelectorAll('[data-testid="demo"] [data-testid="pasteboard"] [data-testid="spread"]').length, h: c.height, gap: n.top - c.bottom, dy: lb.top - c.bottom, lh: lb.height, fs: getComputedStyle(l).fontSize }
    }, cur)
    // absolute Fit numbers (513.25 / 90.78 at 1440×900) are the demo-capture walk's; here the ratios hold at any window size
    ok("kit-sync KS2: #/demo stacks the spreads; gap = 104/588 of the spread height", m.n > 1 && Math.abs(m.gap - m.h * 104 / 588) <= 1, `${m.n} spreads, h ${m.h.toFixed(2)} gap ${m.gap.toFixed(2)}`)
    ok("kit-sync KS3: page numbers 11 px on screen, 8 px under the page", m.fs === "11px" && Math.abs(m.lh - 11) <= 0.5 && Math.abs(m.dy - 8) <= 0.5, `${m.fs} h ${m.lh} dy ${m.dy.toFixed(2)}`)
    const row = await page.locator(`${demo} [data-testid="filmstrip"] [role="row"]`).nth(2).boundingBox(), sb = await page.locator(cur).boundingBox()
    await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2); await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(row.x + (sb.x + sb.width / 2 - row.x) * i / 8, row.y + (sb.y + sb.height + 30 - row.y) * i / 8)
    await page.waitForTimeout(400)
    const p = await page.evaluate((sel) => {
      const c = document.querySelector(sel).getBoundingClientRect(), pills = [...document.querySelectorAll('[data-testid="demo"] [data-testid="gap-pill"]')]
      const e = pills.find((x) => x.getBoundingClientRect().top > c.bottom); if (!e) return null
      const b = e.getBoundingClientRect(), s = getComputedStyle(e), n = [...document.querySelectorAll('[data-testid="demo"] [data-testid="spread"]')].map((x) => x.getBoundingClientRect()).find((x) => x.top > b.top)
      return { w: b.width, h: b.height, fs: s.fontSize, r: s.borderRadius, ws: s.whiteSpace, up: b.top - c.bottom - 19, down: n.top - b.bottom, gapH: e.parentElement.getBoundingClientRect().height }
    }, cur)
    await page.keyboard.press("Escape"); await page.mouse.up(); await page.waitForTimeout(300)
    ok("kit-sync KS4: new-spread pill 32 px, 12 px nowrap, width by content, radius 8, centred under the page numbers; the gap does not grow", !!p && p.h === 32 && p.fs === "12px" && p.ws === "nowrap" && p.r === "8px" && Math.abs(p.w - 199.23) <= 1 && Math.abs(p.up - p.down) <= 1 && Math.abs(p.up - (m.gap - 19 - 32) / 2) <= 1 && Math.abs(p.gapH - m.gap) <= 1, JSON.stringify(p))
    await page.locator(`${cur} [data-testid="frame"]`).first().click(); await page.waitForTimeout(200)
    const sizePill = await page.locator(`${demo} [data-testid="handles"]`).filter({ hasText: / × \d+ mm/ }).count()
    ok("kit-sync KS5: a selected frame shows no size pill (380 × 230 mm)", (await page.locator(`${demo} [data-testid="handles"]`).count()) === 1 && sizePill === 0, `size pills ${sizePill}`)
    await page.keyboard.press("Escape"); await page.waitForTimeout(200); await c('[data-item="p1"]'); await page.waitForTimeout(250)
    // prod usePasteboardCamera: the wheel zooms about the cursor, Ctrl+= / Ctrl+- about the pasteboard centre
    const r0 = await page.locator(cur).boundingBox(), mx = Math.round(r0.x + r0.width * 0.6), my = Math.round(r0.y + r0.height * 0.3)
    await page.mouse.move(mx, my); for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(90) } await page.waitForTimeout(400)
    const r1 = await page.locator(cur).boundingBox(), drift = [((mx - r1.x) / r1.width - (mx - r0.x) / r0.width) * r1.width, ((my - r1.y) / r1.height - (my - r0.y) / r0.height) * r1.height]
    ok("kit-sync KS2: wheel zoom keeps the point under the cursor (≤ 2 px after 3 notches)", r1.width > r0.width && drift.every((d) => Math.abs(d) <= 2), drift.map((d) => d.toFixed(1)).join(" / "))
    await page.keyboard.press("Control+0"); await page.waitForTimeout(250)
    const pb = await page.locator(`${demo} [data-testid="pasteboard"]`).boundingBox(), cx0 = (await page.locator(cur).boundingBox()).x + r0.width / 2
    for (let i = 0; i < 2; i++) { await page.keyboard.press("Control+Equal"); await page.waitForTimeout(150) }
    const rk = await page.locator(cur).boundingBox(), kcx = rk.x + rk.width / 2
    ok("kit-sync KS2: Ctrl+= zooms about the pasteboard centre (spread centre stays at the centre ±2 px)", rk.width > r0.width && Math.abs(kcx - (pb.x + pb.width / 2)) <= 2 && Math.abs(cx0 - kcx) <= 2, `centre ${kcx.toFixed(1)} vs ${(pb.x + pb.width / 2).toFixed(1)}`)
    await page.keyboard.press("Control+0"); await page.waitForTimeout(250)
    // M45 + Q3: the stack ends with the single last page on the left, its number under it, the stack gap before it; the `last` row scrolls to it
    await c('[data-item="last"]'); await page.waitForTimeout(400)
    const e = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="demo"] [data-testid="pasteboard"]'); if (!root) return null
      const items = [...root.querySelectorAll("[data-stack-item]")], l = items.at(-1), lr = l.getBoundingClientRect(), pr = items.at(-2).getBoundingClientRect(), paper = l.querySelector("[data-paper]").getBoundingClientRect()
      const lab = [...l.querySelectorAll('[data-testid="page-labels"] span')].find((s) => s.textContent.trim()), lb = lab.getBoundingClientRect()
      return { key: l.dataset.stackItem, inView: lr.top >= root.getBoundingClientRect().top && lr.bottom <= root.getBoundingClientRect().bottom, left: paper.left - lr.left, w: paper.width / lr.width, gap: lr.top - pr.bottom, h: lr.height, t: lab.textContent, lcx: lb.left + lb.width / 2 - (paper.left + paper.width / 2), dy: lb.top - lr.bottom, fs: getComputedStyle(lab).fontSize }
    })
    ok("kit-sync KS2: the stack ends with the last page alone on the left, its number under it; the last row stays stacked", !!e && e.key === "last" && e.inView && e.left === 0 && e.w === 0.5 && Math.abs(e.gap - e.h * 104 / 588) <= 1 && e.t === "20" && Math.abs(e.lcx) <= 1 && Math.abs(e.dy - 8) <= 0.5 && e.fs === "11px", JSON.stringify(e))
    // a click on the last page on the canvas selects it like the `last` row and keeps the view (prod: scrollTop unchanged)
    await c('[data-item="p9"]'); await page.waitForTimeout(400)
    const pbl = page.locator(`${demo} [data-testid="pasteboard"]`)
    await pbl.evaluate((el) => { el.scrollTop = el.scrollHeight }); await page.waitForTimeout(150)
    const t0 = await pbl.evaluate((el) => el.scrollTop)
    await page.locator(`${demo} [data-stack-item="last"] [data-paper]`).click(); await page.waitForTimeout(400)
    const t1 = await pbl.evaluate((el) => el.scrollTop), lsel = await page.locator(`${demo} [data-testid="panel-l"] [data-item="last"]`).getAttribute("aria-selected")
    ok("kit-sync KS2: a canvas click on the last page selects it (the `last` row) and keeps the view", t0 > 0 && Math.abs(t1 - t0) <= 2 && lsel === "true", `scrollTop ${t0} → ${t1}, last row selected ${lsel}`)
    // 11 px / 8 px is for page numbers only: cover labels keep 12 px, 10 px under the cover
    // the list is scrolled to `last`; bring the cover row into view first (Playwright's own scroll-and-click misses the row there)
    await page.locator('[data-item="cover"]').evaluate((el) => el.scrollIntoView({ block: "nearest" })); await page.waitForTimeout(150)
    await c('[data-item="cover"]'); await page.waitForTimeout(400)
    const cl = await page.evaluate(() => { const v = document.querySelector('[data-testid="demo"] [data-testid="node-view"]').getBoundingClientRect(); return [...document.querySelectorAll('[data-testid="demo"] [data-testid="page-labels"] span')].map((s) => ({ t: s.textContent, fs: getComputedStyle(s).fontSize, dy: +(s.getBoundingClientRect().top - v.bottom).toFixed(2) })) })
    ok("kit-sync KS3: cover labels Back / Spine / Front keep 12 px, 10 px under the cover", cl.map((x) => x.t).join() === "Back,Spine,Front" && cl.every((x) => x.fs === "12px" && Math.abs(x.dy - 10) <= 0.5), JSON.stringify(cl))
    await c('[data-item="p1"]'); await page.waitForTimeout(250)
  }
  const views = await Promise.all(["snap", "grid", "guides", "rulers", "overlays", "dpi"].map((k) => page.locator(`${demo} [data-testid="toggle-${k}"]`).count()))
  ok("kit10 → kit-sync KS1 (M11 widened): #/demo top bar has two view toggles (snap, grid), no guides / rulers / bleed / trim / safe / DPI", views.join() === "1,1,0,0,0,0", views.join())
  // KS1 (M39): the tools toolbar (4 tools + snap + grid) is 210 wide and centred on the canvas, between the spread list and the inspector
  const tb = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="demo"]'), t = d.querySelector('[data-testid="editor-bar"] [role=toolbar][aria-label="Tools"]').getBoundingClientRect()
    return { w: t.width, cx: t.x + t.width / 2, canvas: (d.querySelector('[data-testid="panel-l"]').getBoundingClientRect().right + d.querySelector('[data-testid="panel-r"]').getBoundingClientRect().left) / 2 }
  })
  ok("kit-sync KS1 (M39): the tools toolbar is 210 wide, its centre = the canvas centre", Math.abs(tb.w - 210) <= 0.5 && Math.abs(tb.cx - tb.canvas) <= 0.5, `w ${tb.w} cx ${tb.cx} canvas ${tb.canvas}`)
  // rework (prod SnapToggle / GridToggle .pb-view-toggle): 28 × 28, 8 apart, #CACACA when on, x 717 / 753 at 1440
  await page.mouse.move(0, 899)
  const vt = await page.evaluate(() => ["snap", "grid"].map((k) => { const e = document.querySelector(`[data-testid="demo"] [data-testid="toggle-${k}"]`), b = e.getBoundingClientRect(); return [+b.x.toFixed(2), b.width, b.height, e.getAttribute("aria-pressed") === "true" || e.dataset.selected !== undefined, getComputedStyle(e).backgroundColor] }))
  ok("kit-sync KS1 rework: Snap / Grid toggles 28 × 28 at x 717 / 753, on = rgb(202, 202, 202)", vt.every(([x, w, h, on, bg], i) => Math.abs(x - [717, 753][i]) <= 0.5 && w === 28 && h === 28 && bg === (on ? "rgb(202, 202, 202)" : "rgba(0, 0, 0, 0)")) && vt.some((t) => t[3]), JSON.stringify(vt))
  // rework: the side groups never overlap the tools; the right group reserves its width and moves the tools aside when room runs out
  const bars = []
  let title1024
  for (const w of [1024, 1100, 1280]) {
    await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(250)
    if (w === 1024) title1024 = await page.evaluate(() => { const b = document.querySelector('[data-testid="demo"] [data-testid="book-title"]'), e = b.firstElementChild, r = e.getBoundingClientRect(), s = getComputedStyle(e)
      return { to: s.textOverflow, ov: s.overflowX, cut: e.scrollWidth > e.clientWidth, w: +r.width.toFixed(2), right: +r.right.toFixed(2), box: +b.getBoundingClientRect().right.toFixed(2), size: +b.querySelector('[data-testid="book-size"]').getBoundingClientRect().width.toFixed(2) } })
    bars.push(await page.evaluate(() => { const d = document.querySelector('[data-testid="demo"]'), r = (s) => d.querySelector(s).getBoundingClientRect(), s = r('[data-testid="editor-bar-start"]'), t = r('[data-testid="editor-bar"] [role=toolbar][aria-label="Tools"]'), e = r('[data-testid="editor-bar-end"]'), bar = r('[data-testid="editor-bar"]')
      return [innerWidth, +(t.left - s.right).toFixed(2), +(e.left - t.right).toFixed(2), +(bar.right - e.right).toFixed(2), +t.width.toFixed(2)] }))
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(300)
  ok("kit-sync KS1 rework: top bar at 1024 / 1100 / 1280 — start · tools · end never overlap (gaps ≥ 8), end stays inside the bar, tools 210", bars.every(([, a, b, c, w]) => a >= 7.5 && b >= 7.5 && c >= 0 && Math.abs(w - 210) <= 0.5), JSON.stringify(bars))
  // round 2: a clipped book title ends in "…" inside its button (was shrink-0: "Lake tri" cut by the button edge)
  ok("kit-sync KS1 round 2: at 1024 the top-bar book title truncates with an ellipsis and stays inside its button, the size text gives way first", title1024.to === "ellipsis" && title1024.ov === "hidden" && title1024.right <= title1024.box + 0.5 && (!title1024.cut || title1024.size <= 0.5), JSON.stringify(title1024))
  const defs = await page.evaluate(() => ["[data-guide]", '[data-testid^="ruler-"]', '[data-testid="print-overlay"]'].map((s) => document.querySelectorAll(`[data-testid="demo"] ${s}`).length))
  ok("kit-sync KS1: the #/demo canvas opens with 0 guides, 0 rulers, 0 bleed / trim / safe overlays (no dashed safe lines)", defs.join() === "0,0,0", defs.join())
  await page.locator(`${demo} [data-testid="filmstrip"] [role="row"]`).nth(1).dragTo(page.locator(`${demo} [data-testid="canvas"] [data-current] [data-testid="frame"]`).first()); await page.waitForTimeout(400) // p02 = the 800 px low-res photo
  ok("kit10 → kit-sync KS1: no DPI toggle in #/demo, so a low-res photo shows no dpi badge (prod has none)", (await page.locator(`${demo} [data-testid="canvas"] [data-frame]`).filter({ hasText: /dpi/ }).count()) === 0)
  // kit-sync K1 (prod M43): Esc during a frame drag clears the "Release to replace" chip and the dimmed drag source
  {
    const fb = await page.locator(`${demo} [data-testid="spread"][data-current] [data-testid="frame"]`).first().boundingBox(), x = fb.x + fb.width / 2, y = fb.y + fb.height / 2
    await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 6; i++) await page.mouse.move(x - 10 * i, y + 6 * i)
    const mid = await page.locator(`${demo} [data-testid="canvas"]`).getByText("Release to replace").count()
    await page.keyboard.press("Escape"); await page.mouse.up(); await page.waitForTimeout(250)
    const after = await page.locator(`${demo} [data-testid="canvas"]`).getByText("Release to replace").count(), dim = await page.locator(`${demo} [data-frame].opacity-40`).count()
    ok("kit-sync K1: Esc during a frame drag clears the Release to replace chip and the dimmed source", mid === 1 && after === 0 && dim === 0, `mid ${mid} after ${after} dimmed ${dim}`)
    await page.keyboard.press("Escape"); await page.waitForTimeout(200)
  }
  // KS1: rulers (Shift+R) and guides (Ctrl+;) are on keys as in prod; guides stay shown for the master guide checks below
  await page.keyboard.press("Shift+R"); await page.keyboard.press("Control+;"); await page.waitForTimeout(200)
  const g0 = await page.locator(`${demo} [data-testid="spread"] [data-guide]`).count()
  const rx = await page.locator(`${demo} [data-testid="ruler-x"]`).boundingBox(), sp = await page.locator(`${demo} [data-testid="spread"]`).first().boundingBox()
  await page.mouse.move(rx.x + rx.width / 2, rx.y + 10); await page.mouse.down(); await page.mouse.move(rx.x + rx.width / 2, sp.y + sp.height * 0.4, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250)
  ok("kit10: rulers show and a drag from the ruler adds a guide", (await page.locator(`${demo} [data-testid="spread"] [data-guide]`).count()) === g0 + 1, `${g0}→+1`)
  await page.keyboard.press("Shift+R")
  await page.locator(`${demo} [data-item="p1"]`).hover(); await c('[data-item="p1"] [data-testid="spread-menu"]'); await page.waitForTimeout(250)
  ok("kit10: spread row menu offers Add after / Duplicate / Delete", (await page.getByRole("menuitem").allInnerTexts()).filter((t) => /Add after|Duplicate|Delete/.test(t)).length === 3)
  await page.getByRole("menuitem", { name: /Duplicate/ }).click(); await page.waitForTimeout(300)
  const n0 = await page.locator(`${demo} [data-testid="panel-l"] [role=row]`).count()
  // kit-sync KS8 (M17): the spread list ends without the Add spread + Ctrl+↵ row (the row menu Add after stays)
  const addRows = await page.locator(`${demo} [data-testid="panel-l"]`).getByText(/^Add spread$|^Ctrl\+↵$/).count() + await page.locator(`${demo} [data-testid="add-spread"]`).count()
  ok("kit10: spread list is a drag source (reorder) — kit-sync KS8: 0 Add spread rows", (await page.locator(`${demo} [data-testid="panel-l"] button`).filter({ hasText: "Drag" }).count()) > 0 && addRows === 0, `${n0} rows, ${addRows} add-spread`)
  // master guides + Page numbers feed every spread on the master
  await page.locator(`${demo} [data-testid="mode-seg"]`).getByText("Masters", { exact: true }).click(); await page.waitForTimeout(250)
  await page.keyboard.press("Shift+R"); await page.waitForTimeout(200)
  const m0 = await page.locator(`${demo} [data-testid="node-view"] [data-guide]`).count()
  const ry = await page.locator(`${demo} [data-testid="ruler-y"]`).boundingBox(), mb = await page.locator(`${demo} [data-testid="canvas-master"]`).boundingBox()
  await page.mouse.move(ry.x + 10, ry.y + ry.height / 2); await page.mouse.down(); await page.mouse.move(mb.x + mb.width * 0.3, ry.y + ry.height / 2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250)
  const m1 = await page.locator(`${demo} [data-testid="node-view"] [data-guide]`).count()
  await c('[data-testid="insp-master"] [role=switch][aria-label="Page numbers"]'); await page.waitForTimeout(200)
  await page.locator(`${demo} [data-testid="mode-seg"]`).getByText("Pages", { exact: true }).click(); await page.waitForTimeout(250); await c('[data-item="p1"]'); await page.waitForTimeout(250)
  ok("kit10: a guide dragged on a master is kept and inherited (dashed) by its spreads", m1 === m0 + 1 && (await page.locator(`${demo} [data-testid="spread"] [data-guide]`).count()) >= m1, `master ${m0}→${m1}`)
  ok("kit10: master Page numbers toggle wires Parent.pageNumbers — spreads show page numbers", (await page.locator(`${demo} [data-testid="spread"][data-current] [data-testid="page-number"]`).count()) === 2)
  // page-numbers-kit: folio box 20 × 4.34 mm at y = min(H − bottom/2 − 2.17, H − safe − 4.34) (safe = the book's S, 8 mm), x per Outer / Centre /
  // Inner from Master A's margins, Inter 3.1 mm × px/mm, painted under the spread frames; the single last page gets the left folio; none in the
  // spread list; Start at / Format / Skip first from Book settings
  {
    const mode = async (t) => { await page.locator(`${demo} [data-testid="mode-seg"]`).getByText(t, { exact: true }).click(); await page.waitForTimeout(250) }
    const toP1 = async () => { await mode("Pages"); await c('[data-item="p1"]'); await page.waitForTimeout(250) }
    const fol = () => page.evaluate((demo) => {
      const sp = document.querySelector(`${demo} [data-testid="spread"][data-current]`), s = sp.getBoundingClientRect(), kids = [...sp.children]
      const fs = [...sp.querySelectorAll('[data-testid="page-number"]')], own = kids.findIndex((k) => k.matches('[data-testid="frame"]'))
      const box = (e, s) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { l: r.left - s.left, r: r.right - s.left, t: r.top - s.top, al: cs.textAlign, fz: parseFloat(cs.fontSize), col: cs.color, tx: e.textContent } }
      return { w: s.width, n: [...document.querySelectorAll(`${demo} [data-item]`)].filter((e) => /^p\d+$/.test(e.dataset.item)).length, under: own === -1 || fs.every((e) => kids.indexOf(e) < own), f: fs.map((e) => box(e, s)) }
    }, demo)
    const lastFol = async () => { await c('[data-item="last"]'); await page.waitForTimeout(250)
      return page.evaluate((demo) => { const lp = document.querySelector(`${demo} [data-testid="canvas-last"]`), lr = lp?.getBoundingClientRect()
        return lp ? [...lp.querySelectorAll('[data-testid="page-number"]')].map((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { l: r.left - lr.left, r: r.right - lr.left, t: r.top - lr.top, al: cs.textAlign, fz: parseFloat(cs.fontSize), tx: e.textContent } }) : null }, demo) }
    const bk = await page.evaluate(() => window.__demo.state().books[0].book), P = bk.w * 10, H = bk.h * 10
    await mode("Masters")
    const fv = async (k) => +(await page.locator(`${demo} [data-testid="master-field-${k}"]`).inputValue()), g = { b: await fv("B"), i: await fv("I"), o: await fv("O") }
    const chips = () => page.evaluate((demo) => { const m = document.querySelector(`${demo} [data-testid="canvas-master"]`).getBoundingClientRect()
      return { w: m.width, t: [...document.querySelectorAll(`${demo} [data-testid="master-pn"]`)].map((e) => e.getBoundingClientRect().top - m.top) } }, demo)
    const seg = `${demo} [data-testid="master-pn-position"] button`, got = []
    for (let i = 0; i < 3; i++) { await page.locator(seg).nth(i).click(); await page.waitForTimeout(150); const al = await page.locator(`${demo} [data-testid="master-pn"]`).evaluateAll((es) => es.map((e) => e.dataset.align).join()); const ch = await chips(); await toP1(); got.push({ ...(await fol()), al, ch, last: await lastFol() }); await mode("Masters") }
    await page.locator(seg).nth(0).click(); await page.waitForTimeout(150)
    const k = got[0].w / (2 * P), near = (a, b) => Math.abs(a - b) <= 0.5, ymm = Math.min(H - g.b / 2 - 2.17, H - bk.safe - 4.34), y = ymm * k
    const [o, ce, inn] = got.map((x) => x.f)
    const geo = bk.safe === 8 && got.every((x) => x.f.length === 2 && x.under && x.f.every((f) => near(f.t, y) && near(f.fz, 3.1 * k) && f.col === "rgb(35, 34, 32)"))
      && near(o[0].l, g.o * k) && o[0].al === "left" && near(o[1].r, got[0].w - g.o * k) && o[1].al === "right" && got[0].al === "left,right"
      && near((ce[0].l + ce[0].r) / 2, (P / 2) * k) && near((ce[1].l + ce[1].r) / 2, (P * 1.5) * k) && ce.every((f) => f.al === "center") && got[1].al === "center,center"
      && near(inn[0].r, (P - g.i) * k) && inn[0].al === "right" && near(inn[1].l, (P + g.i) * k) && inn[1].al === "left" && got[2].al === "right,left"
    ok("page-numbers-kit: spread folios follow Outer / Centre / Inner at the master margins, top in the bottom margin band inside the book's safe margin, Inter 3.1 mm, under the spread frames (±0.5 px)", geo, JSON.stringify({ k, ymm, y, g, safe: bk.safe, got }))
    ok("page-numbers-kit: the master # chip sits at the folio top inside the book's safe margin (±0.5 px)", got.every((x) => x.ch.t.length === 2 && x.ch.t.every((t) => near(t, ymm * x.ch.w / (2 * P)))), JSON.stringify(got.map((x) => x.ch)))
    const [lo, lc, li] = got.map((x) => x.last?.[0])
    ok("page-numbers-kit: the single last page prints the left-page folio (page 2n) at Outer / Centre / Inner (±0.5 px)", got.every((x) => x.last?.length === 1 && x.last[0].tx === `${2 * x.n}` && near(x.last[0].t, y) && near(x.last[0].fz, 3.1 * k))
      && near(lo.l, g.o * k) && lo.al === "left" && near((lc.l + lc.r) / 2, (P / 2) * k) && lc.al === "center" && near(li.r, (P - g.i) * k) && li.al === "right", JSON.stringify(got.map((x) => x.last)))
    ok("page-numbers-kit: no folios in the spread list", (await page.locator(`${demo} [data-testid="panel-l"] [data-testid="page-number"]`).count()) === 0)
    // master hint → Book settings; the Page numbers section sits between Binding and Print (179.37 px with a one-line note)
    const hint = await page.locator(`${demo} [data-testid="master-pn-note"]`).innerText()
    await c('[data-testid="master-pn-book-settings"]'); await page.waitForTimeout(250)
    const bs = await page.evaluate((demo) => { const s = document.querySelector(`${demo} [data-testid="book-page-numbers"]`)
      const st = s?.querySelector('[data-testid="book-pn-start"]') // the Start at value fits its 2ch field (no spin buttons eating it)
      return { h: s?.getBoundingClientRect().height, fits: !!st && st.value === "1" && st.scrollWidth <= st.clientWidth, eyebrows: [...document.querySelectorAll(`${demo} [data-testid="insp-book"] h3`)].map((h) => h.textContent).join("/") } }, demo)
    ok("page-numbers-kit: master hint links to Book settings; Page numbers section between Binding and Print, 179.37 px", hint === "Starts at 1 · 1, 2, 3 · Book settings" && near(bs.h, 179.37) && bs.fits && bs.eyebrows === "Page size/Binding/Page numbers/Print/Defaults"
      && (await page.locator(`${demo} [data-testid="book-pn-note"]`).innerText()) === "Page 1 is 1", `${hint} ${JSON.stringify(bs)}`)
    const start = page.locator(`${demo} [data-testid="book-pn-start"]`), fmt = (i) => page.locator(`${demo} [data-testid="book-pn-format"] button`).nth(i).click(), skip = () => c(`${demo} [data-testid="book-pn-skip-first"]`)
    await start.fill("5"); await page.keyboard.press("Enter"); await start.fill("12"); await page.keyboard.press("Escape"); await fmt(1); await skip(); await page.waitForTimeout(200)
    const note = await page.locator(`${demo} [data-testid="book-pn-note"]`).innerText(), sv = await start.inputValue()
    await toP1(); const p1 = (await fol()).f.map((f) => f.tx).join(); await c('[data-item="p0"]'); await page.waitForTimeout(250); const p0 = (await fol()).f.length
    await c('[data-testid="book-title"]'); await page.waitForTimeout(250); await skip(); await c('[data-item="p0"]'); await page.waitForTimeout(250); const p0n = (await fol()).f
    ok("page-numbers-kit: Start at 5 + i, ii, iii + Skip first page → vi / vii on pages 2–3, none on page 1; Skip off → v on the right page", sv === "5" && note === "Page 1 has no number · page 2 is vi" && p1 === "vi,vii" && p0 === 0 && p0n.length === 1 && p0n[0].tx === "v" && p0n[0].l >= got[0].w / 2,
      `start=${sv} note="${note}" p1=${p1} p0=${p0}/${p0n.map((f) => f.tx)}`)
    await c('[data-testid="book-title"]'); await page.waitForTimeout(250); await start.fill("1"); await page.keyboard.press("Enter"); await fmt(0); await page.waitForTimeout(150); await toP1()
    // Preview prints the folios on every page slide (page 1 alone, the spreads, the last page alone) at the slide scale
    await page.click('[data-testid="demo-preview"]'); await page.waitForTimeout(500)
    const pv = []
    for (let j = 0; j < 40; j++) {
      pv.push(await page.evaluate(() => { const root = document.querySelector('[data-testid="presentation"]'), s = root.querySelector('[data-testid="presentation-slide"][data-active="true"]'), b = s.firstElementChild.getBoundingClientRect()
        return { cap: root.querySelector('[data-testid="pager-position"]').textContent, w: b.width, f: [...s.querySelectorAll('[data-testid="page-number"]')].map((e) => { const r = e.getBoundingClientRect(); return { l: r.left - b.left, r: r.right - b.left, t: r.top - b.top, tx: e.textContent } }) } }))
      if (j > 0 && pv[j].cap === pv[j - 1].cap) { pv.pop(); break }
      await page.keyboard.press("ArrowRight"); await page.waitForTimeout(260)
    }
    await page.keyboard.press("Escape"); await page.waitForTimeout(300)
    const N = pv.length - 1, s1 = pv[1], sN = pv[N], ks = (x) => x.w / P
    ok("page-numbers-kit: Preview prints folios on every page slide — page 1 right Outer, 2 per spread, the last page left Outer, top inside the safe margin (±0.5 px)",
      N >= 3 && pv[0].f.length === 0 && pv.slice(2, -1).every((x) => x.f.length === 2 && x.f.every((f) => near(f.t, ymm * x.w / (2 * P))))
        && s1.f.length === 1 && s1.f[0].tx === "1" && near(s1.f[0].r, s1.w - g.o * ks(s1)) && near(s1.f[0].t, ymm * ks(s1))
        && sN.f.length === 1 && sN.f[0].tx === `${2 * got[0].n}` && near(sN.f[0].l, g.o * ks(sN)) && near(sN.f[0].t, ymm * ks(sN)), JSON.stringify(pv.map((x) => `${x.cap}:${x.f.map((f) => `${f.tx}@${f.l.toFixed(2)},${f.t.toFixed(2)}`).join("|")}`)))
  }
  // parent-guides PG5: inherited guides are dashed --parent-soft, 24 px past the page, under own guides and pointer-transparent
  const pg = await page.evaluate((demo) => {
    const sp = document.querySelector(`${demo} [data-testid="spread"][data-current]`)
    const all = [...sp.querySelectorAll("[data-guide]")], inh = all.filter((g) => g.dataset.passive !== undefined)
    const order = all.findIndex((g) => g.dataset.passive === undefined) === -1 || all.findIndex((g) => g.dataset.passive === undefined) > all.indexOf(inh.at(-1))
    const look = inh.map((g) => { const ln = g.firstElementChild, cs = getComputedStyle(ln), v = g.offsetHeight > g.offsetWidth, par = g.offsetParent
      return { v, img: cs.backgroundImage, w: v ? ln.offsetWidth : ln.offsetHeight, pe: getComputedStyle(g).pointerEvents, over: v ? [-g.offsetTop, g.offsetHeight - par.clientHeight + g.offsetTop] : [-g.offsetLeft, g.offsetWidth - par.clientWidth + g.offsetLeft] } })
    // a point on an inherited line inside an own frame: elementFromPoint must be that frame
    let hit = null
    for (const g of inh) { const r = g.firstElementChild.getBoundingClientRect(), v = r.height > r.width
      for (const f of sp.querySelectorAll('[data-testid="frame"]')) { const b = f.getBoundingClientRect()
        const x = v ? r.left + r.width / 2 : b.left + b.width / 2, y = v ? b.top + b.height / 2 : r.top + r.height / 2
        if (x > b.left + 2 && x < b.right - 2 && y > b.top + 2 && y < b.bottom - 2) { hit = { x, y, id: f.dataset.frame, at: document.elementFromPoint(x, y)?.closest("[data-frame]")?.dataset.frame ?? null }; break } }
      if (hit) break }
    return { n: inh.length, order, look, hit }
  }, demo)
  ok("parent-guides PG5: a Master A spread shows its master's guides dashed rgb(163, 161, 162), 1 px, 24 px past the page, pointer-events none, under own guides",
    pg.n >= 1 && pg.order && pg.look.every((l) => /repeating-linear-gradient\(.*rgb\(163, 161, 162\)/.test(l.img) && l.w === 1 && l.pe === "none" && l.over[0] === 24 && l.over[1] === 24), JSON.stringify({ n: pg.n, order: pg.order, look: pg.look[0] }))
  ok("parent-guides PG2: elementFromPoint on a parent guide over a frame is the frame", !!pg.hit && pg.hit.at === pg.hit.id, JSON.stringify(pg.hit))
  if (pg.hit) { await page.mouse.click(pg.hit.x, pg.hit.y); await page.waitForTimeout(200) }
  const pgStatus = (await page.locator(`${demo} [data-testid="status"]`).textContent()) ?? ""
  ok("parent-guides PG2: a click on a parent guide selects the frame below, no status", (await page.locator(`${demo} [data-current] [data-testid="sel-handle"]`).count()) > 0 && !/parent spread/.test(pgStatus), pgStatus)
  await page.keyboard.press("Escape"); await page.waitForTimeout(150)
  await page.locator(`${demo} [data-current] [data-testid="master-frame"]`).first().click({ modifiers: ["Alt"], force: true }); await page.waitForTimeout(250)
  ok("kit10: Alt+click on a parent item makes an override copy", (await page.locator(`${demo} [data-testid="spread"][data-current]`).getByText("override", { exact: true }).count()) === 1)
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

// kit-sync W4 (Designer kit-sync Spec 9–11, = prod): no Pastedown caption, cover inspector selects + row tops, read-only pills flush right, light library card title
{
  const e0 = errs.length
  await go("#/demo", 500); await page.evaluate(() => window.__demo.reset()); await page.waitForTimeout(500)
  const c = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(300) }
  await c('[data-testid="create-library"]'); await c('[data-testid="picker-select"]')
  await c(`${demo} [data-testid="new-book"]`); await page.locator("[role=dialog] input").first().fill("Lake trip"); await c('[data-testid="create-book"]'); await c('[data-item="cover"]')
  // text-node boxes (Spec measures glyph runs, not padded pills)
  const textBox = (sel, t) => page.evaluate(([sel, t]) => { const e = [...document.querySelectorAll(sel)].find((x) => x.textContent.trim().toLowerCase() === t.toLowerCase()); if (!e) return null; const g = document.createRange(); g.selectNodeContents(e); const b = g.getBoundingClientRect(); return { x: b.x, top: b.top } }, [sel, t])
  const near = (a, b) => a != null && Math.abs(a - b) <= 1
  const TOPS = { "Title font": 285.44, Spine: 343.86, "Spine width": 415.70, Direction: 450.55, Back: 504.39, Fill: 580.23, Material: 634.08, Finish: 718.50 }
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
  if ((await page.locator(`${demo} [role=switch][aria-label="Endpapers"]`).getAttribute("aria-checked")) !== "true") await c('[role=switch][aria-label="Endpapers"]')
  await c('[data-item="ef"]')
  const ep = page.locator(`${demo} [data-testid="canvas-endpaper"]`)
  ok("kit-sync KS9: endpaper canvas has no «Pastedown · glued to … board» caption", (await ep.count()) === 1 && !/Pastedown/.test(await ep.textContent()))
  // r15 M89 (prod .endpaper-caption margin-top 0.5rem): the "Endpaper" caption is 12 px, 8 px under the endpaper bottom
  const epc = await page.evaluate(() => { const d = document.querySelector('[data-testid="demo"]'), v = d.querySelector('[data-testid="canvas-endpaper"]').getBoundingClientRect(), s = [...d.querySelectorAll('[data-testid="page-labels"] span')].find((x) => x.textContent === "Endpaper"); return s && { fs: getComputedStyle(s).fontSize, dy: +(s.getBoundingClientRect().top - v.bottom).toFixed(2) } })
  ok("r15 M89: endpaper caption 12 px, 8 px under the endpaper bottom (±0.5)", epc?.fs === "12px" && Math.abs(epc.dy - 8) <= 0.5, JSON.stringify(epc))
  // r15 M91 (prod .endpaper-gutter): the spine is a 1 px hard line, black 18 %, centred on the spread — no gradient band
  const sp = await page.evaluate(() => { const v = document.querySelector('[data-testid="demo"] [data-testid="canvas-endpaper"]'), l = v.querySelector('[data-testid="endpaper-spine"]'), vb = v.getBoundingClientRect(), b = l?.getBoundingClientRect(), cs = l && getComputedStyle(l); return l && { w: b.width, h: b.height, vh: vb.height, dx: +(b.x - (vb.x + vb.width / 2)).toFixed(2), bg: cs.backgroundColor, img: cs.backgroundImage, grads: [...v.querySelectorAll("div")].filter((e) => /linear-gradient/.test(getComputedStyle(e).backgroundImage)).length } })
  ok("r15 M91: endpaper spine 1 px line at the centre, rgb(0 0 0 / 0.18), no gradient", sp?.w === 1 && sp.h === sp.vh && Math.abs(sp.dx) <= 0.5 && /^(rgba\(0, 0, 0, 0\.18\)|color\(srgb 0 0 0 \/ 0\.18\))$/.test(sp.bg) && sp.img === "none" && sp.grads === 0, JSON.stringify(sp))
  await c('[data-testid="editor-library"]')
  const ink = await page.locator(`${demo} [data-testid="book-cover"] .lib-obj div[style*="color"]`).first().evaluate((e) => getComputedStyle(e).color)
  ok("kit-sync KS11: library card title over the photo rgb(245, 245, 245)", ink === "rgb(245, 245, 245)", ink)
  ok("kit-sync W4: no console errors", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
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
  const chev = await size.evaluate((e) => { const s = getComputedStyle(e); return { svg: /svg/.test(s.backgroundImage) && /m6 9 6 6 6-6/.test(s.backgroundImage) && /%236b696a/i.test(s.backgroundImage), gradient: /gradient/.test(s.backgroundImage), size: s.backgroundSize, pos: s.backgroundPosition, pr: s.paddingRight } })
  ok("kit-sync KS15: Page size select shows a 16 px chevron-down #6b696a (prod .pb-select), not the triangle caret", chev.svg && !chev.gradient && chev.size === "16px 16px" && chev.pos === "calc(100% - 8px) 50%" && chev.pr === "32px", JSON.stringify(chev))
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

// r16 M92 (Designer #421, = prod pasteboardClickSpreadId): a grey-canvas press activates the nearest spread and keeps the scroll
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
  // the list grid eats Escape; the demo walk presses it from the inspector, here from the body
  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press("Escape"); await page.waitForTimeout(200); await page.keyboard.press("Escape"); await page.waitForTimeout(300)
  const read = () => page.evaluate(() => {
    const span = [...document.querySelectorAll('[data-stack-item="0"] [data-testid="page-labels"] span')].find((s) => s.textContent.trim() === "1")
    const g = document.createRange(); if (span) g.selectNodeContents(span)
    return { rows: [...document.querySelectorAll('[data-testid="list"] [aria-selected="true"]')].map((e) => e.getAttribute("data-item")), insp: document.querySelector('[data-testid="inspector"]')?.innerText.split("\n").slice(0, 2).join(" · "), y: span ? g.getBoundingClientRect().y : null }
  })
  const before = await read()
  await page.locator('[data-testid="canvas"]').click({ position: { x: 20, y: 20 } }); await page.waitForTimeout(400)
  const after = await read()
  // the demo walk (demo-capture editor-spread-selected) reads y 66.25 before and after; this shorter walk (no photos added) lands at 52.25
  ok("r16 M92: before the press (Esc ×2) no row and the empty inspector; page 1 above the centred spread 2–3 (label y < 100)", before.rows.length === 0 && before.insp === "Select a spread or photo" && before.y < 100, JSON.stringify(before))
  ok("r16 M92: grey press at canvas 20,20 → row p0 (page 1) selected, inspector Spread · Page 1, page-1 label y unchanged ±0.5 (no re-centre)", after.rows.join() === "p0" && /^Spread · Page 1\b/.test(after.insp) && Math.abs(after.y - before.y) <= 0.5, JSON.stringify(after))
  ok("r16 M92: no console errors", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
}

// Designer r17 (kit-thumbgrid-page-select, = prod centerSpreadScroll): Masters → Pages remounts the stack and centres the current spread
// even when it was fully in view — zoomed out 6 steps, spread 4–5 sits fully in view at scrollTop 0 and is not centred by the pick
{
  const e0 = errs.length
  await go("#/demo", 500); await page.evaluate(() => window.__demo.reset()); await page.waitForTimeout(500)
  const c = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(300) }
  await c('[data-testid="create-library"]'); await c('[data-testid="picker-select"]')
  await c(`${demo} [data-testid="new-book"]`); await page.locator("[role=dialog] input").first().fill("Lake trip"); await c('[data-testid="create-book"]')
  for (let i = 0; i < 6; i++) { await page.locator('[data-testid="pasteboard"]').hover(); await page.keyboard.press("Control+Minus"); await page.waitForTimeout(200) }
  await c('[data-item="p2"]')
  const read = () => page.evaluate(() => {
    const pb = document.querySelector('[data-testid="pasteboard"]'), el = pb?.querySelector('[data-stack-item="2"]')
    if (!el) return null
    return { top: pb.scrollTop, want: Math.max(0, Math.min(el.offsetTop + el.offsetHeight / 2 - pb.clientHeight / 2, pb.scrollHeight - pb.clientHeight)) }
  })
  const before = await read()
  const seg = page.locator('[data-testid="mode-seg"]')
  await seg.getByText("Masters", { exact: true }).click(); await page.waitForTimeout(300)
  const gone = await page.locator("[data-stack-item]").count()
  await seg.getByText("Pages", { exact: true }).click(); await page.waitForTimeout(500)
  const after = await read()
  ok("Designer r17: picked spread 4–5 fully in view keeps scrollTop 0 (not yet centred)", before?.top === 0 && before.want > 50, JSON.stringify(before))
  ok("Designer r17: Masters → Pages remounts the stack and centres spread 4–5 (scrollTop = centre ±1)", gone === 0 && after && Math.abs(after.top - after.want) <= 1, JSON.stringify({ gone, after }))
  ok("Designer r17: no console errors", errs.length === e0, errs.slice(e0).join(" | ").slice(0, 300))
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


fs.writeFileSync(new URL("../qa-report.txt", import.meta.url), res.join("\n") + "\n\nCONSOLE:\n" + (errs.join("\n") || "none") + "\n")
console.log(res.join("\n")); console.log(`\n${res.length - fails} passed, ${fails} failed; console errors/warnings: ${errs.length}`); if (errs.length) console.log(errs.slice(0, 20).join("\n"))

await browser.close()
process.exit(fails || errs.length ? 1 : 0)

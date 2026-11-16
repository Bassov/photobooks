// Headless QA for the #/guide page over file:// (needs a built dist/ and Chrome; see scripts/chrome.mjs).  node scripts/guide-qa.mjs
//  1. 21 chapters + one h1, no console errors, every image loads, feature figcaptions name their slug; KitBar Guide link is current
//  2. every MANIFEST slug maps to a chapter; every link on the page resolves; NOT_IN_APP empty, nothing says Coming
//  3. the kit imposition() copy equals prod for 1–120 pages × 2up/4up; fixed sheets for 20 / 22 pages
//  4. Pages 22 / 2-up: summary + 6 sheets (sheet 1 back-right paints "blank"); 4-up: 74 × 104 faces, the cut step on;
//     the assembly row top is the same in all 10 layout × pages combinations
//  5. TOC link 16 scrolls #print-home to y 72 ±1 and marks it current; #/guide/<id> deep link lands at y 72;
//     at #settings the current TOC link is inside the TOC's visible box
//  6. no horizontal page scroll at 1280
import { chromium } from "playwright-core"
import fs from "node:fs"
import { isDeepStrictEqual } from "node:util"
import { chromePath } from "./chrome.mjs"
import { CHAPTERS, CHAPTER_OF, LAYOUTS, NOT_IN_APP, PAGE_COUNTS } from "../src/kit/guide/content.ts"
import { imposition } from "../src/kit/guide/imposition.ts"
import { imposition as prodImposition } from "../../src/core/print/imposition.ts"

const url = "file://" + new URL("../dist/index.html", import.meta.url).pathname
const slugs = JSON.parse(fs.readFileSync(new URL("../src/kit/pages.json", import.meta.url))).map((p) => p.slug)
const ids = CHAPTERS.map((c) => c.id)
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`${m.type()}: ${m.text().slice(0, 240)}`) })
page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`))
page.on("requestfailed", (r) => errs.push(`requestfailed: ${r.url()}`))
const res = []; let fails = 0
const ok = (name, cond, extra = "") => { if (!cond) fails++; res.push(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`) }
const top = (sel) => page.evaluate((s) => document.querySelector(s)?.getBoundingClientRect().top ?? NaN, sel)
const docTop = (sel) => page.evaluate((s) => (document.querySelector(s)?.getBoundingClientRect().top ?? NaN) + scrollY, sel)

// 1. structure, images, console
await page.goto(url + "#/guide"); await page.waitForTimeout(400)
const n = await page.evaluate(() => ({ sections: document.querySelectorAll("section[data-guide-chapter]").length, h1: document.querySelectorAll("h1").length, h2: document.querySelectorAll("h2").length, title: document.title }))
ok("21 chapters, one h1, an h2 per chapter + index", n.sections === 21 && n.h1 === 1 && n.h2 === 22, JSON.stringify(n))
ok("document title", n.title === "Guide · Photobooks UI kit", n.title)
ok("KitBar Guide link is current", (await page.getAttribute('[data-nav="guide"]', "aria-current")) === "page")
const H = await page.evaluate(() => document.documentElement.scrollHeight)
for (let y = 0; y < H; y += 600) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(40) }
await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r })))))
const imgs = await page.$$eval("img", (is) => is.map((i) => ({ src: i.getAttribute("src"), w: i.naturalWidth, alt: i.alt, wa: i.getAttribute("width"), ha: i.getAttribute("height") })))
const badImg = imgs.filter((i) => !(i.w > 0) || !i.alt.endsWith(": kit demo screenshot") || !i.wa || !i.ha)
ok("every image loads, has alt + width/height", imgs.length === CHAPTERS.filter((c) => c.figure).length && imgs.length === 20 && badImg.length === 0, `${imgs.length} images; bad: ${badImg.map((i) => i.src).join(",") || "-"}`)
const caps = await page.$$eval("section[data-guide-chapter]", (ss) => Object.fromEntries(ss.map((s) => [s.id, s.querySelector("figcaption")?.textContent.replace(/\s+/g, " ").trim()])))
const badCap = CHAPTERS.filter((c) => c.figure && "feature" in c.figure && caps[c.id] !== `Kit page ${c.figure.feature}, state ${c.figure.scenario}`).map((c) => `${c.id}: ${caps[c.id]}`)
ok("feature figcaptions name their kit page and state", badCap.length === 0 && CHAPTERS.some((c) => c.figure && "feature" in c.figure), badCap.join(" | ") || "-")

// 2. mapping + links
const unmapped = slugs.filter((s) => !ids.includes(CHAPTER_OF[s]))
ok("every MANIFEST slug maps to a chapter", unmapped.length === 0, unmapped.join(",") || `${slugs.length} slugs`)
const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))
const good = (h) => h === "#/" || h === "#/components" || h === "#/credits" || h === "#/demo" || h === "#/guide" || (h.startsWith("#/guide/") && [...ids, "feature-index"].includes(h.slice(8))) || (h.startsWith("#/feature/") && slugs.includes(h.slice(10)))
const bad = hrefs.filter((h) => !good(h))
const rows = await page.$$eval("[data-feature-row]", (rs) => rs.map((r) => r.getAttribute("data-feature-row")))
ok("every link resolves", bad.length === 0, `${hrefs.length} links; bad: ${bad.join(",") || "-"}`)
ok("feature index lists MANIFEST in order", JSON.stringify(rows) === JSON.stringify(slugs), `${rows.length}/${slugs.length}`)
const coming = await page.locator('[data-status="coming"]').count()
ok("NOT_IN_APP is empty and nothing says Coming", Object.keys(NOT_IN_APP).length === 0 && coming === 0, `${Object.keys(NOT_IN_APP).length} slugs, ${coming} chips`)

// 3. imposition order
const diff = []
for (let p = 1; p <= 120; p++) for (const l of ["2up", "4up"]) if (!isDeepStrictEqual(imposition(p, l), prodImposition(p, l))) diff.push(`${p}/${l}`)
ok("kit imposition() == prod for 1–120 pages × 2up/4up", diff.length === 0, diff.slice(0, 8).join(",") || "240 cases")
const i20 = imposition(20, "2up"), i22 = imposition(22, "2up"), q22 = imposition(22, "4up")
ok("imposition(20,'2up') sheet 1 = front [20, 1], back [2, 19]", isDeepStrictEqual(i20.sheets[0], { front: [20, 1], back: [2, 19] }), JSON.stringify(i20.sheets[0]))
ok("imposition(22,'2up'): 6 sheets, 2 blanks, sheet 1 back [2, null]", i22.sheets.length === 6 && i22.blanks === 2 && isDeepStrictEqual(i22.sheets[0].back, [2, null]), JSON.stringify(i22.sheets[0]))
ok("imposition(22,'4up') sheet 1 = front [22, 1, null, 3], back [2, null, 4, 21]", isDeepStrictEqual(q22.sheets[0], { front: [22, 1, null, 3], back: [2, null, 4, 21] }), JSON.stringify(q22.sheets[0]))

// 4. Layout × Pages switch
const panel = page.locator('[data-testid="guide-imposition"]')
const pick = async (group, label) => { await panel.locator(`[role="radiogroup"][aria-label="${group}"]`).getByText(label, { exact: true }).click(); await page.waitForTimeout(120) }
await panel.scrollIntoViewIfNeeded(); await page.waitForTimeout(100)
await pick("Pages", "22")
const sum = await page.textContent('[data-testid="guide-imposition-summary"]')
const sheets = await panel.locator("[data-sheet]").count()
const paint = await page.evaluate(() => {
  const f = document.querySelector('[data-sheet="1"] [data-face="back"]').getBoundingClientRect()
  return document.elementFromPoint(f.left + (f.width * 3) / 4, f.top + f.height / 2)?.closest("[data-page]")?.getAttribute("data-page")
})
ok("22 / 2-up → summary + 6 sheets", sum.replace(/\s+/g, " ").trim() === "22 pages + 2 blank → 6 sheets, printed on both sides" && sheets === 6, `${sum} · ${sheets}`)
ok("22 / 2-up: sheet 1 back-right paints blank", paint === "blank", String(paint))
ok("2-up: the cut step is dimmed", (await panel.locator('[data-testid="guide-assembly"] li[data-skip]').count()) === 1)
await pick("Layout", "4-up")
const face = await panel.locator('[data-sheet="1"] [data-face="front"]').boundingBox()
ok("4-up: 74 × 104 faces, the cut step on", Math.round(face.width) === 74 && Math.round(face.height) === 104 && (await panel.locator('[data-testid="guide-assembly"] li[data-skip]').count()) === 0, `${face.width}×${face.height}`)
await pick("Pages", "20")
const sum4 = (await page.textContent('[data-testid="guide-imposition-summary"]')).replace(/\s+/g, " ").trim()
ok("20 / 4-up summary", sum4 === "20 pages + 4 blank → 3 sheets, printed on both sides, cut across", sum4)
const tops = []
for (const l of LAYOUTS) for (const p of PAGE_COUNTS) { await pick("Layout", l.label); await pick("Pages", String(p)); tops.push(`${l.id}/${p}:${await docTop('[data-testid="guide-assembly"]')}`) }
ok("the assembly row top is the same in all 10 layout × pages combinations", new Set(tops.map((t) => t.split(":")[1])).size === 1 && tops.length === 10, tops.join(" "))

// 5. TOC + deep link
await page.click('[data-guide-link="print-home"]'); await page.waitForTimeout(400)
const t16 = await top("#print-home")
ok("TOC link 16 scrolls #print-home to y 72 ±1", Math.abs(t16 - 72) <= 1, String(t16))
ok("TOC link 16 is current", (await page.getAttribute('[data-guide-link="print-home"]', "aria-current")) === "location" && (await page.locator("[data-guide-link][aria-current]").count()) === 1)
ok("TOC click records #/guide/print-home", (await page.evaluate(() => location.hash)) === "#/guide/print-home")
await page.goto(url + "#/guide/masters"); await page.waitForTimeout(500)
const tm = await top("#masters")
ok("deep link #/guide/masters lands at y 72 ±1 and is current", Math.abs(tm - 72) <= 1 && (await page.getAttribute('[data-guide-link="masters"]', "aria-current")) === "location", String(tm))
await page.evaluate(() => document.getElementById("settings").scrollIntoView({ block: "start" })); await page.waitForTimeout(400)
const tv = await page.evaluate(() => {
  const t = document.querySelector('[data-testid="guide-toc"]').getBoundingClientRect(), a = document.querySelector('[data-guide-link="settings"]')
  const r = a.getBoundingClientRect()
  return { inside: r.top >= t.top && r.bottom <= t.bottom, current: a.getAttribute("aria-current"), link: [r.top, r.bottom], toc: [t.top, t.bottom] }
})
ok("at #settings the TOC shows its current link", tv.inside && tv.current === "location", JSON.stringify(tv))

// 6. 1280
await page.setViewportSize({ width: 1280, height: 800 }); await page.goto(url + "#/guide"); await page.waitForTimeout(400)
const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
ok("no horizontal scroll at 1280", ov <= 0, `overflow ${ov}px`)
const toc = await page.evaluate(() => { const t = document.querySelector('[data-testid="guide-toc"]'); return { cut: [...t.querySelectorAll("a")].filter((a) => a.scrollWidth > a.clientWidth).length } })
ok("TOC labels never truncated", toc.cut === 0, JSON.stringify(toc))

ok("no console errors", errs.length === 0, errs.slice(0, 5).join(" | "))
await browser.close()
console.log(res.join("\n"))
console.log(`\n${res.length - fails}/${res.length} passed`)
process.exit(fails ? 1 : 0)

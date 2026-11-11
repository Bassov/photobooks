// Headless QA for the #/guide page over file:// (needs a built dist/ and Chrome; see scripts/chrome.mjs).  node scripts/guide-qa.mjs
//  1. 18 chapters + one h1, no console errors, every image loads; KitBar Guide link is current
//  2. every MANIFEST slug maps to a chapter; every link on the page resolves
//  3. saddleSheets(20) / saddleSheets(22)
//  4. Pages 22: summary + 6 sheets (sheet 1 front-left paints "blank"), the assembly row does not move
//  5. TOC link 16 scrolls #print-home to y 72 ±1 and marks it current; #/guide/<id> deep link lands at y 72
//  6. no horizontal page scroll at 1280
import { chromium } from "playwright-core"
import fs from "node:fs"
import { chromePath } from "./chrome.mjs"
import { CHAPTERS, CHAPTER_OF } from "../src/kit/guide/content.ts"
import { saddleSheets } from "../src/kit/guide/imposition.ts"

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
ok("18 chapters, one h1, an h2 per chapter + index", n.sections === 18 && n.h1 === 1 && n.h2 === 19, JSON.stringify(n))
ok("document title", n.title === "Guide · Photobooks UI kit", n.title)
ok("KitBar Guide link is current", (await page.getAttribute('[data-nav="guide"]', "aria-current")) === "page")
const H = await page.evaluate(() => document.documentElement.scrollHeight)
for (let y = 0; y < H; y += 600) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(40) }
await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r })))))
const imgs = await page.$$eval("img", (is) => is.map((i) => ({ src: i.getAttribute("src"), w: i.naturalWidth, alt: i.alt, wa: i.getAttribute("width"), ha: i.getAttribute("height") })))
const badImg = imgs.filter((i) => !(i.w > 0) || !i.alt.endsWith(": kit demo screenshot") || !i.wa || !i.ha)
ok("every image loads, has alt + width/height", imgs.length === CHAPTERS.filter((c) => c.figure).length && badImg.length === 0, `${imgs.length} images; bad: ${badImg.map((i) => i.src).join(",") || "-"}`)

// 2. mapping + links
const unmapped = slugs.filter((s) => !ids.includes(CHAPTER_OF[s]))
ok("every MANIFEST slug maps to a chapter", unmapped.length === 0, unmapped.join(",") || `${slugs.length} slugs`)
const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))
const good = (h) => h === "#/" || h === "#/components" || h === "#/credits" || h === "#/demo" || h === "#/guide" || (h.startsWith("#/guide/") && [...ids, "feature-index"].includes(h.slice(8))) || (h.startsWith("#/feature/") && slugs.includes(h.slice(10)))
const bad = hrefs.filter((h) => !good(h))
const rows = await page.$$eval("[data-feature-row]", (rs) => rs.map((r) => r.getAttribute("data-feature-row")))
ok("every link resolves", bad.length === 0, `${hrefs.length} links; bad: ${bad.join(",") || "-"}`)
ok("feature index lists MANIFEST in order", JSON.stringify(rows) === JSON.stringify(slugs), `${rows.length}/${slugs.length}`)

// 3. imposition order
const s20 = saddleSheets(20), s22 = saddleSheets(22)
ok("saddleSheets(20)[0] = front [20, 1], back [2, 19]", JSON.stringify(s20[0]) === JSON.stringify({ front: [20, 1], back: [2, 19] }) && s20.length === 5, JSON.stringify(s20[0]))
ok("saddleSheets(22): 6 sheets, sheet 1 front [24, 1]", s22.length === 6 && JSON.stringify(s22[0].front) === "[24,1]" && JSON.stringify(s22[5]) === JSON.stringify({ front: [14, 11], back: [12, 13] }), JSON.stringify(s22[0]))

// 4. Pages switch
await page.locator('[data-testid="guide-imposition"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(100)
const a0 = await docTop('[data-testid="guide-assembly"]')
await page.locator('[data-testid="guide-imposition"] [role="radiogroup"]').getByText("22", { exact: true }).click(); await page.waitForTimeout(150)
const sum = await page.textContent('[data-testid="guide-imposition-summary"]')
const sheets = await page.locator('[data-testid="guide-imposition"] [data-sheet]').count()
const a1 = await docTop('[data-testid="guide-assembly"]')
const paint = await page.evaluate(() => {
  const f = document.querySelector('[data-sheet="1"] [data-face="front"]').getBoundingClientRect()
  return document.elementFromPoint(f.left + f.width / 4, f.top + f.height / 2)?.closest("[data-page]")?.getAttribute("data-page")
})
ok("Pages 22 → summary + 6 sheets", sum.replace(/\s+/g, " ").trim() === "22 pages + 2 blank → 6 sheets, printed on both sides" && sheets === 6, `${sum} · ${sheets}`)
ok("Pages 22: sheet 1 front-left paints blank", paint === "blank", String(paint))
ok("Pages switch does not move the assembly row", a0 === a1, `${a0} → ${a1}`)

// 5. TOC + deep link
await page.click('[data-guide-link="print-home"]'); await page.waitForTimeout(400)
const t16 = await top("#print-home")
ok("TOC link 16 scrolls #print-home to y 72 ±1", Math.abs(t16 - 72) <= 1, String(t16))
ok("TOC link 16 is current", (await page.getAttribute('[data-guide-link="print-home"]', "aria-current")) === "location" && (await page.locator("[data-guide-link][aria-current]").count()) === 1)
ok("TOC click records #/guide/print-home", (await page.evaluate(() => location.hash)) === "#/guide/print-home")
await page.goto(url + "#/guide/masters"); await page.waitForTimeout(500)
const tm = await top("#masters")
ok("deep link #/guide/masters lands at y 72 ±1 and is current", Math.abs(tm - 72) <= 1 && (await page.getAttribute('[data-guide-link="masters"]', "aria-current")) === "location", String(tm))

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

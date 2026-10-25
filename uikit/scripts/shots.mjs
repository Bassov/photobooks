// Screenshot kit pages over file:// and collect console errors per page.
// node scripts/shots.mjs <outdir> [slugs comma-separated | all] [theme procreate-light] [WxH, default 1440x900] [full]
//   "full" captures the whole page (header + notes + demo) instead of the viewport only.
import { chromium } from "playwright-core"
import fs from "node:fs"
import { chromePath } from "./chrome.mjs"
const url = "file://" + new URL("../dist/index.html", import.meta.url).pathname
const out = process.argv[2] ?? "shots"; fs.mkdirSync(out, { recursive: true })
const pages = JSON.parse(fs.readFileSync(new URL("../src/kit/pages.json", import.meta.url)))
const all = pages.map((p) => p.slug)
const scr = JSON.parse(fs.readFileSync(new URL("../src/kit/screens.json", import.meta.url))).map((s) => "screen-" + s.id)
const ids = (process.argv[3] ?? "all") === "all" ? ["_index", "_components", ...scr, ...all] : process.argv[3].split(",")
const theme = process.argv[4] ?? "procreate-light"
const [width, height] = (process.argv[5] ?? "1440x900").split("x").map(Number)
const fullPage = process.argv[6] === "full"
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"], ignoreDefaultArgs: ["--hide-scrollbars"] })
const page = await browser.newPage({ viewport: { width, height } })
let cur = ""; const errs = {}
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") (errs[cur] ??= []).push(`${m.type()}: ${m.text().slice(0, 300)}`) })
page.on("pageerror", (e) => (errs[cur] ??= []).push("pageerror: " + e.message))
page.on("requestfailed", (r) => (errs[cur] ??= []).push("reqfail: " + r.url()))
await page.goto(url + `?theme=${theme}#/`)
for (const id of ids) {
  cur = id
  const h = id === "_index" ? "#/" : id === "_components" ? "#/components" : id.startsWith("screen-") ? `#/screen/${id.slice(7)}` : `#/feature/${id}`
  await page.evaluate((h) => { location.hash = h; window.scrollTo(0, 0) }, h)
  await page.waitForTimeout(450)
  const bad = await page.evaluate(() => ({ imgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length, notfound: !!document.querySelector("[data-testid=not-found]"), overflowX: document.documentElement.scrollWidth > window.innerWidth + 2 }))
  if (bad.imgs || bad.notfound || bad.overflowX) (errs[id] ??= []).push("layout: " + JSON.stringify(bad))
  await page.screenshot({ path: `${out}/${id}.png`, fullPage })
}
// v0.7.2 (P2-6): editor scenario states, one shot per scenario tab + md5 list (reproducible: npm run shots)
if ((process.argv[3] ?? "all") === "all") {
  const crypto = await import("node:crypto")
  cur = "editor-scenarios"
  await page.evaluate(() => { location.hash = "#/screen/editor" }); await page.waitForTimeout(900)
  const tabs = await page.$$eval("[data-testid=scenarios] [role=tab]", (ts) => ts.map((t) => ({ key: t.getAttribute("data-key") || t.textContent.trim().toLowerCase().replace(/\W+/g, "-"), text: t.textContent.trim() })))
  const md5 = []
  for (const t of tabs) {
    await page.locator("[data-testid=scenarios] [role=tab]", { hasText: t.text }).first().click(); await page.waitForTimeout(700)
    const f = `${out}/screen-editor--${t.key}.png`
    await page.locator("[data-testid=editor7]").screenshot({ path: f })
    md5.push(`${crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex")}  screen-editor--${t.key}.png`)
  }
  fs.writeFileSync(`${out}/editor-scenarios.md5`, md5.join("\n") + "\n")
  // interaction states the designer asked to see
  await page.locator("[data-testid=scenarios] [role=tab]", { hasText: "Photo" }).first().click(); await page.waitForTimeout(500)
  await page.locator("[data-testid=demo] [data-testid=replace]").click().catch(() => {}); await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/screen-editor--replace-picker.png` }); await page.keyboard.press("Escape")
  await page.locator("[data-testid=demo] [data-testid=crop]").click().catch(() => {}); await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/screen-editor--crop-mode.png` }); await page.keyboard.press("Escape")
  for (const h of ["editor", "home"]) { cur = "full-" + h; await page.evaluate((h) => { location.hash = "#/full/" + h }, h); await page.waitForTimeout(900); await page.screenshot({ path: `${out}/full-${h}.png` }) }
}
fs.writeFileSync(`${out}/errors.json`, JSON.stringify(errs, null, 1))
console.log(Object.keys(errs).length ? JSON.stringify(errs, null, 1).slice(0, 6000) : "no errors", "\n", ids.length, "pages", `${width}x${height}`, theme)
await browser.close()

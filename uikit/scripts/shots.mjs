// Screenshot kit pages over file:// and collect console errors per page.
// node scripts/shots.mjs <outdir> [slugs comma-separated | all] [theme b|b-dark] [WxH, default 1440x900] [full]
//   "full" captures the whole page (header + notes + demo) instead of the viewport only.
import { chromium } from "playwright-core"
import fs from "node:fs"
import { chromePath } from "./chrome.mjs"
const url = "file://" + new URL("../../dist/uikit/index.html", import.meta.url).pathname
const out = process.argv[2] ?? "shots"; fs.mkdirSync(out, { recursive: true })
const pages = JSON.parse(fs.readFileSync(new URL("../src/kit/pages.json", import.meta.url)))
const all = pages.map((p) => p.slug)
const ids = (process.argv[3] ?? "all") === "all" ? ["_index", "_components", ...all] : process.argv[3].split(",")
const theme = process.argv[4] ?? "b"
const [width, height] = (process.argv[5] ?? "1440x900").split("x").map(Number)
const fullPage = process.argv[6] === "full"
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] })
const page = await browser.newPage({ viewport: { width, height } })
let cur = ""; const errs = {}
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") (errs[cur] ??= []).push(`${m.type()}: ${m.text().slice(0, 300)}`) })
page.on("pageerror", (e) => (errs[cur] ??= []).push("pageerror: " + e.message))
page.on("requestfailed", (r) => (errs[cur] ??= []).push("reqfail: " + r.url()))
await page.goto(url + `?theme=${theme}#/`)
for (const id of ids) {
  cur = id
  const h = id === "_index" ? "#/" : id === "_components" ? "#/components" : `#/feature/${id}`
  await page.evaluate((h) => { location.hash = h; window.scrollTo(0, 0) }, h)
  await page.waitForTimeout(450)
  const bad = await page.evaluate(() => ({ imgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length, notfound: !!document.querySelector("[data-testid=not-found]"), overflowX: document.documentElement.scrollWidth > window.innerWidth + 2 }))
  if (bad.imgs || bad.notfound || bad.overflowX) (errs[id] ??= []).push("layout: " + JSON.stringify(bad))
  await page.screenshot({ path: `${out}/${id}.png`, fullPage })
}
fs.writeFileSync(`${out}/errors.json`, JSON.stringify(errs, null, 1))
console.log(Object.keys(errs).length ? JSON.stringify(errs, null, 1).slice(0, 6000) : "no errors", "\n", ids.length, "pages", `${width}x${height}`, theme)
await browser.close()

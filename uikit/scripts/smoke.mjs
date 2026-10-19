// Quick file:// smoke test: console errors, fonts, photos.
import { chromium } from "playwright-core"
import { chromePath } from "./chrome.mjs"
const url = "file://" + new URL("../../dist/uikit/index.html", import.meta.url).pathname
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--no-sandbox"] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errs = []
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`${m.type()}: ${m.text()}`) })
page.on("pageerror", (e) => errs.push("pageerror: " + e.message + "\n" + (e.stack||"").split("\n").slice(0,8).join("\n")))
page.on("requestfailed", (r) => errs.push("reqfail: " + r.url()))
for (const h of (process.argv[2] ?? "#/,#/feature/drag-place-replace").split(",")) {
  await page.goto(url + h); await page.waitForTimeout(800)
  const info = await page.evaluate(async () => { await document.fonts.ready; return { fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family + " " + f.unicodeRange.slice(0, 12)), imgs: [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length, nimg: document.images.length, text: document.body.innerText.slice(0, 120) } })
  console.log(h, JSON.stringify(info))
  if (process.argv[3]) await page.screenshot({ path: process.argv[3], fullPage: !!process.env.FULL })
}
console.log(errs.join("\n") || "no console errors")
await browser.close()

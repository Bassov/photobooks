// pnpm guide:shots — the #/guide screenshots. Runs the deterministic #/demo walk (demo-capture.mjs) at DPR 2 over
// uikit/dist (build first); on each chapter's step it writes the chapter clip to public/guide/<id>.jpg (JPEG q80) and the
// clip size + callout centres (% of the clip, measured in the same run) to src/kit/guide/shots.json. Feature figures
// (`{ feature, scenario }`) are shot after the walk, in the same browser, from the kit page's scenario tab.
import fs from "node:fs"
import { capture, CSS } from "./demo-capture.mjs"
import { CHAPTERS } from "../src/kit/guide/content.ts"

const pub = new URL("../public/guide/", import.meta.url).pathname
const json = new URL("../src/kit/guide/shots.json", import.meta.url).pathname
const walk = new URL("../../.cache/guide-walk/", import.meta.url).pathname
const dist = "file://" + new URL("../dist/index.html", import.meta.url).pathname + "?theme=procreate-light"
const VW = 1440, VH = 900, PAD = 12, QUALITY = 80
const figured = CHAPTERS.filter((c) => c.figure)
const byStep = Object.groupBy(figured.filter((c) => "step" in c.figure), (c) => c.figure.step)

async function box(page, sel) {
  const b = await page.locator(sel).first().boundingBox()
  if (!b) throw new Error(`no box for ${sel}`)
  return b
}
/** The clip in viewport px: the whole viewport, a fixed rect, or the union of selector boxes (+ PAD), clamped. */
async function clipOf(page, clip) {
  if (!clip) return { x: 0, y: 0, width: VW, height: VH }
  if (typeof clip[0] === "number") { const [x, y, width, height] = clip; return { x, y, width, height } }
  const bs = await Promise.all(clip.map((s) => box(page, s)))
  const x0 = Math.max(0, Math.floor(Math.min(...bs.map((b) => b.x)) - PAD)), y0 = Math.max(0, Math.floor(Math.min(...bs.map((b) => b.y)) - PAD))
  const x1 = Math.min(VW, Math.ceil(Math.max(...bs.map((b) => b.x + b.width)) + PAD)), y1 = Math.min(VH, Math.ceil(Math.max(...bs.map((b) => b.y + b.height)) + PAD))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}
const pct = (v) => Math.round(v * 1000) / 10

fs.mkdirSync(pub, { recursive: true })
for (const f of fs.readdirSync(pub)) if (f.endsWith(".jpg")) fs.unlinkSync(pub + f)
const shots = {}
async function shoot(page, c, from) {
  const r = await clipOf(page, c.figure.clip)
  await page.screenshot({ path: `${pub}${c.id}.jpg`, type: "jpeg", quality: QUALITY, clip: r })
  const callouts = []
  for (const m of c.figure.callouts) {
    const b = await box(page, m.sel)
    callouts.push({ n: m.n, x: pct((b.x + b.width / 2 - r.x) / r.width), y: pct((b.y + b.height / 2 - r.y) / r.height) })
  }
  shots[c.id] = { w: r.width, h: r.height, callouts }
  console.log(`${c.id}.jpg ← ${from} ${r.width}×${r.height}`)
}
/** A kit feature page in one scenario: the tab is clicked through the DOM (a pointer click hits the open dialog's underlay). */
async function featureShots(ctx) {
  for (const c of figured.filter((c) => "feature" in c.figure)) {
    const { feature, scenario } = c.figure
    const page = await ctx.newPage()
    page.on("pageerror", (e) => errs.push(e.message))
    await page.goto("about:blank")
    await page.goto(`${dist}#/feature/${feature}`)
    await page.addStyleTag({ content: CSS })
    await page.waitForTimeout(600)
    const tab = page.locator("[data-testid=scenarios]").getByRole("tab", { name: scenario, exact: true })
    if ((await tab.count()) !== 1) throw new Error(`${feature}: ${await tab.count()} tabs "${scenario}"`)
    await tab.evaluate((e) => e.click())
    await page.waitForTimeout(700)
    await page.evaluate(() => window.scrollBy(0, document.querySelector("[data-testid=scenario-stage]").getBoundingClientRect().top))
    if (await page.locator("[data-testid=print-check]").count()) await page.locator("[data-testid=print-check]:not([data-state=checking])").first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(150)
    await shoot(page, c, `${feature} · ${scenario}`)
    await page.close()
  }
}

const errs = []
const walked = await capture(walk, {
  dpr: 2,
  log: () => {},
  probe: async (name, page) => {
    for (const c of byStep[name] ?? []) await shoot(page, c, name)
  },
  after: featureShots,
})
errs.push(...walked.errs)
const missing = figured.filter((c) => !shots[c.id]).map((c) => c.id)
if (missing.length) throw new Error(`no shot for ${missing.join(", ")}`)
fs.writeFileSync(json, JSON.stringify(Object.fromEntries(CHAPTERS.filter((c) => shots[c.id]).map((c) => [c.id, shots[c.id]])), null, 2) + "\n")
fs.rmSync(walk, { recursive: true, force: true })
const sizes = fs.readdirSync(pub).map((f) => [f, Math.round(fs.statSync(pub + f).size / 1024)])
const kb = sizes.reduce((s, [, k]) => s + k, 0)
console.log(`${Object.keys(shots).length} shots, public/guide ${kb} KB${errs.length ? `; page errors: ${errs.join(" | ")}` : ""}`)
if (kb > 3 * 1024) throw new Error(`public/guide is over 3 MB: ${sizes.map(([f, k]) => `${f} ${k}`).join(", ")}`)

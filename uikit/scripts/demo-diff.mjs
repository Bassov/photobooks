// npm run demo:diff -- <stage-name> — re-capture the #/demo walk into research/uikit-decompose/<stage-name>/ and pixel-diff vs baseline.
// Writes <stage>/diff/NN-*.png for changed steps and <stage>/diff-summary.md. Exit code 1 if any step differs or is missing.
import fs from "node:fs"
import { PNG } from "pngjs"
import pixelmatch from "pixelmatch"
import { capture } from "./demo-capture.mjs"
const root = "/workspace/research/uikit-decompose"
const stage = process.argv[2] ?? "stage-0"
const base = process.argv[3] ?? `${root}/baseline`, out = `${root}/${stage}`, dd = `${out}/diff`
const { shots, errs } = await capture(out, { log: () => {} })
fs.rmSync(dd, { recursive: true, force: true }); fs.mkdirSync(dd, { recursive: true })
const baseShots = fs.readdirSync(base).filter((f) => /^\d\d-.*\.png$/.test(f)).sort()
const names = [...new Set([...baseShots, ...shots])].sort()
const rows = []; let bad = 0
for (const f of names) {
  if (!baseShots.includes(f) || !shots.includes(f)) { rows.push([f, baseShots.includes(f) ? "MISSING in new" : "NEW (not in baseline)", "-"]); bad++; continue }
  const a = PNG.sync.read(fs.readFileSync(`${base}/${f}`)), b = PNG.sync.read(fs.readFileSync(`${out}/${f}`))
  if (a.width !== b.width || a.height !== b.height) { rows.push([f, "SIZE CHANGED", "-"]); bad++; continue }
  const d = new PNG({ width: a.width, height: a.height })
  const px = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: 0 })
  if (px) { fs.writeFileSync(`${dd}/${f}`, PNG.sync.write(d)); bad++ }
  rows.push([f, px ? "CHANGED" : "identical", String(px)])
}
const md = [`# #/demo diff — ${stage} vs baseline`, "", `Captured ${new Date().toISOString()} · ${shots.length} steps · threshold 0 (exact) · ${bad ? `**${bad} step(s) differ — STOP**` : "**all identical**"}`, errs.length ? `\nPage errors: ${errs.join(" | ")}` : "", "",
  "| step | result | changed px |", "|---|---|---|", ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`), ""].join("\n")
fs.writeFileSync(`${out}/diff-summary.md`, md)
console.log(md)
process.exit(bad ? 1 : 0)

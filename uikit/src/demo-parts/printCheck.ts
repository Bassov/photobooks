/* pdf-export (Designer spec 2026-11-14 §2.1–2.4): the kit stand-in for the PDF worker's check and the Print dialog texts.
   Pure over the studio doc. Rule ids, severities and order follow core `PREFLIGHT_RULE_IDS` (the kit never imports src/);
   safe-zone / bleed-hazard need core geometry and are left to the product. */
import { effectiveDpi, type Doc } from "@/sandbox/model"
import type { Book } from "@/sandbox/store"
import { fmtN } from "@/sandbox/v7"
import type { KitProfile } from "./printProfiles"

export type CheckSeverity = "error" | "warning" | "info"
export type CheckRow = { rule: string; severity: CheckSeverity; text: string; pages: number[] }
export type PrintFail = "access" | "full" | "other"

/** SAMPLE DATA: kit photos with an embedded non-sRGB profile (prod reads the ICC tag, `colorWarnings`). */
export const KIT_COLOR: Readonly<Record<string, string>> = { p05: "Adobe RGB", p19: "Display P3" }

const ORDER = ["page-count-below-min", "page-count-above-max", "page-count-step", "asset-missing", "asset-modified", "dpi-below-min",
  "dpi-below-warn", "colour", "empty-image-frame", "empty-text-frame", "safe-zone-intrusion", "bleed-hazard"]
const RANK: Record<CheckSeverity, number> = { error: 0, warning: 1, info: 2 }
const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`

/** " · page 6" / " · pages 2, 3, 6"; at most 5 numbers, then " +{n}"; "" for book-level rules. */
export function pageList(pages: readonly number[]) {
  const ps = [...new Set(pages)].sort((a, b) => a - b)
  if (!ps.length) return ""
  const head = ps.slice(0, 5).join(", ")
  return ` · ${ps.length === 1 ? "page" : "pages"} ${head}${ps.length > 5 ? ` +${ps.length - 5}` : ""}`
}

/** Placed photos of the doc with their physical page (spread `i` holds pages 2i + 1, 2i + 2). */
function placed(doc: Doc, book: Book) {
  const half = book.w * 10
  return doc.spreads.flatMap((s, i) => s.frames.map((f) => ({ f, page: 2 * i + (f.x + f.w / 2 > half ? 2 : 1) })))
}

/** The Check block rows: one per rule, errors → warnings → info, in rule order within a severity. */
export function printCheckRows(doc: Doc, book: Book, missing: ReadonlySet<string>, profile: KitProfile): CheckRow[] {
  const pages = doc.spreads.length * 2
  const pc = profile.pageCount
  const rows: CheckRow[] = []
  const add = (rule: string, severity: CheckSeverity, text: string, ps: number[] = []) => rows.push({ rule, severity, text, pages: ps })
  if (pages < pc.min) add("page-count-below-min", "error", `${profile.name} prints at least ${pc.min} pages. This book has ${pages}.`)
  if (pages > pc.max) add("page-count-above-max", "error", `${profile.name} prints up to ${pc.max} pages. This book has ${pages}.`)
  if (pc.step > 1 && pages % pc.step) add("page-count-step", "error", `${profile.name} prints pages in steps of ${pc.step}. This book has ${pages}.`)
  const items = placed(doc, book)
  const photos = items.filter(({ f }) => f.kind === "image" && f.photo)
  const gone = photos.filter(({ f }) => missing.has(f.photo!))
  const goneIds = new Set(gone.map(({ f }) => f.photo))
  if (gone.length) add("asset-missing", "error", `${n(goneIds.size, "photo", "photos")} can’t be found`, gone.map((x) => x.page))
  const readable = photos.filter(({ f }) => !missing.has(f.photo!)).map((x) => ({ ...x, dpi: effectiveDpi(x.f) ?? Infinity }))
  const low = readable.filter((x) => x.dpi < profile.dpi.min)
  if (low.length) add("dpi-below-min", "error", `${n(low.length, "photo", "photos")} below ${profile.dpi.min} ppi`, low.map((x) => x.page))
  const warn = readable.filter((x) => x.dpi >= profile.dpi.min && x.dpi < profile.dpi.warn)
  if (warn.length) add("dpi-below-warn", "warning", `${n(warn.length, "photo", "photos")} below ${profile.dpi.warn} ppi`, warn.map((x) => x.page))
  const tinted = readable.filter(({ f }) => KIT_COLOR[f.photo!])
  const tintedIds = new Set(tinted.map(({ f }) => f.photo!))
  if (tinted.length) {
    const fams = [...new Set([...tintedIds].map((id) => KIT_COLOR[id]))].join(", ")
    add("colour", "warning", `${n(tintedIds.size, "photo", "photos")} ${tintedIds.size === 1 ? "isn’t" : "aren’t"} sRGB (${fams}), colours may shift`, tinted.map((x) => x.page))
  }
  const emptyImg = items.filter(({ f }) => f.kind === "image" && !f.photo)
  if (emptyImg.length) add("empty-image-frame", "warning", `${n(emptyImg.length, "empty photo frame", "empty photo frames")}`, emptyImg.map((x) => x.page))
  const emptyText = items.filter(({ f }) => f.kind === "text" && !f.text?.trim())
  if (emptyText.length) add("empty-text-frame", "info", `${n(emptyText.length, "empty text frame", "empty text frames")}`, emptyText.map((x) => x.page))
  return rows.sort((a, b) => RANK[a.severity] - RANK[b.severity] || ORDER.indexOf(a.rule) - ORDER.indexOf(b.rule))
}

/** "Check" / "Check · 2 errors, 3 warnings" (zero counts left out; info isn't counted). */
export function checkLabel(rows: readonly CheckRow[]) {
  const e = rows.filter((r) => r.severity === "error").length, w = rows.filter((r) => r.severity === "warning").length
  const parts = [e && n(e, "error", "errors"), w && n(w, "warning", "warnings")].filter(Boolean)
  return parts.length ? `Check · ${parts.join(", ")}` : "Check"
}

/** D5: `PDF · {pages} pages` [+ ` on {sheets} sheets`] + ` · bleed {b} mm` / ` · trim size, no marks`. */
export const printSummary = (pages: number, sheets: number, bleedMm: number | null) =>
  `PDF · ${pages} pages${sheets !== pages ? ` on ${sheets} sheets` : ""}${bleedMm === null ? " · trim size, no marks" : ` · bleed ${fmtN(bleedMm)} mm`}`

/** §2.2: run progress `v` 0…100 → 95 % painting sheets ("Page i of n · p%"), the last 5 % writing the file ("Saving · p%"). */
export function printProgress(v: number, sheets: number) {
  const painted = Math.min(sheets, Math.floor((v / 95) * sheets))
  if (painted >= sheets) return { p: v, text: `Saving · ${v}%` }
  const p = Math.round(((100 * painted) / sheets) * 0.95)
  return { p, text: `Page ${painted + 1} of ${sheets} · ${p}%` }
}

/** §2.4 failed texts. */
export const printFailText = (f: PrintFail, library: string) =>
  f === "access" ? `Photobooks can’t write to “${library}”. Allow access to the folder and try again.`
    : f === "full" ? "The disk is full." : "Something went wrong while making the PDF. Try again."

/** The library folder name the done / failed texts use (`~/Pictures/<folder>` → `<folder>`). */
export const libraryLabel = (path: string) => path.split("/").filter(Boolean).pop() || "Photobooks Library"

/* #/demo seed (capture / e2e, like `__demo.missing()`): the next Export PDF fails with this reason. */
let nextFail: PrintFail | undefined
export const takePrintFail = () => { const f = nextFail; nextFail = undefined; return f }
;(window as unknown as { __printDemo: object }).__printDemo = { fail: (f: PrintFail = "access") => { nextFail = f } }

/** D9 stand-in: a one-page PDF so Open PDF opens the browser's PDF viewer (prod opens the written file). */
export function openSamplePdf(name: string) {
  const body = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 595]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`
  const url = URL.createObjectURL(new File([body], name, { type: "application/pdf" }))
  // `noopener` would leave the tab blank (Chromium partitions blob URLs per browsing context group); cut the opener instead
  const tab = window.open(url, "_blank")
  if (tab) tab.opener = null
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

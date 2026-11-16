/* pdf-export (Designer spec 2026-11-14 §2.1–2.4): the kit stand-in for the PDF worker's check and the Print dialog texts.
   Pure over the studio doc. Rule ids, severities and order follow core `PREFLIGHT_RULE_IDS` (the kit never imports src/);
   safe-zone / bleed-hazard need core geometry and are left to the product.
   cover-pdf (Designer spec 2026-11-15 §2.1–2.3): the cover file's rows (`scope: "cover"`), summary, run unit and done texts. */
import { P } from "@/data"
import { effectiveDpi, orientedSize, type Doc } from "@/sandbox/model"
import type { Book } from "@/sandbox/store"
import { fmtN, SAFE, WRAP } from "@/sandbox/v7"
import type { KitProfile } from "./printProfiles"

export type CheckSeverity = "error" | "warning" | "info"
export type CheckScope = "pages" | "cover"
export type CheckRow = { rule: string; severity: CheckSeverity; scope: CheckScope; text: string; pages: number[] }
export type PrintFail = "access" | "full" | "other"

/** SAMPLE DATA: kit photos with an embedded non-sRGB profile (prod reads the ICC tag, `colorWarnings`). */
export const KIT_COLOR: Readonly<Record<string, string>> = { p05: "Adobe RGB", p19: "Display P3" }
/** Generic `minFontPt` (core `genericPrintProfile()`); `KitProfile` doesn't carry it. */
const MIN_FONT_PT = 6

const ORDER = ["page-count-below-min", "page-count-above-max", "page-count-step", "asset-missing", "asset-modified", "dpi-below-min",
  "dpi-below-warn", "colour", "empty-image-frame", "empty-text-frame", "safe-zone-intrusion", "bleed-hazard",
  "cover-asset-missing", "cover-asset-modified", "cover-dpi-below-min", "cover-dpi-below-warn", "cover-not-srgb", "spine-text-small",
  "spine-text-cut", "cover-front-empty"]
const RANK: Record<CheckSeverity, number> = { error: 0, warning: 1, info: 2 }
const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`

/** " · page 6" / " · pages 2, 3, 6"; at most 5 numbers, then " +{n}"; "" for book-level rules. `cover` leads: " · cover, page 6". */
export function pageList(pages: readonly number[], cover = false) {
  const ps = [...new Set(pages)].sort((a, b) => a - b)
  const head = ps.length ? `${ps.length === 1 ? "page" : "pages"} ${ps.slice(0, 5).join(", ")}${ps.length > 5 ? ` +${ps.length - 5}` : ""}` : ""
  const all = [cover && "cover", head].filter(Boolean).join(", ")
  return all && ` · ${all}`
}

/** The cover the check reads: the editor's front photo and spine text, the spine in mm (a manual spine where seeded); `ppi`
 *  and `modified` are SAMPLE seeds (the kit has no crop zoom on the cover nor a file watcher). */
export type KitCover = { photo: string | null; spine: string; spineMm: number; ppi?: number; modified?: boolean }
/** §2.1.4: the front photo's ppi in its box (front board + wrap on top, outer and bottom), cover fit. */
export function coverPpi(photo: string, book: Book) {
  const o = orientedSize(P(photo), 0)
  return Math.round(25.4 / Math.max(((book.w + WRAP) * 10) / o.w, ((book.h + 2 * WRAP) * 10) / o.h))
}
/** §2.1.4 cover rows (C9): never block, no page list. `advanceMm(text, sizeMm)` = the spine text's width at that size. */
export function coverCheckRows(cover: KitCover, book: Book, missing: ReadonlySet<string>, profile: KitProfile, advanceMm: (text: string, sizeMm: number) => number): CheckRow[] {
  const rows: CheckRow[] = []
  const add = (rule: string, severity: CheckSeverity, text: string) => rows.push({ rule, severity, scope: "cover", text, pages: [] })
  const ph = cover.photo
  if (!ph) add("cover-front-empty", "info", "Front cover has no photo and prints in the back fill colour")
  else if (missing.has(ph)) add("cover-asset-missing", "error", "Front cover photo can’t be found")
  else {
    if (cover.modified) add("cover-asset-modified", "warning", "Front cover photo changed on disk since it was added")
    const ppi = cover.ppi ?? coverPpi(ph, book)
    if (ppi < profile.dpi.min) add("cover-dpi-below-min", "error", `Front cover photo is ${ppi} ppi, below ${profile.dpi.min} ppi`)
    else if (ppi < profile.dpi.warn) add("cover-dpi-below-warn", "warning", `Front cover photo is ${ppi} ppi, below ${profile.dpi.warn} ppi`)
    if (KIT_COLOR[ph]) add("cover-not-srgb", "warning", `Front cover photo isn’t sRGB (${KIT_COLOR[ph]}), colours may shift`)
  }
  const spine = cover.spine.trim()
  if (spine) {
    // the canvas spine type: min(12 at the 848 px closed cover, half the spine), cut at trim height − 2 × safe
    const size = Math.min(((2 * book.w * 10 + cover.spineMm) * 12) / 848, cover.spineMm / 2)
    const pt = (size * 72) / 25.4
    if (pt < MIN_FONT_PT) add("spine-text-small", "warning", `Spine text is ${fmtN(pt)} pt, below ${profile.name}’s ${MIN_FONT_PT} pt minimum`)
    if (advanceMm(spine, size) > (book.h - 2 * SAFE) * 10) add("spine-text-cut", "warning", "Spine text is longer than the spine and ends in “…”")
  }
  return rows
}

/** Placed photos of the doc with their physical page (spread `i` holds pages 2i + 1, 2i + 2). */
function placed(doc: Doc, book: Book) {
  const half = book.w * 10
  return doc.spreads.flatMap((s, i) => s.frames.map((f) => ({ f, page: 2 * i + (f.x + f.w / 2 > half ? 2 : 1) })))
}

/** The Check block rows: one per rule, errors → warnings → info; within a severity the page rows, then the `cover` rows, in rule order. */
export function printCheckRows(doc: Doc, book: Book, missing: ReadonlySet<string>, profile: KitProfile, cover: CheckRow[] = []): CheckRow[] {
  const pages = doc.spreads.length * 2
  const pc = profile.pageCount
  const rows: CheckRow[] = [...cover]
  const add = (rule: string, severity: CheckSeverity, text: string, ps: number[] = []) => rows.push({ rule, severity, scope: "pages", text, pages: ps })
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
  // cover ids follow every page id in ORDER, so rule order alone puts the cover rows after the page rows of a severity
  return rows.sort((a, b) => RANK[a.severity] - RANK[b.severity] || ORDER.indexOf(a.rule) - ORDER.indexOf(b.rule))
}

/** "Check" / "Check · 2 errors, 3 warnings" (zero counts left out; info isn't counted). */
export function checkLabel(rows: readonly CheckRow[]) {
  const e = rows.filter((r) => r.severity === "error").length, w = rows.filter((r) => r.severity === "warning").length
  const parts = [e && n(e, "error", "errors"), w && n(w, "warning", "warnings")].filter(Boolean)
  return parts.length ? `Check · ${parts.join(", ")}` : "Check"
}

/** D5: `PDF · {pages} pages` [+ ` on {sheets} sheets`] [+ ` + cover`] + ` · bleed {b} mm` [`, cover {c} mm`] / ` · trim size, no marks`.
 *  `coverBleedMm`: the cover file's bleed (1 per sheet only), `null` = no cover file. */
export const printSummary = (pages: number, sheets: number, bleedMm: number | null, coverBleedMm: number | null = null) =>
  `PDF · ${pages} pages${sheets !== pages ? ` on ${sheets} ${sheets === 1 ? "sheet" : "sheets"}` : ""}${coverBleedMm === null ? "" : " + cover"}${bleedMm === null ? " · trim size, no marks" : ` · bleed ${fmtN(bleedMm)} mm${coverBleedMm !== null && coverBleedMm !== bleedMm ? `, cover ${fmtN(coverBleedMm)} mm` : ""}`}`
/** §2.1.2: the bleed checkbox names the cover bleed only when it differs (1 per sheet). */
export const printBleedLabel = (bleedMm: number, coverBleedMm: number | null = null) =>
  `Add ${fmtN(bleedMm)} mm bleed${coverBleedMm !== null && coverBleedMm !== bleedMm ? ` (cover ${fmtN(coverBleedMm)} mm)` : ""} and crop marks`
/** C1: the cover file sits next to the pages file. */
export const coverFileName = (file: string) => file.replace(/\.pdf$/, "-cover.pdf")

/** §2.2: run progress `v` 0…100 → 95 % painting sheets ("Page i of n · p%") and, with `cover`, the cover sheet as one more unit
 *  ("Cover · p%"); the last 5 % writing the files ("Saving · p%").
 *  A booklet (`paper` sheets, booklet-imposition) paints up to 80 %, then imposes ("Imposing sheets · i of n · p%") up to 95 %. */
export function printProgress(v: number, sheets: number, paper = 0, cover = false) {
  const share = paper ? 80 : 95
  const units = sheets + (cover ? 1 : 0)
  const painted = Math.min(units, Math.floor((v / share) * units))
  if (painted < units) {
    const p = Math.round((share * painted) / units)
    return { p, text: painted < sheets ? `Page ${painted + 1} of ${sheets} · ${p}%` : `Cover · ${p}%` }
  }
  const imposed = Math.min(paper, Math.floor(((v - 80) / 15) * paper))
  if (imposed < paper) {
    const p = 80 + Math.round((15 * imposed) / paper)
    return { p, text: `Imposing sheets · ${imposed + 1} of ${paper} · ${p}%` }
  }
  return { p: v, text: `Saving · ${v}%` }
}

/** Kit layouts of the Imposition (duplex) control. */
export type PrintLayout = "single" | "2up" | "4up"
/** How to print and fold a booklet on a home duplex printer (prod `printDuplexText`). */
export const printDuplexText = (layout: Exclude<PrintLayout, "single">) =>
  layout === "2up"
    ? "Print on both sides, flip on the short edge. Stack the sheets in order, fold in half and staple on the fold."
    : "Print on both sides, flip on the long edge. Cut each sheet across, put the top half on the bottom half, fold and staple."

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

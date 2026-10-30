/**
 * Sandbox document model for the UI kit (NOT the product schema): spreads of two 200 × 200 mm pages,
 * frames in spread millimetres, guides, a page-scoped layout grid, frame styles and parent spreads.
 * Everything is plain data so demos can keep it in React state with undo history.
 */
import { P, photos as ALL_PHOTOS, type Photo } from "@/data"
import { TT, aspectClass } from "./templates"
export { aspectClass }

/* v0.7.1: page geometry follows the book size (mm). Live ESM bindings — setGeom() re-proportions every reader. */
export let PAGE = 200
export let SW = 400
export let SH = 200
export function setGeom(wCm: number, hCm: number) { PAGE = wCm * 10; SW = PAGE * 2; SH = hCm * 10 }
/** scale every frame and guide of a doc from one page size to another (book size change re-proportions the layout) */
export function reflowDoc(d: Doc, from: { w: number; h: number }, to: { w: number; h: number }): Doc {
  const kx = to.w / from.w, ky = to.h / from.h
  if (kx === 1 && ky === 1) return d
  const fr = (f: Frame) => ({ ...f, x: f.x * kx, y: f.y * ky, w: f.w * kx, h: f.h * ky })
  const gd = (g: Guide) => ({ ...g, pos: g.pos * (g.axis === "v" ? kx : ky) })
  return { ...d, spreads: d.spreads.map((s) => ({ ...s, frames: s.frames.map(fr), guides: s.guides.map(gd) })), parents: d.parents.map((p) => ({ ...p, frames: p.frames.map(fr), guides: p.guides.map(gd) })) }
}

export type TextStyle = "title" | "caption" | "body"
export type Frame = {
  id: string
  kind: "image" | "text"
  x: number; y: number; w: number; h: number
  photo: string | null
  /** crop: zoom ≥ 1 over cover fit; ox / oy ∈ [-1, 1] pan inside the overflow */
  zoom: number; ox: number; oy: number
  /** frame rotation (deg), photo quarter-turn and straighten inside the frame */
  rot: number; qt: 0 | 90 | 180 | 270; straighten: number
  /** v0.7.2 photo params (spec: Fill/Fit, flip, Adjust, Caption) */
  fit?: "fill" | "fit"; flipH?: boolean; flipV?: boolean
  adj?: { b: number; c: number; s: number }
  caption?: string
  locked?: boolean
  text?: string; textStyle?: TextStyle; align?: "left" | "center" | "right"
  /** live caption anchored to an image frame */
  anchor?: string; live?: boolean
  styleId?: string
  /** parent items: id of the parent item a local copy overrides */
  overrides?: string
}
export type Guide = { id: string; axis: "v" | "h"; pos: number; locked?: boolean; scope?: "spread" | "book" | "parent" }
export type Grid = { top: number; bottom: number; inside: number; outside: number; cols: number; rows: number; colGutter: number; rowGutter: number }
export type FrameStyle = { id: string; name: string; stroke: number; strokeColor: string; mat: number; radius: number; shadow?: boolean }
export type Parent = { id: string; name: string; frames: Frame[]; guides: Guide[]; grid?: Partial<Grid>; pageNumbers?: boolean }
export type Spread = {
  id: string; template: string | null; frames: Frame[]; guides: Guide[]; bg?: string
  parent?: string | null; hiddenParent?: string[]; grid?: Partial<Grid>; kind?: "cover"
  /** v0.7.2 spread inspector: master page + layout margin / gap (mm) */
  master?: "A" | "B" | "none"; margin?: number; gap?: number
}
export type Doc = { spreads: Spread[]; grid: Grid; styles: FrameStyle[]; parents: Parent[]; gallery: string[]; pageStart?: number; skipFirst?: boolean
  /** sketch-only: book spreads stashed while a parent spread is open for editing */
  stash?: { spreads: Spread[]; cur: number; parent: string }
  userTemplates?: { id: string; name: string; frames: Frame[] }[] }

let n = 0
export const uid = (p = "f") => `${p}${++n}${Math.random().toString(36).slice(2, 5)}`

export const BOOK_GRID: Grid = { top: 16, bottom: 16, inside: 20, outside: 15, cols: 6, rows: 4, colGutter: 4, rowGutter: 4 }

export function frame(p: Partial<Frame> & { x: number; y: number; w: number; h: number }): Frame {
  return { id: uid(), kind: "image", photo: null, zoom: 1, ox: 0, oy: 0, rot: 0, qt: 0, straighten: 0, ...p }
}
export function textFrame(p: Partial<Frame> & { x: number; y: number; w: number; h: number }): Frame {
  return frame({ kind: "text", text: "Caption", textStyle: "caption", align: "left", ...p })
}
/** v0.7.3 built-in masters (Spread.master). A = folios, B = running head + caption band. Built per book geometry,
 *  memoised so frame/guide ids stay stable. A spread with an explicit `parent` keeps using that parent. */
const masterCache = new Map<string, Parent>()
export function builtinMaster(k: "A" | "B"): Parent {
  const key = `${k}-${SW}-${SH}`; const hit = masterCache.get(key); if (hit) return hit
  const P = SW / 2, m = 12
  const mk = (id: string, f: Partial<Frame> & { x: number; y: number; w: number; h: number }) => ({ ...textFrame(f), id: `m${k}-${id}` })
  const par: Parent = k === "A"
    ? { id: "mA", name: "Master A", pageNumbers: false,
        frames: [mk("fl", { x: m, y: SH - m + 2, w: 24, h: 7, text: "Folio", align: "left" }), mk("fr", { x: SW - m - 24, y: SH - m + 2, w: 24, h: 7, text: "Folio", align: "right" })],
        guides: [{ id: "mA-gt", axis: "h", pos: m }, { id: "mA-gb", axis: "h", pos: SH - m }, { id: "mA-gl", axis: "v", pos: m }, { id: "mA-gr", axis: "v", pos: SW - m }] }
    : { id: "mB", name: "Master B", pageNumbers: false,
        frames: [mk("rh", { x: m, y: 4, w: P - 2 * m, h: 7, text: "Running head", align: "left" }), mk("cap", { x: P + m, y: SH - m + 2, w: P - 2 * m, h: 7, text: "Caption band", align: "right" })],
        guides: [{ id: "mB-gt", axis: "h", pos: m + 8 }, { id: "mB-gb", axis: "h", pos: SH - m - 8 }, { id: "mB-gc1", axis: "v", pos: P / 2 }, { id: "mB-gc2", axis: "v", pos: P + P / 2 }] }
  masterCache.set(key, par); return par
}
export function parentOf(doc: Doc, s?: Spread): Parent | undefined {
  if (!s) return undefined
  if (s.parent) return doc.parents.find((p) => p.id === s.parent)
  if (s.kind === "cover" || s.master === "none") return undefined
  return builtinMaster(s.master ?? "A") // the book default master is A (Book settings → Defaults)
}
export function framesFromTemplate(tid: string, ph: (string | null)[] = []): Frame[] {
  return TT(tid).frames.map((b, i) => frame({ x: b.x * SW / 100, y: b.y * SH / 100, w: b.w * SW / 100, h: b.h * SH / 100, photo: ph[i] ?? null }))
}
export function spread(tid: string | null, ph: (string | null)[] = [], extra: Partial<Spread> = {}): Spread {
  return { id: uid("s"), template: tid, frames: tid ? framesFromTemplate(tid, ph) : [], guides: [], ...extra }
}
export const DEFAULT_STYLES: FrameStyle[] = [
  { id: "st-none", name: "None", stroke: 0, strokeColor: "#ffffff", mat: 0, radius: 0 },
  { id: "st-white", name: "White mat", stroke: 0, strokeColor: "#ffffff", mat: 3, radius: 0, shadow: true },
  { id: "st-hair", name: "Hairline", stroke: 0.3, strokeColor: "#1c1b1a", mat: 0, radius: 0 },
  { id: "st-round", name: "Soft corners", stroke: 0, strokeColor: "#ffffff", mat: 0, radius: 4 },
]
export const SAMPLE_BOOK: [string, (string | null)[]][] = [
  ["t-margin", ["p13"]], ["t-full", ["p09"]], ["t-hero2", ["p16", "p07", "p11"]], ["t-pair", ["p03", "p18"]],
  ["t-hero4", ["p15", "p05", "p14", "p06", "p19"]], ["t-pano", ["p04"]], ["t-three", ["p12", "p20", "p10"]], ["t-offset", [null, null]],
]
/** v0.7.2 (P1-3): every book in the kit has at least 20 pages = 10 spreads; short specs are padded
 *  after the demo's own spreads (sample layouts, or empty frames when the spec is an empty book). */
export const MIN_SPREADS = 10
export function padSpec(spec: [string | null, (string | null)[]][]): [string | null, (string | null)[]][] {
  if (spec.length >= MIN_SPREADS) return spec
  const empty = spec.length > 0 && spec.every(([, p]) => p.every((x) => x === null))
  const out = [...spec]
  for (let i = 0; out.length < MIN_SPREADS; i++) { const [t, p] = SAMPLE_BOOK[(spec.length + i) % SAMPLE_BOOK.length]; out.push([t, empty ? p.map(() => null) : p]) }
  return out
}
export function makeDoc(spec: [string | null, (string | null)[]][] = SAMPLE_BOOK, extra: Partial<Doc> = {}): Doc {
  spec = padSpec(spec)
  return {
    spreads: spec.map(([t, p]) => spread(t, p)), grid: { ...BOOK_GRID }, styles: DEFAULT_STYLES, parents: [],
    gallery: ALL_PHOTOS.map((p) => p.id), ...extra,
  }
}
export const emptyDoc = (count = 4) => makeDoc(SAMPLE_BOOK.slice(0, count).map(([t, p]) => [t, p.map(() => null)]))

/* ---------------------------------------------------------------- geometry */
export type Rect = { x: number; y: number; w: number; h: number }
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d

/** v0.8 §3.4: live grids of the built-in masters (mA / mB), written by the Masters inspector (v7.setMaster). */
export const MASTER_GRIDS: Record<string, Grid | undefined> = {}
export function effectiveGrid(doc: Doc, s?: Spread): Grid & { src: Record<keyof Grid, "book" | "parent" | "spread"> } {
  const p0 = parentOf(doc, s)
  const par = p0 && MASTER_GRIDS[p0.id] ? { ...p0, grid: MASTER_GRIDS[p0.id] } : p0
  const g = { ...doc.grid } as Grid
  const src = {} as Record<keyof Grid, "book" | "parent" | "spread">
  for (const k of Object.keys(g) as (keyof Grid)[]) {
    src[k] = "book"
    if (par?.grid && par.grid[k] !== undefined) { g[k] = par.grid[k]!; src[k] = "parent" }
    if (s?.grid && s.grid[k] !== undefined) { g[k] = s.grid[k]!; src[k] = "spread" }
  }
  return { ...g, src }
}
/** per page: content box, columns and rows (mirrored on facing pages) */
export function resolveGrid(g: Grid) {
  return [0, 1].map((page) => {
    const left = page === 0 ? g.outside : PAGE + g.inside
    const right = page === 0 ? PAGE - g.inside : SW - g.outside
    const cw = (right - left - g.colGutter * (g.cols - 1)) / g.cols
    const rh = (SH - g.top - g.bottom - g.rowGutter * (g.rows - 1)) / g.rows
    return {
      content: { x: left, y: g.top, w: right - left, h: SH - g.top - g.bottom },
      cols: Array.from({ length: g.cols }, (_, i) => ({ x: left + i * (cw + g.colGutter), w: cw })),
      rows: Array.from({ length: g.rows }, (_, i) => ({ y: g.top + i * (rh + g.rowGutter), h: rh })),
    }
  })
}

export type Anchor = { v: number; kind: string }
export function anchors(doc: Doc, s: Spread, opts: { grid: boolean; guides: boolean; frames: boolean; exclude: string[] }) {
  const xs: Anchor[] = [{ v: 0, kind: "trim" }, { v: PAGE, kind: "spine" }, { v: SW, kind: "trim" }, { v: PAGE / 2, kind: "page center" }, { v: PAGE * 1.5, kind: "page center" }]
  const ys: Anchor[] = [{ v: 0, kind: "trim" }, { v: SH, kind: "trim" }, { v: SH / 2, kind: "center" }]
  if (opts.grid) {
    for (const p of resolveGrid(effectiveGrid(doc, s))) {
      p.cols.forEach((c, i) => { xs.push({ v: c.x, kind: `column ${i + 1}` }, { v: c.x + c.w, kind: `column ${i + 1}` }) })
      p.rows.forEach((r, i) => { ys.push({ v: r.y, kind: `row ${i + 1}` }, { v: r.y + r.h, kind: `row ${i + 1}` }) })
    }
  }
  if (opts.guides) for (const g of allGuides(doc, s)) (g.axis === "v" ? xs : ys).push({ v: g.pos, kind: "guide" })
  if (opts.frames) for (const f of s.frames) {
    if (opts.exclude.includes(f.id)) continue
    xs.push({ v: f.x, kind: "frame" }, { v: f.x + f.w, kind: "frame" }, { v: f.x + f.w / 2, kind: "frame center" })
    ys.push({ v: f.y, kind: "frame" }, { v: f.y + f.h, kind: "frame" }, { v: f.y + f.h / 2, kind: "frame center" })
  }
  return { xs, ys }
}
/** Built-in master overrides edited in the Masters view (v7 store): guide list and Page numbers toggle; unset = the master's own values. */
export const MASTER_GUIDES: Record<string, Guide[] | undefined> = {}
export const MASTER_PN: Record<string, boolean | undefined> = {}
export const guidesOf = (p?: Parent): Guide[] => (p ? MASTER_GUIDES[p.id] ?? p.guides : [])
export const pageNumbersOf = (p?: Parent): boolean => (p ? MASTER_PN[p.id] ?? !!p.pageNumbers : false)
export function allGuides(doc: Doc, s: Spread): (Guide & { inherited?: boolean })[] {
  const par = parentOf(doc, s)
  const pg = guidesOf(par).filter((g) => !(s.hiddenParent ?? []).includes(g.id)).map((g) => ({ ...g, inherited: true }))
  return [...pg, ...s.guides]
}
export type SnapLine = { axis: "v" | "h"; pos: number; kind: string }
/** snap a rect's edges / center to the nearest anchors within th (mm) */
export function snapRect(r: Rect, a: { xs: Anchor[]; ys: Anchor[] }, th: number, edges: { x: ("l" | "c" | "r")[]; y: ("t" | "m" | "b")[] } = { x: ["l", "c", "r"], y: ["t", "m", "b"] }) {
  let bx: { d: number; a: Anchor } | null = null, by: { d: number; a: Anchor } | null = null
  const px = { l: r.x, c: r.x + r.w / 2, r: r.x + r.w }, py = { t: r.y, m: r.y + r.h / 2, b: r.y + r.h }
  for (const e of edges.x) for (const an of a.xs) { const d = an.v - px[e]; if (Math.abs(d) < th && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, a: an } }
  for (const e of edges.y) for (const an of a.ys) { const d = an.v - py[e]; if (Math.abs(d) < th && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, a: an } }
  const lines: SnapLine[] = []
  if (bx) lines.push({ axis: "v", pos: bx.a.v, kind: bx.a.kind })
  if (by) lines.push({ axis: "h", pos: by.a.v, kind: by.a.kind })
  return { dx: bx?.d ?? 0, dy: by?.d ?? 0, lines }
}

/* ---------------------------------------------------------------- photos */
export const photoOf = (id: string | null | undefined): Photo | null => (id ? P(id) : null)
export function orientedSize(p: Photo, qt: number) { return qt % 180 === 0 ? { w: p.w, h: p.h } : { w: p.h, h: p.w } }
/** effective DPI of the photo as printed in the frame (cover fit × zoom) */
export function effectiveDpi(f: Frame): number | null {
  const p = photoOf(f.photo); if (!p) return null
  const o = orientedSize(p, f.qt)
  const s = Math.max(f.w / o.w, f.h / o.h) * f.zoom // mm per px
  return Math.round(25.4 / s)
}
export const fmtMm = (v: number) => `${round(v)}`

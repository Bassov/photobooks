/* v0.7.1: book-level parts of the ONE editor (cover, endpapers, masters, last page, book settings).
   Moved from the v0.7.0 Editor7 mock into the sandbox editor; the sandbox keeps the spreads, frames, templates and filmstrip. */
import * as React from "react"
import { useStudio, type Book } from "./store"
import { Slider as USlider, SliderTrack, SliderFillTrack, SliderThumb } from "@/components/ui/slider"
import { P } from "@/data"
import { MASTER_GRIDS, MASTER_GUIDES, MASTER_PN, MASTER_POS, FOLIO_W, builtinMaster, folioBox, formatPageNumber, lastPageFolios, pageNumbersOf, type Doc, type Folio, type Grid, type Guide, type PageFormat, type PnPos } from "./model"
import { Link2, RotateCcw, Unlink2 } from "lucide-react"

export const T = "#393738", SUB = "#535152", INK = "#232223", ON_INK = "#F2F2F2", SURROUND = "#C8CACB", BAR = "#E1E1E1", FIELD = "#D7D7D7", PAPER = "#FFFFFF"
const serif = { fontFamily: "var(--font-heading)" } as const
const ph = (id: string) => `url(${P(id).src})`
/* v0.7.2: the cover's front photo is replaceable (P0-2); one value per mounted demo */
let coverId = "p01"; const coverSubs = new Set<() => void>()
export const setCoverPhoto = (id: string) => { coverId = id; coverSubs.forEach((f) => f()) }
export const resetCoverPhoto = () => { coverId = "p01"; coverText = COVER_TEXT0 }
/* v0.8.1 (P1-1/P2-7): cover texts are per book — the sample book keeps its texts, a new book starts from its own title */
export type CoverText = { front: string; spine: string; back: string }
const COVER_TEXT0: CoverText = { front: "Summer", spine: "Summer", back: "Summer by the sea · 2025" }
let coverText: CoverText = COVER_TEXT0
export const setCoverText = (t: CoverText) => { coverText = t; coverSubs.forEach((f) => f()) }
export const useCoverText = () => React.useSyncExternalStore((f) => { coverSubs.add(f); return () => { coverSubs.delete(f) } }, () => coverText)
/** session snapshot of the module-level editor state (cover photo + texts, masters) */
export const getEditorExtras = () => ({ cover: coverId, coverText, masters: MASTERS })
export const setEditorExtras = (x: { cover: string; coverText: CoverText; masters: Record<"A" | "B", Master> }) => { coverId = x.cover; coverText = x.coverText; MASTERS = x.masters; syncGrids(); coverSubs.forEach((f) => f()); masterSubs.forEach((f) => f()) }
export const useCoverPhoto = () => React.useSyncExternalStore((f) => { coverSubs.add(f); return () => { coverSubs.delete(f) } }, () => coverId)
export const PAGE_MIN = 20, PAGE_MAX = 120
/** page count: spread 0 is page 1 alone, every later spread adds two pages, the last page closes the block */
export const pagesOf = (spreads: number) => spreads * 2
export const pageLabel = (i: number) => (i === 0 ? "1" : `${i * 2}–${i * 2 + 1}`)
export const ENDP = "#5E5B57"
export const endpBg = `radial-gradient(circle at 25% 25%, rgb(255 255 255/.10) 1.2px, transparent 1.6px) 0 0/14px 14px, radial-gradient(circle at 75% 75%, rgb(255 255 255/.10) 1.2px, transparent 1.6px) 0 0/14px 14px, ${ENDP}`
export const V7CSS = `
.e7 ::-webkit-scrollbar-thumb { background-color: #A8A8A8 } .e7 *:hover::-webkit-scrollbar-thumb { background-color: #969696 } .e7 ::-webkit-scrollbar-thumb:hover { background-color: #7E7E7E }
.e7-ghost { color: ${T}; border: 0; outline: none; transition: background-color .15s } .e7-ghost:hover { background: rgb(57 55 56/.08) }
.e7-ghost:focus-visible, .e7-item:focus-visible, .e7-title:focus-visible, .e7-sel:focus-visible, .e7-csel:focus-visible, .e7-canvas:focus-visible { outline: 2px solid #535152; outline-offset: 2px }
.e7-canvas[data-panning], .e7-canvas[data-panning]:focus-visible { outline: none }
.cursor-tool-frame { cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M12%201v22M1%2012h22%22%20stroke%3D%22%23232223%22%20stroke-width%3D%223.2%22%20stroke-linecap%3D%22square%22%2F%3E%3Cpath%20d%3D%22M12%201v22M1%2012h22%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22square%22%2F%3E%3C%2Fsvg%3E") 12 12, crosshair }
.cursor-tool-text { cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2224%22%20viewBox%3D%220%200%2016%2024%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M3%202.5h10M8%202.5v19M3%2021.5h10%22%20stroke%3D%22%23232223%22%20stroke-width%3D%222.6%22%20stroke-linecap%3D%22square%22%2F%3E%3Cpath%20d%3D%22M3%202.5h10M8%202.5v19M3%2021.5h10%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221.3%22%20stroke-linecap%3D%22square%22%2F%3E%3C%2Fsvg%3E") 7 11, text }

.e7-item { cursor: default; outline: none; transition: background-color .12s } .e7-item:hover { background: ${FIELD} }
.e7-item[aria-selected=true], .e7-item[aria-selected=true]:hover { background: #CACACA }
.e7-title { transition: background-color .12s } .e7-title:hover { background: rgb(57 55 56/.08) } .e7-title:active { background: #CDCDCD } .e7-title[aria-pressed=true] { background: ${FIELD} }
.e7-tg { background: #CACACA } .e7-tg[data-on] { background: #A8A8A8 } .e7-tg[data-on]:hover { background: #8E8E8E }
.e7-tog[aria-pressed=true] { background: ${FIELD} } .e7-sec:hover { background: #CDCDCD !important }
.e7-csel { -webkit-appearance: none; appearance: none; padding: 0 33px 0 11px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b696a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-position: right 9px center; background-size: 16px 16px; background-repeat: no-repeat }
.e7-sel { -webkit-appearance: none; appearance: none; background-image: linear-gradient(45deg, transparent 50%, ${SUB} 50%), linear-gradient(135deg, ${SUB} 50%, transparent 50%); background-position: calc(100% - 13px) 12px, calc(100% - 9px) 12px; background-size: 4px 4px; background-repeat: no-repeat }
.e7-pan { transition: width .18s cubic-bezier(.2,.7,.2,1), height .18s cubic-bezier(.2,.7,.2,1) } @media (prefers-reduced-motion: reduce) { .e7-pan { transition: none } }
.e7-tip { position: relative } .e7-tip > .e7-tt { position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .12s .25s; z-index: 50; background: #535152; color: ${ON_INK}; font-size: 11px; line-height: 16px; padding: 3px 7px; border-radius: 5px }
.e7-tip:hover > .e7-tt, .e7-tip:focus-visible > .e7-tt { opacity: 1 } .e7-tt kbd { font-family: inherit; opacity: .7; margin-left: 6px }
`
export const shadowBig = "0 1px 2px rgb(35 34 35/.2), 0 30px 60px -30px rgb(35 34 35/.55)", shadowSm = "0 1px 2px rgb(35 34 35/.18)"
export const Gutter = () => <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[8%] -translate-x-1/2" style={{ background: "linear-gradient(90deg, transparent, rgb(0 0 0/.07) 46%, rgb(0 0 0/.14) 50%, rgb(0 0 0/.07) 54%, transparent)" }} />
export const SPINE = 1.2
/** v0.8 §3.2: page-size presets — size of ONE page, portrait base (cm). Orientation applies to the preset. */
export const PRESETS: { id: string; name: string; w: number; h: number }[] = [
  { id: "A6", name: "A6", w: 10.5, h: 14.8 }, { id: "A5", name: "A5", w: 14.8, h: 21 }, { id: "A4", name: "A4", w: 21, h: 29.7 }, { id: "A3", name: "A3", w: 29.7, h: 42 },
  { id: "Letter", name: "Letter", w: 21.6, h: 27.9 }, { id: "sq20", name: "Square 20×20", w: 20, h: 20 }, { id: "sq30", name: "Square 30×30", w: 30, h: 30 }]
export const presetLabel = (p: { name: string; w: number; h: number }, land = false) => `${p.name} · ${fmtN(land && p.w !== p.h ? p.h : p.w)} × ${fmtN(land && p.w !== p.h ? p.w : p.h)} cm`
export const coverW = (b: Book) => 2 * b.w + SPINE
export const fmtN = (n: number) => (Math.round(n * 10) / 10).toString()
export const useBook = () => useStudio().book
/** `slide`: the canvas text sizes × slide without the canvas chrome (no safe line, no wrap note, no test ids) — the presentation cover */
export function CoverSpread({ big, slide }: { big?: boolean; slide?: number }) {
  const cov = useCoverPhoto(), ct = useCoverText()
  const bk = useBook(), CW = coverW(bk), k = big ? 1 : slide
  return (
    <div className="relative flex h-full w-full" style={{ boxShadow: big ? shadowBig : slide ? undefined : shadowSm }} data-testid={big ? "canvas-cover" : undefined}>
      <div className="relative h-full" style={{ width: `${(bk.w / CW) * 100}%`, background: "#3E3C3B" }}>
        <div className="absolute right-[12%] bottom-[10%] left-[12%]" style={{ color: "#E8E6E3", fontSize: k ? 11 * k : 3 }} data-testid={big ? "cover-back-text" : undefined}>{ct.back}</div></div>
      <div className="relative grid h-full place-items-center" style={{ width: `${(SPINE / CW) * 100}%`, background: "#353332" }} data-testid={big ? "cover-spine" : undefined}>
        <span className="whitespace-nowrap" style={{ ...serif, color: "#E8E6E3", fontSize: k ? 12 * k : 3, transform: "rotate(90deg)" }}><em>{ct.spine}</em></span></div>
      <div className="relative h-full bg-cover" style={{ width: `${(bk.w / CW) * 100}%`, backgroundImage: cov ? ph(cov) : undefined, backgroundColor: cov ? undefined : "#8E8E8E", backgroundPosition: "45% 50%" }} data-testid={big ? "cover-front" : undefined} data-photo-id={cov || undefined}>
        <div className="absolute top-[9%] right-[10%] left-[10%] text-white" style={{ ...serif, fontSize: k ? 34 * k : 7, textShadow: "0 1px 8px rgb(0 0 0/.35)" }} data-testid={big ? "cover-front-text" : undefined}><em>{ct.front}</em></div></div>
      {big && <>
        <div data-allow-border data-testid={big ? "cover-safe" : undefined} className="pointer-events-none absolute" style={{ inset: `${(1.5 / bk.h) * 100}% ${(1.5 / CW) * 100}%`, outline: "1px dashed rgb(255 255 255/.45)" }} />
        <span className="pointer-events-none absolute top-1.5 right-2 text-2xs" style={{ color: "rgb(255 255 255/.92)" }}>Wrap 15 mm</span></>}
    </div>)
}
export function EndpaperSpread({ big, which }: { big?: boolean; which: "front" | "back" }) {
  const paste = <div className="h-full flex-1" style={{ background: endpBg }} />
  return (
    <div className="relative flex h-full w-full" style={{ boxShadow: big ? shadowBig : shadowSm }} data-testid={big ? "canvas-endpaper" : undefined}>
      {paste}{paste}
      {/* M91: prod .endpaper-gutter — a 1 px hard line at the spine, not the master gradient */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px" style={{ background: "color-mix(in srgb, black 18%, transparent)" }} data-testid={big ? "endpaper-spine" : undefined} />
    </div>)
}
/** `guides` unset = the built-in master guides; `pn` feeds Parent.pageNumbers of every spread on this master */
export type Master = { grid: Grid; link: boolean; pn: boolean; pos: number; guides?: Guide[] }
/** v0.8 §3.4: master grids in mm — columns, rows, gutter, row gap, margins T/B/I/O (linked or not) */
const MASTERS0: Record<"A" | "B", Master> = {
  A: { grid: { top: 12, bottom: 16, inside: 12, outside: 12, cols: 2, rows: 1, colGutter: 4, rowGutter: 4 }, link: false, pn: false, pos: 0 },
  B: { grid: { top: 16, bottom: 16, inside: 16, outside: 16, cols: 3, rows: 2, colGutter: 4, rowGutter: 4 }, link: true, pn: false, pos: 0 } }
const syncGrids = () => {
  MASTER_GRIDS.mA = MASTERS.A.grid; MASTER_GRIDS.mB = MASTERS.B.grid
  MASTER_GUIDES.mA = MASTERS.A.guides; MASTER_GUIDES.mB = MASTERS.B.guides
  MASTER_PN.mA = MASTERS.A.pn; MASTER_PN.mB = MASTERS.B.pn
  MASTER_POS.mA = MASTERS.A.pos as PnPos; MASTER_POS.mB = MASTERS.B.pos as PnPos
}
/** The guides a master shows (and edits): its own list once edited, else the built-in ones. */
export const guidesOfMaster = (id: "A" | "B", m: Master): Guide[] => m.guides ?? builtinMaster(id).guides
export let MASTERS: Record<"A" | "B", Master> = MASTERS0; const masterSubs = new Set<() => void>()
syncGrids()
export const setMaster = (id: "A" | "B", patch: Partial<Master>) => { MASTERS = { ...MASTERS, [id]: { ...MASTERS[id], ...patch } }; syncGrids(); masterSubs.forEach((f) => f()) }
export const resetMasters = () => { MASTERS = MASTERS0; syncGrids() }
export const defaultMasters = () => MASTERS0
export const useMasters = () => React.useSyncExternalStore((f) => { masterSubs.add(f); return () => { masterSubs.delete(f) } }, () => MASTERS)
export function MasterSpread({ id, big, m }: { id: "A" | "B"; big?: boolean; m: Master }) {
  const bk = useBook()
  const g = m.grid, PW = bk.w * 10, PH = bk.h * 10, pc = (v: number, d: number) => `${(v / d) * 100}%`
  const cw = (PW - g.inside - g.outside - g.colGutter * (g.cols - 1)) / g.cols, ch = PH - g.top - g.bottom, rh = (ch - g.rowGutter * (g.rows - 1)) / g.rows
  const mx = pc(g.outside, PW), cq = (mm: number) => `${(mm / PW) * 100}cqw`
  /* Designer page-numbers: the `#` chip sits at the folio box in the folio font at true scale (cqw of its page) */
  const chip = (side: "l" | "r") => {
    const b = folioBox(g, PW, PH, m.pos as PnPos, side === "l" ? 0 : 1, bk.safe)
    const at = b.align === "center" ? { left: pc(b.x + FOLIO_W / 2, PW), transform: "translateX(-50%)" } : b.align === "left" ? { left: pc(b.x, PW) } : { right: pc(PW - b.x - FOLIO_W, PW) }
    return <span className="pointer-events-none absolute whitespace-nowrap" data-testid="master-pn" data-align={b.align}
      style={{ top: pc(b.y, PH), ...at, fontFamily: "'Inter Variable', system-ui, sans-serif", fontSize: cq(3.1), fontWeight: 400, lineHeight: 1.4, padding: `0 ${cq(1)}`, borderRadius: 2, color: SUB, background: "rgb(57 55 56/.08)" }}>#</span>
  }
  const page = (side: "l" | "r") => (
    <div className="relative h-full flex-1" style={{ background: PAPER, containerType: big ? "inline-size" : undefined }} data-paper>
      <div className="absolute" style={{ inset: `${pc(g.top, PH)} ${pc(side === "l" ? g.inside : g.outside, PW)} ${pc(g.bottom, PH)} ${pc(side === "l" ? g.outside : g.inside, PW)}` }} data-testid={big ? "master-margin" : undefined}>
        {Array.from({ length: g.cols }, (_, i) => <div key={i} className="absolute inset-y-0" data-testid={big ? "master-col" : undefined} style={{ left: pc(i * (cw + g.colGutter), PW - g.inside - g.outside), width: pc(cw, PW - g.inside - g.outside) }}>
          {Array.from({ length: g.rows }, (_, j) => <div key={j} className="absolute inset-x-0" data-testid={big ? "master-cell" : undefined} style={{ top: pc(j * (rh + g.rowGutter), ch), height: pc(rh, ch), background: "rgb(57 55 56/.06)" }} />)}</div>)}
        {big && <div data-allow-border className="absolute inset-0" style={{ outline: "1px dashed #9A9A9A" }} />}
      </div>
      {big && m.pn && chip(side)}
      {id === "B" && <div className="absolute rounded-2xs" style={{ top: `calc(${pc(g.top, PH)} - 5%)`, left: mx, right: mx, height: "2.5%", background: "rgb(57 55 56/.16)" }} />}
    </div>)
  return <div className="relative flex h-full w-full" style={{ boxShadow: big ? shadowBig : shadowSm }} data-testid={big ? "canvas-master" : undefined}>{page("l")}{page("r")}<Gutter /></div>
}
/* Designer page-numbers: folios at `sc` px / mm (spread mm), printed parent content on the canvas, the last page and Preview;
   never in spread-list thumbnails */
export const FolioMarks = ({ folios, sc }: { folios: Folio[]; sc: number }) => <>{folios.map((p) => (
  <span key={p.side} className="pointer-events-none absolute select-none whitespace-nowrap" data-testid="page-number" data-side={p.side}
    style={{ left: p.x * sc, top: p.y * sc, width: p.w * sc, height: p.h * sc, textAlign: p.align, fontFamily: "'Inter Variable', system-ui, sans-serif", fontSize: 3.1 * sc, fontWeight: 400, lineHeight: 1.4, color: "#232220", fontVariantNumeric: "tabular-nums", letterSpacing: "normal" }}>{p.text}</span>
))}</>
/** the single last page; with `sc` (px / mm, the canvas) it prints the left-page folio of the last spread's parent */
export function LastPage({ big, sc }: { big?: boolean; sc?: number }) {
  const st = useStudio()
  return (
    <div className="relative flex h-full w-full" data-testid={big ? "canvas-last" : undefined}>
      <div className="h-full flex-1" style={{ background: PAPER, boxShadow: big ? shadowBig : shadowSm }} data-paper />
      <div className="h-full flex-1" />
      {sc !== undefined && <FolioMarks folios={lastPageFolios(st.doc, st.book.safe, st.view.pageNumbers)} sc={sc} />}
    </div>)
}

export const Sec = ({ title, children, right, tid }: { title: string; children: React.ReactNode; right?: React.ReactNode; tid?: string }) => (
  <section className="px-4 py-4" data-testid={tid}><div className="mb-3 flex items-center justify-between"><h3 className="text-2xs font-semibold tracking-[0.12em] uppercase" style={{ color: SUB }}>{title}</h3>{right}</div>{children}</section>)
/** layout-grids-parent-inherit GP2/GP3: with `src` (tooltip + description) the value reads grey 400 when inherited, dark 600 + ↺ when `own` */
export const Field = ({ l, v, u, set, min = 0, max = 99, cap, name, tid = "master-field", own, src, onReset, resetLabel }: { l: string; v: string; u?: string; set?: (n: number) => void; min?: number; max?: number; cap?: string; name?: string; tid?: string; own?: boolean; src?: string; onReset?: () => void; resetLabel?: string }) => {
  const descId = React.useId(), shade = src === undefined ? { color: T } : { color: own ? T : SUB, fontWeight: own ? 600 : 400 }
  /* v0.9 §5: always show the short label (`l`) so the number + unit stay visible; long name goes on title/aria */
  return <label className="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm has-[input:focus-visible]:shadow-field-focus" style={{ background: FIELD }} title={src ?? cap ?? name ?? l}><span className="min-w-3 shrink-0 text-center" style={{ color: SUB }}>{l}</span>
    {set ? <input type="number" inputMode="numeric" aria-label={name ?? cap ?? l} aria-describedby={src === undefined ? undefined : descId} value={v} min={min} max={max} data-testid={`${tid}-${l}`} onChange={(e) => { const n = +e.target.value; if (Number.isFinite(n)) set(Math.min(max, Math.max(min, n))) }}
        className="w-0 min-w-0 flex-1 bg-transparent font-mono tabular-nums outline-none [appearance:textfield] focus-visible:underline" style={shade} />
      : <span className="flex-1 font-mono tabular-nums" style={shade}>{v}</span>}{u && <span className="shrink-0" style={{ color: SUB }}>{u}</span>}
    {src !== undefined && <span id={descId} className="sr-only">{src}</span>}
    {own && onReset && <button type="button" aria-label={resetLabel} title={resetLabel} data-testid={`${tid}-reset-${l}`} onClick={(e) => { e.preventDefault(); onReset() }}
      className="-ml-1 grid size-4 shrink-0 place-items-center rounded-xs border-0 bg-transparent p-0 text-[#535152] outline-none transition-colors hover:bg-[rgb(57_55_56/.08)] hover:text-[#393738] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#535152] [&_svg]:size-3"><RotateCcw /></button>}</label>
}
export const SegC = ({ items, on, set, label, tid }: { items: React.ReactNode[]; on: number; set?: (i: number) => void; label?: string; tid?: string }) => (
  <div className="flex rounded-md p-0.5" style={{ background: FIELD }} role={label ? "group" : undefined} aria-label={label} data-testid={tid}>
    {items.map((it, i) => <button key={i} type="button" aria-pressed={i === on} onClick={() => set?.(i)} className="e7-ghost flex h-6.5 flex-1 items-center justify-center rounded-sm text-sm font-medium [&_svg]:size-3.5" style={i === on ? { background: BAR, color: T, boxShadow: "0 1px 2px rgb(35 34 35/.14)" } : { color: SUB }}>{it}</button>)}
  </div>)
export const Slider = ({ l, v, pct }: { l: string; v: string; pct: number }) => (
  <div className="mt-3"><div className="mb-1 flex justify-between text-sm"><span style={{ color: SUB }}>{l}</span><span className="font-mono tabular-nums" style={{ color: T }}>{v}</span></div>
    <USlider aria-label={l} defaultValue={pct} className="w-full" data-testid="e7-slider"><SliderTrack><SliderFillTrack /><SliderThumb /></SliderTrack></USlider></div>)
export const Row = ({ l, children }: { l: string; children: React.ReactNode }) => <div className="mt-3 flex items-center justify-between text-sm"><span style={{ color: SUB }}>{l}</span>{children}</div>
export const Toggle = ({ on, onClick, label, tid }: { on: boolean; onClick?: () => void; label: string; tid?: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} data-testid={tid} className="e7-tg relative h-4.5 w-8 rounded-full border-0 p-0" data-on={on || undefined}>
    <span className="e7-knob absolute top-0.5 size-3.5 rounded-full transition-[left]" style={{ left: on ? 16 : 2 }} /></button>)
export const Val = ({ v }: { v: string }) => <span className="rounded-sm px-2 py-1 text-sm" style={{ background: FIELD, color: T }}>{v}</span>
/** kit-sync KS10: read-only pill + note as one right-aligned group (prod ReadOnlyPill) */
const ReadOnly = ({ v, note, tid }: { v: string; note: string; tid: string }) => <span className="flex items-center"><Val v={v} /><span className="ml-1.5 text-2xs" style={{ color: SUB }} data-testid={tid}>{note}</span></span>
/** kit-sync KS10: cover style choice — native select like prod Select (h 36, r 8, chevron 16), right-aligned in its Row */
function CoverSel({ l, opts, tid }: { l: string; opts: string[]; tid: string }) {
  const [v, setV] = React.useState(opts[0])
  return <Row l={l}><select aria-label={l} data-testid={tid} value={v} onChange={(e) => setV(e.target.value)}
    className="e7-csel h-9 rounded-md border-0 text-sm outline-none" style={{ backgroundColor: FIELD, color: T }}>{opts.map((o) => <option key={o}>{o}</option>)}</select></Row>
}
export const Swatches = ({ cs, on }: { cs: string[]; on: number }) => <div className="flex gap-1.5">{cs.map((c, i) => <span key={c} className={i === on ? "swatch-on size-5 rounded-full" : "size-5 rounded-full"} data-swatch-on={i === on || undefined} style={{ background: c, boxShadow: "0 1px 2px rgb(0 0 0/.15)" }} />)}</div>
export const Head = ({ t, s }: { t: string; s: string }) => <div className="px-4 pt-4 pb-1" data-testid="inspector-head"><div className="text-sm font-medium">{t}</div><div className="mt-0.5 text-xs" style={{ color: SUB }}>{s}</div></div>
export const Txt = ({ v, ph: p }: { v?: string; ph?: string }) => <div className="flex h-8 items-center rounded-md px-2.5 text-sm" style={{ background: FIELD, color: v ? T : SUB }}>{v ?? p}</div>

/** v0.8.1: editable cover text (front title / spine / back) — persists per book in the demo */
export function CoverTxt({ k, label }: { k: keyof CoverText; label: string }) {
  const ct = useCoverText()
  return <input type="text" aria-label={label} value={ct[k]} placeholder={label} data-testid={`cover-text-${k}`} onChange={(e) => setCoverText({ ...ct, [k]: e.target.value })}
    className="flex h-8 w-full items-center rounded-md px-2.5 text-sm outline-none placeholder:text-[#535152] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[#535152]" style={{ background: FIELD, color: T }} />
}
export function SizeEditor({ book, setBook }: { book: Book; setBook: (b: Book) => void }) {
  const [unit, setUnit] = React.useState<"cm" | "mm">("cm")
  const land = book.w > book.h, pr = PRESETS.find((p) => p.id === book.preset)
  const apply = (p: (typeof PRESETS)[number], l: boolean) => setBook({ ...book, w: l && p.w !== p.h ? p.h : p.w, h: l && p.w !== p.h ? p.w : p.h, preset: p.id })
  const setOri = (o: number) => { const l = o === 1; if (l === land) return; if (pr) return apply(pr, l); setBook({ ...book, w: book.h, h: book.w }) }
  const k = unit === "mm" ? 10 : 1, lo = 5, hi = 50
  const num = (key: "w" | "h", l: string) => (
    <label className="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm" style={{ background: FIELD }}><span className="w-3 shrink-0" style={{ color: SUB }}>{l}</span>
      <input aria-label={key === "w" ? `Width (${unit})` : `Height (${unit})`} data-testid={`size-${key}`} type="number" step={unit === "mm" ? 1 : 0.1} min={lo * k} max={hi * k} value={+(book[key] * k).toFixed(1)}
        onChange={(e) => { const v = parseFloat(e.target.value) / k; if (v >= lo && v <= hi) setBook({ ...book, [key]: +v.toFixed(2), preset: "custom" }) }}
        className="w-full min-w-0 flex-1 border-0 bg-transparent p-0 font-mono tabular-nums outline-none" style={{ color: T }} /><span style={{ color: SUB }}>{unit}</span></label>)
  return <>
    <select aria-label="Page size" data-testid="size-preset" value={pr ? pr.id : "custom"} onChange={(e) => { const p = PRESETS.find((x) => x.id === e.target.value); if (p) apply(p, land); else setBook({ ...book, preset: "custom" }) }}
      className="e7-sel h-8 w-full rounded-md border-0 pr-7 pl-2.5 text-sm outline-none" style={{ backgroundColor: FIELD, color: T }}>
      {PRESETS.map((p) => <option key={p.id} value={p.id}>{presetLabel(p, land)}</option>)}<option value="custom">Custom</option></select>
    <div className="mt-3" data-testid="size-orientation"><SegC items={["Portrait", "Landscape"]} on={land ? 1 : 0} set={setOri} /></div>
    {book.preset === "custom" && <div className="mt-3" data-testid="size-unit"><SegC items={["cm", "mm"]} on={unit === "cm" ? 0 : 1} set={(i) => setUnit(i ? "mm" : "cm")} /></div>}
    <div className="mt-3 grid grid-cols-2 gap-2">{num("w", "W")}{num("h", "H")}</div>
    <div className="mt-1.5 text-2xs leading-4" style={{ color: SUB }} data-testid="size-hint">Size of one page. To print 2 pages per A4 sheet, choose A5.</div>
  </>
}

/** v0.8 §3.4: the grid editor — Columns, Rows, Gutter, Row gap, Margins T/B/I/O with a link toggle, all mm. Shared by Masters and the spread inspector. */
/** layout-grids-parent-inherit: `src` (per-field source) + `parentName` ("Master A" / "book grid") + `onReset` show grey / own values and ↺; without `src` it renders as before (masters). */
export function GridFields({ g, set, link, setLink, tid = "master-field", src, parentName = "book grid", onReset }: { g: Grid; set: (g: Grid) => void; link: boolean; setLink: (v: boolean) => void; tid?: string; src?: Record<keyof Grid, "book" | "parent" | "spread">; parentName?: string; onReset?: (k: keyof Grid) => void }) {
  const f = (k: keyof Grid, l: string, cap: string, name: string, u: string | undefined, min: number, max: number) => {
    const own = src?.[k] === "spread", label = name.replace(" (mm)", "")
    const tip = src && `${name} · ${own ? "set on this spread" : src[k] === "parent" ? `from ${parentName}` : "from book grid"}`
    return <Field l={l} cap={cap} name={name} tid={tid} v={`${g[k]}`} u={u} min={min} max={max} own={own} src={tip} onReset={onReset && (() => onReset(k))} resetLabel={`Reset ${label} to ${parentName}`}
      set={(n) => set(link && ["top", "bottom", "inside", "outside"].includes(k) ? { ...g, top: n, bottom: n, inside: n, outside: n } : { ...g, [k]: n })} />
  }
  return <div data-testid={`${tid}-grid`}>
    <div className="grid grid-cols-2 gap-2">{f("cols", "C", "Columns", "Columns", undefined, 1, 12)}{f("rows", "R", "Rows", "Rows", undefined, 1, 12)}{f("colGutter", "G", "Gutter", "Gutter (mm)", "mm", 0, 30)}{f("rowGutter", "RG", "Row gap", "Row gap (mm)", "mm", 0, 30)}</div>
    <div className="mt-3 flex items-center justify-between text-sm"><span style={{ color: SUB }}>Margins</span>
      <button type="button" aria-pressed={link} aria-label="Link margins" data-testid={`${tid}-link`} onClick={() => { if (!link) set({ ...g, bottom: g.top, inside: g.top, outside: g.top }); setLink(!link) }}
        className="e7-ghost grid size-7 place-items-center rounded-md outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[#535152] [&_svg]:size-3.5" style={{ background: link ? FIELD : undefined, color: link ? T : SUB }}>{link ? <Link2 /> : <Unlink2 />}</button></div>
    <div className="mt-2 grid grid-cols-2 gap-2">{f("top", "T", "T", "Top margin (mm)", "mm", 0, 60)}{f("bottom", "B", "B", "Bottom margin (mm)", "mm", 0, 60)}{f("inside", "I", "I", "Inside margin (mm)", "mm", 0, 60)}{f("outside", "O", "O", "Outside margin (mm)", "mm", 0, 60)}</div>
  </div>
}

/* Designer page-numbers: the book owns how folios count (Start at, Format, Skip first page); masters own Show + position */
const PN_FORMATS: PageFormat[] = ["decimal", "lower-roman", "upper-roman"], PN_LABELS = ["1, 2, 3", "i, ii, iii", "I, II, III"]
const pnStart = (d: Doc) => formatPageNumber(d.pageStart ?? 1, d.pageFormat)
/** Start at: the Pages field look as a real number input; commits on Enter / blur (rounded, 1–999), Esc reverts, empty keeps the value */
function StartAt({ v, set }: { v: number; set: (n: number) => void }) {
  const [t, setT] = React.useState(`${v}`)
  React.useEffect(() => setT(`${v}`), [v])
  const commit = () => { const n = Math.round(parseFloat(t)); const c = Number.isFinite(n) ? Math.min(999, Math.max(1, n)) : v; setT(`${c}`); if (c !== v) set(c) }
  return <input type="number" inputMode="numeric" min={1} max={999} step={1} aria-label="Start page numbers at" data-testid="book-pn-start" value={t}
    onChange={(e) => setT(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") { e.stopPropagation(); setT(`${v}`) } }}
    className="rounded-sm border-0 px-2 py-1 text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152]"
    style={{ background: FIELD, color: T, width: `calc(${Math.max(2, t.length)}ch + 1rem)` }} />
}

/** book-level inspector: Book settings, Cover, Endpaper, Master, last page, nothing selected */
export function BookInspector() {
  const masters = useMasters(); const cov = useCoverPhoto(); const ct = useCoverText()
  const st = useStudio(), sel = st.node, book = st.book, setBook = st.setBook
  const pages = pagesOf(st.doc.spreads.length)
  if (!sel || sel.k === "none") return <div className="grid h-full place-items-center px-8 text-center text-sm" style={{ color: SUB }} data-testid="inspector-empty">Select a spread or photo</div>
  const pc = <span className="text-sm" style={{ color: SUB }} data-testid="page-colour-readonly">Paper white · coming later</span>
  const doc = st.doc, pnFmt = PN_FORMATS.indexOf(doc.pageFormat ?? "decimal"), pnAny = masters.A.pn || masters.B.pn || doc.parents.some((p) => pageNumbersOf(p))
  if (sel.k === "book") return <div data-testid="insp-book">
    <Head t="Book settings" s={`${ct.back || ct.front || "Untitled book"} · applies to the whole book`} />
    <Sec title="Page size"><SizeEditor book={book} setBook={setBook} /></Sec>
    <Sec title="Binding"><Row l="Style"><ReadOnly v="Hardcover" note="read-only" tid="binding-readonly" /></Row>
      <Row l="Endpapers"><Toggle label="Endpapers" on={book.endp} onClick={() => setBook({ ...book, endp: !book.endp })} /></Row>
      <Row l="Pages"><span className="flex items-center gap-1" data-testid="book-pages"><Val v={`${pages}`} /><span className="text-2xs" style={{ color: SUB }}>{PAGE_MIN}–{PAGE_MAX}</span></span></Row>
      <div className="mt-1.5 text-2xs" style={{ color: SUB }} data-testid="book-pages-note">{pages < PAGE_MIN ? `Add ${Math.ceil((PAGE_MIN - pages) / 2)} spread${PAGE_MIN - pages > 2 ? "s" : ""} to reach the ${PAGE_MIN}-page minimum` : pages > PAGE_MAX ? `Remove ${Math.ceil((pages - PAGE_MAX) / 2)} spreads to stay within ${PAGE_MAX} pages` : "Pages are added in spreads of 2"}</div></Sec>
    <Sec title="Page numbers" tid="book-page-numbers"><Row l="Start at"><StartAt v={doc.pageStart ?? 1} set={(n) => st.update((d) => ({ ...d, pageStart: n }), "Start page numbers at")} /></Row>
      <div className="mt-3"><SegC label="Page number format" tid="book-pn-format" items={PN_LABELS} on={pnFmt} set={(i) => st.update((d) => ({ ...d, pageFormat: PN_FORMATS[i] }), "Page number format")} /></div>
      <Row l="Skip first page"><Toggle label="Skip first page" tid="book-pn-skip-first" on={!!doc.skipFirst} onClick={() => st.update((d) => ({ ...d, skipFirst: !d.skipFirst }), "Skip first page")} /></Row>
      <div className="mt-1.5 text-2xs leading-[1.35]" style={{ color: SUB }} data-testid="book-pn-note">{!pnAny ? "No master prints page numbers yet. Turn them on in Masters." : doc.skipFirst ? `Page 1 has no number · page 2 is ${formatPageNumber((doc.pageStart ?? 1) + 1, doc.pageFormat)}` : `Page 1 is ${pnStart(doc)}`}</div></Sec>
    <Sec title="Print"><div className="grid grid-cols-2 gap-2"><Field l="B" v="3" u="mm" /><Field l="S" v={`${book.safe}`} u="mm" /></div><Row l="Paper"><Val v="Matte 200 g" /></Row></Sec>
    <Sec title="Defaults"><Row l="Default master"><Val v="Master A" /></Row><Row l="Page colour">{pc}</Row></Sec></div>
  if (sel.k === "cover") return <div data-testid="insp-cover">
    <Head t="Cover" s="Hardcover · back, spine, front · wrap 15 mm" />
    <Sec title="Front"><div className="flex items-center gap-3"><div className="h-13 w-10.5 shrink-0 rounded-xs bg-cover" style={{ backgroundImage: cov ? ph(cov) : undefined, backgroundColor: cov ? undefined : "#8E8E8E" }} data-testid="cover-front-thumb" data-photo-id={cov} /><div className="text-sm"><div>{!cov ? "No photo yet" : cov === "p01" ? "IMG_P01.jpg" : P(cov).name}</div><div className="mt-0.5" style={{ color: SUB }}>Full bleed · 288 ppi</div><div className="mt-0.5 text-2xs" style={{ color: SUB }}>Drag a photo from the filmstrip onto the cover</div></div></div>
      <div className="mt-3"><CoverTxt k="front" label="Front title" /></div><CoverSel l="Title font" opts={["Serif italic", "Serif", "Sans"]} tid="cover-title-font" /></Sec>
    <Sec title="Spine"><CoverTxt k="spine" label="Spine text" /><Row l="Spine width"><span className="font-mono text-sm tabular-nums">12 mm</span></Row><Row l="Direction"><Val v="Top to bottom" /></Row></Sec>
    <Sec title="Back"><CoverTxt k="back" label="Back text" /><Row l="Fill"><ReadOnly v="Paper white" note="coming later" tid="fill-readonly" /></Row></Sec>
    <Sec title="Material"><CoverSel l="Cover" opts={["Printed", "Linen", "Leatherette"]} tid="cover-material" /><CoverSel l="Finish" opts={["Matte laminate", "Gloss laminate", "Soft touch"]} tid="cover-finish" /></Sec></div>
  if (sel.k === "endpaper") return <div data-testid="insp-endpaper">
    <Head t={`Endpaper · ${sel.w}`} s="Pastedown and free leaf, printed full bleed" />
    <Sec title="Fill"><Row l="Style"><Val v="Pattern" /><span className="ml-1.5 text-2xs" style={{ color: SUB }} data-testid="endp-fill-readonly">coming later</span></Row>
      <Row l="Pattern"><span className="h-6 w-12 rounded-xs" style={{ background: endpBg }} /></Row></Sec>
    <Sec title="Apply"><Row l="Same on back endpaper"><Toggle label="Same on back endpaper" on={book.endpSame} onClick={() => setBook({ ...book, endpSame: !book.endpSame })} /></Row></Sec></div>
  if (sel.k === "master") { const m = masters[sel.id], id = sel.id; return <div data-testid="insp-master">
    <Head t={`Master ${sel.id}`} s={`Used by ${sel.id === "A" ? 10 : 4} pages`} />
    <Sec title="Grid"><GridFields g={m.grid} set={(grid) => setMaster(id, { grid })} link={m.link} setLink={(link) => setMaster(id, { link })} /></Sec>
    <Sec title="Page numbers" tid="master-page-numbers"><Row l="Show"><Toggle label="Page numbers" tid="master-pn-toggle" on={m.pn} onClick={() => setMaster(id, m.pn ? { pn: false } : { pn: true, pos: 0 })} /></Row>
      {m.pn && <><div className="mt-3"><SegC label="Page number position" tid="master-pn-position" items={["Outer", "Centre", "Inner"]} on={m.pos} set={(i) => setMaster(id, { pos: i })} /></div>
        <div className="mt-1.5 text-2xs leading-[1.35]" style={{ color: SUB }} data-testid="master-pn-note">Starts at {pnStart(doc)} · {PN_LABELS[pnFmt]}{doc.skipFirst ? " · page 1 blank" : ""} · <button type="button" data-testid="master-pn-book-settings" onClick={() => st.setNode({ k: "book" })}
          className="rounded-2xs border-0 bg-transparent p-0 text-2xs font-medium text-[#393738] underline decoration-[rgb(57_55_56/.45)] underline-offset-2 outline-none hover:decoration-[#393738] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#535152]">Book settings</button></div></>}</Sec></div> }
  return <div data-testid="insp-page">
    <Head t={`Page ${pages}`} s="Last page · faces the back endpaper" />
    <Sec title="Page"><Row l="Master"><Val v="Master A" /></Row><Row l="Page colour">{pc}</Row></Sec></div>
}

/** v0.7.1: user-facing name of spread i — page numbers, never "Spread N" / "Cover". */
export const pagesName = (i: number) => i === 0 ? "Page 1" : `Pages ${pageLabel(i)}`

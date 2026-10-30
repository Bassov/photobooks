/* v0.7.1: book-level parts of the ONE editor (cover, endpapers, masters, last page, book settings).
   Moved from the v0.7.0 Editor7 mock into the sandbox editor; the sandbox keeps the spreads, frames, templates and filmstrip. */
import * as React from "react"
import { useStudio, type Book } from "./store"
import { Slider as USlider, SliderTrack, SliderFillTrack, SliderThumb } from "@/components/ui/slider"
import { P } from "@/data"
import { MASTER_GRIDS, MASTER_GUIDES, MASTER_PN, builtinMaster, type Grid, type Guide } from "./model"
import { Link2, Unlink2 } from "lucide-react"

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
.e7-ghost:focus-visible, .e7-item:focus-visible, .e7-title:focus-visible, .e7-sel:focus-visible, .e7-canvas:focus-visible { outline: 2px solid #535152; outline-offset: 2px }
.e7-canvas[data-panning], .e7-canvas[data-panning]:focus-visible { outline: none }
.cursor-tool-frame { cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M12%201v22M1%2012h22%22%20stroke%3D%22%23232223%22%20stroke-width%3D%223.2%22%20stroke-linecap%3D%22square%22%2F%3E%3Cpath%20d%3D%22M12%201v22M1%2012h22%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22square%22%2F%3E%3C%2Fsvg%3E") 12 12, crosshair }
.cursor-tool-text { cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2224%22%20viewBox%3D%220%200%2016%2024%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M3%202.5h10M8%202.5v19M3%2021.5h10%22%20stroke%3D%22%23232223%22%20stroke-width%3D%222.6%22%20stroke-linecap%3D%22square%22%2F%3E%3Cpath%20d%3D%22M3%202.5h10M8%202.5v19M3%2021.5h10%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221.3%22%20stroke-linecap%3D%22square%22%2F%3E%3C%2Fsvg%3E") 7 11, text }

.e7-item { cursor: default; outline: none; transition: background-color .12s } .e7-item:hover { background: ${FIELD} }
.e7-item[aria-selected=true], .e7-item[aria-selected=true]:hover { background: #CACACA }
.e7-title { transition: background-color .12s } .e7-title:hover { background: rgb(57 55 56/.08) } .e7-title:active { background: #CDCDCD } .e7-title[aria-pressed=true] { background: ${FIELD} }
.e7-tg { background: #CACACA } .e7-tg[data-on] { background: #A8A8A8 } .e7-tg[data-on]:hover { background: #8E8E8E }
.e7-tog[aria-pressed=true] { background: ${FIELD} } .e7-sec:hover { background: #CDCDCD !important }
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
export function CoverSpread({ big }: { big?: boolean }) {
  const cov = useCoverPhoto(), ct = useCoverText()
  const bk = useBook(), CW = coverW(bk)
  return (
    <div className="relative flex h-full w-full" style={{ boxShadow: big ? shadowBig : shadowSm }} data-testid={big ? "canvas-cover" : undefined}>
      <div className="relative h-full" style={{ width: `${(bk.w / CW) * 100}%`, background: "#3E3C3B" }}>
        <div className="absolute right-[12%] bottom-[10%] left-[12%]" style={{ color: "#E8E6E3", fontSize: big ? 11 : 3 }} data-testid={big ? "cover-back-text" : undefined}>{ct.back}</div></div>
      <div className="relative grid h-full place-items-center" style={{ width: `${(SPINE / CW) * 100}%`, background: "#353332" }} data-testid={big ? "cover-spine" : undefined}>
        <span className="whitespace-nowrap" style={{ ...serif, color: "#E8E6E3", fontSize: big ? 12 : 3, transform: "rotate(90deg)" }}><em>{ct.spine}</em></span></div>
      <div className="relative h-full bg-cover" style={{ width: `${(bk.w / CW) * 100}%`, backgroundImage: cov ? ph(cov) : undefined, backgroundColor: cov ? undefined : "#8E8E8E", backgroundPosition: "45% 50%" }} data-testid={big ? "cover-front" : undefined} data-photo-id={cov || undefined}>
        <div className="absolute top-[9%] right-[10%] left-[10%] text-white" style={{ ...serif, fontSize: big ? 34 : 7, textShadow: "0 1px 8px rgb(0 0 0/.35)" }} data-testid={big ? "cover-front-text" : undefined}><em>{ct.front}</em></div></div>
      {big && <>
        <div data-allow-border data-testid={big ? "cover-safe" : undefined} className="pointer-events-none absolute" style={{ inset: `${(1.5 / bk.h) * 100}% ${(1.5 / CW) * 100}%`, outline: "1px dashed rgb(255 255 255/.45)" }} />
        <span className="pointer-events-none absolute top-1.5 right-2 text-2xs" style={{ color: "rgb(255 255 255/.92)" }}>Wrap 15 mm</span></>}
    </div>)
}
export function EndpaperSpread({ big, which }: { big?: boolean; which: "front" | "back" }) {
  const paste = <div className="h-full flex-1" style={{ background: endpBg }} />
  return (
    <div className="relative flex h-full w-full" style={{ boxShadow: big ? shadowBig : shadowSm }} data-testid={big ? "canvas-endpaper" : undefined}>
      {paste}{paste}<Gutter />
      {big && <span className="pointer-events-none absolute top-2 text-2xs" style={{ color: "#535152", [which === "front" ? "left" : "right"]: 10 }}>Pastedown · glued to {which} board</span>}
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
  const mx = pc(g.outside, PW)
  const page = (side: "l" | "r") => (
    <div className="relative h-full flex-1" style={{ background: PAPER }} data-paper>
      <div className="absolute" style={{ inset: `${pc(g.top, PH)} ${pc(side === "l" ? g.inside : g.outside, PW)} ${pc(g.bottom, PH)} ${pc(side === "l" ? g.outside : g.inside, PW)}` }} data-testid={big ? "master-margin" : undefined}>
        {Array.from({ length: g.cols }, (_, i) => <div key={i} className="absolute inset-y-0" data-testid={big ? "master-col" : undefined} style={{ left: pc(i * (cw + g.colGutter), PW - g.inside - g.outside), width: pc(cw, PW - g.inside - g.outside) }}>
          {Array.from({ length: g.rows }, (_, j) => <div key={j} className="absolute inset-x-0" data-testid={big ? "master-cell" : undefined} style={{ top: pc(j * (rh + g.rowGutter), ch), height: pc(rh, ch), background: "rgb(57 55 56/.06)" }} />)}</div>)}
        {big && <div data-allow-border className="absolute inset-0" style={{ outline: "1px dashed #9A9A9A" }} />}
      </div>
      {m.pn && <span className="absolute grid place-items-center rounded-2xs font-mono" data-testid={big ? "master-pn" : undefined} style={{ bottom: "3.5%", ...(m.pos === 1 ? { left: "50%", transform: "translateX(-50%)" } : { [(side === "l") === (m.pos === 0) ? "left" : "right"]: mx }), fontSize: big ? 10.5 : 3, color: SUB, background: big ? "rgb(57 55 56/.08)" : undefined, padding: big ? "1px 5px" : 0 }}>#</span>}
      {id === "B" && <div className="absolute rounded-2xs" style={{ top: `calc(${pc(g.top, PH)} - 5%)`, left: mx, right: mx, height: "2.5%", background: "rgb(57 55 56/.16)" }} />}
    </div>)
  return <div className="relative flex h-full w-full" style={{ boxShadow: big ? shadowBig : shadowSm }} data-testid={big ? "canvas-master" : undefined}>{page("l")}{page("r")}<Gutter /></div>
}
export function LastPage({ big }: { big?: boolean }) {
  return (
    <div className="relative flex h-full w-full" data-testid={big ? "canvas-last" : undefined}>
      <div className="h-full flex-1" style={{ background: PAPER, boxShadow: big ? shadowBig : shadowSm }} data-paper />
      <div className="h-full flex-1" />
    </div>)
}

export const Sec = ({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) => (
  <section className="px-4 py-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-2xs font-semibold tracking-[0.12em] uppercase" style={{ color: SUB }}>{title}</h3>{right}</div>{children}</section>)
export const Field = ({ l, v, u, set, min = 0, max = 99, cap, name, tid = "master-field" }: { l: string; v: string; u?: string; set?: (n: number) => void; min?: number; max?: number; cap?: string; name?: string; tid?: string }) => (
  /* v0.9 §5: always show the short label (`l`) so the number + unit stay visible; long name goes on title/aria */
  <label className="flex h-8 items-center gap-2 rounded-md px-2.5 text-sm" style={{ background: FIELD }} title={cap ?? name ?? l}><span className="min-w-3 shrink-0 text-center" style={{ color: SUB }}>{l}</span>
    {set ? <input type="number" inputMode="numeric" aria-label={name ?? cap ?? l} value={v} min={min} max={max} data-testid={`${tid}-${l}`} onChange={(e) => { const n = +e.target.value; if (Number.isFinite(n)) set(Math.min(max, Math.max(min, n))) }}
        className="w-0 min-w-0 flex-1 bg-transparent font-mono tabular-nums outline-none [appearance:textfield] focus-visible:underline" style={{ color: T }} />
      : <span className="flex-1 font-mono tabular-nums" style={{ color: T }}>{v}</span>}{u && <span className="shrink-0" style={{ color: SUB }}>{u}</span>}</label>)
export const SegC = ({ items, on, set }: { items: React.ReactNode[]; on: number; set?: (i: number) => void }) => (
  <div className="flex rounded-md p-0.5" style={{ background: FIELD }}>
    {items.map((it, i) => <button key={i} type="button" aria-pressed={i === on} onClick={() => set?.(i)} className="e7-ghost flex h-6.5 flex-1 items-center justify-center rounded-sm text-sm font-medium [&_svg]:size-3.5" style={i === on ? { background: BAR, color: T, boxShadow: "0 1px 2px rgb(35 34 35/.14)" } : { color: SUB }}>{it}</button>)}
  </div>)
export const Slider = ({ l, v, pct }: { l: string; v: string; pct: number }) => (
  <div className="mt-3"><div className="mb-1 flex justify-between text-sm"><span style={{ color: SUB }}>{l}</span><span className="font-mono tabular-nums" style={{ color: T }}>{v}</span></div>
    <USlider aria-label={l} defaultValue={pct} className="w-full" data-testid="e7-slider"><SliderTrack><SliderFillTrack /><SliderThumb /></SliderTrack></USlider></div>)
export const Row = ({ l, children }: { l: string; children: React.ReactNode }) => <div className="mt-3 flex items-center justify-between text-sm"><span style={{ color: SUB }}>{l}</span>{children}</div>
export const Toggle = ({ on, onClick, label }: { on: boolean; onClick?: () => void; label: string }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className="e7-tg relative h-4.5 w-8 rounded-full border-0 p-0" data-on={on || undefined}>
    <span className="e7-knob absolute top-0.5 size-3.5 rounded-full transition-[left]" style={{ left: on ? 16 : 2 }} /></button>)
export const Val = ({ v }: { v: string }) => <span className="rounded-sm px-2 py-1 text-sm" style={{ background: FIELD, color: T }}>{v}</span>
export const Swatches = ({ cs, on }: { cs: string[]; on: number }) => <div className="flex gap-1.5">{cs.map((c, i) => <span key={c} className={i === on ? "swatch-on size-5 rounded-full" : "size-5 rounded-full"} data-swatch-on={i === on || undefined} style={{ background: c, boxShadow: "0 1px 2px rgb(0 0 0/.15)" }} />)}</div>
export const Head = ({ t, s }: { t: string; s: string }) => <div className="px-4 pt-4 pb-1" data-testid="inspector-head"><div className="text-sm font-medium">{t}</div><div className="mt-0.5 text-xs" style={{ color: SUB }}>{s}</div></div>
export const Txt = ({ v, ph: p }: { v?: string; ph?: string }) => <div className="flex h-8 items-center rounded-md px-2.5 text-sm" style={{ background: FIELD, color: v ? T : SUB }}>{v ?? p}</div>

/** v0.8.1: editable cover text (front title / spine / back) — persists per book in the demo */
export function CoverTxt({ k, label }: { k: keyof CoverText; label: string }) {
  const ct = useCoverText()
  return <input type="text" aria-label={label} value={ct[k]} placeholder={label} data-testid={`cover-text-${k}`} onChange={(e) => setCoverText({ ...ct, [k]: e.target.value })}
    className="flex h-8 w-full items-center rounded-md px-2.5 text-sm outline-none placeholder:text-[#535152] focus-visible:outline-2 focus-visible:outline-[#535152]" style={{ background: FIELD, color: T }} />
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
export function GridFields({ g, set, link, setLink, tid = "master-field" }: { g: Grid; set: (g: Grid) => void; link: boolean; setLink: (v: boolean) => void; tid?: string }) {
  const f = (k: keyof Grid, l: string, cap: string, name: string, u: string | undefined, min: number, max: number) =>
    <Field l={l} cap={cap} name={name} tid={tid} v={`${g[k]}`} u={u} min={min} max={max} set={(n) => set(link && ["top", "bottom", "inside", "outside"].includes(k) ? { ...g, top: n, bottom: n, inside: n, outside: n } : { ...g, [k]: n })} />
  return <div data-testid={`${tid}-grid`}>
    <div className="grid grid-cols-2 gap-2">{f("cols", "C", "Columns", "Columns", undefined, 1, 12)}{f("rows", "R", "Rows", "Rows", undefined, 1, 12)}{f("colGutter", "G", "Gutter", "Gutter (mm)", "mm", 0, 30)}{f("rowGutter", "RG", "Row gap", "Row gap (mm)", "mm", 0, 30)}</div>
    <div className="mt-3 flex items-center justify-between text-sm"><span style={{ color: SUB }}>Margins</span>
      <button type="button" aria-pressed={link} aria-label="Link margins" data-testid={`${tid}-link`} onClick={() => { if (!link) set({ ...g, bottom: g.top, inside: g.top, outside: g.top }); setLink(!link) }}
        className="e7-ghost grid size-7 place-items-center rounded-md outline-none focus-visible:outline-2 focus-visible:outline-[#535152] [&_svg]:size-3.5" style={{ background: link ? FIELD : undefined, color: link ? T : SUB }}>{link ? <Link2 /> : <Unlink2 />}</button></div>
    <div className="mt-2 grid grid-cols-2 gap-2">{f("top", "T", "T", "Top margin (mm)", "mm", 0, 60)}{f("bottom", "B", "B", "Bottom margin (mm)", "mm", 0, 60)}{f("inside", "I", "I", "Inside margin (mm)", "mm", 0, 60)}{f("outside", "O", "O", "Outside margin (mm)", "mm", 0, 60)}</div>
  </div>
}

/** book-level inspector: Book settings, Cover, Endpaper, Master, last page, nothing selected */
export function BookInspector() {
  const masters = useMasters(); const cov = useCoverPhoto(); const ct = useCoverText()
  const st = useStudio(), sel = st.node, book = st.book, setBook = st.setBook
  const pages = pagesOf(st.doc.spreads.length)
  if (!sel || sel.k === "none") return <div className="grid h-full place-items-center px-8 text-center text-sm" style={{ color: SUB }} data-testid="inspector-empty">Select a spread or photo</div>
  const pc = <span className="text-sm" style={{ color: SUB }} data-testid="page-colour-readonly">Paper white · coming later</span>
  if (sel.k === "book") return <div data-testid="insp-book">
    <Head t="Book settings" s={`${ct.back || ct.front || "Untitled book"} · applies to the whole book`} />
    <Sec title="Page size"><SizeEditor book={book} setBook={setBook} /></Sec>
    <Sec title="Binding"><Row l="Style"><Val v="Hardcover" /><span className="ml-1.5 text-2xs" style={{ color: SUB }} data-testid="binding-readonly">read-only</span></Row>
      <Row l="Endpapers"><Toggle label="Endpapers" on={book.endp} onClick={() => setBook({ ...book, endp: !book.endp })} /></Row>
      <Row l="Pages"><span className="flex items-center gap-1" data-testid="book-pages"><Val v={`${pages}`} /><span className="text-2xs" style={{ color: SUB }}>{PAGE_MIN}–{PAGE_MAX}</span></span></Row>
      <div className="mt-1.5 text-2xs" style={{ color: SUB }} data-testid="book-pages-note">{pages < PAGE_MIN ? `Add ${Math.ceil((PAGE_MIN - pages) / 2)} spread${PAGE_MIN - pages > 2 ? "s" : ""} to reach the ${PAGE_MIN}-page minimum` : pages > PAGE_MAX ? `Remove ${Math.ceil((pages - PAGE_MAX) / 2)} spreads to stay within ${PAGE_MAX} pages` : "Pages are added in spreads of 2"}</div></Sec>
    <Sec title="Print"><div className="grid grid-cols-2 gap-2"><Field l="B" v="3" u="mm" /><Field l="S" v="8" u="mm" /></div><Row l="Paper"><Val v="Matte 200 g" /></Row></Sec>
    <Sec title="Defaults"><Row l="Default master"><Val v="Master A" /></Row><Row l="Page colour">{pc}</Row></Sec></div>
  if (sel.k === "cover") return <div data-testid="insp-cover">
    <Head t="Cover" s="Hardcover · back, spine, front · wrap 15 mm" />
    <Sec title="Front"><div className="flex items-center gap-3"><div className="h-13 w-10.5 rounded-xs bg-cover" style={{ backgroundImage: cov ? ph(cov) : undefined, backgroundColor: cov ? undefined : "#8E8E8E" }} data-testid="cover-front-thumb" data-photo-id={cov} /><div className="text-sm"><div>{!cov ? "No photo yet" : cov === "p01" ? "IMG_P01.jpg" : P(cov).name}</div><div className="mt-0.5" style={{ color: SUB }}>Full bleed · 288 ppi</div><div className="mt-0.5 text-2xs" style={{ color: SUB }}>Drag a photo from the filmstrip onto the cover</div></div></div>
      <div className="mt-3"><CoverTxt k="front" label="Front title" /></div><Row l="Title font"><Val v="Serif italic" /></Row></Sec>
    <Sec title="Spine"><CoverTxt k="spine" label="Spine text" /><Row l="Spine width"><span className="font-mono text-sm tabular-nums">12 mm</span></Row><Row l="Direction"><Val v="Top to bottom" /></Row></Sec>
    <Sec title="Back"><CoverTxt k="back" label="Back text" /><Row l="Fill"><Val v="Paper white" /><span className="ml-1.5 text-2xs" style={{ color: SUB }} data-testid="fill-readonly">coming later</span></Row></Sec>
    <Sec title="Material"><Row l="Cover"><Val v="Printed" /><span className="ml-1.5 text-2xs" style={{ color: SUB }} data-testid="material-readonly">coming later</span></Row><Row l="Finish"><Val v="Matte laminate" /></Row></Sec></div>
  if (sel.k === "endpaper") return <div data-testid="insp-endpaper">
    <Head t={`Endpaper · ${sel.w}`} s="Pastedown and free leaf, printed full bleed" />
    <Sec title="Fill"><Row l="Style"><Val v="Pattern" /><span className="ml-1.5 text-2xs" style={{ color: SUB }} data-testid="endp-fill-readonly">coming later</span></Row>
      <Row l="Pattern"><span className="h-6 w-12 rounded-xs" style={{ background: endpBg }} /></Row></Sec>
    <Sec title="Apply"><Row l="Same on back endpaper"><Toggle label="Same on back endpaper" on={book.endpSame} onClick={() => setBook({ ...book, endpSame: !book.endpSame })} /></Row></Sec></div>
  if (sel.k === "master") { const m = masters[sel.id], id = sel.id; return <div data-testid="insp-master">
    <Head t={`Master ${sel.id}`} s={`Used by ${sel.id === "A" ? 10 : 4} pages`} />
    <Sec title="Grid"><GridFields g={m.grid} set={(grid) => setMaster(id, { grid })} link={m.link} setLink={(link) => setMaster(id, { link })} /></Sec>
    <Sec title="Page numbers"><Row l="Show"><Toggle label="Page numbers" on={m.pn} onClick={() => setMaster(id, { pn: !m.pn })} /></Row><div className="mt-3"><SegC items={["Outer", "Centre", "Inner"]} on={m.pos} set={(i) => setMaster(id, { pos: i })} /></div><Row l="Position"><Val v="Bottom" /></Row></Sec>
    <Sec title="Background">{pc}</Sec></div> }
  return <div data-testid="insp-page">
    <Head t={`Page ${pages}`} s="Last page · faces the back endpaper" />
    <Sec title="Page"><Row l="Master"><Val v="Master A" /></Row><Row l="Page colour">{pc}</Row></Sec></div>
}

/** v0.7.1: user-facing name of spread i — page numbers, never "Spread N" / "Cover". */
export const pagesName = (i: number) => i === 0 ? "Page 1" : `Pages ${pageLabel(i)}`

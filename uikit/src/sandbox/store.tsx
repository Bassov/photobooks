/* Sandbox editor store: document with undo history (op-key coalescing), selection, view state, toasts. */
import * as React from "react"
import { createToastQueue, type ToastContent } from "@/components/ui/toast"
import { P } from "@/data"
import type { Doc, Frame, Spread } from "./model"
import { setGeom, reflowDoc, spread, SW } from "./model"
import { bestTemplate } from "./templates"
import { anchorPhoto, fillTokens } from "./meta"
import { hideCopies } from "./parent-overrides"

export type View = {
  grid: boolean; snap: boolean; guides: boolean; rulers: boolean; overlays: boolean; preview: boolean
  dpi: boolean; snapFrames: boolean; snapGrid: boolean; snapGuides: boolean; pageNumbers: boolean
  tool: "select" | "frame" | "text" | "hand"; zoom: number; thumb: Thumb; unplacedOnly: boolean; sort: "date" | "name" | "added"
}
/** Filmstrip thumb height (Designer walkthrough-ux-review §B): px, or "auto" = follows the window height. */
export type Thumb = number | "auto"
export const THUMB_MIN = 56
/** auto = clamp(76, floor(0.085 · innerHeight), 160): 900 → 76, 1440 → 122, 2160 → 160 */
export const thumbAuto = (ih: number) => Math.min(160, Math.max(76, Math.floor(0.085 * ih)))
/** manual max = min(240, floor(0.5 · (innerHeight − 48)) − 64) */
export const thumbMax = (ih: number) => Math.max(THUMB_MIN, Math.min(240, Math.floor(0.5 * (ih - 48)) - 64))
/** effective height for this window; a stored value above the window's max re-clamps here and is never written back */
export const thumbPx = (t: Thumb, ih: number) => t === "auto" ? thumbAuto(ih) : Math.min(thumbMax(ih), Math.max(THUMB_MIN, t))
export const THUMB_KEY = "photobooks.filmstrip.thumb.v2"
export function readThumb(): Thumb {
  try {
    const raw = localStorage.getItem(THUMB_KEY)
    const n = Number(raw)
    return raw && raw !== "auto" && Number.isFinite(n) ? n : "auto"
  } catch { return "auto" }
}
export function writeThumb(t: Thumb) { try { localStorage.setItem(THUMB_KEY, String(t)) } catch { /* private mode: session-only */ } }
/** window.innerHeight, live */
export function useInnerHeight() {
  const [ih, setIh] = React.useState(() => window.innerHeight)
  React.useEffect(() => {
    const on = () => setIh(window.innerHeight)
    window.addEventListener("resize", on)
    return () => window.removeEventListener("resize", on)
  }, [])
  return ih
}
export type Features = {
  /** pointer move / resize / rotate with handles */
  handles?: boolean; rotateHandle?: boolean
  /** drag a frame's photo onto another frame (swap) / back to the filmstrip (unplace) */
  swap?: boolean
  /** drop photos from the filmstrip onto frames */
  drop?: boolean
  /** multi-photo drag fills empty frames; drop between spreads makes a new spread */
  multiDrop?: boolean
  crop?: boolean; multi?: boolean; marquee?: boolean; textEdit?: boolean
  /** stack all spreads vertically on the pasteboard */
  stack?: boolean
  /** editing a parent spread instead of a book spread */
  parentEdit?: string | null
  overrides?: boolean
}
/** A spread op's step also holds the current spread before (`cur`) and after (`next`) it: undo selects `cur`, redo `next`. */
type Step = { doc: Doc; label: string; cur?: number; next?: number }
/** `cur`: the current spread lives here so undo / redo move it in the same state step as the doc. */
type Hist = { doc: Doc; cur: number; past: Step[]; future: Step[]; lastKey?: string; lastAt?: number }

export type Studio = {
  doc: Doc
  /** `cur`: the spread an op on the spread list makes current (undo returns to the one before, redo to this one) */
  update: (fn: (d: Doc) => Doc, label: string, key?: string, cur?: number) => void
  preview: (fn: (d: Doc) => Doc) => void
  commit: (label: string) => void
  cancelPreview: () => void
  undo: () => void; redo: () => void
  past: { label: string }[]; future: { label: string }[]
  cur: number; setCur: (i: number) => void
  sel: string[]; setSel: (ids: string[]) => void
  filmSel: string[]; setFilmSel: (ids: string[]) => void
  cropId: string | null; setCropId: (id: string | null) => void
  view: View; setView: (p: Partial<View>) => void
  features: Features
  toast: (c: ToastContent, timeout?: number) => void
  queue: ReturnType<typeof createToastQueue>
  status: string; setStatus: React.Dispatch<React.SetStateAction<string>>
  dragging: string[] | null; setDragging: (ids: string[] | null) => void
  saveState: "saved" | "saving" | "dirty" | "error"; setSaveState: (s: Studio["saveState"]) => void
  missing: Set<string>; setMissing: (s: Set<string>) => void
  /** v0.7.1: book-level node selected in the list (cover, endpaper, master, last page, book settings, nothing); null = the current spread */
  node: Node; setNode: (n: Node) => void
  mode: "pages" | "masters"; setMode: (m: "pages" | "masters") => void
  book: Book; setBook: (b: Book) => void
  panels: { l: boolean; b: boolean }; setPanels: (p: { l: boolean; b: boolean }) => void
  /** Designer frame-context-menu M3: Replace photo… / Place photo… pick mode on frame `id` of spread `si` (UI: photo-pick-kit) */
  pick: Pick | null; setPick: (p: Pick | null) => void
}
export type Pick = { si: number; id: string; kind: "replace" | "place" }
export type Node = { k: "cover" } | { k: "endpaper"; w: "front" | "back" } | { k: "master"; id: "A" | "B" } | { k: "last" } | { k: "book" } | { k: "none" } | null
/** `safe`: the safe margin in mm (Book settings Print · S; folios stay inside it) */
export type Book = { endp: boolean; endpSame: boolean; w: number; h: number; preset: string; safe: number }
/** a new book takes the default profile's safe margin, like prod: Generic's 5 mm (printProfiles `CATALOG[0]`) */
export const BOOK0: Book = { endp: true, endpSame: true, w: 20, h: 20, preset: "sq20", safe: 5 }
const Ctx = React.createContext<Studio | null>(null)
export const useStudio = () => React.useContext(Ctx)!

export const DEFAULT_VIEW: View = {
  grid: false, snap: true, guides: true, rulers: false, overlays: false, preview: false, dpi: false,
  snapFrames: true, snapGrid: true, snapGuides: true, pageNumbers: false, tool: "select", zoom: 1, thumb: "auto", unplacedOnly: false, sort: "date",
}

export function StudioProvider({ init, view, features = {}, cur: cur0 = 0, sel: sel0 = [], missing: miss0, node: node0 = null, mode: mode0 = "pages", book: book0, children }: {
  init: Doc | (() => Doc); view?: Partial<View>; features?: Features; cur?: number; sel?: string[]; missing?: string[]; children: React.ReactNode
  node?: Node; mode?: "pages" | "masters"; book?: Partial<Book>
}) {
  const [node, setNodeRaw] = React.useState<Node>(node0)
  const [mode, setMode] = React.useState(mode0)
  const [book, setBookRaw] = React.useState<Book>({ ...BOOK0, ...book0 })
  setGeom(book.w, book.h)
  const [panels, setPanels] = React.useState({ l: true, b: true })
  const [h, setH] = React.useState<Hist>(() => { setGeom(BOOK0.w, BOOK0.h); const d0 = typeof init === "function" ? init() : init; setGeom(book.w, book.h); return { doc: reflowDoc(d0, BOOK0, { ...BOOK0, ...book0 }), cur: cur0, past: [], future: [] } })
  const setBook = (b: Book) => {
    if (b.w !== book.w || b.h !== book.h) { const from = book; setGeom(b.w, b.h); setH((s) => ({ ...s, doc: reflowDoc(s.doc, from, b) })) }
    setBookRaw(b)
  }
  const [draft, setDraft] = React.useState<Doc | null>(null)
  const draftRef = React.useRef<Doc | null>(null)
  const [sel, setSel] = React.useState<string[]>(sel0)
  const [filmSel, setFilmSel] = React.useState<string[]>([])
  const [cropId, setCropId] = React.useState<string | null>(null)
  const [pick, setPick] = React.useState<Pick | null>(null)
  const [v, setV] = React.useState<View>(() => ({ ...DEFAULT_VIEW, thumb: readThumb(), ...view }))
  const [status, setStatus] = React.useState("")
  const [dragging, setDragging] = React.useState<string[] | null>(null)
  const [saveState, setSaveState] = React.useState<Studio["saveState"]>("saved")
  const [missing, setMissing] = React.useState<Set<string>>(() => new Set(miss0 ?? []))
  const queue = React.useMemo(() => createToastQueue(), [])
  const doc = draft ?? h.doc
  const hRef = React.useRef(h)
  hRef.current = h

  const update = React.useCallback((fn: (d: Doc) => Doc, label: string, key?: string, cur?: number) => {
    setH((s) => {
      const now = Date.now()
      const next = fn(s.doc)
      if (next === s.doc) return s
      // op-key coalescing: the same key within 1 s replaces the last step (typing in a field)
      if (key && s.lastKey === key && now - (s.lastAt ?? 0) < 1000 && s.past.length)
        return { ...s, doc: next, future: [], lastAt: now }
      const step: Step = cur === undefined ? { doc: s.doc, label } : { doc: s.doc, label, cur: s.cur, next: cur }
      return { doc: next, cur: cur ?? s.cur, past: [...s.past, step].slice(-100), future: [], lastKey: key, lastAt: now }
    })
    if (cur !== undefined) setNodeRaw(null)
    setSaveState("dirty")
  }, [])
  const setCur = React.useCallback((i: number) => setH((s) => (s.cur === i ? s : { ...s, cur: i })), [])
  const preview = React.useCallback((fn: (d: Doc) => Doc) => {
    draftRef.current = fn(draftRef.current ?? hRef.current.doc)
    setDraft(draftRef.current)
  }, [])
  const commit = React.useCallback((label: string) => {
    const d = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (!d) return
    setH((s) => ({ doc: d, cur: s.cur, past: [...s.past, { doc: s.doc, label }].slice(-100), future: [] }))
    setSaveState("dirty")
  }, [])
  const cancelPreview = React.useCallback(() => { draftRef.current = null; setDraft(null) }, [])
  const undo = React.useCallback(() => setH((s) => {
    if (!s.past.length) return s
    const last = s.past[s.past.length - 1]
    return { doc: last.doc, cur: last.cur ?? s.cur, past: s.past.slice(0, -1), future: [{ ...last, doc: s.doc }, ...s.future] }
  }), [])
  const redo = React.useCallback(() => setH((s) => {
    if (!s.future.length) return s
    const [n, ...rest] = s.future
    return { doc: n.doc, cur: n.next ?? s.cur, past: [...s.past, { ...n, doc: s.doc }], future: rest }
  }), [])
  const value: Studio = {
    doc, update, preview, commit, cancelPreview, undo, redo, past: h.past, future: h.future,
    cur: Math.min(h.cur, doc.spreads.length - 1), setCur: (i: number) => { setCur(i); setNodeRaw(null) }, sel, setSel: (ids: string[]) => { setSel(ids); if (ids.length) setNodeRaw(null) }, filmSel, setFilmSel, cropId, setCropId,
    view: v, setView: (p) => setV((o) => ({ ...o, ...p })), features,
    toast: (c, timeout = 5000) => { queue.add(c, { timeout }) }, queue, status, setStatus, dragging, setDragging,
    saveState, setSaveState, missing, setMissing,
    node, setNode: (n) => { setNodeRaw(n); if (n) setSel([]) }, mode, setMode, book, setBook, panels, setPanels, pick, setPick,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---------------------------------------------------------------- doc helpers (immutable) */
export function mapSpread(d: Doc, i: number, fn: (s: Spread) => Spread): Doc {
  return { ...d, spreads: d.spreads.map((s, j) => (j === i ? fn(s) : s)) }
}
export function mapFrames(d: Doc, i: number, ids: string[], fn: (f: Frame) => Frame): Doc {
  return mapSpread(d, i, (s) => ({ ...s, frames: s.frames.map((f) => (ids.includes(f.id) ? fn(f) : f)) }))
}
/** Map spread `i`; live captions whose anchor is no longer an image frame become static with the text they painted before `fn` (Designer live-captions §6). */
export function mapSpreadFreezing(d: Doc, i: number, fn: (s: Spread) => Spread): Doc {
  return mapSpread(d, i, (before) => {
    const after = fn(before)
    const isImage = (id: string) => after.frames.some((x) => x.id === id && x.kind === "image")
    return {
      ...after,
      frames: after.frames.map((f) => (f.live && f.anchor && !isImage(f.anchor) ? { ...f, text: fillTokens(f.text ?? "", anchorPhoto(before.frames, f)), live: false, anchor: undefined } : f)),
    }
  })
}
/** Delete frames from spread `i`; live captions anchored to a removed frame become static with their painted text.
 *  A removed override copy hides its parent item on the spread (Designer parent-overrides PO3). */
export function removeFrames(d: Doc, i: number, ids: string[]): Doc {
  return mapSpreadFreezing(d, i, (s) => hideCopies({ ...s, template: null, frames: s.frames.filter((f) => !ids.includes(f.id)) }, s.frames.filter((f) => ids.includes(f.id))))
}
/** z-order moves (inspector Arrange, frame menu): `fwd` / `bwd` step past the next unselected frame. */
export type ZKind = "front" | "fwd" | "bwd" | "back"
export const Z_LABEL: Record<ZKind, string> = { front: "Bring to front", fwd: "Bring forward", bwd: "Send backward", back: "Send to back" }
/** Move frames `ids` of spread `i` in z order; the same doc back when nothing moves. */
export function zMove(d: Doc, i: number, ids: string[], kind: ZKind): Doc {
  return mapSpread(d, i, (s) => {
    const a = [...s.frames]
    const sel = a.filter((x) => ids.includes(x.id)), rest = a.filter((x) => !ids.includes(x.id))
    if (kind === "front") return { ...s, frames: [...rest, ...sel] }
    if (kind === "back") return { ...s, frames: [...sel, ...rest] }
    // prod reorderFrames: from the moving end, each selected frame steps past the next unselected one
    const step = kind === "fwd" ? 1 : -1
    for (let j = kind === "fwd" ? a.length - 2 : 1; j >= 0 && j < a.length; j -= step) {
      if (ids.includes(a[j].id) && !ids.includes(a[j + step].id)) [a[j], a[j + step]] = [a[j + step], a[j]]
    }
    return { ...s, frames: a }
  })
}
/** The z moves that change the order of frames `ids` on spread `s` (prod zMovesFor / setZMovesFor). */
export function zMovesFor(s: Spread, ids: string[]): ZKind[] {
  const order = (fs: Frame[]) => fs.map((f) => f.id).join()
  const d: Doc = { spreads: [s] } as Doc
  return (["front", "fwd", "bwd", "back"] as const).filter((k) => order(zMove(d, 0, ids, k).spreads[0].frames) !== order(s.frames))
}
/** One photo onto frame `frameId` of spread `si` (a filmstrip drop or a pick): one undo step "Replace photo" / "Place photo". */
export function placePhoto(st: Studio, si: number, frameId: string, photo: string) {
  const old = st.doc.spreads[si].frames.find((x) => x.id === frameId)?.photo
  st.update((d) => mapFrames(d, si, [frameId], (x) => ({ ...x, photo, zoom: 1, ox: 0, oy: 0, qt: 0, straighten: 0 })), old ? "Replace photo" : "Place photo")
  st.setStatus(old ? `Replaced ${P(old).name} — it is back in the gallery` : `Placed ${P(photo).name}`)
  st.setSel([frameId]); st.setCur(si)
}
/** Designer frame-context-menu M3 pick mode status (kept while the mode is on). */
export const PICK_STATUS: Record<Pick["kind"], string> = {
  replace: "Click a photo in the filmstrip to replace this one · Esc to cancel",
  place: "Click a photo in the filmstrip to place it here · Esc to cancel",
}
/** Replace photo… / Place photo…: crop mode ends, the frame stays selected, the filmstrip picks (chrome.tsx). */
export function startPick(st: Studio, si: number, id: string, kind: Pick["kind"]) {
  st.setCropId(null)
  st.setCur(si); st.setSel([id])
  st.setPick({ si, id, kind })
  st.setStatus(PICK_STATUS[kind])
}
/** Cancel: no change to the book. */
export function endPick(st: Studio) {
  st.setPick(null)
  st.setStatus("")
}
/** A filmstrip click / Enter on `photo` while picking = the same replace / place as a drop; the mode then ends. */
export function pickPhoto(st: Studio, photo: string) {
  const p = st.pick
  if (!p) return
  st.setPick(null)
  placePhoto(st, p.si, p.id, photo)
}
export const deleteLabel = (fs: Frame[]) => fs.length > 1 ? `Delete ${fs.length} frames` : fs[0]?.overrides ? "Hide parent item" : "Delete frame"
export function placedSet(d: Doc) {
  const s = new Set<string>()
  for (const sp of d.spreads) for (const f of sp.frames) if (f.photo) s.add(f.photo)
  return s
}
/* ---------------------------------------------------------------- Designer fill-book (FB1 = core src/core/ops/fill.ts, kit doc) */
export type FillPlan = { intoFrames: number; onNewSpreads: number; newSpreads: number; leftover: number; pagesBefore: number; pagesAfter: number; maxPages: number }
/** F6: a spread's empty own photo frames (no text, locked or master copy), left page → right page, top (1 mm) → left */
function emptySlots(s: Spread) {
  const page = (f: Frame) => (f.x + f.w / 2 < SW / 2 ? 0 : 1)
  return s.frames.filter((f) => f.kind === "image" && !f.locked && !f.overrides && !f.photo)
    .sort((a, b) => page(a) - page(b) || Math.round(a.y) - Math.round(b.y) || a.x - b.x)
}
/** F3–F9 on the kit doc. The kit's last page is a node without frames (L = ∅), so E = every spread's empty frames and the
 *  new spreads go after the last spread, before the closing page. Pages = 2 per spread (v7 `pagesOf`). */
function layoutFill(d: Doc, ids: readonly string[], maxPages: number) {
  const placed = placedSet(d)
  const usable = [...new Set(ids)].filter((id) => !placed.has(id))
  const slots = d.spreads.flatMap((s, si) => emptySlots(s).map((f) => ({ si, id: f.id })))
  const pagesBefore = d.spreads.length * 2
  const intoFrames = Math.min(usable.length, slots.length)
  const needed = usable.length - intoFrames
  const room = Math.max(0, Math.floor((maxPages - pagesBefore) / 2))
  const newSpreads = Math.min(Math.ceil(needed / 2), room)
  const onNewSpreads = Math.min(needed, 2 * newSpreads)
  const plan: FillPlan = { intoFrames, onNewSpreads, newSpreads, leftover: needed - onNewSpreads, pagesBefore, pagesAfter: pagesBefore + 2 * newSpreads, maxPages }
  return { usable, slots, plan }
}
/** The popover's numbers: the same layout `fillBook` applies. `ids` = the filmstrip's unplaced, present photos in its order. */
export const planFillBook = (d: Doc, ids: readonly string[], maxPages: number) => layoutFill(d, ids, maxPages).plan
/** Photos in order into the empty frames, then new 2-photo spreads (best fit, as a gap drop); the tail that passes the page
 *  limit stays out. `first` = the first spread that changed (−1 when nothing fits). */
export function fillBook(d: Doc, ids: readonly string[], maxPages: number): { doc: Doc; first: number; plan: FillPlan } {
  const { usable, slots, plan } = layoutFill(d, ids, maxPages)
  if (!plan.intoFrames && !plan.onNewSpreads) return { doc: d, first: -1, plan }
  const put = new Map(slots.slice(0, plan.intoFrames).map((s, i) => [s.id, usable[i]]))
  const spreads = d.spreads.map((s) => (s.frames.some((f) => put.has(f.id))
    ? { ...s, frames: s.frames.map((f) => { const photo = put.get(f.id); return photo ? { ...f, photo, zoom: 1, ox: 0, oy: 0, qt: 0 as const, straighten: 0 } : f }) }
    : s))
  const rest = usable.slice(plan.intoFrames, plan.intoFrames + plan.onNewSpreads)
  for (let i = 0; i < rest.length; i += 2) { const chunk = rest.slice(i, i + 2); spreads.push(spread(bestTemplate(chunk).id, chunk)) }
  return { doc: { ...d, spreads }, first: plan.intoFrames ? slots[0].si : d.spreads.length, plan }
}
export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`
/** Spec status: "Placed {p} photo(s)" + " · added {s} spread(s)" + " · {l} stay(s) in the filmstrip" */
export function fillBookStatus(p: FillPlan) {
  return `Placed ${plural(p.intoFrames + p.onNewSpreads, "photo")}${p.newSpreads ? ` · added ${plural(p.newSpreads, "spread")}` : ""}${p.leftover ? ` · ${p.leftover} ${p.leftover === 1 ? "stays" : "stay"} in the filmstrip` : ""}`
}
/** Designer placed-badge: where a photo sits, in spread-list order (the cover's front photo, then spreads × frames bottom → top). */
export type Place = { kind: "cover" } | { kind: "frame"; si: number; frameId: string }
export function placesOf(d: Doc, photoId: string, coverPhoto: string): Place[] {
  const out: Place[] = []
  if (photoId === coverPhoto && d.gallery.includes(photoId)) out.push({ kind: "cover" })
  d.spreads.forEach((s, si) => { for (const f of s.frames) if (f.photo === photoId) out.push({ kind: "frame", si, frameId: f.id }) })
  return out
}
/** B3 memory: the last jump (photo + index into its places). */
let lastJump: { photo: string; i: number } | null = null
const isSelected = (st: Studio, p: Place) => p.kind === "cover"
  ? st.node?.k === "cover"
  : !st.node && st.cur === p.si && st.sel.length === 1 && st.sel[0] === p.frameId
/** spread-list position of the active row: cover −1, front endpaper −0.5, spread i, last page / back endpaper after every spread */
function activePos(st: Studio) {
  const nd = st.node
  if (nd?.k === "cover") return -1
  if (nd?.k === "endpaper") return nd.w === "front" ? -0.5 : Infinity
  if (nd?.k === "last") return Infinity
  return st.cur
}
/** B3: the last jump still selected → the next place (wraps); else the first place at or after the active row, else the first. */
export function nextPlaceIndex(st: Studio, photo: string, places: Place[]) {
  const last = lastJump
  if (last && last.photo === photo && last.i < places.length && isSelected(st, places[last.i])) return (last.i + 1) % places.length
  const at = activePos(st)
  const i = places.findIndex((p) => (p.kind === "cover" ? -1 : p.si) >= at)
  return i < 0 ? 0 : i
}
/** B1: go to place `i` of `photo` and select it, as a spread-row click then a frame click (no history step, B9). */
export function jumpTo(st: Studio, photo: string, places: Place[], i: number) {
  const p = places[i]
  lastJump = { photo, i }
  st.setCropId(null)
  st.setMode("pages")
  if (p.kind === "cover") st.setNode({ k: "cover" })
  else { st.setCur(p.si); st.setSel([p.frameId]) }
}
/** Inputs whose keys never edit text (Switch / checkbox, radio, slider…). */
const NON_TEXT_INPUT = new Set(["checkbox", "radio", "range", "button", "submit", "reset", "color", "file", "image"])
export function useKeys(handler: (e: KeyboardEvent) => void, deps: React.DependencyList) {
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === "TEXTAREA" || t.isContentEditable)) return
      // a focused non-text input keeps its plain keys (arrows, Space, Esc) but passes Ctrl/⌘ combos (undo / redo, view)
      if (t instanceof HTMLInputElement && !(NON_TEXT_INPUT.has(t.type) && (e.ctrlKey || e.metaKey))) return
      handler(e)
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

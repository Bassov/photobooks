/* Sandbox editor store: document with undo history (op-key coalescing), selection, view state, toasts. */
import * as React from "react"
import { createToastQueue, type ToastContent } from "@/components/ui/toast"
import type { Doc, Frame, Spread } from "./model"

export type View = {
  grid: boolean; snap: boolean; guides: boolean; rulers: boolean; overlays: boolean; preview: boolean
  dpi: boolean; snapFrames: boolean; snapGrid: boolean; snapGuides: boolean; pageNumbers: boolean
  tool: "select" | "frame" | "text" | "hand"; zoom: number; thumb: number; unplacedOnly: boolean; sort: "date" | "name" | "added"
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
type Hist = { doc: Doc; past: { doc: Doc; label: string }[]; future: { doc: Doc; label: string }[]; lastKey?: string; lastAt?: number }

export type Studio = {
  doc: Doc
  update: (fn: (d: Doc) => Doc, label: string, key?: string) => void
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
  status: string; setStatus: (s: string) => void
  dragging: string[] | null; setDragging: (ids: string[] | null) => void
  saveState: "saved" | "saving" | "dirty" | "error"; setSaveState: (s: Studio["saveState"]) => void
  missing: Set<string>; setMissing: (s: Set<string>) => void
}
const Ctx = React.createContext<Studio | null>(null)
export const useStudio = () => React.useContext(Ctx)!

export const DEFAULT_VIEW: View = {
  grid: false, snap: true, guides: true, rulers: false, overlays: false, preview: false, dpi: false,
  snapFrames: true, snapGrid: true, snapGuides: true, pageNumbers: false, tool: "select", zoom: 1, thumb: 76, unplacedOnly: false, sort: "date",
}

export function StudioProvider({ init, view, features = {}, cur: cur0 = 0, sel: sel0 = [], missing: miss0, children }: {
  init: Doc | (() => Doc); view?: Partial<View>; features?: Features; cur?: number; sel?: string[]; missing?: string[]; children: React.ReactNode
}) {
  const [h, setH] = React.useState<Hist>(() => ({ doc: typeof init === "function" ? init() : init, past: [], future: [] }))
  const [draft, setDraft] = React.useState<Doc | null>(null)
  const draftRef = React.useRef<Doc | null>(null)
  const [cur, setCur] = React.useState(cur0)
  const [sel, setSel] = React.useState<string[]>(sel0)
  const [filmSel, setFilmSel] = React.useState<string[]>([])
  const [cropId, setCropId] = React.useState<string | null>(null)
  const [v, setV] = React.useState<View>({ ...DEFAULT_VIEW, ...view })
  const [status, setStatus] = React.useState("")
  const [dragging, setDragging] = React.useState<string[] | null>(null)
  const [saveState, setSaveState] = React.useState<Studio["saveState"]>("saved")
  const [missing, setMissing] = React.useState<Set<string>>(() => new Set(miss0 ?? []))
  const queue = React.useMemo(() => createToastQueue(), [])
  const doc = draft ?? h.doc
  const hRef = React.useRef(h)
  hRef.current = h

  const update = React.useCallback((fn: (d: Doc) => Doc, label: string, key?: string) => {
    setH((s) => {
      const now = Date.now()
      const next = fn(s.doc)
      if (next === s.doc) return s
      // op-key coalescing: the same key within 1 s replaces the last step (typing in a field)
      if (key && s.lastKey === key && now - (s.lastAt ?? 0) < 1000 && s.past.length)
        return { ...s, doc: next, future: [], lastAt: now }
      return { doc: next, past: [...s.past, { doc: s.doc, label }].slice(-100), future: [], lastKey: key, lastAt: now }
    })
    setSaveState("dirty")
  }, [])
  const preview = React.useCallback((fn: (d: Doc) => Doc) => {
    draftRef.current = fn(draftRef.current ?? hRef.current.doc)
    setDraft(draftRef.current)
  }, [])
  const commit = React.useCallback((label: string) => {
    const d = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (!d) return
    setH((s) => ({ doc: d, past: [...s.past, { doc: s.doc, label }].slice(-100), future: [] }))
    setSaveState("dirty")
  }, [])
  const cancelPreview = React.useCallback(() => { draftRef.current = null; setDraft(null) }, [])
  const undo = React.useCallback(() => setH((s) => {
    if (!s.past.length) return s
    const last = s.past[s.past.length - 1]
    return { doc: last.doc, past: s.past.slice(0, -1), future: [{ doc: s.doc, label: last.label }, ...s.future] }
  }), [])
  const redo = React.useCallback(() => setH((s) => {
    if (!s.future.length) return s
    const [n, ...rest] = s.future
    return { doc: n.doc, past: [...s.past, { doc: s.doc, label: n.label }], future: rest }
  }), [])
  const value: Studio = {
    doc, update, preview, commit, cancelPreview, undo, redo, past: h.past, future: h.future,
    cur: Math.min(cur, doc.spreads.length - 1), setCur, sel, setSel, filmSel, setFilmSel, cropId, setCropId,
    view: v, setView: (p) => setV((o) => ({ ...o, ...p })), features,
    toast: (c, timeout = 5000) => { queue.add(c, { timeout }) }, queue, status, setStatus, dragging, setDragging,
    saveState, setSaveState, missing, setMissing,
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
export function placedSet(d: Doc) {
  const s = new Set<string>()
  for (const sp of d.spreads) for (const f of sp.frames) if (f.photo) s.add(f.photo)
  return s
}
export function useKeys(handler: (e: KeyboardEvent) => void, deps: React.DependencyList) {
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      handler(e)
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/* ReadingRoom (Spec site-stand S6): the open book over the page, shared by the sys shell (demo 6, demo 7) and fresh C.
   Grid M 24 / 16, G 16 / 12, 12 / 4 columns. Desktop: top 72, foot 96, rw = max(200, min(span(10), (h − 168)·R))
   centred; Previous · label · Next 32 px below; "Close the book" bottom-left. Phone portrait (w < 768, h > w): the
   single-page Pager (S5), controls 24 px below the page, Close bottom 40. Landscape phone (h < 500): the spread at
   W = min(w − 32, (h − 72)·R). Opens with a 240 ms fade, focuses the book, opens the cover; Esc closes (one press);
   closing returns focus to the trigger; ← / → turn. */
import * as React from "react"
import { pagesOf, SPREAD_R, viewLabel, viewsOf, type SiteBook } from "../site-demo-1/data"
import type { Box } from "../site-demo-1/v2"
import { pageOf, Pager, stepOf, stepsOf, type PagerApi } from "./pager"
import { BookReader, type ReaderApi } from "./reader"
import "./room.css"

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
type Mode = "page" | "land" | "desk"
export const roomMode = (box: Box): Mode => (box.w < 768 && box.h > box.w ? "page" : box.w > box.h && box.h < 500 ? "land" : "desk")

type RoomProps = { b: SiteBook; view: number; setView: (v: number) => void; onClose: () => void; dark?: boolean; box: Box }

export function ReadingRoom({ b, view, setView, onClose, dark, box }: RoomProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const api = React.useRef<ReaderApi>(null), pager = React.useRef<PagerApi>(null)
  const [trigger] = React.useState(() => document.activeElement as HTMLElement | null)
  const mode = roomMode(box), nar = box.narrow
  const M = nar ? 16 : 24, G = nar ? 12 : 16, C = nar ? 4 : 12
  const col = (box.w - 2 * M - (C - 1) * G) / C, span = (k: number) => k * col + (k - 1) * G
  const R = SPREAD_R[b.fmt], last = viewsOf(b) - 1
  const steps = React.useMemo(() => stepsOf(b), [b])
  const [step, setStep] = React.useState(() => stepOf(steps, view))
  const go = (d: number) => (mode === "page" ? pager.current : api.current)?.go(d)
  const goRef = React.useRef(go)
  goRef.current = go
  const live = React.useRef({ onClose })
  live.current.onClose = onClose

  // open: focus the book, the cover opens; close: focus back on the trigger (skipped on a StrictMode re-mount)
  React.useEffect(() => {
    const el = root.current
    el?.querySelector<HTMLElement>('[role="region"]')?.focus({ preventScroll: true })
    const t = view === 0 ? setTimeout(() => goRef.current(1), reduced() ? 0 : 250) : 0
    return () => {
      clearTimeout(t)
      requestAnimationFrame(() => { if (!el?.isConnected) trigger?.focus({ preventScroll: true }) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Esc closes once: a host that already handled it (sys shell) marks it defaultPrevented
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); live.current.onClose() } }
    addEventListener("keydown", k); return () => removeEventListener("keydown", k)
  }, [])

  const txt = nar || mode !== "desk" ? "m15" : "t16"
  let book: React.ReactNode, bookTop: number, bookBottom: number, bookLeft: number
  let label = viewLabel(b, view)
  if (label.startsWith("Page")) label += ` of ${pagesOf(b)}`
  let prev = view <= 0, next = view >= last
  if (mode === "page") {
    const CH = box.h - 56 - 104 - 16
    book = <Pager ref={pager} b={b} view={view} onStep={(i, s) => { setStep(i); setView(s.v) }} width={box.w} height={CH} dark={dark} />
    const H = (2 * pageOf(b, box.w, CH)) / R
    bookLeft = 0; bookTop = 56; bookBottom = 56 + (CH + H) / 2
    label = steps[step].label; prev = step <= 0; next = step >= steps.length - 1
  } else {
    const top = mode === "land" ? 8 : nar ? 64 : 72, foot = mode === "land" ? 64 : nar ? 104 : 96
    const rw = mode === "land"
      ? Math.min(box.w - 32, (box.h - 72) * R)
      : Math.max(200, Math.min(span(nar ? 4 : 10), (box.h - top - foot) * R))
    const rh = rw / R
    bookLeft = (box.w - rw) / 2; bookTop = top + (box.h - top - foot - rh) / 2; bookBottom = bookTop + rh
    book = <BookReader ref={api} b={b} view={view} onView={setView} width={rw} dark={dark} />
  }
  return (
    <div ref={root} className="sb-room" data-testid="ss-reader-page" data-mode={mode}>
      <div className="ss-abs" style={{ left: bookLeft, top: bookTop }} data-testid="ss-reader" data-view={view}>{book}</div>
      <div className="ss-abs" style={{ left: M, right: M, top: bookBottom + (mode === "desk" && !nar ? 32 : mode === "land" ? 12 : 24), display: "flex", justifyContent: "center", alignItems: "baseline", gap: mode === "desk" && !nar ? 40 : 24 }}>
        <button type="button" className={`${txt} g ss-tx`} style={{ minHeight: 44 }} disabled={prev} onClick={() => go(-1)} data-testid="ss-prev">Previous</button>
        <span className="t13 g" data-testid="ss-label">{label}</span>
        <button type="button" className={`${txt} g ss-tx`} style={{ minHeight: 44 }} disabled={next} onClick={() => go(1)} data-testid="ss-next">Next</button>
      </div>
      <button type="button" className={`ss-abs ${txt} g ss-tx`} style={mode === "land" ? { left: M, top: bookBottom + 12, minHeight: 44 } : { left: M, bottom: nar || mode === "page" ? 40 : 20, minHeight: nar || mode === "page" ? 44 : undefined }}
        onClick={onClose} data-testid="ss-close">Close the book</button>
    </div>
  )
}

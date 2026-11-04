/* Demo 5 parts (Spec site-awards-5, Direction 5): the layout, the book page (the reader on the book's own colour, "← Shelf",
   the title, "Pages 2–3 / 22") and the riffle strip under the book: a tick per view and a handle; drag it or press the
   strip to thumb through the leaves at 180 ms each (`api.riffle`). */
import * as React from "react"
import { pagesOf, SPREAD_R, viewLabel, viewsOf, type SiteBook } from "../site-demo-1/data"
import { BookReader, type ReaderApi } from "../site-demo-1/reader"

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
/** wide ≥ 1024 and mid: the 1440×900 design scaled by k = min(vw / 1440, vh / 900); narrow < 768: s 12, a scrolling row */
export type L5 = { vw: number; vh: number; narrow: boolean; mid: boolean; k: number; s: number; shelf: number }
export const layoutOf = (vw: number, vh: number): L5 => {
  const narrow = vw < 768, k = narrow ? 1 : Math.min(vw / 1440, vh / 900)
  return { vw, vh, narrow, mid: !narrow && vw < 1024, k, s: narrow ? 12 : 17 * k, shelf: Math.round(narrow ? vh * 0.76 : vh - 115 * k) }
}
/** the reader: W = min(1040, vw − 400), top 112 (mid: vw − 160; narrow: vw − 32, top 96); short windows shrink it */
export const readerBox = (l: L5, b: SiteBook) => {
  const R = SPREAD_R[b.fmt], top = l.narrow ? 96 : 112
  const w0 = l.narrow ? l.vw - 32 : l.mid ? l.vw - 160 : Math.min(1040, l.vw - 400)
  const w = Math.max(200, Math.min(w0, (l.vh - top - 120) * R))
  return { w, h: w / R, top, left: (l.vw - w) / 2 }
}
/** the page colours of an open book */
export const pageBg = (b: SiteBook) => `color-mix(in oklab, ${b.spine} 92%, white)`
export const boardOf = (b: SiteBook) => `color-mix(in oklab, ${b.spine} 80%, black)`

export function BookPage({ b, l, view, onView, onClose }: { b: SiteBook; l: L5; view: number; onView: (v: number) => void; onClose: () => void }) {
  const api = React.useRef<ReaderApi>(null)
  const host = React.useRef<HTMLDivElement>(null)
  const rb = readerBox(l, b), label = viewLabel(b, view)
  // the reader takes the focus, so ← / → and Tab start from the book
  React.useEffect(() => { host.current?.querySelector<HTMLElement>('[role="region"]')?.focus({ preventScroll: true }) }, [])
  const x = l.narrow ? 20 : 48
  return (
    <div ref={host} className="sd5-page" style={{ "--d5-on": b.spineInk, "--d5-board": boardOf(b) } as React.CSSProperties} data-testid="sd5-page">
      <div className="sd5-big sd5-abs" style={{ left: -18, top: l.narrow ? 380 : 300 * l.k, fontSize: l.narrow ? 160 : 280 * l.k }} aria-hidden>{b.title}</div>
      <button type="button" className="sd5-k sd5-link sd5-abs" style={{ left: x, top: 33 }} onClick={onClose} data-testid="sd5-close">← Shelf</button>
      {!l.narrow && <h1 className="sd5-title sd5-abs" style={{ left: "50%", top: 30 }}>{b.title}</h1>}
      <span className="sd5-k sd5-abs tabular-nums" style={{ right: x, top: 33 }} aria-hidden data-testid="sd5-label">
        {label}{label.startsWith("Page") && <span className="sd5-muted"> / {pagesOf(b)}</span>}
      </span>
      <div className="sd5-abs" style={{ left: rb.left, top: rb.top, width: rb.w }} data-testid="sd5-reader" data-view={view}>
        <BookReader ref={api} b={b} view={view} onView={onView} width={rb.w} board={boardOf(b)} />
      </div>
      <Riffle b={b} view={view} left={rb.left} top={rb.top + rb.h + 22} w={rb.w} api={api} />
    </div>
  )
}

/** The riffle strip: 14 px, radius 7; ticks inset 10; target = round(x / width · (views − 1)) */
function Riffle({ b, view, left, top, w, api }: { b: SiteBook; view: number; left: number; top: number; w: number; api: React.RefObject<ReaderApi | null> }) {
  const n = viewsOf(b), xOf = (v: number) => 10 + (v * (w - 20)) / (n - 1)
  const el = React.useRef<HTMLDivElement>(null)
  const [drag, setDrag] = React.useState<number | null>(null)
  const last = React.useRef(-1)
  const at = (e: React.PointerEvent) => clamp(e.clientX - el.current!.getBoundingClientRect().left, 10, w - 10)
  const aim = (x: number) => {
    setDrag(x)
    const t = Math.round(((x - 10) / (w - 20)) * (n - 1))
    if (t !== last.current) { last.current = t; api.current?.riffle(t, 180) }
  }
  const hx = drag ?? xOf(view)
  return (
    <div ref={el} className="sd5-riffle sd5-abs" style={{ left, top, width: w }} data-drag={drag !== null || undefined} data-testid="sd5-riffle"
      role="slider" tabIndex={0} aria-label="Riffle the pages" aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={view} aria-valuetext={viewLabel(b, view)}
      onPointerDown={(e) => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); last.current = view; aim(at(e)) }}
      onPointerMove={(e) => { if (drag !== null) aim(at(e)) }}
      onPointerUp={() => { setDrag(null); last.current = -1 }}
      onPointerCancel={() => { setDrag(null); last.current = -1 }}>
      {Array.from({ length: n }, (_, i) => <span key={i} className="sd5-tick" style={{ left: xOf(i) }} />)}
      <span className="sd5-handle" style={{ left: hx - 14 }} />
      <span className="sd5-k sd5-pill" style={{ left: hx }} aria-hidden>⇠ Riffle ⇢</span>
    </div>
  )
}

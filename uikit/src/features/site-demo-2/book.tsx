/* Demo 2 book page (Spec site-awards-5, Direction 2): the reader with the paper leaf under the big spot, "← Back to the
   room", the title, and Previous · Pages 4–5 / 22 · Next at the reader width. Plus the Index overlay (a plain list). */
import * as React from "react"
import { BOOKS, pad2, pagesOf, SPREAD_R, viewLabel, viewsOf, type SiteBook } from "../site-demo-1/data"
import { BookReader, type ReaderApi } from "../site-demo-1/reader"

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
export type L2 = { vw: number; vh: number; narrow: boolean; mid: boolean; m: number; bay: number; s: number; y: (v: number) => number }
export const layoutOf = (vw: number, vh: number): L2 => {
  const narrow = vw < 768, mid = !narrow && vw < 1024, k = Math.min(1, vh / 900)
  return { vw, vh, narrow, mid, m: narrow ? 20 : 48, bay: mid ? 520 : 600, s: narrow ? 9 : (mid ? 12 : 14) * k, y: (v) => Math.round((v * vh) / 900) }
}
/** the reader box: W = min(1000, vw − 240), centred, top 168 (narrow: vw − 40); short windows shrink it to fit */
export const readerBox = (l: L2, b: SiteBook) => {
  const R = SPREAD_R[b.fmt], top = l.narrow ? 156 : 168
  const w = Math.max(200, l.narrow ? Math.min(l.vw - 40, (l.vh - top - 96) * R) : Math.min(1000, l.vw - 240, (l.vh - top - 96) * R))
  return { w, h: w / R, top, left: (l.vw - w) / 2 }
}

export function BookPage({ b, l, view, onView, onClose }: { b: SiteBook; l: L2; view: number; onView: (v: number) => void; onClose: () => void }) {
  const api = React.useRef<ReaderApi>(null)
  const host = React.useRef<HTMLDivElement>(null)
  const rb = readerBox(l, b), n = viewsOf(b)
  // after the walk the reader takes the focus, so ← / → and Tab start from the book
  React.useEffect(() => {
    const t = window.setTimeout(() => host.current?.querySelector<HTMLElement>('[role="region"]')?.focus({ preventScroll: true }), reduced() ? 160 : 900)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <div ref={host} className="sd2-page" data-testid="sd2-page">
      <div className="sd2-spot" style={{ left: 0, top: l.y(-160), width: l.vw, height: l.y(1180) }} />
      <button type="button" className="sd2-cap sd2-on sd2-link sd2-abs" style={{ left: l.m, top: l.narrow ? 64 : 92 }} onClick={onClose} data-testid="sd2-close">← Back to the room</button>
      <div className="sd2-abs inset-x-0 text-center" style={{ top: l.narrow ? 92 : 88 }}>
        <h1 style={{ font: "300 30px/1 var(--site-sans)", letterSpacing: "-.02em", color: "var(--d2-text)" }} data-testid="sd2-title">{b.title}</h1>
        <div className="sd2-cap" style={{ marginTop: 10 }}>{pad2(BOOKS.indexOf(b) + 1)} · {b.year} · {b.w} × {b.h} cm</div>
      </div>
      <div className="sd2-abs" style={{ left: rb.left, top: rb.top, width: rb.w }} data-testid="sd2-reader" data-view={view}>
        <BookReader ref={api} b={b} view={view} onView={onView} width={rb.w} dark leaf="paper" board={b.spine} turnMs={900} />
      </div>
      <div className="sd2-abs flex items-baseline justify-between" style={{ left: rb.left, top: l.vh - 64, width: rb.w }}>
        <button type="button" className="sd2-cap sd2-on sd2-link" disabled={view === 0} onClick={() => api.current?.go(-1)} data-testid="sd2-prev">← Previous</button>
        <span className="sd2-cap sd2-on tabular-nums" aria-hidden data-testid="sd2-label">{viewLabel(b, view)} <span style={{ color: "var(--d2-muted)" }}>/ {pagesOf(b)}</span></span>
        <button type="button" className="sd2-cap sd2-on sd2-link" disabled={view === n - 1} onClick={() => api.current?.go(1)} data-testid="sd2-next">Next →</button>
      </div>
    </div>
  )
}

/** "Index": the titles as label rows; a row walks to its book and opens it. */
export function IndexOverlay({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="sd2-index" role="dialog" aria-modal="true" aria-label="Index" data-testid="sd2-index">
      <ol>
        {BOOKS.map((b, i) => (
          <li key={b.id}>
            <button type="button" className="sd2-cap sd2-link" autoFocus={i === 0} onClick={() => onPick(b.id)} data-testid="sd2-index-row" data-id={b.id}>
              <span className="tabular-nums">{pad2(i + 1)}</span>&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--d2-text)" }}>{b.title}</span>&nbsp;&nbsp;&nbsp;{b.year}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="sd2-cap sd2-on sd2-link sd2-abs" style={{ right: 48, top: 34 }} onClick={onClose} data-testid="sd2-index-close">Close</button>
    </div>
  )
}

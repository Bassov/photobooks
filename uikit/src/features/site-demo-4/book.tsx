/* Demo 4 parts (Spec site-awards-5, Direction 4): the layout, the flat top-down book (cover + stacked page-block edge),
   and the book page: the reader opened in the lamp light, "Put the book back · ESC" and the paper tag "‹ Pages 6–7 of 22 ›". */
import * as React from "react"
import { CoverFace } from "../site-demo-1/art"
import { thick } from "../site-demo-1/book3d"
import { pagesOf, SPREAD_R, viewLabel, viewsOf, type SiteBook } from "../site-demo-1/data"
import { BookReader, type ReaderApi } from "../site-demo-1/reader"

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
/** design units are the 1440×900 desk; px = o + u·k, centred, k = min(vw / 1440, vh / 900) */
export type L4 = { vw: number; vh: number; narrow: boolean; mid: boolean; k: number; s: number; ox: number; oy: number }
export const layoutOf = (vw: number, vh: number): L4 => {
  const narrow = vw < 768, k = narrow ? 1 : Math.min(vw / 1440, vh / 900)
  return { vw, vh, narrow, mid: !narrow && vw < 1024, k, s: narrow ? 8 : 9 * k, ox: vw / 2 - 720 * k, oy: vh / 2 - 450 * k }
}
/** the reader: W = min(980, vw − 2·230), top 168 (mid: vw − 96; narrow: vw − 32, top 120); short windows shrink it */
export const readerBox = (l: L4, b: SiteBook) => {
  const R = SPREAD_R[b.fmt], top = l.narrow ? 120 : Math.round(168 * Math.min(1, l.vh / 900))
  const w0 = l.narrow ? l.vw - 32 : l.mid ? l.vw - 96 : Math.min(980, l.vw - 460)
  const w = Math.max(200, Math.min(w0, (l.vh - top - 108) * R))
  return { w, h: w / R, top, left: (l.vw - w) / 2 }
}

/** the page-block edge: round(.45·T) layers (k·.55, k) in two papers, then one in the cloth */
export const edgeOf = (b: SiteBook, s: number) => {
  const d = Math.round(thick(b, s) * 0.45), e: string[] = []
  for (let k = 1; k <= d; k++) e.push(`${(k * 0.55).toFixed(2)}px ${k}px 0 ${k % 2 ? "#F6F2EA" : "#DCD4C6"}`)
  e.push(`${(d * 0.55 + 0.6).toFixed(2)}px ${d + 1}px 0 ${b.spine}`)
  return e.join(", ")
}
export const tagOf = (b: SiteBook) => `${b.title} · ${b.year} · ${pagesOf(b)} pp`

/** The flat book face: the cover with the edge and the rest / lifted shadow (`.sd4-pose`, CSS); `children` = the tag. */
export function FlatBook({ b, s, children }: { b: SiteBook; s: number; children?: React.ReactNode }) {
  const W = b.w * s, H = b.h * s
  return (
    <>
      <span className="sd4-pose" style={{ "--edge": edgeOf(b, s) } as React.CSSProperties}>
        <span className="sd4-face"><CoverFace b={b} w={W} h={H} /></span>
      </span>
      {children}
    </>
  )
}

export function BookPage({ b, l, view, onView, onClose }: { b: SiteBook; l: L4; view: number; onView: (v: number) => void; onClose: () => void }) {
  const api = React.useRef<ReaderApi>(null)
  const host = React.useRef<HTMLDivElement>(null)
  const rb = readerBox(l, b), n = viewsOf(b), label = viewLabel(b, view)
  // the reader takes the focus, so ← / → and Tab start from the book
  React.useEffect(() => { host.current?.querySelector<HTMLElement>('[role="region"]')?.focus({ preventScroll: true }) }, [])
  return (
    <div ref={host} className="sd4-page" data-testid="sd4-page">
      <div className="sd4-abs flex items-baseline" style={{ left: l.narrow ? 20 : 48, top: l.narrow ? 24 : 40, gap: 14 }}>
        <button type="button" className="sd4-link" onClick={onClose} data-testid="sd4-close">Put the book back</button>
        <span className="sd4-mono" style={{ fontSize: 11, color: "var(--d4-muted)" }} aria-hidden>ESC</span>
      </div>
      <div className="sd4-abs" style={{ left: rb.left, top: rb.top, width: rb.w }} data-testid="sd4-reader" data-view={view}>
        <BookReader ref={api} b={b} view={view} onView={onView} width={rb.w} corner={80} />
      </div>
      <div className="sd4-tag sd4-pages" style={{ top: l.vh - 78 }}>
        <button type="button" className="sd4-link-q" disabled={view === 0} aria-label="Previous pages" onClick={() => api.current?.go(-1)} data-testid="sd4-prev">‹</button>
        <span aria-hidden data-testid="sd4-label">{label.startsWith("Page") ? `${label} of ${pagesOf(b)}` : label}</span>
        <button type="button" className="sd4-link-q" disabled={view === n - 1} aria-label="Next pages" onClick={() => api.current?.go(1)} data-testid="sd4-next">›</button>
      </div>
    </div>
  )
}

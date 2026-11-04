/* Fullscreen reading for demo 1: the kit Fullscreen (site-viewer) copied with the Spec site-awards props — pad 96 / 48,
   no swipe (the reader drags itself), reader labels — and the reader inside, dark. */
import * as React from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { SPREAD_R, viewLabel, viewsOf, type SiteBook } from "./data"
import { BookReader, type ReaderApi } from "./reader"

const PAD = { x: 96, y: 48 }

export function SiteFullscreen({ b, view, onView, onClose }: { b: SiteBook; view: number; onView: (v: number) => void; onClose: () => void }) {
  const [vp, setVp] = React.useState({ w: window.innerWidth, h: window.innerHeight })
  const boxRef = React.useRef<HTMLDivElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const api = React.useRef<ReaderApi>(null)
  const n = viewsOf(b)
  // measure the dialog itself (fixed inset-0) so the book fits whatever box it fills — the window, or a transformed kit frame
  React.useEffect(() => { const el = boxRef.current; closeRef.current?.focus(); if (!el) return; const r = () => setVp({ w: el.clientWidth, h: el.clientHeight }); r(); const ro = new ResizeObserver(r); ro.observe(el); return () => ro.disconnect() }, [])
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const d = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[e.key]
      if (d) { e.preventDefault(); e.stopPropagation(); api.current?.go(d) }
      if (e.key === "Home") { e.preventDefault(); e.stopPropagation(); onView(0) }
      if (e.key === "End") { e.preventDefault(); e.stopPropagation(); onView(n - 2) }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose() }
    }
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true)
  }, [n, onView, onClose])
  const w = Math.max(100, Math.min(vp.w - PAD.x * 2, (vp.h - PAD.y * 2) * SPREAD_R[b.fmt]))
  return (
    <div ref={boxRef} className="sd-dark fixed inset-0 z-50 grid place-items-center" style={{ background: "var(--site-band)" }} role="dialog" aria-modal="true" aria-label={`${b.title} — fullscreen`} data-testid="lightbox">
      <div data-testid="site-fullscreen-book" style={{ width: w }}><BookReader ref={api} b={b} view={view} onView={onView} width={w} dark keys={false} /></div>
      <button type="button" className="sd-ctl absolute top-1/2 -translate-y-1/2" style={{ left: 28 }} aria-label="Previous pages" disabled={view === 0} onClick={() => api.current?.go(-1)} data-testid="fs-prev"><ChevronLeft /></button>
      <button type="button" className="sd-ctl absolute top-1/2 -translate-y-1/2" style={{ right: 28 }} aria-label="Next pages" disabled={view === n - 1} onClick={() => api.current?.go(1)} data-testid="fs-next"><ChevronRight /></button>
      <div className="sd-meta absolute inset-x-0 text-center" style={{ bottom: 16, color: "var(--site-on-band-muted)" }} data-testid="site-fullscreen-indicator">{viewLabel(b, view)}</div>
      <button ref={closeRef} type="button" aria-label="Exit fullscreen" onClick={onClose} className="sd-ctl absolute" style={{ right: 24, top: 24 }} data-testid="site-fullscreen-close"><X /></button>
    </div>
  )
}

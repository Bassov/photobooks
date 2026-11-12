/* The site lightbox (Fullscreen), opened from the personal-site reading room; the old site viewer it came from is retired (personal-site K3). */
import * as React from "react"
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { SW, SH } from "@/sandbox/model"
import { pagesOf } from "@/sandbox/v7"
import { type Zoom, Z1, ZOOM_STEP, ZOOM_TOGGLE, clampPan, fitArea, fitBox, fitInsets, settle, wheelFactor, zoomAt } from "./lightbox-zoom"

export const spreadLabel = (i: number, n: number) => (i === 0 ? "Cover" : i === n - 1 && n > 2 ? `Page ${i * 2}` : `Pages ${i * 2}–${i * 2 + 1}`)
/** A kit page's site seed (site-lightbox / site-preview-mode): the entry, the book, slide s (0 = cover) and the open lightbox at its zoom. */
export type SiteState = { page: "catalog" | "book"; book: string; slide: number; lb: boolean; lbZoom?: number }
/* Fullscreen = the site lightbox (Designer site-lightbox §2–§3): the presentation pager look; each slide fits the viewport minus
   64 top / 48 bottom / 64 sides (8 on touch); neighbours i ± 1 stay mounted for a 200 ms slide; zoom 1–3× by transform only.
   `ratio` = spread width / height (default: the editor spread); `ratioOf(i)` = slide i's own ratio when slides differ (the cover);
   `label` = indicator text (default: page / page count). */
const HOVER_Q = "(hover: hover) and (pointer: fine)"
const hoverNow = () => window.matchMedia?.(HOVER_Q).matches ?? true
function useHover() {
  const [h, setH] = React.useState(hoverNow)
  React.useEffect(() => { const m = window.matchMedia?.(HOVER_Q); if (!m) return; const f = () => setH(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f) }, [])
  return h
}
type Pt = { x: number; y: number }
type Gesture = { kind: "swipe"; p0: Pt } | { kind: "pan"; p0: Pt; z0: Zoom } | { kind: "pinch"; d0: number; m0: Pt; z0: Zoom }
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const chip = "absolute grid cursor-pointer place-items-center rounded-full border-0 bg-white/10 text-white outline-hidden transition-[background-color] duration-[120ms] hover:bg-white/20 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const stopDown = (e: React.PointerEvent) => e.stopPropagation()
export function Fullscreen({ i, n, title, onGo, onClose, render, ratio = SW / SH, ratioOf = () => ratio, label = (i, n) => `${spreadLabel(i, n)} · ${i === 0 ? 1 : i * 2} / ${pagesOf(n)}`, initialZoom = 1 }: { i: number; n: number; title: string; onGo: (d: number) => void; onClose: () => void; render: (i: number, w: number) => React.ReactNode; ratio?: number; ratioOf?: (i: number) => number; label?: (i: number, n: number) => string; initialZoom?: number }) {
  const boxRef = React.useRef<HTMLDivElement>(null)
  const [vp, setVp] = React.useState({ w: window.innerWidth, h: window.innerHeight })
  const hover = useHover()
  const insets = fitInsets(hover)
  const area = fitArea(vp, insets)
  // each slide fits the area at its own ratio (spec §2); zoom / pan limits follow that slide's box
  const boxOf = (k: number) => fitBox({ w: ratioOf(k), h: 1 }, vp, insets)
  const box = boxOf(i)
  // zoom per slide index: a step keeps only the old slide's entry, so it slides away at its zoom and the new one opens at 1
  const [zooms, setZooms] = React.useState<Record<number, Zoom>>({})
  const [at, setAt] = React.useState(i)
  if (at !== i) { setAt(i); setZooms((zs) => (zs[at] ? { [at]: zs[at] } : {})) }
  const zoomOf = (k: number) => clampPan(zooms[k] ?? Z1, boxOf(k), area)
  const zoom = zoomOf(i)
  const [anim, setAnim] = React.useState(false) // discrete change: 200 ms transform transition
  const [live, setLive] = React.useState(false) // will-change while input runs, dropped 150 ms after it
  const [drag, setDrag] = React.useState(false)
  const cur = React.useRef({ i, n, box, area, zoom, onGo, onClose })
  React.useLayoutEffect(() => { cur.current = { i, n, box, area, zoom, onGo, onClose } })
  const liveT = React.useRef<number | undefined>(undefined)
  const wheelEnd = React.useRef<number | undefined>(undefined)
  const update = React.useCallback((f: (z: Zoom) => Zoom, discrete: boolean) => {
    const { i: ci, box: b, area: a } = cur.current
    setZooms((zs) => ({ ...zs, [ci]: clampPan(f(clampPan(zs[ci] ?? Z1, b, a)), b, a) }))
    setAnim(discrete); setLive(true)
    window.clearTimeout(liveT.current)
    liveT.current = window.setTimeout(() => { setLive(false); setAnim(false) }, discrete ? 350 : 150)
  }, [])
  const settleNow = React.useCallback(() => update((z) => settle(z), false), [update])
  const toggleAt = React.useCallback((p: Pt) => update((z) => (z.z > 1 ? Z1 : zoomAt(z, ZOOM_TOGGLE / z.z, p.x, p.y, cur.current.box, cur.current.area)), true), [update])
  const zoomBy = React.useCallback((f: number) => { const a = cur.current.area; update((z) => zoomAt(z, f, a.x + a.w / 2, a.y + a.h / 2, cur.current.box, a), true) }, [update])
  React.useEffect(() => () => window.clearTimeout(liveT.current), [])
  /** Client → dialog-local px (a kit frame may scale the dialog). */
  const local = (cx: number, cy: number) => { const el = boxRef.current!, r = el.getBoundingClientRect(), s = el.clientWidth / (r.width || 1); return { x: (cx - r.left) * s, y: (cy - r.top) * s } }
  // measure the dialog itself (fixed inset-0) so the book fits whatever box it fills — the window, or a transformed kit frame; focus the dialog, not the X
  React.useLayoutEffect(() => {
    const el = boxRef.current; if (!el) return
    el.focus({ preventScroll: true })
    const v = { w: el.clientWidth, h: el.clientHeight }; setVp(v)
    if (initialZoom > 1) { const ins = fitInsets(hoverNow()), a = fitArea(v, ins); setZooms({ [i]: zoomAt(Z1, initialZoom, a.x + a.w / 2, a.y + a.h / 2, fitBox({ w: ratioOf(i), h: 1 }, v, ins), a) }) }
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); return () => ro.disconnect()
  }, []) // mount only
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const c = cur.current, el = boxRef.current
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); c.onClose(); return }
      if (e.key === "Tab" && el) {
        const fs = [...el.querySelectorAll<HTMLButtonElement>("[data-lb-control]")].filter((b) => getComputedStyle(b).visibility !== "hidden")
        if (!fs.length) return
        e.preventDefault()
        const at = fs.indexOf(document.activeElement as HTMLButtonElement)
        fs[at < 0 ? (e.shiftKey ? fs.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + fs.length) % fs.length].focus()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const space = e.key === " " && !(e.target as HTMLElement)?.closest?.("button")
      const d = e.key === "ArrowRight" || space ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -c.i : e.key === "End" ? c.n - 1 - c.i : 0
      if (d) { e.preventDefault(); c.onGo(d); return }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(ZOOM_STEP) }
      else if (e.key === "-") { e.preventDefault(); zoomBy(1 / ZOOM_STEP) }
      else if (e.key === "0") { e.preventDefault(); update(() => Z1, true) }
    }
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true)
  }, [update, zoomBy])
  React.useEffect(() => {
    const el = boxRef.current; if (!el) return
    // non-passive: Ctrl + wheel must not zoom the page
    const w = (e: WheelEvent) => {
      e.preventDefault()
      const s = el.clientWidth / (el.getBoundingClientRect().width || 1), line = e.deltaMode === 1 ? 16 : 1
      if (e.ctrlKey || e.metaKey) { const r = el.getBoundingClientRect(), px = (e.clientX - r.left) * s, py = (e.clientY - r.top) * s; update((z) => zoomAt(z, wheelFactor(e.deltaY, e.deltaMode), px, py, cur.current.box, cur.current.area), false); window.clearTimeout(wheelEnd.current); wheelEnd.current = window.setTimeout(settleNow, 150) }
      else if (cur.current.zoom.z > 1) update((z) => ({ ...z, x: z.x - e.deltaX * line * s, y: z.y - e.deltaY * line * s }), false)
    }
    el.addEventListener("wheel", w, { passive: false }); return () => { el.removeEventListener("wheel", w); window.clearTimeout(wheelEnd.current) }
  }, [update, settleNow])
  const ptrs = React.useRef(new Map<number, Pt>())
  const g = React.useRef<Gesture | null>(null)
  const lastTap = React.useRef<{ t: number; p: Pt } | null>(null)
  const mouse = React.useRef(true)
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    mouse.current = e.pointerType === "mouse"
    if (e.button !== 0 && e.pointerType === "mouse") return
    const p = local(e.clientX, e.clientY); ptrs.current.set(e.pointerId, p)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic */ }
    const z = cur.current.zoom
    if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; g.current = { kind: "pinch", d0: Math.max(1, dist(a, b)), m0: mid(a, b), z0: z }; setDrag(false) }
    else if (ptrs.current.size === 1) { g.current = z.z > 1 ? { kind: "pan", p0: p, z0: z } : { kind: "swipe", p0: p }; setDrag(z.z > 1) }
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ptrs.current.has(e.pointerId)) return
    const p = local(e.clientX, e.clientY); ptrs.current.set(e.pointerId, p)
    const gg = g.current, { box: b, area: a } = cur.current
    if (gg?.kind === "pan") update(() => ({ ...gg.z0, x: gg.z0.x + p.x - gg.p0.x, y: gg.z0.y + p.y - gg.p0.y }), false)
    else if (gg?.kind === "pinch" && ptrs.current.size >= 2) {
      const [p1, p2] = [...ptrs.current.values()], m = mid(p1, p2)
      update(() => { const z = zoomAt(gg.z0, dist(p1, p2) / gg.d0, gg.m0.x, gg.m0.y, b, a); return { ...z, x: z.x + m.x - gg.m0.x, y: z.y + m.y - gg.m0.y } }, false)
    }
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ptrs.current.delete(e.pointerId)) return
    const gg = g.current, p = local(e.clientX, e.clientY)
    if (gg?.kind === "swipe" && e.type === "pointerup") {
      const dx = p.x - gg.p0.x
      if (Math.abs(dx) > 60) cur.current.onGo(dx < 0 ? 1 : -1)
    }
    // double-tap (touch / pen): 2 taps ≤ 300 ms, ≤ 16 px apart; the mouse uses dblclick
    if (!mouse.current && gg && gg.kind !== "pinch" && e.type === "pointerup" && dist(p, gg.p0) <= 16) {
      const t = e.timeStamp, l = lastTap.current
      if (l && t - l.t <= 300 && dist(p, l.p) <= 16) { lastTap.current = null; toggleAt(p) } else lastTap.current = { t, p }
    }
    const rest = [...ptrs.current.values()]
    if (rest.length === 1 && gg?.kind === "pinch") { g.current = { kind: "pan", p0: rest[0], z0: cur.current.zoom }; return }
    if (rest.length === 0) { g.current = null; setDrag(false); if (gg && gg.kind !== "swipe") settleNow() }
  }
  const ks = [i - 1, i, i + 1].filter((k) => k >= 0 && k < n)
  const cursor = zoom.z > 1 ? (drag ? "grabbing" : "grab") : "default"
  const arrowTop = area.y + area.h / 2 - 20
  return (
    <div ref={boxRef} className="fixed inset-0 z-[60] touch-none select-none overflow-hidden bg-presentation outline-hidden" style={{ cursor }} role="dialog" aria-modal="true" aria-label={`${title} — fullscreen`} tabIndex={-1} data-testid="lightbox" data-zoom={zoom.z.toFixed(2)}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      onDoubleClick={(e) => { if (mouse.current && !(e.target as HTMLElement).closest("[data-lb-control]")) toggleAt(local(e.clientX, e.clientY)) }}>
      {ks.map((k) => {
        const z = k === i ? zoom : zoomOf(k), b = boxOf(k)
        return (
          <div key={k} inert={k !== i} className="absolute transition-[transform,opacity] duration-[var(--duration-base)] ease-out motion-reduce:transition-none" style={{ left: b.x, top: b.y, width: b.w, height: b.h, transform: `translateX(${(k - i) * 100}%)`, opacity: k === i ? 1 : 0 }} data-slide={k}>
            <div className={cn("size-full origin-top-left", k === i && anim && "transition-transform duration-[var(--duration-base)] ease-out motion-reduce:transition-none")} style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.z})`, willChange: k === i && (live || drag) ? "transform" : undefined }} data-testid={k === i ? "site-fullscreen-layer" : undefined}>
              <div className="grid size-full place-items-center" data-testid={k === i ? "site-fullscreen-book" : undefined}>{render(k, b.w)}</div>
            </div>
          </div>
        )
      })}
      {hover && <>
        <button type="button" data-lb-control aria-label="Previous spread" onPointerDown={stopDown} onClick={() => onGo(-1)} className={cn(chip, "size-10 [&_svg]:size-5")} style={{ left: 12, top: arrowTop, visibility: i === 0 ? "hidden" : undefined }}><ChevronLeft /></button>
        <button type="button" data-lb-control aria-label="Next spread" onPointerDown={stopDown} onClick={() => onGo(1)} className={cn(chip, "size-10 [&_svg]:size-5")} style={{ right: 12, top: arrowTop, visibility: i === n - 1 ? "hidden" : undefined }}><ChevronRight /></button>
      </>}
      <button type="button" data-lb-control aria-label={zoom.z > 1 ? "Zoom out" : "Zoom in"} onPointerDown={stopDown} onClick={() => (zoom.z > 1 ? update(() => Z1, true) : zoomBy(ZOOM_TOGGLE))} className={cn(chip, "size-8 [&_svg]:size-4")} style={{ top: 16, right: 56 }} data-testid="site-fullscreen-zoom">{zoom.z > 1 ? <ZoomOut /> : <ZoomIn />}</button>
      <button type="button" data-lb-control aria-label="Exit fullscreen" title="Close (Esc)" onPointerDown={stopDown} onClick={onClose} className={cn(chip, "size-8 [&_svg]:size-4")} style={{ top: 16, right: 16 }} data-testid="site-fullscreen-close"><X /></button>
      <div className="pointer-events-none absolute inset-x-0 text-center text-xs leading-4 tabular-nums text-white/60" style={{ bottom: 16 }} aria-live="polite" data-testid="site-fullscreen-indicator">{label(i, n)}</div>
    </div>
  )
}

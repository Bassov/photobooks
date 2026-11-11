/* Pager (Spec site-stand S5): single-page mode for a phone. A camera box CW wide (overflow hidden, full bleed) over a
   BookReader at W = 2P driven by `scrub`, so the leaf angle and the camera share one clock. Sequence Cover → Page 1 … →
   last page → Back cover (endpapers skipped). Left → right page of a spread: camera pan 380 ms; right page → next left
   page: leaf turn 820 ms (cover / back board 1000 ms) with tx = from + (to − from)·smoothstep(θ/180); reduced motion
   crossfades 160 ms. Input: tap the outer 40 %, horizontal drag (1:1 pan in a spread, θ across a leaf; release past
   25 % of P or > 0.3 px/ms), ← / →; `touch-action: pan-y` keeps the vertical scroll. */
import * as React from "react"
import { pagesOf, SPREAD_R, viewsOf, type SiteBook } from "../site-demo-1/data"
import { BookReader, EASE, geoOf, TURN } from "./reader"

export type Step = { v: number; side: "L" | "R" | "C"; label: string }
export type PagerApi = { go: (d: number) => void }

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const smooth = (x: number) => x * x * (3 - 2 * x)
/** smoothstep⁻¹: BookReader's scrub draws θ = smoothstep(frac)·180, the pager wants θ = q·180 */
const unsmooth = (y: number) => 0.5 - Math.sin(Math.asin(clamp(1 - 2 * y, -1, 1)) / 3)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Cover, Page 1 (view 1 right), then each spread's left and right page (the last spread's endpaper skipped), Back cover */
export function stepsOf(b: SiteBook): Step[] {
  const n = viewsOf(b), N = pagesOf(b)
  const out: Step[] = [{ v: 0, side: "C", label: "Cover" }, { v: 1, side: "R", label: `Page 1 of ${N}` }]
  for (let v = 2; v <= n - 2; v++) {
    out.push({ v, side: "L", label: `Page ${2 * (v - 1)} of ${N}` })
    if (b.spreads[v - 2].template !== "last") out.push({ v, side: "R", label: `Page ${2 * (v - 1) + 1} of ${N}` })
  }
  out.push({ v: n - 1, side: "C", label: "Back cover" })
  return out
}
/** the first step showing `view` */
export const stepOf = (steps: Step[], view: number) => Math.max(0, steps.findIndex((s) => s.v >= view))

/** page width P = min(CW − 32 − BD − eMax, CH·w/h); BD and eMax depend on P (px per cm), so iterate to the fixed point */
export function pageOf(b: SiteBook, CW: number, CH: number) {
  const fit = (CH * b.w) / b.h
  let P = Math.min(CW - 32, fit)
  for (let i = 0; i < 4; i++) {
    const g = geoOf(b, 2 * P, (2 * P) / SPREAD_R[b.fmt], viewsOf(b), "", true)
    P = Math.min(CW - 32 - g.BD - g.eMax, fit)
  }
  return P
}
/** camera translateX: left page centred, right page centred, closed book centred */
const camOf = (s: Step, CW: number, P: number) => (s.side === "C" ? (CW - 2 * P) / 2 : s.side === "L" ? (CW - P) / 2 : (CW - P) / 2 - P)

/** moving from step `from` to the adjacent step `to`, progress f ∈ [0, 1] */
type Mo = { from: number; to: number; f: number }
type PagerProps = {
  b: SiteBook; view: number; onStep: (i: number, s: Step) => void; width: number; height: number; dark?: boolean; keys?: boolean
}

export const Pager = React.forwardRef<PagerApi, PagerProps>(function Pager({ b, view, onStep, width: CW, height: CH, dark, keys = true }, apiRef) {
  const steps = React.useMemo(() => stepsOf(b), [b])
  const n = viewsOf(b)
  const P = pageOf(b, CW, CH), H = (2 * P) / SPREAD_R[b.fmt]
  const cam = (i: number) => camOf(steps[i], CW, P)
  const [idx, setIdxS] = React.useState(() => stepOf(steps, view))
  const [mo, setMoS] = React.useState<Mo | null>(null)
  const live = React.useRef({ idx, mo: null as Mo | null, onStep, P })
  live.current.onStep = onStep; live.current.P = P
  const setIdx = (i: number) => { live.current.idx = i; setIdxS(i) }
  const setMo = (m: Mo | null) => { live.current.mo = m; setMoS(m) }
  const box = React.useRef<HTMLDivElement>(null), camEl = React.useRef<HTMLDivElement>(null)
  const raf = React.useRef(0), pending = React.useRef<number | null>(null)
  React.useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const isTurn = (i: number, j: number) => steps[i].v !== steps[j].v
  const fullMs = (i: number, j: number) => {
    if (!isTurn(i, j)) return 380
    const a = Math.min(steps[i].v, steps[j].v)
    return a === 0 || a === n - 2 ? 1000 : 820
  }
  const run = (m: Mo, f1: number, ms: number, ease: (t: number) => number, done: () => void) => {
    cancelAnimationFrame(raf.current)
    setMo(m)
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      setMo({ ...m, f: m.f + (f1 - m.f) * ease(p) })
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else done()
    }
    raf.current = requestAnimationFrame(tick)
  }
  const land = (i: number) => {
    setMo(null); setIdx(i)
    const d = pending.current; pending.current = null
    if (d !== null) go(d)
  }
  const go = (d: number) => {
    if (live.current.mo || ptr.current?.drag) { if (pending.current === null) pending.current = d; return }
    const i = live.current.idx, j = clamp(i + d, 0, steps.length - 1)
    if (j === i) return
    live.current.onStep(j, steps[j])
    if (reduced()) {
      setIdx(j)
      camEl.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" })
      return
    }
    run({ from: i, to: j, f: 0 }, 1, fullMs(i, j), isTurn(i, j) ? TURN : EASE, () => land(j))
  }
  const goRef = React.useRef(go)
  goRef.current = go
  React.useImperativeHandle(apiRef, () => ({ go: (d: number) => goRef.current(d) }), [])

  React.useEffect(() => {
    if (!keys) return
    const k = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,select,[contenteditable]")) return
      const d = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[e.key]
      if (d) { e.preventDefault(); goRef.current(d) }
    }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [keys])

  // pointer: a tap on the outer 40 % steps; a horizontal drag (6 px) pans or turns, the page follows the finger
  const ptr = React.useRef<{ id: number; x0: number; y0: number; lx: number; lt: number; vx: number; drag: boolean } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || live.current.mo) return
    ptr.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, lt: e.timeStamp, vx: 0, drag: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const p = ptr.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.x0, dy = e.clientY - p.y0
    if (!p.drag) {
      if (Math.abs(dx) <= 6 || Math.abs(dx) < Math.abs(dy) || reduced()) return
      p.drag = true; box.current?.setPointerCapture(e.pointerId)
    }
    const dt = e.timeStamp - p.lt; if (dt > 0) p.vx = (e.clientX - p.lx) / dt
    p.lx = e.clientX; p.lt = e.timeStamp
    const i = live.current.idx, j = clamp(i + (dx < 0 ? 1 : -1), 0, steps.length - 1)
    if (j === i) { setMo(null); return }
    const span = isTurn(i, j) ? live.current.P : Math.abs(cam(j) - cam(i)) || 1
    setMo({ from: i, to: j, f: clamp(Math.abs(dx) / span, 0, 1) })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const p = ptr.current; ptr.current = null
    if (!p || p.id !== e.pointerId) return
    if (!p.drag) {
      const r = box.current!.getBoundingClientRect(), x = (e.clientX - r.left) / r.width
      if (x > 0.6) go(1)
      else if (x < 0.4) go(-1)
      return
    }
    const m = live.current.mo
    if (!m) return
    if (e.timeStamp - p.lt > 100) p.vx = 0 // the finger rested before release: no fling
    const toward = (m.to > m.from ? -1 : 1) * p.vx
    const done = Math.abs(e.clientX - p.x0) > 0.25 * live.current.P || toward > 0.3
    if (done) live.current.onStep(m.to, steps[m.to])
    const f1 = done ? 1 : 0
    run(m, f1, Math.max(120, fullMs(m.from, m.to) * Math.abs(f1 - m.f)), EASE, () => land(done ? m.to : m.from))
  }
  const onPointerCancel = () => { const p = ptr.current; ptr.current = null; if (p?.drag) setMo(null) }

  // the frame: the scrub value for the reader and the camera translateX
  let s: number, tx: number
  if (!mo) { s = steps[idx].v; tx = cam(idx) }
  else if (!isTurn(mo.from, mo.to)) { s = steps[mo.from].v; tx = lerp(cam(mo.from), cam(mo.to), mo.f) }
  else {
    const A = steps[mo.from].v, B = steps[mo.to].v, q = B > A ? mo.f : 1 - mo.f
    s = Math.min(A, B) + unsmooth(q)
    tx = lerp(cam(mo.from), cam(mo.to), smooth(mo.f))
  }
  return (
    <div ref={box} className="sd-pager" style={{ position: "relative", width: CW, height: CH, overflow: "hidden", touchAction: "pan-y" }}
      data-testid="ps-pager" data-step={idx} data-side={steps[idx].side} data-page={P.toFixed(1)}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      <div ref={camEl} style={{ position: "absolute", left: 0, top: (CH - H) / 2, transform: `translateX(${tx}px)` }}>
        <BookReader b={b} view={steps[idx].v} onView={() => {}} width={2 * P} dark={dark} keys={false} scrub={s} />
      </div>
      <div className="sr-only" aria-live="polite" data-testid="ps-pager-live">{steps[idx].label}</div>
    </div>
  )
})

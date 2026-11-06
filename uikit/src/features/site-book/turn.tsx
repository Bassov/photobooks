/* Phone portrait reader, Page turn mode (Spec site-stand-v6 T / C / F, D28–D29): every slide is a page-sized sheet over a
   fixed bed; a drag peels the top sheet with an e-reader curl (the model below, ported from the Designer's mockup-src.html),
   tap / Next / keys / Play run a 600 ms scripted turn, Home / End and `jump` crossfade 240 ms, reduced motion crossfades
   160 ms. Same props and `SlidesApi` as the carousel (slides.tsx), so the room drives both alike. This item draws the curl
   state as a flat CSS fold (r = 0, β = 0): the top sheet clipped at xm, a shadow right of it, the part past xm mirrored to
   its left (`pt-flap`). The commit (end of a completing turn) moves the slide, the label and the room's view. */
import * as React from "react"
import { ENDPAPER } from "../site-demo-1/art"
import type { SiteBook } from "../site-demo-1/data"
import { EASE, TURN } from "./reader"
import { Paper, slideOfView, type Slide, type SlidesApi } from "./slides"
import "./turn.css"

// ---------- the curl model (spec §C; mockup-src.html:54-74 verbatim) ----------
// sheet coords: x right, y down, z toward the viewer, px. State { xm, beta, r }: the curl axis passes (xm, ph/2) with
// normal n = (cos β, sin β) pointing at the free edge; d = (p − A)·n. d ≤ 0 flat; 0 < d < πr on the cylinder; d ≥ πr flat, flipped, z = 2r.
const rad = (d: number) => (d * Math.PI) / 180
const B0 = rad(15), BMAX = rad(25)
export type Curl = { xm: number; beta: number; r: number }
const xmStart = (pw: number, ph: number, beta: number) => pw + (ph / 2) * Math.tan(beta) // the axis just touches the leading corner
const xmEnd = (r: number) => -r - 18 // the curl is off the screen (sheet left = 16)
/** forward drag: grabbed point C (corner or edge), finger offset → state */
export function fromDrag(pw: number, ph: number, r: number, C: { x: number; y: number }, corner: boolean, dx: number, dy: number): Curl {
  const P = { x: C.x + dx, y: C.y + dy }, vx = C.x - P.x, vy = corner ? C.y - P.y : 0
  const L0 = Math.hypot(vx, vy)
  const prog = Math.min(1, Math.max(0, vx / pw))
  let beta = L0 < 1 ? 0 : Math.atan2(vy, vx)
  if (corner) beta += (C.y > ph / 2 ? 1 : -1) * B0 * (1 - prog) // the grabbed corner leads, straightening as it turns
  beta = Math.max(-BMAX, Math.min(BMAX, beta))
  const n = { x: Math.cos(beta), y: Math.sin(beta) }, L = Math.max(0, vx * n.x + vy * n.y)
  const D = L < Math.PI * r ? L : (L + Math.PI * r) / 2 // past πr the folded corner sits under the finger
  const A = { x: C.x - n.x * D, y: C.y - n.y * D }
  return { xm: A.x - (ph / 2 - A.y) * Math.tan(beta), beta, r }
}
/** the scripted turn (tap, Next, keys, Play): t 0..1 eased with TURN */
export const scripted = (pw: number, ph: number, r: number, e: number): Curl => ({ xm: xmStart(pw, ph, B0) + (xmEnd(r) - xmStart(pw, ph, B0)) * e, beta: B0 * (1 - e), r })

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const SCRIPT_MS = 600, JUMP_MS = 240, FADE_MS = 160

type Props = {
  b: SiteBook; slides: Slide[]; w: number; top: number; pw: number; ph: number
  view: number; setView: (v: number) => void
  si: number; onSi: (i: number) => void; onRest: (i: number) => void
  /** the slide to open on */
  start: number
}
/** a turn in progress: `top` is the sheet that moves (fade: the one fading out), `under` the one it uncovers */
type Turn = { top: number; under: number; dir: "fwd" | "back" | "fade" }
type Drag = { id: number; x0: number; y0: number; t0: number; py: number; active: boolean; dead: boolean; dx: number; trail: [number, number][] }

export const PageTurn = React.forwardRef<SlidesApi, Props>(function PageTurn({ b, slides, w, top, pw, ph, view, setView, onSi, onRest, start }, ref) {
  const n = slides.length
  const clamp = (i: number) => Math.max(0, Math.min(n - 1, i))
  const [si, setSi] = React.useState(() => clamp(start))
  const [turn, setTurn] = React.useState<Turn | null>(null)
  const live = React.useRef({ si, view, turn: null as Turn | null, xm: null as number | null, raf: 0, end: null as (() => void) | null })
  const cb = React.useRef({ setView, onSi, onRest })
  cb.current = { setView, onSi, onRest }
  const stage = React.useRef<HTMLDivElement>(null)
  const topEl = React.useRef<HTMLDivElement>(null)
  const shadow = React.useRef<HTMLDivElement>(null)
  const flap = React.useRef<HTMLDivElement>(null)
  const rOf = (i: number) => (slides[i]?.kind === "cover" ? 0.3 : 0.09) * pw

  // the flat fold for the live state (xm null: at rest); fade: the top sheet's opacity
  const paint = () => {
    const L = live.current, xm = L.xm, t = L.turn
    const st = stage.current
    if (st) st.dataset.xm = xm == null || t?.dir === "fade" ? "" : xm.toFixed(1)
    const top = topEl.current?.style
    if (top) {
      top.clipPath = xm == null || t?.dir === "fade" ? "" : `inset(0 ${Math.min(pw, Math.max(0, pw - xm))}px 0 0)`
      top.opacity = xm != null && t?.dir === "fade" ? String(xm) : ""
    }
    if (xm == null || t?.dir === "fade") return
    const cut = Math.max(0, pw - xm)
    if (shadow.current) Object.assign(shadow.current.style, { left: `${16 + xm}px`, width: `${Math.min(cut, 28)}px` })
    if (flap.current) Object.assign(flap.current.style, { left: `${16 + 2 * xm - pw}px`, width: `${cut}px` })
  }
  React.useLayoutEffect(paint)

  const begin = (t: Turn, xm: number) => {
    const L = live.current
    L.turn = t; L.xm = xm
    setTurn(t)
    paint()
  }
  const commit = (i: number) => {
    const L = live.current
    L.turn = null; L.xm = null
    setTurn(null)
    if (i !== L.si) {
      L.si = i
      setSi(i)
      cb.current.onSi(i); cb.current.onRest(i)
      const s = slides[i]
      if (s && s.view !== L.view) { L.view = s.view; cb.current.setView(s.view) }
    }
    paint()
  }
  /** animate the live value from a to z over ms (f maps eased progress to xm / opacity), then `done` */
  const run = (ms: number, frame: (t: number) => void, done: () => void) => {
    const L = live.current, t0 = performance.now()
    const end = () => { cancelAnimationFrame(L.raf); L.end = null; frame(1); done() }
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms)
      if (t >= 1) return end()
      frame(t); paint()
      L.raf = requestAnimationFrame(step)
    }
    L.end = end
    L.raf = requestAnimationFrame(step)
  }
  /** the running animation jumps to its end (commits or springs back) */
  const finish = () => live.current.end?.()

  const fade = (i: number, ms: number) => {
    const L = live.current
    if (i === L.si) return
    begin({ top: L.si, under: i, dir: "fade" }, 1)
    run(ms, (t) => { L.xm = 1 - EASE(t) }, () => commit(i))
  }
  /** a scripted turn from the bottom corner (backward: the same, reversed) */
  const script = (d: 1 | -1) => {
    const L = live.current, i = L.si + d
    if (i < 0 || i >= n) return
    if (reduced()) return fade(i, FADE_MS)
    const t: Turn = d > 0 ? { top: L.si, under: i, dir: "fwd" } : { top: i, under: L.si, dir: "back" }
    const at = (u: number) => scripted(pw, ph, rOf(t.top), TURN(d > 0 ? u : 1 - u)).xm
    begin(t, at(0))
    run(SCRIPT_MS, (u) => { L.xm = at(u) }, () => commit(i))
  }
  /** release: animate xm to the end of the turn (`complete`) or back to where it started */
  const settle = (complete: boolean) => {
    const L = live.current, t = L.turn
    if (!t || L.xm == null) return
    const end = xmEnd(rOf(t.top)), from = L.xm
    const to = (t.dir === "fwd") === complete ? end : pw
    const target = complete ? (t.dir === "fwd" ? t.under : t.top) : L.si
    run(160 + (440 * Math.abs(to - from)) / (pw - end), (u) => { L.xm = from + (to - from) * EASE(u) }, () => commit(target))
  }

  const go = (d: number) => { finish(); script(d > 0 ? 1 : -1) }
  const jump = (i: number) => { finish(); fade(clamp(i), reduced() ? FADE_MS : JUMP_MS) }
  const api = React.useRef({ go, jump })
  api.current = { go, jump }
  React.useImperativeHandle(ref, () => ({ go: (d) => api.current.go(d), jump: (i) => api.current.jump(i) }))

  // mount: report the start slide
  React.useLayoutEffect(() => {
    cb.current.onSi(live.current.si); cb.current.onRest(live.current.si)
    const L = live.current
    return () => cancelAnimationFrame(L.raf)
  }, [])
  // a view change from outside (rotation, deep link): jump there without animation
  React.useEffect(() => {
    const L = live.current
    L.view = view
    if (slides[L.si]?.view === view) return
    cancelAnimationFrame(L.raf); L.end = null
    const i = slideOfView(slides, view)
    L.turn = null; L.xm = null; L.si = i
    setTurn(null); setSi(i)
    cb.current.onSi(i); cb.current.onRest(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // ← / → turn, Home / End jump
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,select,[contenteditable]")) return
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
      if (d) { e.preventDefault(); api.current.go(d) }
      else if (e.key === "Home" || e.key === "End") { e.preventDefault(); api.current.jump(e.key === "Home" ? 0 : n - 1) }
    }
    addEventListener("keydown", k); return () => removeEventListener("keydown", k)
  }, [n])

  // drag (as swipe back: active once |dx| > 10 and |dx| > 1.5·|dy|, abandoned if |dy| > 10 comes first) and tap
  const drag = React.useRef<Drag | null>(null)
  const follow = (g: Drag, x: number, y: number) => {
    const L = live.current, t = L.turn
    if (!t || reduced()) return
    const r = rOf(t.top)
    if (t.dir === "fwd") {
      const corner = g.py < 0.25 * ph || g.py > 0.75 * ph
      const C = { x: pw, y: corner ? (g.py < 0.25 * ph ? 0 : ph) : g.py }
      L.xm = fromDrag(pw, ph, r, C, corner, x - g.x0, y - g.y0).xm
    } else {
      const end = xmEnd(r), k = (pw - end) / Math.max(40, w - 16 - g.x0)
      L.xm = end + (x - g.x0) * k
    }
    L.xm = Math.max(xmEnd(r), Math.min(pw, L.xm))
    paint()
  }
  const onPointerDown = (e: React.PointerEvent) => {
    if (drag.current) return
    finish()
    const py = e.clientY - stage.current!.getBoundingClientRect().top
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, py, active: false, dead: false, dx: 0, trail: [] }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const g = drag.current
    if (!g || g.id !== e.pointerId || g.dead) return
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0
    if (!g.active) {
      if (Math.abs(dy) > 10) { g.dead = true; return }
      if (!(Math.abs(dx) > 10 && Math.abs(dx) > 1.5 * Math.abs(dy))) return
      const L = live.current, fwd = dx < 0
      // no forward drag on the last slide, no backward drag on the first: nothing moves
      if (fwd ? L.si >= n - 1 : L.si <= 0) { g.dead = true; return }
      g.active = true
      stage.current!.setPointerCapture(e.pointerId)
      const t: Turn = fwd ? { top: L.si, under: L.si + 1, dir: "fwd" } : { top: L.si - 1, under: L.si, dir: "back" }
      if (!reduced()) begin(t, fwd ? pw : xmEnd(rOf(t.top)))
      else L.turn = t
    }
    g.dx = dx
    g.trail = [...g.trail.filter(([t]) => e.timeStamp - t <= 80), [e.timeStamp, dx]]
    follow(g, e.clientX, e.clientY)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const g = drag.current
    if (!g || g.id !== e.pointerId) return
    drag.current = null
    const L = live.current
    if (!g.active) {
      // a tap (< 8 px, < 350 ms): the left half back, the right half on
      if (g.dead || Math.abs(e.clientX - g.x0) >= 8 || Math.abs(e.clientY - g.y0) >= 8 || e.timeStamp - g.t0 > 350) return
      const r = stage.current!.getBoundingClientRect()
      return go(e.clientX - r.left < r.width / 2 ? -1 : 1)
    }
    const t = L.turn!, s = t.dir === "fwd" ? -1 : 1
    if (reduced()) {
      L.turn = null
      if (s * g.dx > 40) fade(t.dir === "fwd" ? t.under : t.top, FADE_MS)
      return
    }
    const back = g.trail.find(([tt]) => e.timeStamp - tt <= 80) ?? [e.timeStamp, g.dx]
    const v = e.timeStamp > back[0] ? (g.dx - back[1]) / (e.timeStamp - back[0]) : 0
    const end = xmEnd(rOf(t.top)), xm = L.xm ?? pw
    const p = t.dir === "fwd" ? (pw - xm) / (pw - end) : (xm - end) / (pw - end)
    settle((p > 0.5 || s * v > 0.3) && !(s * v < -0.3))
  }
  const onPointerCancel = (e: React.PointerEvent) => {
    const g = drag.current
    if (!g || g.id !== e.pointerId) return
    drag.current = null
    if (!g.active) return
    if (reduced()) live.current.turn = null
    else settle(false)
  }

  const topI = turn ? turn.top : si, underI = turn ? turn.under : null
  const fold = !!turn && turn.dir !== "fade"
  const sheet = (i: number, role: "top" | "under") => {
    const s = slides[i]!
    return (
      <div key={i} ref={role === "top" ? topEl : undefined} className="pt-sheet" style={{ width: pw, height: ph, zIndex: role === "top" ? 2 : 1 }}
        data-testid="pt-sheet" data-role={role} role="group" aria-roledescription="page" aria-label={s.label} aria-hidden={role === "under" || undefined}>
        <Paper b={b} s={s} pw={pw} ph={ph} on sheet />
      </div>
    )
  }
  const cover = slides[topI]?.kind === "cover"
  return (
    <div ref={stage} className="pt-stage" style={{ top, width: w, height: ph }} data-testid="pt-stage"
      role="region" aria-roledescription="book" aria-label={b.title} tabIndex={0}
      data-si={si} data-dir={turn && turn.dir !== "fade" ? turn.dir : ""} data-gl="0"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      <div className="pt-bed" style={{ width: pw, height: ph }} aria-hidden data-testid="pt-bed" />
      {[topI, underI].filter((i): i is number => i != null).sort((a, c) => a - c).map((i) => sheet(i, i === topI ? "top" : "under"))}
      {fold && (
        <>
          <div ref={shadow} className="pt-shadow" style={{ height: ph }} aria-hidden data-testid="pt-shadow" />
          <div ref={flap} className="pt-flap" style={{ height: ph, background: cover ? ENDPAPER : undefined }} aria-hidden data-testid="pt-flap">
            {!cover && <div className="pt-mirror" style={{ width: pw, height: ph }}><Paper b={b} s={slides[topI]!} pw={pw} ph={ph} on sheet /></div>}
            <div className="pt-flap-shade" />
          </div>
        </>
      )}
    </div>
  )
})

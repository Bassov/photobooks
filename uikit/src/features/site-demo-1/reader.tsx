/* BookReader (Spec site-awards): a controlled book that opens its cover and turns rigid layflat pages around the spine.
   Views: 0 closed front cover · 1 endpaper | page 1 · 2… the spreads (the last: last page | endpaper) · last: closed back.
   A ±1 change of `view` turns a leaf (800 ms, the cover / back board 1000 ms); bigger jumps crossfade 240 ms; reduced
   motion crossfades every change in 160 ms. Click a half, ← / →, or drag a page; the corner lifts under a fine pointer.
   Demos 2–5 (Spec site-awards-5) add `leaf="paper"` (a curling leaf), `turnMs` and `board`; the defaults are demo 1's. */
import * as React from "react"
import { CoverFace, ENDPAPER, FOLD, SpreadArt, TitlePage } from "./art"
import { SPREAD_R, src, viewLabel, viewsOf, type SiteBook } from "./data"

export type ReaderApi = { go: (d: number) => void }
type Turn = { a: number; th: number; kind: "anim" | "drag" | "lift" }

const BD = 5
const SHADOW_DARK = "0 2px 4px rgb(0 0 0/.3), 0 34px 60px -22px rgb(0 0 0/.65)"
const EDGE = "repeating-linear-gradient(90deg,#FBFAF7 0 1px,#D9D4CA 1px 2px)"
/** CSS cubic-bezier(x1, y1, x2, y2) as t → progress */
const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const X = (u: number) => ((ax * u + bx) * u + cx) * u, dX = (u: number) => (3 * ax * u + 2 * bx) * u + cx
  return (t: number) => {
    let u = t
    for (let i = 0; i < 8; i++) { const e = X(u) - t, d = dX(u); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; u = Math.min(1, Math.max(0, u - e / d)) }
    return ((ay * u + by) * u + cy) * u
  }
}
const TURN = bezier(0.45, 0.05, 0.25, 1)
const EASE = bezier(0.2, 0.7, 0.2, 1)
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const decoded = new Set<string>()
const photosOf = (b: SiteBook, v: number) => (v >= 2 && v - 2 < b.spreads.length ? b.spreads[v - 2].photos.map(src) : [])

/** One page face of view v: the left or right half of its spread, the endpaper or the title page. */
function Face({ b, v, side, W, H }: { b: SiteBook; v: number; side: "L" | "R"; W: number; H: number }) {
  const pw = W / 2
  if (v === 1) return side === "L" ? <div className="absolute inset-0" style={{ background: ENDPAPER }} /> : <TitlePage b={b} h={H} />
  const k = v - 1
  if (k < 1 || k > b.spreads.length) return null
  if (side === "R" && b.spreads[k - 1].template === "last") return <div className="absolute inset-0" style={{ background: ENDPAPER }} />
  return <div className="absolute top-0" style={{ left: side === "L" ? 0 : -pw }}><SpreadArt b={b} k={k} w={W} fold={false} /></div>
}

const FaceM = React.memo(Face)

type Geo = { b: SiteBook; W: number; H: number; pw: number; n: number; shadow: string; board: string; paper: boolean }
const readOf = (g: Geo, v: number) => clamp((v - 1) / (g.n - 3), 0, 1)

/** The book at rest on view v (no leaf). */
function StaticBook({ g, v, vt }: { g: Geo; v: number; vt?: boolean }) {
  const { b, W, H, pw, n, shadow } = g
  const r = readOf(g, v), eL = 2 + 6 * r, eR = 2 + 6 * (1 - r)
  const board = (left: boolean, e: number) => <div style={{ left: left ? -BD - e : pw, top: -BD, width: pw + BD + e, height: H + 2 * BD, background: g.board, borderRadius: left ? "3px 0 0 3px" : "0 3px 3px 0", boxShadow: shadow }} />
  if (v === 0) return (
    <div className="sd-rbook" style={{ width: W, height: H, transform: `translateX(${-pw / 2}px)` }}>
      {board(false, 8)}
      <div className="sd-edge" style={{ left: W, top: 2, width: 8, height: H - 4 }} />
      <div style={{ left: pw, top: -BD, width: pw + BD, height: H + 2 * BD, borderRadius: "1px 3px 3px 1px", overflow: "hidden", viewTransitionName: vt ? "site-book" : undefined }}><CoverFace b={b} w={pw + BD} h={H + 2 * BD} /></div>
    </div>
  )
  if (v === n - 1) return (
    <div className="sd-rbook" style={{ width: W, height: H, transform: `translateX(${pw / 2}px)` }}>
      {board(true, 8)}
      <div className="sd-edge" style={{ left: -8, top: 2, width: 8, height: H - 4 }} />
      <div style={{ left: -BD, top: -BD, width: pw + BD, height: H + 2 * BD, background: `linear-gradient(270deg, rgb(0 0 0/.18), rgb(0 0 0/0) 6%), ${g.board}`, borderRadius: "3px 1px 1px 3px" }} />
    </div>
  )
  return (
    <div className="sd-rbook" style={{ width: W, height: H }}>
      {board(true, eL)}{board(false, eR)}
      <div className="sd-edge" style={{ left: -eL, top: 2, width: eL, height: H - 4 }} />
      <div className="sd-edge" style={{ left: W, top: 2, width: eR, height: H - 4 }} />
      <div className="sd-pg" style={{ left: 0, top: 0, width: pw, height: H }}><Face b={b} v={v} side="L" W={W} H={H} /></div>
      <div className="sd-pg" style={{ left: pw, top: 0, width: pw, height: H }}><Face b={b} v={v} side="R" W={W} H={H} /></div>
      <div className="pointer-events-none" style={{ left: pw - W * 0.015, top: 0, width: W * 0.03, height: H, background: FOLD }} />
    </div>
  )
}

/** The book between views a and a + 1 with the leaf at angle th (0 = view a, 180 = view a + 1). */
function TurningBook({ g, a, th }: { g: Geo; a: number; th: number }) {
  const { b, W, H, pw, n, shadow } = g
  const opening = a === 0, closing = a === n - 2
  const s = Math.sin((th * Math.PI) / 180), f = th / 180
  const r = readOf(g, a) + (readOf(g, a + 1) - readOf(g, a)) * f, eL = 2 + 6 * r, eR = 2 + 6 * (1 - r)
  const tx = opening ? -(pw / 2) * (1 - f) : closing ? (pw / 2) * f : 0
  const frontShade = `linear-gradient(90deg, rgb(0 0 0/${0.22 * s}), rgb(0 0 0/${0.06 * s}) 35%, rgb(0 0 0/0) 70%), rgb(0 0 0/${th < 90 ? (0.28 * th) / 90 : 0})`
  const backShade = `linear-gradient(270deg, rgb(0 0 0/${0.2 * s}), rgb(0 0 0/0) 40%), rgb(0 0 0/${th > 90 ? (0.3 * (180 - th)) / 90 : 0})`
  const boardLeaf = opening || closing
  const leafBox = boardLeaf ? { left: pw, top: -BD, width: pw + BD, height: H + 2 * BD } : { left: pw, top: 0, width: pw, height: H }
  const endpaper = (inset: React.CSSProperties) => <div className="absolute" style={{ ...inset, background: ENDPAPER }} />
  const front = opening ? <CoverFace b={b} w={pw + BD} h={H + 2 * BD} /> : closing ? endpaper({ left: 0, top: BD, right: BD, bottom: BD }) : <Face b={b} v={a} side="R" W={W} H={H} />
  const back = opening ? endpaper({ left: BD, top: BD, right: 0, bottom: BD }) : closing ? null : <Face b={b} v={a + 1} side="L" W={W} H={H} />
  const castR = pw * (0.12 + 0.55 * (1 - f)), castL = (0.35 * pw * (th - 90)) / 90
  return (
    <div className="sd-rbook" style={{ width: W, height: H, transform: `translateX(${tx}px)` }}>
      {!opening && <div style={{ left: -BD - eL, top: -BD, width: pw + BD + eL, height: H + 2 * BD, background: g.board, borderRadius: "3px 0 0 3px", boxShadow: shadow }} />}
      {!closing && <div style={{ left: pw, top: -BD, width: pw + BD + eR, height: H + 2 * BD, background: g.board, borderRadius: "0 3px 3px 0", boxShadow: shadow }} />}
      {!opening && <div className="sd-edge" style={{ left: -eL, top: 2, width: eL, height: H - 4 }} />}
      {!closing && <div className="sd-edge" style={{ left: W, top: 2, width: eR, height: H - 4 }} />}
      {!opening && <div className="sd-pg" style={{ left: 0, top: 0, width: pw, height: H }}><Face b={b} v={a} side="L" W={W} H={H} /></div>}
      {!closing && <div className="sd-pg" style={{ left: pw, top: 0, width: pw, height: H }}><Face b={b} v={a + 1} side="R" W={W} H={H} /></div>}
      {!opening && !closing && <div className="pointer-events-none" style={{ left: pw - W * 0.015, top: 0, width: W * 0.03, height: H, background: FOLD, transform: "translateZ(.5px)" }} />}
      {!closing && th > 0 && th < 178 && <div className="pointer-events-none" style={{ left: pw, top: 0, width: castR, height: H, background: `linear-gradient(90deg, rgb(0 0 0/${0.34 * s}), rgb(0 0 0/0))`, transform: "translateZ(.3px)" }} />}
      {!opening && th > 92 && <div className="pointer-events-none" style={{ left: pw - castL, top: 0, width: castL, height: H, background: `linear-gradient(270deg, rgb(0 0 0/${0.26 * s}), rgb(0 0 0/0))`, transform: "translateZ(.3px)" }} />}
      {g.paper && !boardLeaf ? <PaperLeaf g={g} a={a} th={th} /> : (
        <div className="sd-leaf" style={{ ...leafBox, transform: `translateZ(1px) rotateY(${-th}deg)`, willChange: "transform" }} data-testid="ps-leaf">
          <div className="sd-face" style={{ background: boardLeaf ? g.board : undefined, borderRadius: boardLeaf ? "0 3px 3px 0" : undefined }}>{front}<div className="absolute inset-0" style={{ background: frontShade }} /></div>
          <div className="sd-face sd-back" style={{ background: boardLeaf ? g.board : undefined, borderRadius: boardLeaf ? "0 3px 3px 0" : undefined }}>{back}<div className="absolute inset-0" style={{ background: backShade }} /></div>
        </div>
      )}
    </div>
  )
}

/** The paper leaf (Spec site-awards-5): 12 nested strips, each bent 7°·sin θ·i/12 past the one before, so the free edge
   leads mid-turn and the leaf lies flat at 0 and 180. Shading is flat per strip (no seams); the cast shadows stay the board's. */
const STRIPS = 12
const STRIP_FACE: React.CSSProperties = { position: "absolute", inset: 0, backfaceVisibility: "hidden", overflow: "hidden", background: "var(--site-paper)" }
function PaperLeaf({ g, a, th }: { g: Geo; a: number; th: number }) {
  const { b, W, H, pw } = g
  const sw = pw / STRIPS, s = Math.sin((th * Math.PI) / 180)
  const bend = (i: number) => 7 * s * (i / STRIPS)
  const angs: number[] = []
  let tot = 0
  for (let i = 1; i < STRIPS; i++) tot += bend(i)
  for (let i = 0, x = th - tot / 2; i < STRIPS; i++) { if (i) x += bend(i); angs.push(x) }
  let inner: React.ReactNode = null
  for (let i = STRIPS - 1; i >= 0; i--) {
    const al = angs[i], fa = al < 90 ? (0.3 * al) / 90 : 0, ba = al > 90 ? (0.3 * (180 - al)) / 90 : 0, hi = 0.1 * s * Math.sin((Math.PI * i) / STRIPS)
    inner = (
      <div style={{ position: "absolute", left: i === 0 ? pw : sw, top: 0, width: sw + 1.5, height: H, transformStyle: "preserve-3d", transformOrigin: "left center", transform: `${i === 0 ? "translateZ(1px) " : ""}rotateY(${-(i === 0 ? al : bend(i))}deg)` }} data-testid={i === 0 ? "ps-leaf" : undefined}>
        <div style={STRIP_FACE}>
          <div className="absolute top-0" style={{ left: -i * sw, width: pw, height: H }}><FaceM b={b} v={a} side="R" W={W} H={H} /></div>
          <div className="absolute inset-0" style={{ background: `rgb(255 255 255/${hi})`, boxShadow: `inset 0 0 0 999px rgb(0 0 0/${fa})` }} />
        </div>
        <div style={{ ...STRIP_FACE, transform: "rotateY(180deg)" }}>
          <div className="absolute top-0" style={{ left: (i + 1) * sw - pw, width: pw, height: H }}><FaceM b={b} v={a + 1} side="L" W={W} H={H} /></div>
          <div className="absolute inset-0" style={{ background: `rgb(0 0 0/${ba})` }} />
        </div>
        {inner}
      </div>
    )
  }
  return inner
}

type ReaderProps = {
  b: SiteBook; view: number; onView: (v: number) => void; width: number; dark?: boolean; keys?: boolean; vt?: boolean
  /** "paper" (Spec site-awards-5): interior leaves curl as 12 strips; the cover and back board stay rigid */
  leaf?: "board" | "paper"
  /** one interior leaf, ms (the cover / back board stay 1000) */
  turnMs?: number
  /** board (cloth) colour, default the spine */
  board?: string
}

export const BookReader = React.forwardRef<ReaderApi, ReaderProps>(
  function BookReader({ b, view, onView, width: W, dark, keys = true, vt, leaf = "board", turnMs = 800, board = b.spine }, apiRef) {
    const n = viewsOf(b)
    const H = W / SPREAD_R[b.fmt], pw = W / 2
    const g: Geo = { b, W, H, pw, n, shadow: dark ? SHADOW_DARK : "var(--site-shadow-book)", board, paper: leaf === "paper" }
    const el = React.useRef<HTMLDivElement>(null)
    const [shown, setShown] = React.useState(view)
    const [turn, setTurnS] = React.useState<Turn | null>(null)
    const [fade, setFade] = React.useState<{ from: number; ms: number; id: number } | null>(null)
    const turnRef = React.useRef<Turn | null>(null)
    const setTurn = (t: Turn | null) => { turnRef.current = t; setTurnS(t) }
    const raf = React.useRef(0)
    const pending = React.useRef<number | null>(null)
    const live = React.useRef({ view, shown, onView })
    live.current = { view, shown, onView }
    const busy = turn !== null && turn.kind !== "lift"

    const run = (a: number, th0: number, th1: number, ms: number, ease: (t: number) => number, kind: Turn["kind"], done?: () => void) => {
      cancelAnimationFrame(raf.current)
      setTurn({ a, th: th0, kind }) // busy from now, so a press before the first frame is queued
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms)
        setTurn({ a, th: th0 + (th1 - th0) * ease(p), kind })
        if (p < 1) raf.current = requestAnimationFrame(step)
        else done?.()
      }
      raf.current = requestAnimationFrame(step)
    }
    React.useEffect(() => () => cancelAnimationFrame(raf.current), [])
    /** a finished turn lands on view v; a queued press runs next */
    const land = (v: number) => {
      setTurn(null); setShown(v)
      const d = pending.current; pending.current = null
      if (live.current.view !== v) return
      if (d !== null) { const t = clamp(v + d, 0, n - 1); if (t !== v) live.current.onView(t) }
    }
    const stop = () => { cancelAnimationFrame(raf.current); setTurn(null) }
    const request = React.useCallback((d: number) => {
      const { view: v, onView: go } = live.current
      if (turnRef.current && turnRef.current.kind !== "lift") { if (pending.current === null) pending.current = d; return }
      const t = clamp(v + d, 0, n - 1)
      if (t !== v) go(t)
    }, [n])
    React.useImperativeHandle(apiRef, () => ({ go: request }), [request])

    // follow `view`: ±1 turns a leaf, bigger jumps crossfade; reduced motion crossfades every change
    React.useEffect(() => {
      if (busy || view === shown) return
      if (reduced()) { stop(); setFade({ from: shown, ms: 160, id: performance.now() }); setShown(view); return }
      if (Math.abs(view - shown) > 1) { stop(); setFade({ from: shown, ms: 240, id: performance.now() }); setShown(view); return }
      const fwd = view > shown, a = Math.min(view, shown)
      const lift = turnRef.current
      const th0 = lift && lift.a === a ? lift.th : fwd ? 0 : 180, th1 = fwd ? 180 : 0
      const full = a === 0 || a === n - 2 ? 1000 : turnMs
      run(a, th0, th1, Math.max(200, (full * Math.abs(th1 - th0)) / 180), TURN, "anim", () => land(view))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, shown, busy])

    // preload + decode the photos two views either side
    React.useEffect(() => {
      for (const v of [shown - 2, shown - 1, shown + 1, shown + 2]) for (const u of photosOf(b, v)) {
        if (decoded.has(u)) continue
        decoded.add(u); const img = new Image(); img.src = u; void img.decode().catch(() => {})
      }
    }, [b, shown])

    // keys while the reader is at least half in view
    const inView = React.useRef(false)
    React.useEffect(() => {
      const e = el.current; if (!e) return
      const io = new IntersectionObserver(([x]) => { inView.current = x.intersectionRatio >= 0.5 }, { threshold: [0, 0.5, 1] })
      io.observe(e); return () => io.disconnect()
    }, [])
    React.useEffect(() => {
      if (!keys) return
      const k = (e: KeyboardEvent) => {
        if (!inView.current || e.altKey || e.ctrlKey || e.metaKey) return
        const t = e.target as HTMLElement | null
        if (t?.closest?.("input,textarea,select,[contenteditable]")) return
        const d = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[e.key]
        if (d) { e.preventDefault(); request(d); return }
        if (e.key === "Home") { e.preventDefault(); live.current.onView(0) }
        if (e.key === "End") { e.preventDefault(); live.current.onView(n - 2) }
      }
      window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
    }, [keys, n, request])

    // pointer: click a half, drag a page (6 px threshold), corner lift
    const ptr = React.useRef<{ id: number; x0: number; y0: number; side: "L" | "R"; a: number; drag: boolean; lx: number; lt: number; vx: number } | null>(null)
    const geo = () => { const r = el.current!.getBoundingClientRect(); const k = r.width / W; return { r, k, spine: r.left + pw * k } }
    const canDrag = (side: "L" | "R") => !reduced() && (side === "R" ? shown >= 1 && shown <= n - 3 : shown >= 2 && shown <= n - 2)
    const thAt = (x: number) => { const { k, spine } = geo(); return (Math.acos(clamp((x - spine) / (pw * k), -1, 1)) * 180) / Math.PI }
    const sideAt = (x: number) => (x < geo().spine ? "L" : "R")
    const cursorAt = (x: number) => (shown === 0 ? "Open" : shown === n - 1 ? "←" : sideAt(x) === "R" ? "→" : "←")
    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const side = sideAt(e.clientX)
      ptr.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, side, a: side === "R" ? shown : shown - 1, drag: false, lx: e.clientX, lt: e.timeStamp, vx: 0 }
    }
    const onPointerMove = (e: React.PointerEvent) => {
      el.current?.setAttribute("data-cursor", cursorAt(e.clientX))
      const p = ptr.current
      if (p && p.id === e.pointerId) {
        if (!p.drag && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 6 && canDrag(p.side) && !busy) {
          p.drag = true; cancelAnimationFrame(raf.current); el.current?.setPointerCapture(e.pointerId)
        }
        if (p.drag) {
          const dt = e.timeStamp - p.lt; if (dt > 0) p.vx = (e.clientX - p.lx) / dt
          p.lx = e.clientX; p.lt = e.timeStamp
          setTurn({ a: p.a, th: thAt(e.clientX), kind: "drag" })
        }
        return
      }
      // corner lift: the outer 64 px of a page
      if (e.pointerType !== "mouse" || !fine() || reduced() || busy) return
      const { r, k } = geo(), x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k
      const inY = y >= 0 && y <= H
      const want = inY && x > W - 64 && x <= W + 8 && canDrag("R") ? { a: shown, th: 10 } : inY && x < 64 && x >= -8 && canDrag("L") ? { a: shown - 1, th: 170 } : null
      const cur = turnRef.current
      if (want && (!cur || cur.a !== want.a)) run(want.a, cur?.a === want.a ? cur.th : want.th === 10 ? 0 : 180, want.th, 240, EASE, "lift")
      if (!want && cur?.kind === "lift") unlift()
    }
    const unlift = () => {
      const cur = turnRef.current; if (!cur || cur.kind !== "lift") return
      const to = cur.a === shown ? 0 : 180
      run(cur.a, cur.th, to, 240, EASE, "lift", () => setTurn(null))
    }
    const onPointerUp = (e: React.PointerEvent) => {
      const p = ptr.current; ptr.current = null
      if (!p || p.id !== e.pointerId) return
      if (!p.drag) {
        // closed: only the book itself (centred, one page wide) opens it
        const { r, k } = geo(), x = (e.clientX - r.left) / k, onBook = x >= pw / 2 - BD && x <= (3 * pw) / 2 + BD
        if (shown === 0) { if (onBook) request(1) }
        else if (shown === n - 1) { if (onBook) request(-1) }
        else request(p.side === "R" ? 1 : -1)
        return
      }
      const th = turnRef.current?.th ?? 0
      const fwd = p.side === "R"
      if (e.timeStamp - p.lt > 100) p.vx = 0 // the pointer rested before release: no fling
      const done = fwd ? th > 90 || p.vx < -0.5 : th < 90 || p.vx > 0.5
      const to = fwd === done ? 180 : 0
      const target = done ? (fwd ? shown + 1 : shown - 1) : shown
      run(p.a, th, to, Math.max(200, (turnMs * Math.abs(to - th)) / 180), EASE, "anim", () => {
        if (target !== shown) { onView(target); live.current = { ...live.current, view: target } }
        land(target)
      })
    }
    const onPointerLeave = () => { if (!ptr.current) unlift() }
    // the cursor label (site Cursor) reads data-cursor; set only here and on pointer moves
    React.useEffect(() => { el.current?.setAttribute("data-cursor", shown === 0 ? "Open" : shown === n - 1 ? "←" : "→") }, [shown, n])

    const label = viewLabel(b, shown)
    return (
      <div ref={el} className={dark ? "sd-reader sd-dark" : "sd-reader"} style={{ width: W, height: H, perspective: `${Math.round(W * 2.9)}px` }}
        role="region" aria-roledescription="book" aria-label={b.title} tabIndex={0} data-testid="ps-reader" data-view={shown}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { ptr.current = null; setTurn(null) }} onPointerLeave={onPointerLeave}>
        {turn ? <TurningBook g={g} a={turn.a} th={turn.th} /> : <StaticBook g={g} v={shown} vt={vt} />}
        {fade && <div key={fade.id} className="sd-fade" style={{ "--fd": `${fade.ms}ms` } as React.CSSProperties} onAnimationEnd={() => setFade(null)}><StaticBook g={g} v={fade.from} /></div>}
        <div className="sr-only" aria-live="polite" data-testid="ps-reader-live">{label}</div>
      </div>
    )
  },
)

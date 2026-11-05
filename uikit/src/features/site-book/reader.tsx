/* BookReader (Spec site-awards): a controlled book that opens its cover and turns its pages around the spine.
   Views: 0 closed front cover · 1 endpaper | page 1 · 2… the spreads (the last: last page | endpaper) · last: closed back.
   A ±1 change of `view` turns a leaf (820 ms, the cover / back board 1000 ms); bigger jumps crossfade 240 ms; reduced
   motion crossfades every change in 160 ms. Click a half, ← / →, or drag a page; the corner lifts under a fine pointer.
   Spec site-stand S2–S4: the open book shows its thickness (boards, page-block side edges, tail strip, gutter), every
   page is photo paper (paper.ts), interior leaves curl (`leaf="paper"`, the default; covers stay rigid).
   Demos 2–5 (Spec site-awards-5) add `turnMs`, `board` and `scrub` (the page follows the scroll), demo 4 `corner`,
   demo 5 `api.riffle`. */
import * as React from "react"
import { CoverFace, ENDPAPER, SpreadArt, TitlePage } from "../site-demo-1/art"
import { pagesOf, SPREAD_R, src, viewLabel, viewsOf, type SiteBook } from "../site-demo-1/data"
import { paperLayers } from "./paper"
import "./reader.css"

/** `riffle(target, ms)` turns one leaf after another toward `target`, `ms` (default `turnMs`) each with an ease-out; a new
   target replaces the old one and a ← / → press ends it; reduced motion crossfades straight to `target` */
export type ReaderApi = { go: (d: number) => void; riffle: (target: number, ms?: number) => void }
type Turn = { a: number; th: number; kind: "anim" | "drag" | "lift" }

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
const OUT = bezier(0, 0, 0.58, 1)
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

/** Photo paper over a face (S3): grain + sheen above the content; `x` / `w` place the page under a paper-leaf strip */
function Paper({ x, w }: { x?: number; w?: number }) {
  const [grain, sheen] = paperLayers(x, w)
  return <><div style={grain} /><div style={sheen} /></>
}

/** Board (cloth) BD, page-block side edge eMax and tail strip tE, px (S2) */
type Geo = { b: SiteBook; W: number; H: number; pw: number; n: number; board: string; paper: boolean; BD: number; eMax: number; tE: number }
/** the closed Book3D's thickness at s px/cm (book3d.tsx `thick()`) */
const thick = (b: SiteBook, s: number) => Math.max(12, (0.6 + (pagesOf(b) / 2) * 0.1) * s)
function geoOf(b: SiteBook, W: number, H: number, n: number, board: string, paper: boolean): Geo {
  const sr = W / (2 * b.w), BD = clamp(0.3 * sr, 3, 8)
  const eMax = clamp(0.45 * (thick(b, sr) - 2 * 0.25 * sr), 3, 14)
  return { b, W, H, pw: W / 2, n, board, paper, BD, eMax, tE: clamp(0.35 * eMax, 2, 5) }
}
const readOf = (g: Geo, v: number) => clamp((v - 1) / (g.n - 3), 0, 1)
/** the page-block side edges at read fraction r: the read pages pile up on the left */
const edgesOf = (g: Geo, r: number) => [1 + (g.eMax - 1) * r, 1 + (g.eMax - 1) * (1 - r)]

/** A board (S2): reaches tE below the page block, its bottom BD + 1 px darker; the book shadow comes from reader.css. */
function Board({ g, left, x, w, radius }: { g: Geo; left?: boolean; x: number; w: number; radius?: string }) {
  const { H, BD, tE, board } = g
  const bottom = `linear-gradient(0deg, color-mix(in srgb, ${board} 85%, #000) 0 ${BD + 1}px, transparent ${BD + 1}px)`
  return <div className="sd-board" style={{ left: x, top: -BD, width: w, height: H + 2 * BD + tE, background: `${bottom}, ${board}`, borderRadius: radius ?? (left ? "3px 0 0 3px" : "0 3px 3px 0") }} />
}
/** A page-block side edge e px wide (S2), shaded darker outward */
function Edge({ g, left, e }: { g: Geo; left: boolean; e: number }) {
  return <div className="sd-edge" style={{ left: left ? -e : g.W, top: 1, width: e, height: g.H - 1, boxShadow: `inset ${left ? e : -e}px 0 ${e}px ${-e}px rgb(0 0 0/.12)` }} />
}
/** The tail strip (S2): the page block's thickness under the pages, both edges included */
function Tail({ g, eL, eR }: { g: Geo; eL: number; eR: number }) {
  const { W, H, tE } = g
  return <div className="sd-tail" style={{ left: -eL, top: H, width: W + eL + eR, height: tE, boxShadow: `inset 0 ${-tE}px ${tE}px ${-tE}px rgb(0 0 0/.15)` }} />
}
/** The reader gutter (S2): 8 % of W centred on the spine */
const Gutter = ({ g, z }: { g: Geo; z?: boolean }) => (
  <div className="sd-gutter" style={{ left: g.pw - g.W * 0.04, top: 0, width: g.W * 0.08, height: g.H, transform: z ? "translateZ(.5px)" : undefined }} />
)

/** The book at rest on view v (no leaf). */
function StaticBook({ g, v, vt }: { g: Geo; v: number; vt?: boolean }) {
  const { b, W, H, pw, n, BD, eMax } = g
  const [eL, eR] = edgesOf(g, readOf(g, v))
  if (v === 0) return (
    <div className="sd-rbook" style={{ width: W, height: H, transform: `translateX(${-pw / 2}px)` }}>
      <Board g={g} x={pw} w={pw + BD + eMax} />
      <Edge g={g} left={false} e={eMax} />
      <div style={{ left: pw, top: -BD, width: pw + BD, height: H + 2 * BD, borderRadius: "1px 3px 3px 1px", overflow: "hidden", viewTransitionName: vt ? "site-book" : undefined }}><CoverFace b={b} w={pw + BD} h={H + 2 * BD} /></div>
    </div>
  )
  if (v === n - 1) return (
    <div className="sd-rbook" style={{ width: W, height: H, transform: `translateX(${pw / 2}px)` }}>
      <Board g={g} left x={-BD - eMax} w={pw + BD + eMax} />
      <Edge g={g} left e={eMax} />
      <div style={{ left: -BD, top: -BD, width: pw + BD, height: H + 2 * BD, background: `linear-gradient(270deg, rgb(0 0 0/.18), rgb(0 0 0/0) 6%), ${g.board}`, borderRadius: "3px 1px 1px 3px" }} />
    </div>
  )
  return (
    <div className="sd-rbook" style={{ width: W, height: H }}>
      <Board g={g} left x={-BD - eL} w={pw + BD + eL} /><Board g={g} x={pw} w={pw + BD + eR} />
      <Edge g={g} left e={eL} /><Edge g={g} left={false} e={eR} />
      <Tail g={g} eL={eL} eR={eR} />
      <div className="sd-pg" style={{ left: 0, top: 0, width: pw, height: H }}><Face b={b} v={v} side="L" W={W} H={H} /><Paper /></div>
      <div className="sd-pg" style={{ left: pw, top: 0, width: pw, height: H }}><Face b={b} v={v} side="R" W={W} H={H} /><Paper /></div>
      <Gutter g={g} />
    </div>
  )
}

/** The book between views a and a + 1 with the leaf at angle th (0 = view a, 180 = view a + 1). */
function TurningBook({ g, a, th }: { g: Geo; a: number; th: number }) {
  const { b, W, H, pw, n, BD } = g
  const opening = a === 0, closing = a === n - 2
  const s = Math.sin((th * Math.PI) / 180), f = th / 180
  const [eL, eR] = edgesOf(g, readOf(g, a) + (readOf(g, a + 1) - readOf(g, a)) * f)
  const tx = opening ? -(pw / 2) * (1 - f) : closing ? (pw / 2) * f : 0
  const frontShade = `linear-gradient(90deg, rgb(0 0 0/${0.22 * s}), rgb(0 0 0/${0.06 * s}) 35%, rgb(0 0 0/0) 70%), rgb(0 0 0/${th < 90 ? (0.28 * th) / 90 : 0})`
  const backShade = `linear-gradient(270deg, rgb(0 0 0/${0.2 * s}), rgb(0 0 0/0) 40%), rgb(0 0 0/${th > 90 ? (0.3 * (180 - th)) / 90 : 0})`
  const boardLeaf = opening || closing
  const leafBox = boardLeaf ? { left: pw, top: -BD, width: pw + BD, height: H + 2 * BD } : { left: pw, top: 0, width: pw, height: H }
  // the endpaper inside a board is paper too; the cover face is not
  const endpaper = (inset: React.CSSProperties) => <div className="absolute" style={{ ...inset, background: ENDPAPER }}><Paper /></div>
  const page = (v: number, side: "L" | "R") => <><Face b={b} v={v} side={side} W={W} H={H} /><Paper /></>
  const front = opening ? <CoverFace b={b} w={pw + BD} h={H + 2 * BD} /> : closing ? endpaper({ left: 0, top: BD, right: BD, bottom: BD }) : page(a, "R")
  const back = opening ? endpaper({ left: BD, top: BD, right: 0, bottom: BD }) : closing ? null : page(a + 1, "L")
  const castR = pw * (0.12 + 0.55 * (1 - f)), castL = (0.35 * pw * (th - 90)) / 90
  return (
    <div className="sd-rbook" style={{ width: W, height: H, transform: `translateX(${tx}px)` }}>
      {!opening && <Board g={g} left x={-BD - eL} w={pw + BD + eL} />}
      {!closing && <Board g={g} x={pw} w={pw + BD + eR} />}
      {!opening && <Edge g={g} left e={eL} />}
      {!closing && <Edge g={g} left={false} e={eR} />}
      {!opening && !closing && <Tail g={g} eL={eL} eR={eR} />}
      {!opening && <div className="sd-pg" style={{ left: 0, top: 0, width: pw, height: H }}>{page(a, "L")}</div>}
      {!closing && <div className="sd-pg" style={{ left: pw, top: 0, width: pw, height: H }}>{page(a + 1, "R")}</div>}
      {!opening && !closing && <Gutter g={g} z />}
      {!closing && th > 0 && th < 178 && <div className="pointer-events-none" style={{ left: pw, top: 0, width: castR, height: H, background: `linear-gradient(90deg, rgb(0 0 0/${0.34 * s}), rgb(0 0 0/0))`, transform: "translateZ(.3px)" }} />}
      {!opening && th > 92 && <div className="pointer-events-none" style={{ left: pw - castL, top: 0, width: castL, height: H, background: `linear-gradient(270deg, rgb(0 0 0/${0.26 * s}), rgb(0 0 0/0))`, transform: "translateZ(.3px)" }} />}
      {g.paper && !boardLeaf ? <PaperLeaf g={g} a={a} th={th} /> : (
        <div className="sd-leaf" style={{ ...leafBox, transform: `translateZ(1px) rotateY(${-th}deg)`, willChange: "transform" }} data-testid="ps-leaf" data-leaf="board">
          <div className="sd-face" style={{ background: boardLeaf ? g.board : undefined, borderRadius: boardLeaf ? "0 3px 3px 0" : undefined }}>{front}<div className="absolute inset-0" style={{ background: frontShade }} /></div>
          <div className="sd-face sd-back" style={{ background: boardLeaf ? g.board : undefined, borderRadius: boardLeaf ? "0 3px 3px 0" : undefined }}>{back}<div className="absolute inset-0" style={{ background: backShade }} /></div>
        </div>
      )}
    </div>
  )
}

/** The paper leaf (Spec site-awards-5, site-stand S4): 12 nested strips, each bent 10°·sin θ·i/12 past the one before, so
   the free edge leads mid-turn and the leaf lies flat at 0 and 180. Shading is flat per strip (no seams); the cast shadows
   stay the board's. The spine strip and the outer (free-edge) strip carry `ps-leaf`. */
const STRIPS = 12
const STRIP_FACE: React.CSSProperties = { position: "absolute", inset: 0, backfaceVisibility: "hidden", overflow: "hidden", background: "var(--site-paper)" }
function PaperLeaf({ g, a, th }: { g: Geo; a: number; th: number }) {
  const { b, W, H, pw } = g
  const sw = pw / STRIPS, s = Math.sin((th * Math.PI) / 180)
  const bend = (i: number) => 10 * s * (i / STRIPS)
  const angs: number[] = []
  let tot = 0
  for (let i = 1; i < STRIPS; i++) tot += bend(i)
  for (let i = 0, x = th - tot / 2; i < STRIPS; i++) { if (i) x += bend(i); angs.push(x) }
  let inner: React.ReactNode = null
  for (let i = STRIPS - 1; i >= 0; i--) {
    const al = angs[i], fa = al < 90 ? (0.34 * al) / 90 : 0, ba = al > 90 ? (0.3 * (180 - al)) / 90 : 0, hi = 0.16 * s * Math.sin((Math.PI * i) / STRIPS)
    inner = (
      <div style={{ position: "absolute", left: i === 0 ? pw : sw, top: 0, width: sw + 1.5, height: H, transformStyle: "preserve-3d", transformOrigin: "left center", transform: `${i === 0 ? "translateZ(1px) " : ""}rotateY(${-(i === 0 ? al : bend(i))}deg)` }} data-testid={i === 0 || i === STRIPS - 1 ? "ps-leaf" : undefined} data-leaf={i === 0 ? "paper" : undefined}>
        <div style={STRIP_FACE}>
          <div className="absolute top-0" style={{ left: -i * sw, width: pw, height: H }}><FaceM b={b} v={a} side="R" W={W} H={H} /></div>
          <Paper x={-i * sw} w={pw} />
          <div className="absolute inset-0" style={{ background: `rgb(255 255 255/${hi})`, boxShadow: `inset 0 0 0 999px rgb(0 0 0/${fa})` }} />
        </div>
        <div style={{ ...STRIP_FACE, transform: "rotateY(180deg)" }}>
          <div className="absolute top-0" style={{ left: (i + 1) * sw - pw, width: pw, height: H }}><FaceM b={b} v={a + 1} side="L" W={W} H={H} /></div>
          <Paper x={(i + 1) * sw - pw} w={pw} />
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
  /** "paper" (default, Spec site-stand S4): interior leaves curl as 12 strips; "board": rigid layflat leaves (demo 1). The
     cover and back board stay rigid either way */
  leaf?: "board" | "paper"
  /** one interior leaf, ms, default 820 (the cover / back board stay 1000) */
  turnMs?: number
  /** board (cloth) colour, default the spine */
  board?: string
  /** scroll position in views (Spec site-awards-5): draws view floor(scrub) with θ = smoothstep(frac)·180; no animation,
     no pointer or keys, and `onView` is not called */
  scrub?: number
  /** the outer band of a page where the corner lifts under a fine pointer, px (demo 4: 80) */
  corner?: number
}

export const BookReader = React.forwardRef<ReaderApi, ReaderProps>(
  function BookReader({ b, view, onView, width: W, dark, keys = true, vt, leaf = "paper", turnMs = 820, board = b.spine, scrub, corner = 64 }, apiRef) {
    const n = viewsOf(b)
    const sc = scrub === undefined ? null : clamp(scrub, 0, n - 1)
    const sa = sc === null ? 0 : Math.min(Math.floor(sc), n - 2), sf = sc === null ? 0 : sc - sa
    const sth = sf * sf * (3 - 2 * sf) * 180
    const H = W / SPREAD_R[b.fmt], pw = W / 2
    const g = geoOf(b, W, H, n, board, leaf === "paper")
    const el = React.useRef<HTMLDivElement>(null)
    const [shown, setShown] = React.useState(view)
    const [turn, setTurnS] = React.useState<Turn | null>(null)
    const [fade, setFade] = React.useState<{ from: number; ms: number; id: number } | null>(null)
    const turnRef = React.useRef<Turn | null>(null)
    const setTurn = (t: Turn | null) => { turnRef.current = t; setTurnS(t) }
    const raf = React.useRef(0)
    const pending = React.useRef<number | null>(null)
    const riffleRef = React.useRef<{ target: number; ms: number } | null>(null)
    const live = React.useRef({ view, shown, onView, turnMs })
    live.current = { view, shown, onView, turnMs }
    const busy = turn !== null && turn.kind !== "lift"
    /** the view on screen: a scrubbed leaf past 90° shows the next one */
    const at = sc === null ? shown : sth >= 90 ? sa + 1 : sa

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
      const r = riffleRef.current
      if (r) { if (r.target === v) riffleRef.current = null; else live.current.onView(v + Math.sign(r.target - v)); return }
      if (d !== null) { const t = clamp(v + d, 0, n - 1); if (t !== v) live.current.onView(t) }
    }
    const stop = () => { cancelAnimationFrame(raf.current); setTurn(null) }
    const request = React.useCallback((d: number) => {
      const { view: v, onView: go } = live.current
      riffleRef.current = null
      if (turnRef.current && turnRef.current.kind !== "lift") { if (pending.current === null) pending.current = d; return }
      const t = clamp(v + d, 0, n - 1)
      if (t !== v) go(t)
    }, [n])
    const riffle = React.useCallback((target: number, ms?: number) => {
      const t = clamp(Math.round(target), 0, n - 1), { view: v, onView: go } = live.current
      pending.current = null
      if (reduced()) { riffleRef.current = null; if (t !== v) go(t); return }
      riffleRef.current = t === v ? null : { target: t, ms: ms ?? live.current.turnMs }
      if (t !== v && !(turnRef.current && turnRef.current.kind !== "lift")) go(v + Math.sign(t - v))
    }, [n])
    React.useImperativeHandle(apiRef, () => ({ go: request, riffle }), [request, riffle])

    // follow `view`: ±1 turns a leaf, bigger jumps crossfade; reduced motion crossfades every change
    React.useEffect(() => {
      if (sc !== null || busy || view === shown) return
      if (reduced()) { stop(); setFade({ from: shown, ms: 160, id: performance.now() }); setShown(view); return }
      if (Math.abs(view - shown) > 1) { stop(); setFade({ from: shown, ms: 240, id: performance.now() }); setShown(view); return }
      const fwd = view > shown, a = Math.min(view, shown)
      const lift = turnRef.current
      const th0 = lift && lift.a === a ? lift.th : fwd ? 0 : 180, th1 = fwd ? 180 : 0
      const r = riffleRef.current
      if (r) { run(a, th0, th1, (r.ms * Math.abs(th1 - th0)) / 180, OUT, "anim", () => land(view)); return }
      const full = a === 0 || a === n - 2 ? 1000 : turnMs
      run(a, th0, th1, Math.max(200, (full * Math.abs(th1 - th0)) / 180), TURN, "anim", () => land(view))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, shown, busy])

    // preload + decode the photos two views either side
    React.useEffect(() => {
      for (const v of [at - 2, at - 1, at + 1, at + 2]) for (const u of photosOf(b, v)) {
        if (decoded.has(u)) continue
        decoded.add(u); const img = new Image(); img.src = u; void img.decode().catch(() => {})
      }
    }, [b, at])

    // keys while the reader is at least half in view
    const inView = React.useRef(false)
    React.useEffect(() => {
      const e = el.current; if (!e) return
      const io = new IntersectionObserver(([x]) => { inView.current = x.intersectionRatio >= 0.5 }, { threshold: [0, 0.5, 1] })
      io.observe(e); return () => io.disconnect()
    }, [])
    const scrubbing = sc !== null
    React.useEffect(() => {
      if (!keys || scrubbing) return
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
    }, [keys, scrubbing, n, request])

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
      // corner lift: the outer `corner` px of a page
      if (e.pointerType !== "mouse" || !fine() || reduced() || busy) return
      const { r, k } = geo(), x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k
      const inY = y >= 0 && y <= H
      const want = inY && x > W - corner && x <= W + 8 && canDrag("R") ? { a: shown, th: 10 } : inY && x < corner && x >= -8 && canDrag("L") ? { a: shown - 1, th: 170 } : null
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
        const { r, k } = geo(), x = (e.clientX - r.left) / k, onBook = x >= pw / 2 - g.BD && x <= (3 * pw) / 2 + g.BD
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

    const label = viewLabel(b, at)
    const handlers = scrubbing ? {} : { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: () => { ptr.current = null; setTurn(null) }, onPointerLeave }
    return (
      <div ref={el} className={dark ? "sd-reader sd-dark" : "sd-reader"} style={{ width: W, height: H, perspective: `${Math.round(W * 2)}px`, perspectiveOrigin: "50% 50%" }}
        role="region" aria-roledescription="book" aria-label={b.title} tabIndex={0} data-testid="ps-reader" data-view={at} data-views={n} {...handlers}>
        {scrubbing ? sth > 0 && sth < 180 ? <TurningBook g={g} a={sa} th={sth} /> : <StaticBook g={g} v={at} vt={vt} />
          : turn ? <TurningBook g={g} a={turn.a} th={turn.th} /> : <StaticBook g={g} v={shown} vt={vt} />}
        {fade && <div key={fade.id} className="sd-fade" style={{ "--fd": `${fade.ms}ms` } as React.CSSProperties} onAnimationEnd={() => setFade(null)}><StaticBook g={g} v={fade.from} /></div>}
        <div className="sr-only" aria-live="polite" data-testid="ps-reader-live">{label}</div>
      </div>
    )
  },
)

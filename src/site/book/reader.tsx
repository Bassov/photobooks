/*
 * BookReader (Designer D39; kit site-book/reader.tsx): a controlled book that
 * opens its cover and turns its pages around the spine. Views: 0 the closed
 * front cover, v the spread v − 1, n + 1 the closed back cover. A ±1 change of
 * `view` turns a leaf (820 ms, the boards 1000 ms); bigger jumps crossfade
 * 240 ms; reduced motion crossfades every change in 160 ms. Click a half,
 * ← / →, or drag a page; the corner lifts under a fine pointer. With WebGL 2
 * (not `?gl=0`) three.js draws the open book (roomGl.ts, a lazy chunk) into
 * one canvas over the reader box; else the CSS book below.
 */
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { spreadRatio, spreadSide, viewLabel } from '../siteModel'
import { CoverFace, PageFace, type RoomBook } from '../SiteSlide'
import { glWanted } from './gl/three'
import type { ReaderGlBook } from './roomGl'
import { PaperGrain } from './slides'

/** `go(d)` turns (or queues) one step; `jump(v)` rests on view v with no turn */
export interface ReaderApi {
  go: (d: number) => void
  jump: (v: number) => void
}
interface Turn {
  a: number
  th: number
  kind: 'anim' | 'drag' | 'lift'
}

/** CSS cubic-bezier(x1, y1, x2, y2) as t → progress */
const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const X = (u: number) => ((ax * u + bx) * u + cx) * u
  const dX = (u: number) => (3 * ax * u + 2 * bx) * u + cx
  return (t: number) => {
    let u = t
    for (let i = 0; i < 8; i++) {
      const e = X(u) - t
      const d = dX(u)
      if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break
      u = Math.min(1, Math.max(0, u - e / d))
    }
    return ((ay * u + by) * u + cy) * u
  }
}
export const TURN = bezier(0.45, 0.05, 0.25, 1)
export const EASE = bezier(0.2, 0.7, 0.2, 1)
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const px = (n: number) => `${String(n)}px`
/** one interior leaf, ms (the boards: 1000) */
const TURN_MS = 820
/** the outer band of a page where the corner lifts under a fine pointer, px */
const CORNER = 64

/** One page face of view v: a half of its spread, or the endpaper. */
function Face({
  rb,
  v,
  side,
  W,
}: {
  rb: RoomBook
  v: number
  side: 'L' | 'R'
  W: number
}) {
  const k = v - 1
  if (k < 0 || k >= rb.book.spreads.length) return null
  const s = side === 'L' ? 'left' : 'right'
  const single = spreadSide(rb.book, k)
  if (single !== undefined && single !== s) {
    return <div className="sd-fill" style={{ background: rb.entry.endpaper }} />
  }
  return (
    <PageFace
      book={rb.book}
      images={rb.images}
      spread={k}
      side={s}
      pw={W / 2}
      renderSlide={rb.renderSlide}
      eager
    />
  )
}
const FaceM = memo(Face)

/** Board (cloth) BD, page-block side edge eMax and tail strip tE, px */
interface Geo {
  rb: RoomBook
  W: number
  H: number
  pw: number
  n: number
  board: string
  BD: number
  eMax: number
  tE: number
}
export function geoOf(rb: RoomBook, W: number, H: number, n: number): Geo {
  const sr = W / (2 * (rb.entry.trimMm.w / 10))
  const BD = clamp(0.3 * sr, 3, 8)
  // the closed book's thickness at sr px/cm (Book3D)
  const thick = Math.max(12, (0.6 + (rb.entry.pageCount / 2) * 0.1) * sr)
  const eMax = clamp(0.45 * (thick - 2 * 0.25 * sr), 3, 14)
  return {
    rb,
    W,
    H,
    pw: W / 2,
    n,
    board: rb.entry.spine.cloth,
    BD,
    eMax,
    tE: clamp(0.35 * eMax, 2, 5),
  }
}
const readOf = (g: Geo, v: number) =>
  clamp((v - 1) / Math.max(1, g.n - 3), 0, 1)
/** the page-block side edges at read fraction r: the read pages pile up on the left */
const edgesOf = (g: Geo, r: number) => [
  1 + (g.eMax - 1) * r,
  1 + (g.eMax - 1) * (1 - r),
]

/** A board: reaches tE below the page block, its bottom BD + 1 px darker. */
function Board({
  g,
  left,
  x,
  w,
}: {
  g: Geo
  left?: boolean
  x: number
  w: number
}) {
  const { H, BD, tE, board } = g
  const bottom = `linear-gradient(0deg, color-mix(in srgb, ${board} 85%, #000) 0 ${px(BD + 1)}, transparent ${px(BD + 1)})`
  return (
    <div
      className="sd-board"
      style={{
        left: x,
        top: -BD,
        width: w,
        height: H + 2 * BD + tE,
        background: `${bottom}, ${board}`,
        borderRadius: left ? '3px 0 0 3px' : '0 3px 3px 0',
      }}
    />
  )
}
/** A page-block side edge e px wide, shaded darker outward */
function Edge({ g, left, e }: { g: Geo; left: boolean; e: number }) {
  return (
    <div
      className="sd-edge"
      style={{
        left: left ? -e : g.W,
        top: 1,
        width: e,
        height: g.H - 1,
        boxShadow: `inset ${px(left ? e : -e)} 0 ${px(e)} ${px(-e)} rgb(0 0 0/.12)`,
      }}
    />
  )
}
/** The tail strip: the page block's thickness under the pages */
function Tail({ g, eL, eR }: { g: Geo; eL: number; eR: number }) {
  const { W, H, tE } = g
  return (
    <div
      className="sd-tail"
      style={{
        left: -eL,
        top: H,
        width: W + eL + eR,
        height: tE,
        boxShadow: `inset 0 ${px(-tE)} ${px(tE)} ${px(-tE)} rgb(0 0 0/.15)`,
      }}
    />
  )
}
/** The gutter: 8 % of W centred on the spine */
const Gutter = ({ g, z }: { g: Geo; z?: boolean }) => (
  <div
    className="sd-gutter"
    style={{
      left: g.pw - g.W * 0.04,
      top: 0,
      width: g.W * 0.08,
      height: g.H,
      transform: z ? 'translateZ(.5px)' : undefined,
    }}
  />
)

const page = (g: Geo, v: number, side: 'L' | 'R') => (
  <>
    <Face rb={g.rb} v={v} side={side} W={g.W} />
    <PaperGrain />
  </>
)

/** The book at rest on view v (no leaf). */
function StaticBook({ g, v }: { g: Geo; v: number }) {
  const { rb, W, H, pw, n, BD, eMax } = g
  const [eL = 1, eR = 1] = edgesOf(g, readOf(g, v))
  if (v === 0) {
    return (
      <div
        className="sd-rbook"
        style={{ width: W, height: H, transform: `translateX(${px(-pw / 2)})` }}
      >
        <Board g={g} x={pw} w={pw + BD + eMax} />
        <Edge g={g} left={false} e={eMax} />
        <div
          style={{
            left: pw,
            top: -BD,
            width: pw + BD,
            height: H + 2 * BD,
            borderRadius: '1px 3px 3px 1px',
            overflow: 'hidden',
          }}
        >
          <CoverFace b={rb.entry} w={pw + BD} h={H + 2 * BD} />
        </div>
      </div>
    )
  }
  if (v === n - 1) {
    return (
      <div
        className="sd-rbook"
        style={{ width: W, height: H, transform: `translateX(${px(pw / 2)})` }}
      >
        <Board g={g} left x={-BD - eMax} w={pw + BD + eMax} />
        <Edge g={g} left e={eMax} />
        <div
          style={{
            left: -BD,
            top: -BD,
            width: pw + BD,
            height: H + 2 * BD,
            background: `linear-gradient(270deg, rgb(0 0 0/.18), rgb(0 0 0/0) 6%), ${g.board}`,
            borderRadius: '3px 1px 1px 3px',
          }}
        />
      </div>
    )
  }
  return (
    <div className="sd-rbook" style={{ width: W, height: H }}>
      <Board g={g} left x={-BD - eL} w={pw + BD + eL} />
      <Board g={g} x={pw} w={pw + BD + eR} />
      <Edge g={g} left e={eL} />
      <Edge g={g} left={false} e={eR} />
      <Tail g={g} eL={eL} eR={eR} />
      <div className="sd-pg" style={{ left: 0, top: 0, width: pw, height: H }}>
        {page(g, v, 'L')}
      </div>
      <div className="sd-pg" style={{ left: pw, top: 0, width: pw, height: H }}>
        {page(g, v, 'R')}
      </div>
      <Gutter g={g} />
    </div>
  )
}

/** The book between views a and a + 1 with the leaf at angle th (0 = view a, 180 = view a + 1). */
function TurningBook({ g, a, th }: { g: Geo; a: number; th: number }) {
  const { rb, W, H, pw, n, BD } = g
  const opening = a === 0
  const closing = a === n - 2
  const s = Math.sin((th * Math.PI) / 180)
  const f = th / 180
  const [eL = 1, eR = 1] = edgesOf(
    g,
    readOf(g, a) + (readOf(g, a + 1) - readOf(g, a)) * f,
  )
  const tx = opening ? -(pw / 2) * (1 - f) : closing ? (pw / 2) * f : 0
  const frontShade = `linear-gradient(90deg, rgb(0 0 0/${String(0.22 * s)}), rgb(0 0 0/${String(0.06 * s)}) 35%, rgb(0 0 0/0) 70%), rgb(0 0 0/${String(th < 90 ? (0.28 * th) / 90 : 0)})`
  const backShade = `linear-gradient(270deg, rgb(0 0 0/${String(0.2 * s)}), rgb(0 0 0/0) 40%), rgb(0 0 0/${String(th > 90 ? (0.3 * (180 - th)) / 90 : 0)})`
  const boardLeaf = opening || closing
  const leafBox = boardLeaf
    ? { left: pw, top: -BD, width: pw + BD, height: H + 2 * BD }
    : { left: pw, top: 0, width: pw, height: H }
  // the endpaper inside a board is paper too; the cover face is not
  const endpaper = (inset: CSSProperties) => (
    <div
      style={{ position: 'absolute', ...inset, background: rb.entry.endpaper }}
    >
      <PaperGrain />
    </div>
  )
  const front = opening ? (
    <CoverFace b={rb.entry} w={pw + BD} h={H + 2 * BD} />
  ) : closing ? (
    endpaper({ left: 0, top: BD, right: BD, bottom: BD })
  ) : (
    page(g, a, 'R')
  )
  const back = opening
    ? endpaper({ left: BD, top: BD, right: 0, bottom: BD })
    : closing
      ? null
      : page(g, a + 1, 'L')
  const castR = pw * (0.12 + 0.55 * (1 - f))
  const castL = (0.35 * pw * (th - 90)) / 90
  const boardFace: CSSProperties | undefined = boardLeaf
    ? { background: g.board, borderRadius: '0 3px 3px 0' }
    : undefined
  return (
    <div
      className="sd-rbook"
      style={{ width: W, height: H, transform: `translateX(${px(tx)})` }}
    >
      {!opening && <Board g={g} left x={-BD - eL} w={pw + BD + eL} />}
      {!closing && <Board g={g} x={pw} w={pw + BD + eR} />}
      {!opening && <Edge g={g} left e={eL} />}
      {!closing && <Edge g={g} left={false} e={eR} />}
      {!opening && !closing && <Tail g={g} eL={eL} eR={eR} />}
      {!opening && (
        <div
          className="sd-pg"
          style={{ left: 0, top: 0, width: pw, height: H }}
        >
          {page(g, a, 'L')}
        </div>
      )}
      {!closing && (
        <div
          className="sd-pg"
          style={{ left: pw, top: 0, width: pw, height: H }}
        >
          {page(g, a + 1, 'R')}
        </div>
      )}
      {!opening && !closing && <Gutter g={g} z />}
      {!closing && th > 0 && th < 178 && (
        <div
          className="sd-cast"
          style={{
            left: pw,
            top: 0,
            width: castR,
            height: H,
            background: `linear-gradient(90deg, rgb(0 0 0/${String(0.34 * s)}), rgb(0 0 0/0))`,
          }}
        />
      )}
      {!opening && th > 92 && (
        <div
          className="sd-cast"
          style={{
            left: pw - castL,
            top: 0,
            width: castL,
            height: H,
            background: `linear-gradient(270deg, rgb(0 0 0/${String(0.26 * s)}), rgb(0 0 0/0))`,
          }}
        />
      )}
      {!boardLeaf ? (
        <PaperLeaf g={g} a={a} th={th} />
      ) : (
        <div
          className="sd-leaf"
          style={{
            ...leafBox,
            transform: `translateZ(1px) rotateY(${String(-th)}deg)`,
            willChange: 'transform',
          }}
          data-testid="ps-leaf"
          data-leaf="board"
        >
          <div className="sd-face" style={boardFace}>
            {front}
            <div className="sd-fill" style={{ background: frontShade }} />
          </div>
          <div className="sd-face sd-back" style={boardFace}>
            {back}
            <div className="sd-fill" style={{ background: backShade }} />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The paper leaf: 12 nested strips, each bent 10°·sin θ·i/12 past the one
 * before, so the free edge leads mid-turn and the leaf lies flat at 0 and 180.
 */
const STRIPS = 12
const STRIP_FACE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  overflow: 'hidden',
  background: 'var(--site-paper)',
}
function PaperLeaf({ g, a, th }: { g: Geo; a: number; th: number }) {
  const { rb, W, H, pw } = g
  const sw = pw / STRIPS
  const s = Math.sin((th * Math.PI) / 180)
  const bend = (i: number) => 10 * s * (i / STRIPS)
  const angs: number[] = []
  let tot = 0
  for (let i = 1; i < STRIPS; i++) tot += bend(i)
  for (let i = 0, x = th - tot / 2; i < STRIPS; i++) {
    if (i) x += bend(i)
    angs.push(x)
  }
  let inner: ReactNode = null
  for (let i = STRIPS - 1; i >= 0; i--) {
    const al = angs[i] ?? th
    const fa = al < 90 ? (0.34 * al) / 90 : 0
    const ba = al > 90 ? (0.3 * (180 - al)) / 90 : 0
    const hi = 0.16 * s * Math.sin((Math.PI * i) / STRIPS)
    inner = (
      <div
        style={{
          position: 'absolute',
          left: i === 0 ? pw : sw,
          top: 0,
          width: sw + 1.5,
          height: H,
          transformStyle: 'preserve-3d',
          transformOrigin: 'left center',
          transform: `${i === 0 ? 'translateZ(1px) ' : ''}rotateY(${String(-(i === 0 ? al : bend(i)))}deg)`,
        }}
        data-testid={i === 0 || i === STRIPS - 1 ? 'ps-leaf' : undefined}
        data-leaf={i === 0 ? 'paper' : undefined}
      >
        <div style={STRIP_FACE}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: -i * sw,
              width: pw,
              height: H,
            }}
          >
            <FaceM rb={rb} v={a} side="R" W={W} />
          </div>
          <PaperGrain x={-i * sw} w={pw} />
          <div
            className="sd-fill"
            style={{
              background: `rgb(255 255 255/${String(hi)})`,
              boxShadow: `inset 0 0 0 999px rgb(0 0 0/${String(fa)})`,
            }}
          />
        </div>
        <div style={{ ...STRIP_FACE, transform: 'rotateY(180deg)' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: (i + 1) * sw - pw,
              width: pw,
              height: H,
            }}
          >
            <FaceM rb={rb} v={a + 1} side="L" W={W} />
          </div>
          <PaperGrain x={(i + 1) * sw - pw} w={pw} />
          <div
            className="sd-fill"
            style={{ background: `rgb(0 0 0/${String(ba)})` }}
          />
        </div>
        {inner}
      </div>
    )
  }
  return inner
}

/** the GL canvas within the reader box (css px) */
interface GlBox {
  x: number
  y: number
  w: number
  h: number
}
interface GlProps {
  rb: RoomBook
  a: number
  th: number
  view: number
  W: number
  H: number
  box: GlBox
  s: number
  label: string
  fade: { ms: number; id: number } | null
  onFade: () => void
  onFail: () => void
}

/**
 * The reader's WebGL layer: one canvas, drawn when (a, θ), the box or a page
 * texture changes; a crossfade snapshots the last frame into an overlay
 * canvas and fades it out.
 */
function ReaderGl({
  rb,
  a,
  th,
  view,
  W,
  H,
  box,
  s,
  label,
  fade,
  onFade,
  onFail,
}: GlProps) {
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const over = useRef<HTMLCanvasElement>(null)
  const [gl, setGl] = useState<ReaderGlBook | null>(null)
  const [tick, setTick] = useState(0)
  const cb = useRef({ onFail, onFade })
  useLayoutEffect(() => {
    cb.current = { onFail, onFade }
  })
  const pagePx = W >= 1600 ? 2048 : 1024
  useEffect(() => {
    let dead = false
    // read through a call so each await re-reads it
    const gone = () => dead
    let made: ReaderGlBook | undefined
    void (async () => {
      try {
        const { openReaderGl } = await import('./roomGl')
        if (gone()) return
        made = await openReaderGl({ ...rb, pagePx })
        if (gone()) {
          made.book.dispose()
          made.faces.dispose()
          return
        }
        made.book.onChange = () => {
          setTick((t) => t + 1)
        }
        setGl(made)
      } catch (e) {
        if (!gone()) {
          console.warn('BookReader: GL failed, CSS fallback', e)
          cb.current.onFail()
        }
      }
    })()
    return () => {
      dead = true
      made?.book.dispose()
      made?.faces.dispose()
      setGl(null)
    }
  }, [rb, pagePx])

  useEffect(() => {
    gl?.faces.focus(view)
  }, [gl, view])

  const lastFade = useRef<number | null>(null)
  useLayoutEffect(() => {
    const c = canvas.current
    const o = over.current
    if (!gl || !c || !o) return
    if (fade && fade.id !== lastFade.current) {
      lastFade.current = fade.id
      o.width = c.width
      o.height = c.height
      o.getContext('2d')?.drawImage(c, 0, 0)
      const an = o.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: fade.ms,
        easing: 'linear',
        fill: 'forwards',
      })
      an.onfinish = () => {
        cb.current.onFade()
      }
    }
    // capped so a wide reader's backing store stays within 4096 px
    const k = Math.min(
      Math.max(2, window.devicePixelRatio || 1),
      4096 / Math.max(box.w, box.h),
    )
    const cw = Math.round(box.w * k)
    const ch = Math.round(box.h * k)
    if (c.width !== cw || c.height !== ch) {
      c.width = cw
      c.height = ch
    }
    gl.book.set(a, th)
    gl.book.frame(W, H, s, box)
    gl.draw(c)
    root.current?.setAttribute('data-gl', 'ready')
    // data-faces: "done" once every face drawn so far has its canvas (tests wait on it)
    root.current?.setAttribute(
      'data-faces',
      gl.book.loading ? 'loading' : 'done',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the box by value; tick is a texture landing
  }, [gl, tick, a, th, W, H, s, box.x, box.y, box.w, box.h, fade])

  const place: CSSProperties = {
    position: 'absolute',
    left: box.x,
    top: box.y,
    width: box.w,
    height: box.h,
    pointerEvents: 'none',
  }
  return (
    <div ref={root} className="sd-fill" data-testid="ps-reader-gl">
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        style={place}
        data-testid="ps-reader-canvas"
      />
      <canvas ref={over} aria-hidden style={{ ...place, opacity: 0 }} />
    </div>
  )
}

export interface ReaderProps {
  rb: RoomBook
  view: number
  onView: (v: number) => void
  width: number
  /** window keys while the reader is half in view; off under the lightbox and in the editor preview */
  keys?: boolean
}

const KEY_STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  PageDown: 1,
  ArrowLeft: -1,
  PageUp: -1,
}

export const BookReader = forwardRef<ReaderApi, ReaderProps>(
  function BookReader({ rb, view, onView, width: W, keys = true }, apiRef) {
    const nSpreads = rb.book.spreads.length
    const n = nSpreads + 2
    const H = W / spreadRatio(rb.book.settings.trim)
    const pw = W / 2
    const g = geoOf(rb, W, H, n)
    const [gl, setGl] = useState(
      () => rb.renderSlide === undefined && glWanted(),
    )
    const el = useRef<HTMLDivElement>(null)
    const [shown, setShown] = useState(view)
    const [turn, setTurnS] = useState<Turn | null>(null)
    const [fade, setFade] = useState<{
      from: number
      ms: number
      id: number
    } | null>(null)
    const turnRef = useRef<Turn | null>(null)
    const setTurn = (t: Turn | null) => {
      turnRef.current = t
      setTurnS(t)
    }
    const raf = useRef(0)
    const pending = useRef<number | null>(null)
    /** a jump: the next `view` change crossfades nothing, it just rests there */
    const quiet = useRef<number | null>(null)
    const live = useRef({ view, onView })
    useLayoutEffect(() => {
      live.current = { view, onView }
    })
    const busy = turn !== null && turn.kind !== 'lift'

    const run = (
      a: number,
      th0: number,
      th1: number,
      ms: number,
      ease: (t: number) => number,
      kind: Turn['kind'],
      done?: () => void,
    ) => {
      cancelAnimationFrame(raf.current)
      setTurn({ a, th: th0, kind }) // busy from now, so a press before the first frame is queued
      const t0 = performance.now()
      // progress from the clock, not the rAF timestamp (stale after a slow GL frame)
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / ms)
        setTurn({ a, th: th0 + (th1 - th0) * ease(p), kind })
        if (p < 1) raf.current = requestAnimationFrame(step)
        else done?.()
      }
      raf.current = requestAnimationFrame(step)
    }
    useEffect(
      () => () => {
        cancelAnimationFrame(raf.current)
      },
      [],
    )
    /** a finished turn lands on view v; a queued press runs next */
    const land = (v: number) => {
      setTurn(null)
      setShown(v)
      const d = pending.current
      pending.current = null
      if (live.current.view !== v || d === null) return
      const t = clamp(v + d, 0, n - 1)
      if (t !== v) live.current.onView(t)
    }
    const stop = () => {
      cancelAnimationFrame(raf.current)
      setTurn(null)
    }
    const request = useCallback(
      (d: number) => {
        const { view: v, onView: go } = live.current
        if (turnRef.current && turnRef.current.kind !== 'lift') {
          pending.current ??= d
          return
        }
        const t = clamp(v + d, 0, n - 1)
        if (t !== v) go(t)
      },
      [n],
    )
    const jump = useCallback(
      (v: number) => {
        const t = clamp(v, 0, n - 1)
        pending.current = null
        quiet.current = t
        live.current.onView(t)
      },
      [n],
    )
    useImperativeHandle(apiRef, () => ({ go: request, jump }), [request, jump])

    // follow `view`: ±1 turns a leaf, bigger jumps crossfade; reduced motion crossfades every change
    useEffect(() => {
      if (busy || view === shown) return
      if (quiet.current === view) {
        quiet.current = null
        stop()
        setShown(view)
        return
      }
      if (reduced()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- `view` is the outside input; the shown view follows it once per change
        stop()
        setFade({ from: shown, ms: 160, id: performance.now() })
        setShown(view)
        return
      }
      if (Math.abs(view - shown) > 1) {
        stop()
        setFade({ from: shown, ms: 240, id: performance.now() })
        setShown(view)
        return
      }
      const fwd = view > shown
      const a = Math.min(view, shown)
      const lift = turnRef.current
      const th0 = lift?.a === a ? lift.th : fwd ? 0 : 180
      const th1 = fwd ? 180 : 0
      const full = a === 0 || a === n - 2 ? 1000 : TURN_MS
      run(
        a,
        th0,
        th1,
        Math.max(200, (full * Math.abs(th1 - th0)) / 180),
        TURN,
        'anim',
        () => {
          land(view)
        },
      )
      // eslint-disable-next-line react-hooks/exhaustive-deps -- a new view or the end of a turn only; run / land are read at that moment
    }, [view, shown, busy])

    // keys while the reader is at least half in view
    const inView = useRef(false)
    useEffect(() => {
      const e = el.current
      if (!e) return
      const io = new IntersectionObserver(
        ([x]) => {
          inView.current = (x?.intersectionRatio ?? 0) >= 0.5
        },
        { threshold: [0, 0.5, 1] },
      )
      io.observe(e)
      return () => {
        io.disconnect()
      }
    }, [])
    useEffect(() => {
      if (!keys) return
      const k = (e: KeyboardEvent) => {
        if (!inView.current || e.altKey || e.ctrlKey || e.metaKey) return
        const t = e.target as Partial<Element> | null
        if (t?.closest?.('input,textarea,select,[contenteditable]')) return
        const d = KEY_STEP[e.key]
        if (d !== undefined) {
          e.preventDefault()
          request(d)
          return
        }
        if (e.key === 'Home') {
          e.preventDefault()
          live.current.onView(0)
        }
        if (e.key === 'End') {
          e.preventDefault()
          live.current.onView(n - 2)
        }
      }
      window.addEventListener('keydown', k)
      return () => {
        window.removeEventListener('keydown', k)
      }
    }, [keys, n, request])

    // pointer: click a half, drag a page (6 px threshold), corner lift
    const ptr = useRef<{
      id: number
      x0: number
      y0: number
      side: 'L' | 'R'
      a: number
      drag: boolean
      lx: number
      lt: number
      vx: number
    } | null>(null)
    const geo = () => {
      const r = el.current?.getBoundingClientRect() ?? new DOMRect()
      const k = r.width / W || 1
      return { r, k, spine: r.left + pw * k }
    }
    const canDrag = (side: 'L' | 'R') =>
      !reduced() &&
      (side === 'R'
        ? shown >= 1 && shown <= n - 3
        : shown >= 2 && shown <= n - 2)
    const thAt = (x: number) => {
      const { k, spine } = geo()
      return (Math.acos(clamp((x - spine) / (pw * k), -1, 1)) * 180) / Math.PI
    }
    const sideAt = (x: number): 'L' | 'R' => (x < geo().spine ? 'L' : 'R')
    const cursorAt = (x: number) =>
      shown === 0
        ? 'Open'
        : shown === n - 1
          ? '←'
          : sideAt(x) === 'R'
            ? '→'
            : '←'
    const unlift = () => {
      const cur = turnRef.current
      if (cur?.kind !== 'lift') return
      const to = cur.a === shown ? 0 : 180
      run(cur.a, cur.th, to, 240, EASE, 'lift', () => {
        setTurn(null)
      })
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const side = sideAt(e.clientX)
      ptr.current = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        side,
        a: side === 'R' ? shown : shown - 1,
        drag: false,
        lx: e.clientX,
        lt: e.timeStamp,
        vx: 0,
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      el.current?.setAttribute('data-cursor', cursorAt(e.clientX))
      const p = ptr.current
      if (p?.id === e.pointerId) {
        const dx = Math.abs(e.clientX - p.x0)
        const dy = Math.abs(e.clientY - p.y0)
        // touch / pen: only a horizontal move turns; a vertical one is the page scroll
        if (!p.drag && e.pointerType !== 'mouse' && dy > 6 && dy > dx) {
          ptr.current = null
          return
        }
        const moved =
          e.pointerType === 'mouse'
            ? Math.hypot(dx, dy) > 6
            : dx > 6 && dx >= dy
        if (!p.drag && moved && canDrag(p.side) && !busy) {
          p.drag = true
          cancelAnimationFrame(raf.current)
          el.current?.setPointerCapture(e.pointerId)
        }
        if (p.drag) {
          const dt = e.timeStamp - p.lt
          if (dt > 0) p.vx = (e.clientX - p.lx) / dt
          p.lx = e.clientX
          p.lt = e.timeStamp
          setTurn({ a: p.a, th: thAt(e.clientX), kind: 'drag' })
        }
        return
      }
      // corner lift: the outer CORNER px of a page
      if (e.pointerType !== 'mouse' || !fine() || reduced() || busy) return
      const { r, k } = geo()
      const x = (e.clientX - r.left) / k
      const y = (e.clientY - r.top) / k
      const inY = y >= 0 && y <= H
      const want =
        inY && x > W - CORNER && x <= W + 8 && canDrag('R')
          ? { a: shown, th: 10 }
          : inY && x < CORNER && x >= -8 && canDrag('L')
            ? { a: shown - 1, th: 170 }
            : null
      const cur = turnRef.current
      if (want && cur?.a !== want.a) {
        run(want.a, want.th === 10 ? 0 : 180, want.th, 240, EASE, 'lift')
      }
      if (!want && cur?.kind === 'lift') unlift()
    }
    const onPointerUp = (e: PointerEvent) => {
      const p = ptr.current
      ptr.current = null
      if (p?.id !== e.pointerId) return
      if (!p.drag) {
        // closed: only the book itself (centred, one page wide) opens it
        const { r, k } = geo()
        const x = (e.clientX - r.left) / k
        const onBook = x >= pw / 2 - g.BD && x <= (3 * pw) / 2 + g.BD
        if (shown === 0) {
          if (onBook) request(1)
        } else if (shown === n - 1) {
          if (onBook) request(-1)
        } else request(p.side === 'R' ? 1 : -1)
        return
      }
      const th = turnRef.current?.th ?? 0
      const fwd = p.side === 'R'
      if (e.timeStamp - p.lt > 100) p.vx = 0 // the pointer rested before release: no fling
      const done = fwd ? th > 90 || p.vx < -0.5 : th < 90 || p.vx > 0.5
      const to = fwd === done ? 180 : 0
      const target = done ? (fwd ? shown + 1 : shown - 1) : shown
      run(
        p.a,
        th,
        to,
        Math.max(200, (TURN_MS * Math.abs(to - th)) / 180),
        EASE,
        'anim',
        () => {
          if (target !== shown) {
            onView(target)
            live.current = { ...live.current, view: target }
          }
          land(target)
        },
      )
    }
    const onPointerLeave = () => {
      if (!ptr.current) unlift()
    }
    // the cursor label reads data-cursor; set only here and on pointer moves
    useEffect(() => {
      el.current?.setAttribute(
        'data-cursor',
        shown === 0 ? 'Open' : shown === n - 1 ? '←' : '→',
      )
    }, [shown, n])

    const label = viewLabel(shown, nSpreads)
    // GL: the same state drawn as (a, θ); the closed back = the back board turned to 180
    const [ga, gth] = turn
      ? [turn.a, turn.th]
      : shown === n - 1
        ? [n - 2, 180]
        : [shown, 0]
    // the canvas overhangs the reader box: the leaf rises toward the eye past the head mid-turn
    const RISE = 0.21
    const box = {
      x: -0.04 * W,
      y: -RISE * W,
      w: 1.08 * W,
      h: H + RISE * W + 0.05 * H,
    }
    const glLayer = gl && (
      <>
        <ReaderGl
          rb={rb}
          a={ga}
          th={gth}
          view={shown}
          W={W}
          H={H}
          box={box}
          s={W / (2 * (rb.entry.trimMm.w / 10) + 10)}
          label={label}
          fade={fade}
          onFade={() => {
            setFade(null)
          }}
          onFail={() => {
            setGl(false)
          }}
        />
        {turn && (
          <div
            aria-hidden
            data-testid="ps-leaf"
            data-leaf={turn.a === 0 || turn.a === n - 2 ? 'board' : 'paper'}
            data-theta={turn.th.toFixed(1)}
          />
        )}
      </>
    )
    return (
      <div
        ref={el}
        className="sd-reader"
        style={
          {
            width: W,
            height: H,
            perspective: px(Math.round(W * 2)),
            perspectiveOrigin: '50% 50%',
            '--site-paper': rb.entry.paper,
          } as CSSProperties
        }
        role="region"
        aria-roledescription="book"
        aria-label={rb.entry.title}
        tabIndex={0}
        data-testid="ps-reader"
        data-view={shown}
        data-views={n}
        data-turn={turn ? turn.kind : fade ? 'fade' : 'rest'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          ptr.current = null
          setTurn(null)
        }}
        onPointerLeave={onPointerLeave}
      >
        {glLayer ||
          (turn ? (
            <TurningBook g={g} a={turn.a} th={turn.th} />
          ) : (
            <StaticBook g={g} v={shown} />
          ))}
        {fade && !gl && (
          <div
            key={fade.id}
            className="sd-fade"
            style={{ '--fd': `${String(fade.ms)}ms` } as CSSProperties}
            onAnimationEnd={() => {
              setFade(null)
            }}
          >
            <StaticBook g={g} v={fade.from} />
          </div>
        )}
        <div
          className="site-sr-only"
          aria-live="polite"
          data-testid="ps-reader-live"
        >
          {label}
        </div>
      </div>
    )
  },
)

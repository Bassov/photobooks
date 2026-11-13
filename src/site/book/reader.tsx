/*
 * BookReader (Designer D39; kit site-book/reader.tsx): a controlled book that
 * opens its cover and turns its pages around the spine. Views: 0 the closed
 * front cover, v the spread v − 1, n + 1 the closed back cover. A ±1 change of
 * `view` turns a leaf (820 ms, the boards 1000 ms); bigger jumps crossfade
 * 240 ms; reduced motion crossfades every change in 160 ms. Click a half,
 * ← / →, or drag a page; the corner lifts under a fine pointer. With WebGL 2
 * (not `?gl=0`) three.js draws the open book (roomGl.ts, a lazy chunk) into
 * one canvas over the reader box; else the CSS book below. Geometry, styles
 * and decisions: readerGeo.ts.
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
import { glWanted } from './glWanted'
import { EASE, TURN } from './motion'
import {
  backShell,
  backingSize,
  canDrag,
  clamp,
  clickStep,
  cursorOf,
  followPlan,
  frontShell,
  geoOf,
  glBox,
  glPose,
  liftAt,
  moveIntent,
  openShell,
  pagePxOf,
  paperStrips,
  px,
  readerKey,
  releasePlan,
  stepFrom,
  thetaAt,
  turnShell,
  type Geo,
  type Shell,
  type Turn,
} from './readerGeo'
import type { ReaderGlBook } from './roomGl'
import { PaperGrain } from './slides'

/** `go(d)` turns (or queues) one step; `jump(v)` rests on view v with no turn */
export interface ReaderApi {
  go: (d: number) => void
  jump: (v: number) => void
}

function reduced(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}
function fine(): boolean {
  return matchMedia('(hover: hover) and (pointer: fine)').matches
}

/** One page face of spread view v (1 … n − 2): a half of its spread, or the endpaper. */
function Face({
  rb,
  v,
  side,
  pw,
}: {
  rb: RoomBook
  v: number
  side: 'L' | 'R'
  pw: number
}) {
  const k = v - 1
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
      pw={pw}
      renderSlide={rb.renderSlide}
      eager
    />
  )
}
const FaceM = memo(Face)

/** The book's still parts: boards, edges, tail, pages, gutter, then `top`. */
function ShellParts({
  rb,
  g,
  shell,
  children,
}: {
  rb: RoomBook
  g: Geo
  shell: Shell
  children: ReactNode
}) {
  return (
    <>
      {shell.boards.map((style, i) => (
        <div key={`b${String(i)}`} className="sd-board" style={style} />
      ))}
      {shell.edges.map((style, i) => (
        <div key={`e${String(i)}`} className="sd-edge" style={style} />
      ))}
      {shell.tail && <div className="sd-tail" style={shell.tail} />}
      {shell.pages.map((p) => (
        <div key={p.side} className="sd-pg" style={p.style}>
          <Face rb={rb} v={p.v} side={p.side} pw={g.pw} />
          <PaperGrain />
        </div>
      ))}
      {shell.gutter && <div className="sd-gutter" style={shell.gutter} />}
      {children}
    </>
  )
}

/** The book at rest on view v (no leaf). */
function StaticBook({ rb, g, v }: { rb: RoomBook; g: Geo; v: number }) {
  const front = v === 0 ? frontShell(g) : null
  const back = v === g.n - 1 ? backShell(g) : null
  const shell = front ?? back ?? openShell(g, v)
  return (
    <div
      className="sd-rbook"
      style={{ width: g.W, height: g.H, transform: shell.transform }}
    >
      <ShellParts rb={rb} g={g} shell={shell}>
        {front && (
          <div style={front.cover}>
            <CoverFace b={rb.entry} w={g.pw + g.BD} h={g.H + 2 * g.BD} />
          </div>
        )}
        {back && <div style={back.back} />}
      </ShellParts>
    </div>
  )
}

/** The book between views a and a + 1 with the leaf at angle th (0 = view a, 180 = view a + 1). */
function TurningBook({
  rb,
  g,
  a,
  th,
}: {
  rb: RoomBook
  g: Geo
  a: number
  th: number
}) {
  const shell = turnShell(g, a, th)
  const leaf = shell.board
  // the endpaper inside a board is paper too; the cover face is not
  const endpaper = leaf && (
    <div
      style={{
        position: 'absolute',
        ...leaf.endpaper,
        background: rb.entry.endpaper,
      }}
    >
      <PaperGrain />
    </div>
  )
  return (
    <div
      className="sd-rbook"
      style={{ width: g.W, height: g.H, transform: shell.transform }}
    >
      <ShellParts rb={rb} g={g} shell={shell}>
        {shell.casts.map((style, i) => (
          <div key={`c${String(i)}`} className="sd-cast" style={style} />
        ))}
        {leaf ? (
          <div
            className="sd-leaf"
            style={leaf.style}
            data-testid="ps-leaf"
            data-leaf="board"
          >
            <div className="sd-face" style={leaf.face}>
              {shell.opening ? (
                <CoverFace b={rb.entry} w={g.pw + g.BD} h={g.H + 2 * g.BD} />
              ) : (
                endpaper
              )}
              <div
                className="sd-fill"
                style={{ background: leaf.frontShade }}
              />
            </div>
            <div className="sd-face sd-back" style={leaf.face}>
              {shell.opening && endpaper}
              <div className="sd-fill" style={{ background: leaf.backShade }} />
            </div>
          </div>
        ) : (
          <PaperLeaf rb={rb} g={g} a={a} th={th} />
        )}
      </ShellParts>
    </div>
  )
}

const STRIP_FACE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  overflow: 'hidden',
  background: 'var(--site-paper)',
}
/** The paper leaf (readerGeo `paperStrips`): each strip nests the next. */
function PaperLeaf({
  rb,
  g,
  a,
  th,
}: {
  rb: RoomBook
  g: Geo
  a: number
  th: number
}) {
  const { pw, H } = g
  const strips = paperStrips(g, th)
  const last = strips.length - 1
  return strips.reduceRight<ReactNode>(
    (inner, st, i) => (
      <div
        style={st.style}
        data-testid={i === 0 || i === last ? 'ps-leaf' : undefined}
        data-leaf={i === 0 ? 'paper' : undefined}
      >
        <div style={STRIP_FACE}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: st.frontX,
              width: pw,
              height: H,
            }}
          >
            <FaceM rb={rb} v={a} side="R" pw={pw} />
          </div>
          <PaperGrain x={st.frontX} w={pw} />
          <div
            className="sd-fill"
            style={{
              background: `rgb(255 255 255/${String(st.hi)})`,
              boxShadow: `inset 0 0 0 999px rgb(0 0 0/${String(st.front)})`,
            }}
          />
        </div>
        <div style={{ ...STRIP_FACE, transform: 'rotateY(180deg)' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: st.backX,
              width: pw,
              height: H,
            }}
          >
            <FaceM rb={rb} v={a + 1} side="L" pw={pw} />
          </div>
          <PaperGrain x={st.backX} w={pw} />
          <div
            className="sd-fill"
            style={{ background: `rgb(0 0 0/${String(st.back)})` }}
          />
        </div>
        {inner}
      </div>
    ),
    null,
  )
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
  const pagePx = pagePxOf(W)
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
    const size = backingSize(box, window.devicePixelRatio)
    if (c.width !== size.w || c.height !== size.h) {
      c.width = size.w
      c.height = size.h
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

export const BookReader = forwardRef<ReaderApi, ReaderProps>(
  function BookReader({ rb, view, onView, width: W, keys = true }, apiRef) {
    const nSpreads = rb.book.spreads.length
    const n = nSpreads + 2
    const H = W / spreadRatio(rb.book.settings.trim)
    const pw = W / 2
    const g = geoOf(rb.entry, W, H, n)
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
      done: () => void,
    ) => {
      cancelAnimationFrame(raf.current)
      setTurn({ a, th: th0, kind }) // busy from now, so a press before the first frame is queued
      const t0 = performance.now()
      // progress from the clock, not the rAF timestamp (stale after a slow GL frame)
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / ms)
        setTurn({ a, th: th0 + (th1 - th0) * ease(p), kind })
        if (p < 1) raf.current = requestAnimationFrame(step)
        else done()
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
      const t = stepFrom(v, d, n)
      if (t !== null) live.current.onView(t)
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
        const t = stepFrom(v, d, n)
        if (t !== null) go(t)
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
      const plan = followPlan(view, shown, n, reduced(), turnRef.current)
      if ('fade' in plan) {
        stop()
        setFade({ from: shown, ms: plan.fade, id: performance.now() })
        setShown(view)
        return
      }
      run(plan.a, plan.th0, plan.th1, plan.ms, TURN, 'anim', () => {
        land(view)
      })
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
        const d = inView.current ? readerKey(e) : null
        if (d === null) return
        e.preventDefault()
        if (d === 'home') live.current.onView(0)
        else if (d === 'end') live.current.onView(n - 2)
        else request(d)
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
      /** the dragged leaf's angle */
      th: number
    } | null>(null)
    /** the reader's client box, its scale k (client px per book px) and the spine's client x */
    const geo = (e: PointerEvent) => {
      const r = e.currentTarget.getBoundingClientRect()
      const k = r.width / W
      return { r, k, spine: r.left + pw * k }
    }
    const sideAt = (e: PointerEvent): 'L' | 'R' =>
      e.clientX < geo(e).spine ? 'L' : 'R'
    const unlift = () => {
      const cur = turnRef.current
      if (cur?.kind !== 'lift') return
      run(cur.a, cur.th, cur.a === shown ? 0 : 180, 240, EASE, 'lift', () => {
        setTurn(null)
      })
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const side = sideAt(e)
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
        th: 0,
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      e.currentTarget.setAttribute('data-cursor', cursorOf(shown, n, sideAt(e)))
      const p = ptr.current
      if (p?.id === e.pointerId) {
        if (!p.drag) {
          const intent = moveIntent(
            e.pointerType,
            Math.abs(e.clientX - p.x0),
            Math.abs(e.clientY - p.y0),
          )
          // touch / pen: a vertical move is the page scroll
          if (intent === 'scroll') {
            ptr.current = null
            return
          }
          if (
            intent === 'drag' &&
            !reduced() &&
            canDrag(p.side, shown, n) &&
            !busy
          ) {
            p.drag = true
            cancelAnimationFrame(raf.current)
            e.currentTarget.setPointerCapture(e.pointerId)
          }
        }
        if (p.drag) {
          const dt = e.timeStamp - p.lt
          if (dt > 0) p.vx = (e.clientX - p.lx) / dt
          p.lx = e.clientX
          p.lt = e.timeStamp
          const { k, spine } = geo(e)
          p.th = thetaAt(e.clientX, spine, pw * k)
          setTurn({ a: p.a, th: p.th, kind: 'drag' })
        }
        return
      }
      // corner lift: the outer CORNER px of a page
      if (e.pointerType !== 'mouse' || !fine() || reduced() || busy) return
      const { r, k } = geo(e)
      const want = liftAt(
        (e.clientX - r.left) / k,
        (e.clientY - r.top) / k,
        W,
        H,
        shown,
        n,
      )
      const cur = turnRef.current
      if (want && cur?.a !== want.a) {
        run(want.a, want.th0, want.th, 240, EASE, 'lift', () => undefined)
      }
      if (!want) unlift()
    }
    const onPointerUp = (e: PointerEvent) => {
      const p = ptr.current
      ptr.current = null
      if (p?.id !== e.pointerId) return
      if (!p.drag) {
        const { r, k } = geo(e)
        const d = clickStep((e.clientX - r.left) / k, p.side, g, shown)
        if (d !== 0) request(d)
        return
      }
      const th = p.th
      const plan = releasePlan(
        p.side === 'R',
        th,
        p.vx,
        e.timeStamp - p.lt,
        shown,
      )
      run(p.a, th, plan.to, plan.ms, EASE, 'anim', () => {
        if (plan.target !== shown) {
          onView(plan.target)
          live.current = { ...live.current, view: plan.target }
        }
        land(plan.target)
      })
    }
    const onPointerLeave = () => {
      if (!ptr.current) unlift()
    }
    // the cursor label reads data-cursor; set only here and on pointer moves
    useEffect(() => {
      el.current?.setAttribute('data-cursor', cursorOf(shown, n, 'R'))
    }, [shown, n])

    const label = viewLabel(shown, nSpreads)
    // GL: the same state drawn as (a, θ)
    const [ga, gth] = glPose(turn, shown, n)
    const glLayer = gl && (
      <>
        <ReaderGl
          rb={rb}
          a={ga}
          th={gth}
          view={shown}
          W={W}
          H={H}
          box={glBox(W, H)}
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
            <TurningBook rb={rb} g={g} a={turn.a} th={turn.th} />
          ) : (
            <StaticBook rb={rb} g={g} v={shown} />
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
            <StaticBook rb={rb} g={g} v={fade.from} />
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

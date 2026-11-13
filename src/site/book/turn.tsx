/*
 * Phone portrait reader, Page turn (Designer D40; kit site-book/turn.tsx):
 * every slide is a page-sized sheet over a fixed bed; a drag peels the top
 * sheet with an e-reader curl, a tap / key / Play runs a 600 ms scripted
 * turn, Home / End and `jump` crossfade 240 ms, reduced motion crossfades
 * 160 ms. With WebGL the `pt-gl` canvas draws the sheets (the DOM sheets stay
 * for a11y and tests); without it, and for a turn whose textures are not in
 * yet, the turn is a flat CSS fold: the top sheet clipped at xm, a shadow
 * right of it, the part past xm mirrored to its left (`pt-flap`). The
 * gesture and paint rules live in turnGeo.ts.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { slideOfView } from '../siteModel'
import type { PageCurl } from './gl/curl'
import type { FaceSource } from './gl/faces'
import { glWanted } from './glWanted'
import { EASE, sheetOf, xmEnd } from './motion'
import { slideKey } from './roomLayout'
import { Paper, type SlidesApi, type SlidesProps } from './slides'
import {
  backingRatio,
  canvasPx,
  curlRadius,
  dragIntent,
  fadeOpacity,
  followBack,
  followFwd,
  landing,
  OV,
  pushTrail,
  reducedCompletes,
  releaseCompletes,
  releaseVelocity,
  scriptAt,
  settleAt,
  settlePlan,
  sheetPaint,
  stepTurn,
  tapStep,
  type Trail,
  type Turn,
} from './turnGeo'

function reduced(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}
/** the GL canvas' backing pixels per CSS px */
function backing(): number {
  return backingRatio(window.devicePixelRatio)
}
const SCRIPT_MS = 600
const JUMP_MS = 240
const FADE_MS = 160

interface Drag {
  id: number
  x0: number
  y0: number
  t0: number
  py: number
  active: boolean
  dead: boolean
  dx: number
  trail: Trail
}
interface Live {
  si: number
  view: number
  turn: Turn | null
  xm: number | null
  beta: number
  raf: number
  end: (() => void) | null
  drawn: boolean
}

export const PageTurn = forwardRef<SlidesApi, SlidesProps>(function PageTurn(
  {
    rb,
    slides,
    w,
    top,
    pw,
    ph,
    view,
    setView,
    onSi,
    onRest,
    start,
    title,
    keys,
  },
  ref,
) {
  const n = slides.length
  const clampI = (i: number) => Math.max(0, Math.min(n - 1, i))
  const [si, setSi] = useState(() => clampI(start))
  const [turn, setTurn] = useState<Turn | null>(null)
  const live = useRef<Live>({
    si,
    view,
    turn: null,
    xm: null,
    beta: 0,
    raf: 0,
    end: null,
    drawn: false,
  })
  const cb = useRef({ setView, onSi, onRest })
  const stage = useRef<HTMLDivElement>(null)
  const shadow = useRef<HTMLDivElement>(null)
  const flap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const curl = useRef<{ curl: PageCurl; faces: FaceSource } | null>(null)
  const [gl, setGl] = useState(() => rb.renderSlide === undefined && glWanted())
  const rOf = (i: number) => curlRadius(slides[i], pw)

  /** the canvas draws the live state (at rest: the flat top sheet); false → the DOM sheets show */
  const glPaint = () => {
    const L = live.current
    const t = L.turn
    const c = canvas.current
    const pc = curl.current?.curl
    if (!c || !pc || (t && !t.gl)) return false
    const k = backing()
    const px = canvasPx(w, ph, k)
    if (c.width !== px.width || c.height !== px.height) {
      c.width = px.width
      c.height = px.height
    }
    return pc.draw(
      c,
      k,
      t
        ? {
            top: t.top,
            under: t.under,
            xm: L.xm ?? pw,
            beta: L.beta,
            r: rOf(t.top),
          }
        : { top: L.si, under: null, xm: pw, beta: 0, r: rOf(L.si) },
    )
  }
  // the live state: on the canvas or as the flat fold; fade: the top sheet's opacity
  const paint = () => {
    const L = live.current
    const on = glPaint()
    if (on) L.drawn = true
    const v = sheetPaint(pw, L.xm, L.turn?.dir)
    const st = stage.current
    if (st) {
      st.dataset.xm = v.xm
      st.dataset.gl = L.drawn ? '1' : '0'
      for (const el of st.querySelectorAll<HTMLElement>(':scope > .pt-sheet')) {
        const isTop = el.dataset.role === 'top'
        el.style.visibility = on ? 'hidden' : ''
        el.style.clipPath = isTop ? v.clip : ''
        el.style.opacity = isTop ? v.opacity : ''
      }
    }
    if (canvas.current) canvas.current.style.visibility = on ? '' : 'hidden'
    const f = v.fold
    if (on || f === null) return
    if (shadow.current) {
      Object.assign(shadow.current.style, {
        left: `${String(f.shadowLeft)}px`,
        width: `${String(f.shadowWidth)}px`,
      })
    }
    if (flap.current) {
      Object.assign(flap.current.style, {
        left: `${String(f.flapLeft)}px`,
        width: `${String(f.flapWidth)}px`,
      })
    }
  }
  const repaint = useRef(paint)
  useLayoutEffect(() => {
    cb.current = { setView, onSi, onRest }
    repaint.current = paint
    paint()
  })

  const begin = (t: Turn, xm: number, beta = 0) => {
    const L = live.current
    const pc = curl.current?.curl
    t.gl =
      !!pc &&
      L.drawn &&
      t.dir !== 'fade' &&
      pc.ready(t.top) &&
      pc.ready(t.under)
    L.turn = t
    L.xm = xm
    L.beta = beta
    // the re-render's layout effect paints (one GL draw per turn start)
    setTurn(t)
  }
  const keep = (i: number) => {
    curl.current?.curl.keep(i)
    curl.current?.faces.focus(slides[i]?.view ?? 0)
  }
  const commit = (i: number) => {
    const L = live.current
    L.turn = null
    L.xm = null
    L.beta = 0
    setTurn(null)
    if (i !== L.si) {
      L.si = i
      keep(i)
      setSi(i)
      cb.current.onSi(i)
      cb.current.onRest(i)
      const s = slides[i]
      if (s && s.view !== L.view) {
        L.view = s.view
        cb.current.setView(s.view)
      }
    }
    paint()
  }
  /** animate over ms (`frame` maps progress to xm / opacity), then `done` */
  const run = (ms: number, frame: (t: number) => void, done: () => void) => {
    const L = live.current
    const t0 = performance.now()
    const end = () => {
      cancelAnimationFrame(L.raf)
      L.end = null
      frame(1)
      done()
    }
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms)
      if (t >= 1) {
        end()
        return
      }
      frame(t)
      paint()
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
    begin({ top: L.si, under: i, dir: 'fade' }, 1)
    run(
      ms,
      (t) => {
        L.xm = fadeOpacity(t)
      },
      () => {
        commit(i)
      },
    )
  }
  /** a scripted turn from the bottom corner (backward: the same, reversed) */
  const script = (d: 1 | -1) => {
    const L = live.current
    const t = stepTurn(L.si, d, n)
    if (t === null) return
    const i = landing(t)
    if (reduced()) {
      fade(i, FADE_MS)
      return
    }
    const r = rOf(t.top)
    const s0 = scriptAt(pw, ph, r, d, 0)
    begin(t, s0.xm, s0.beta)
    run(
      SCRIPT_MS,
      (u) => {
        const s = scriptAt(pw, ph, r, d, u)
        L.xm = s.xm
        L.beta = s.beta
      },
      () => {
        commit(i)
      },
    )
  }
  /** release: animate xm to the end of the turn (`complete`) or back */
  const settle = (complete: boolean) => {
    const L = live.current
    const t = L.turn
    if (!t || L.xm === null) return
    const from = L.xm
    const b0 = L.beta
    const plan = settlePlan(t, complete, L.si, from, pw, rOf(t.top))
    run(
      plan.ms,
      (u) => {
        const s = settleAt(from, plan.to, b0, EASE(u))
        L.xm = s.xm
        L.beta = s.beta
      },
      () => {
        commit(plan.target)
      },
    )
  }

  const go = (d: number) => {
    finish()
    script(d > 0 ? 1 : -1)
  }
  const jump = (i: number) => {
    finish()
    fade(clampI(i), reduced() ? FADE_MS : JUMP_MS)
  }
  const api = useRef({ go, jump })
  useLayoutEffect(() => {
    api.current = { go, jump }
  })
  useImperativeHandle(ref, () => ({ go, jump }))

  // mount: report the start slide
  useLayoutEffect(() => {
    const L = live.current
    cb.current.onSi(L.si)
    cb.current.onRest(L.si)
    return () => {
      cancelAnimationFrame(L.raf)
    }
  }, [])
  // GL: the sheet textures; a failed load falls back to the CSS fold
  useEffect(() => {
    if (!gl) return
    let dead = false
    // read through a call so each await re-reads it
    const gone = () => dead
    let made: { curl: PageCurl; faces: FaceSource } | undefined
    const L = live.current
    void (async () => {
      try {
        const { openCurlGl } = await import('./roomGl')
        if (gone()) return
        made = await openCurlGl(
          { ...rb, pagePx: Math.round(pw * backing()) },
          slides.map(sheetOf),
          pw,
          ph,
        )
        if (gone()) {
          made.curl.dispose()
          made.faces.dispose()
          return
        }
        made.curl.onChange = () => {
          repaint.current()
        }
        curl.current = made
        made.curl.keep(L.si)
        made.faces.focus(slides[L.si]?.view ?? 0)
      } catch (e) {
        if (!gone()) {
          console.warn('PageTurn: GL failed, CSS fold', e)
          setGl(false)
        }
      }
    })()
    return () => {
      dead = true
      curl.current = null
      made?.curl.dispose()
      made?.faces.dispose()
      L.drawn = false
    }
  }, [gl, rb, slides, pw, ph])

  // a view change from outside (rotation, deep link, lightbox): jump there without animation
  useEffect(() => {
    const L = live.current
    L.view = view
    if (slides[L.si]?.view === view) return
    cancelAnimationFrame(L.raf)
    L.end = null
    const i = slideOfView(slides, view)
    L.turn = null
    L.xm = null
    L.beta = 0
    L.si = i
    keep(i)
    setTurn(null)
    setSi(i)
    cb.current.onSi(i)
    cb.current.onRest(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- an outside view change only; a new slide list must not jump the stage
  }, [view])

  // ← / → turn, Home / End jump
  useEffect(() => {
    if (!keys) return
    const k = (e: KeyboardEvent) => {
      const d = slideKey(e)
      if (d === null) return
      e.preventDefault()
      if (typeof d === 'number') api.current.go(d)
      else api.current.jump(d === 'home' ? 0 : n - 1)
    }
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener('keydown', k)
    }
  }, [keys, n])

  // drag: active once |dx| > 10 and |dx| > 1.5·|dy| (dead if |dy| > 10 first); tap
  const drag = useRef<Drag | null>(null)
  const follow = (g: Drag, x: number, y: number) => {
    const L = live.current
    const t = L.turn
    if (!t || reduced()) return
    const r = rOf(t.top)
    if (t.dir === 'fwd') {
      const s = followFwd(pw, ph, r, g.py, x - g.x0, y - g.y0)
      L.xm = s.xm
      L.beta = s.beta
    } else {
      L.xm = followBack(pw, w, r, g.x0, x - g.x0)
    }
    paint()
  }
  const onPointerDown = (e: PointerEvent) => {
    const st = stage.current
    if (drag.current || st === null) return
    finish()
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      t0: e.timeStamp,
      py: e.clientY - st.getBoundingClientRect().top,
      active: false,
      dead: false,
      dx: 0,
      trail: [],
    }
  }
  const onPointerMove = (e: PointerEvent) => {
    const g = drag.current
    if (g?.id !== e.pointerId || g.dead) return
    const dx = e.clientX - g.x0
    if (!g.active) {
      const intent = dragIntent(dx, e.clientY - g.y0)
      if (intent === 'wait') return
      const L = live.current
      // no forward drag on the last slide, no backward drag on the first
      const t =
        intent === 'dead' ? null : stepTurn(L.si, intent === 'fwd' ? 1 : -1, n)
      if (t === null) {
        g.dead = true
        return
      }
      g.active = true
      stage.current?.setPointerCapture(e.pointerId)
      if (!reduced()) begin(t, t.dir === 'fwd' ? pw : xmEnd(rOf(t.top)))
      else L.turn = t
    }
    g.dx = dx
    g.trail = pushTrail(g.trail, e.timeStamp, dx)
    follow(g, e.clientX, e.clientY)
  }
  const onPointerUp = (e: PointerEvent) => {
    const g = drag.current
    if (g?.id !== e.pointerId) return
    drag.current = null
    const L = live.current
    if (!g.active) {
      // a tap: the left half back, the right half on
      const st = stage.current
      if (st === null || g.dead) return
      const r = st.getBoundingClientRect()
      const d = tapStep(
        e.clientX - g.x0,
        e.clientY - g.y0,
        e.timeStamp - g.t0,
        e.clientX - r.left,
        r.width,
      )
      if (d !== null) go(d)
      return
    }
    const t = L.turn
    if (t === null) return
    if (reduced()) {
      L.turn = null
      if (reducedCompletes(t.dir, g.dx)) {
        fade(landing(t), FADE_MS)
      }
      return
    }
    // the release velocity over the last 80 ms of moves; a finger that rested: 0
    const v = releaseVelocity(g.trail, e.timeStamp)
    settle(releaseCompletes(t.dir, L.xm ?? pw, pw, rOf(t.top), v))
  }
  const onPointerCancel = (e: PointerEvent) => {
    const g = drag.current
    if (g?.id !== e.pointerId) return
    drag.current = null
    if (!g.active) return
    if (reduced()) live.current.turn = null
    else settle(false)
  }

  const topI = turn ? turn.top : si
  const underI = turn ? turn.under : null
  const fold = turn !== null && turn.dir !== 'fade' && turn.gl !== true
  const topSlide = slides[topI]
  const sheet = (i: number, role: 'top' | 'under') => {
    const s = slides[i]
    if (s === undefined) return null
    return (
      <div
        key={i}
        className="pt-sheet"
        style={{ width: pw, height: ph, zIndex: role === 'top' ? 2 : 1 }}
        data-testid="pt-sheet"
        data-role={role}
        role="group"
        aria-roledescription="page"
        aria-label={s.label}
        aria-hidden={role === 'under' || undefined}
      >
        <Paper rb={rb} s={s} pw={pw} ph={ph} on sheet />
      </div>
    )
  }
  const cover = topSlide?.page === undefined
  return (
    <div
      ref={stage}
      className="pt-stage"
      style={{ top, width: w, height: ph }}
      data-testid="pt-stage"
      role="region"
      aria-roledescription="book"
      aria-label={title}
      tabIndex={0}
      data-si={si}
      data-dir={turn && turn.dir !== 'fade' ? turn.dir : ''}
      data-turn={turn ? 'move' : 'rest'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className="pt-bed"
        style={{ width: pw, height: ph }}
        aria-hidden
        data-testid="pt-bed"
      />
      {gl && (
        <canvas
          ref={canvas}
          aria-hidden
          data-testid="pt-gl"
          className="pt-gl"
          style={{ top: -OV, width: w, height: ph + 2 * OV }}
        />
      )}
      {[topI, underI]
        .filter((i): i is number => i !== null)
        .sort((a, c) => a - c)
        .map((i) => sheet(i, i === topI ? 'top' : 'under'))}
      {fold && topSlide !== undefined && (
        <>
          <div
            ref={shadow}
            className="pt-shadow"
            style={{ height: ph }}
            aria-hidden
            data-testid="pt-shadow"
          />
          <div
            ref={flap}
            className="pt-flap"
            style={{
              height: ph,
              background: cover ? rb.entry.endpaper : undefined,
            }}
            aria-hidden
            data-testid="pt-flap"
          >
            {!cover && (
              <div className="pt-mirror" style={{ width: pw, height: ph }}>
                <Paper rb={rb} s={topSlide} pw={pw} ph={ph} on sheet />
              </div>
            )}
            <div className="pt-flap-shade" />
          </div>
        </>
      )}
    </div>
  )
})

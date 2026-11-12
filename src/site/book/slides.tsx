/*
 * Phone portrait reader (Designer D40; kit site-book/slides.tsx): one page
 * per slide on a native scroll-snap strip (`?reader=carousel`), and the
 * slide paper the page turn (turn.tsx) draws too. Slides: the cover, then
 * per spread the whole spread (a frame crosses the gutter) or each side with
 * a frame; blank pages and endpapers are skipped, no back cover.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { slideOfView, spreadRatio, type RoomSlide } from '../siteModel'
import { CoverFace, PageFace, SlideContent, type RoomBook } from '../SiteSlide'

export interface SlidesApi {
  go: (d: number) => void
  jump: (i: number) => void
}

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")"
const SHEEN =
  'linear-gradient(100deg, rgb(255 255 255/.08), rgb(255 255 255/0) 40%)'
const LAYER: CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  pointerEvents: 'none',
}

/**
 * Photo paper over a face: grain + sheen above the content. `x` / `w` place
 * the page under a paper-leaf strip so both stay continuous across strips.
 */
export function paperLayers(x = 0, w?: number): [CSSProperties, CSSProperties] {
  const box = w === undefined ? { left: 0, right: 0 } : { left: x, width: w }
  return [
    {
      ...LAYER,
      ...box,
      backgroundImage: GRAIN,
      backgroundSize: '160px',
      mixBlendMode: 'multiply',
      opacity: 0.03,
    },
    { ...LAYER, ...box, background: SHEEN },
  ]
}

/** The two paper layers as elements. */
export function PaperGrain({ x, w }: { x?: number; w?: number }) {
  const [grain, sheen] = paperLayers(x, w)
  return (
    <>
      <div aria-hidden style={grain} />
      <div aria-hidden style={sheen} />
    </>
  )
}

/**
 * Page size and rows for a w × h portrait screen: header 44 + 8 + page + 8 +
 * label 24, centred in [8, h − 64].
 */
export function portGeo(rb: RoomBook, w: number, h: number) {
  const rp = spreadRatio(rb.book.settings.trim) / 2
  const pw = Math.min(w - 32, (h - 172) * rp)
  const ph = pw / rp
  const gt = Math.max(8, 8 + (h - 72 - (ph + 84)) / 2)
  return { pw, ph, gt, stageTop: gt + 52, footTop: gt + 52 + ph + 8 }
}

/** The kind of a slide (tests read it as `data-kind`). */
export const slideKind = (s: RoomSlide): 'cover' | 'spread' | 'page' =>
  s.page === undefined ? 'cover' : s.page.side === 'both' ? 'spread' : 'page'

/**
 * A slide's paper. `sheet` (page turn): always pw × ph at the sheet origin,
 * a whole spread centred on it.
 */
export function Paper({
  rb,
  s,
  pw,
  ph,
  on,
  sheet = false,
}: {
  rb: RoomBook
  s: RoomSlide
  pw: number
  ph: number
  on: boolean
  sheet?: boolean
}) {
  const kind = slideKind(s)
  const sh = pw / spreadRatio(rb.book.settings.trim)
  const h = kind === 'spread' && !sheet ? sh : ph
  const page = s.page
  const spread =
    page === undefined ? null : rb.renderSlide === undefined ? (
      <SlideContent
        book={rb.book}
        images={rb.images}
        slide={page.spread + 1}
        width={pw}
      />
    ) : (
      rb.renderSlide(page.spread + 1, pw)
    )
  let content = null
  if (on && page === undefined) {
    content = <CoverFace b={rb.entry} w={pw} h={ph} />
  } else if (on && page !== undefined) {
    content = (
      <>
        {page.side !== 'both' ? (
          <PageFace
            book={rb.book}
            images={rb.images}
            spread={page.spread}
            side={page.side}
            pw={pw}
            renderSlide={rb.renderSlide}
          />
        ) : sheet ? (
          <div
            style={{ position: 'absolute', left: 0, top: (ph - sh) / 2 }}
            data-testid="pt-art"
          >
            {spread}
          </div>
        ) : (
          spread
        )}
        <PaperGrain />
      </>
    )
  }
  return (
    <div
      className="ps-paper"
      style={{
        top: (ph - h) / 2,
        width: pw,
        height: h,
        borderRadius: kind === 'cover' ? 2 : undefined,
        ...(sheet && { left: 0, boxShadow: 'none' }),
      }}
      data-testid="ps-paper"
    >
      {content}
    </div>
  )
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export interface SlidesProps {
  rb: RoomBook
  slides: readonly RoomSlide[]
  w: number
  top: number
  pw: number
  ph: number
  view: number
  setView: (v: number) => void
  /** the live slide (follows the finger) */
  si: number
  onSi: (i: number) => void
  /** the slide the strip came to rest on */
  onRest: (i: number) => void
  /** the slide to open on */
  start: number
  /** the book's name for the region */
  title: string
  /** window keys (← / →, Home / End); off under the lightbox and in the editor preview */
  keys: boolean
}

const KEY_STEP: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowLeft: -1,
}

/** Slide steps for a key event, or null when the event is not ours. */
export function slideKey(e: KeyboardEvent): number | 'home' | 'end' | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null
  const t = e.target as Partial<Element> | null
  if (t?.closest?.('input,textarea,select,[contenteditable]')) return null
  if (e.key === 'Home') return 'home'
  if (e.key === 'End') return 'end'
  return KEY_STEP[e.key] ?? null
}

/** The carousel (`?reader=carousel`). */
export const Slides = forwardRef<SlidesApi, SlidesProps>(function Slides(
  {
    rb,
    slides,
    w,
    top,
    pw,
    ph,
    view,
    setView,
    si,
    onSi,
    onRest,
    start,
    title,
    keys,
  },
  ref,
) {
  const strip = useRef<HTMLDivElement>(null)
  const pitch = pw + 16
  const n = slides.length
  const live = useRef({ si, view, aim: null as number | null, idle: 0 })
  const cb = useRef({ setView, onSi, onRest })
  useLayoutEffect(() => {
    cb.current = { setView, onSi, onRest }
  })
  const clampI = (i: number) => Math.max(0, Math.min(n - 1, i))
  const to = (i: number, smooth: boolean) => {
    live.current.aim = smooth ? i : null
    strip.current?.scrollTo({
      left: i * pitch,
      behavior: smooth ? 'smooth' : 'instant',
    })
  }
  const go = (d: number) => {
    const L = live.current
    const from = L.aim ?? L.si
    const i = clampI(from + d)
    if (i !== from) to(i, !reduced())
  }
  const api = useRef({ go, to })
  useLayoutEffect(() => {
    api.current = { go, to }
  })
  useImperativeHandle(ref, () => ({
    go: (d) => {
      api.current.go(d)
    },
    jump: (i) => {
      api.current.to(Math.max(0, Math.min(n - 1, i)), false)
    },
  }))

  // mount and a new pitch: rest on `start` (mount) or the current slide (resize)
  const mounted = useRef(false)
  useLayoutEffect(() => {
    const L = live.current
    const i = mounted.current ? L.si : Math.max(0, Math.min(n - 1, start))
    mounted.current = true
    strip.current?.scrollTo({ left: i * pitch, behavior: 'instant' })
    L.si = i
    cb.current.onSi(i)
    cb.current.onRest(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new pitch only: `start` applies on mount
  }, [pitch])
  // a view change from outside: jump there
  useEffect(() => {
    const L = live.current
    L.view = view
    if (slides[L.si]?.view === view) return
    const i = slideOfView(slides, view)
    api.current.to(i, false)
    L.si = i
    cb.current.onSi(i)
    cb.current.onRest(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- an outside view change only
  }, [view])

  // the live position on scroll; at rest (scrollend, else 150 ms quiet) the view follows
  useEffect(() => {
    const el = strip.current
    if (el === null) return
    const L = live.current
    el.dataset.scroll = 'rest'
    const settle = () => {
      el.dataset.scroll = 'rest'
      window.clearTimeout(L.idle)
      L.aim = null
      const s = slides[L.si]
      cb.current.onRest(L.si)
      if (s !== undefined && s.view !== L.view) {
        L.view = s.view
        cb.current.setView(s.view)
      }
    }
    const scroll = () => {
      el.dataset.scroll = 'move'
      const i = Math.max(
        0,
        Math.min(slides.length - 1, Math.round(el.scrollLeft / pitch)),
      )
      if (i !== L.si) {
        L.si = i
        cb.current.onSi(i)
      }
      window.clearTimeout(L.idle)
      L.idle = window.setTimeout(settle, 150)
    }
    el.addEventListener('scroll', scroll, { passive: true })
    el.addEventListener('scrollend', settle)
    return () => {
      el.removeEventListener('scroll', scroll)
      el.removeEventListener('scrollend', settle)
      window.clearTimeout(L.idle)
    }
  }, [pitch, slides])

  useEffect(() => {
    if (!keys) return
    const k = (e: KeyboardEvent) => {
      const d = slideKey(e)
      if (d === null) return
      e.preventDefault()
      if (typeof d === 'number') api.current.go(d)
      else api.current.to(d === 'home' ? 0 : n - 1, !reduced())
    }
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener('keydown', k)
    }
  }, [keys, n])

  // a tap (< 8 px, < 350 ms) turns: the left half back, the right half on
  const down = useRef<{ x: number; y: number; t: number } | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
  }
  const onPointerUp = (e: PointerEvent) => {
    const d = down.current
    down.current = null
    const el = strip.current
    if (
      d === null ||
      el === null ||
      Math.abs(e.clientX - d.x) >= 8 ||
      Math.abs(e.clientY - d.y) >= 8 ||
      e.timeStamp - d.t > 350
    )
      return
    const r = el.getBoundingClientRect()
    go(e.clientX - r.left < r.width / 2 ? -1 : 1)
  }

  return (
    <div
      ref={strip}
      className="ps-strip"
      style={{ top, height: ph, paddingInline: (w - pitch) / 2 }}
      data-testid="ps-strip"
      role="region"
      aria-roledescription="carousel"
      aria-label={title}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        down.current = null
      }}
    >
      {slides.map((s, i) => (
        <div
          key={i}
          className="ps-slide"
          style={{ width: pitch }}
          data-testid="ps-slide"
          data-kind={slideKind(s)}
          role="group"
          aria-roledescription="slide"
          aria-label={s.label}
        >
          <Paper rb={rb} s={s} pw={pw} ph={ph} on={Math.abs(i - si) <= 2} />
        </div>
      ))}
    </div>
  )
})

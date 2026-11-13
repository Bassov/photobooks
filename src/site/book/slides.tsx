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
  type PointerEvent,
} from 'react'
import { slideOfView, spreadRatio, type RoomSlide } from '../siteModel'
import { CoverFace, PageFace, SlideContent, type RoomBook } from '../SiteSlide'
import { slideKey, slideKind } from './roomLayout'
import {
  paperBox,
  paperLayers,
  stripSlide,
  tapStep,
  type Point,
} from './slidesGeo'

export interface SlidesApi {
  go: (d: number) => void
  jump: (i: number) => void
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
  const ratio = spreadRatio(rb.book.settings.trim)
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
            style={{
              position: 'absolute',
              left: 0,
              top: (ph - pw / ratio) / 2,
            }}
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
      style={paperBox(kind, pw, ph, ratio, sheet)}
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
      const i = stripSlide(el.scrollLeft, pitch, slides.length)
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
  const down = useRef<Point | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp }
  }
  const onPointerUp = (e: PointerEvent) => {
    const d = down.current
    down.current = null
    if (d === null) return
    const r = e.currentTarget.getBoundingClientRect()
    const up = { x: e.clientX, y: e.clientY, t: e.timeStamp }
    const step = tapStep(d, up, r.left, r.width)
    if (step !== null) go(step)
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

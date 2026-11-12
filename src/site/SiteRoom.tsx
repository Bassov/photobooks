/*
 * The reading room (Designer personal-site P5; port of the kit's
 * site-book/room.tsx): the book page, and the layer a home book opens.
 * Desktop: the reader centred between the head (y 44) and the foot row at
 * h − 54 (about · pager · Share · Fullscreen · Play on the 12-column grid);
 * narrow desktop (≤ 640): pager row, then about + buttons. Phone portrait
 * (w < 768, h > w): the page turn (`?reader=carousel`: the carousel) under a
 * "‹ Title" row with Share and Play, the label below; no Previous / Next, no
 * Fullscreen. Phone landscape (h < 500): the larger of the side and foot
 * layouts. Views: 0 cover, v spread v − 1, n + 1 back cover.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { glWanted } from './book/gl/three'
import { BookReader, type ReaderApi } from './book/reader'
import { portGeo, roomMode } from './book/roomLayout'
import { Slides, type SlidesApi } from './book/slides'
import { PageTurn } from './book/turn'
import { ShareButton } from './ShareButton'
import type { SiteBookData, SiteCatalogBook } from './siteInput'
import { SiteLightbox } from './SiteLightbox'
import {
  hashForSlide,
  homeHead,
  roomMeta,
  roomSlides,
  slideForHash,
  slideOfView,
  spreadRatio,
  viewLabel,
} from './siteModel'
import { CoverFace, type RenderSlide, type RoomBook } from './SiteSlide'
import { pageHref, sitePageUrl } from './siteUrl'
import { useViewport } from './useViewport'
import './book/room.css'

export type BookInput = SiteBookData

/** A host-controlled view (editor preview): the room touches no URL or window keys. */
export interface Embedded {
  slide: number
  onSlide: (slide: number) => void
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** the room fade, then the cover starts turning this much later */
export const FADE_MS = 240
export const COVER_DELAY_MS = 120
/** Play: the dwell after each turn */
export const DWELL_MS = 4000

/** the box the server lays the room out for */
const SERVER = { vw: 1440, vh: 900 }

/**
 * Desktop reader (site-stand-v7 R): [kx, ky, ty, dx] = the visible GL book's
 * width / W, height / H, top offset / H and centre right of the box centre / W.
 */
const BODY: Record<SiteCatalogBook['fmt'], readonly number[]> = {
  portrait: [0.8747, 0.8496, 0.0784, 0],
  landscape: [0.907, 0.894, 0.0533, 0.0006],
  square: [0.881, 0.8607, 0.0729, 0.0002],
}
/** the CSS reader (`?gl=0`, no WebGL2, the prerender) paints its whole box */
const CSS_BODY = [1, 1, 0, 0] as const

const ROW: CSSProperties = { display: 'flex', alignItems: 'center', height: 44 }

/**
 * Canonical book URL: the site URL when set, else this page without its hash
 * (the query stays: the sample site picks its book with `?book=`).
 */
function bookUrl(input: BookInput): string {
  const url = sitePageUrl(input.site.url, input.path)
  if (url !== undefined) return url
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}`
}

const carousel = () =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('reader') === 'carousel'

export function SiteRoom({
  input,
  onClose,
  over = false,
  embedded,
  allBooks = true,
  share = true,
  renderSlide,
}: {
  input: BookInput
  /** back to the home (opened over it): "All books", Esc, the phone back and swipe */
  onClose?: (() => void) | undefined
  /** opened over the home: fade in and turn the cover at once */
  over?: boolean
  embedded?: Embedded | undefined
  allBooks?: boolean
  share?: boolean
  renderSlide?: RenderSlide | undefined
}) {
  const { book, images, entry } = input
  const n = book.spreads.length
  const last = n + 1
  const root = useRef<HTMLDivElement>(null)
  const viewport = useViewport(root, { height: 'element' })
  const box = viewport ?? SERVER
  const rb = useMemo<RoomBook>(
    () => ({ entry, book, images, renderSlide }),
    [entry, book, images, renderSlide],
  )
  const api = useRef<ReaderApi>(null)
  const sapi = useRef<SlidesApi>(null)
  const mode = roomMode(box.vw, box.vh)
  const port = mode === 'port'
  const narrow = mode === 'desk' && box.vw <= 640
  const wide = mode === 'desk' && !narrow

  const [ownView, setOwnView] = useState(0)
  const view = embedded === undefined ? ownView : embedded.slide
  const isEmbedded = embedded !== undefined
  const setView = (v: number) => {
    const t = Math.max(0, Math.min(last, v))
    if (embedded !== undefined) {
      embedded.onSlide(t)
      return
    }
    setOwnView(t)
    const hash = hashForSlide(t, n)
    const { pathname, search } = window.location
    window.history.replaceState(
      window.history.state,
      '',
      hash === '' ? `${pathname}${search}` : hash,
    )
  }
  // The server renders the cover; the hash picks the view once hydrated.
  useLayoutEffect(() => {
    if (isEmbedded) return
    const read = () => {
      setOwnView(slideForHash(window.location.hash, n))
    }
    read()
    window.addEventListener('hashchange', read)
    return () => {
      window.removeEventListener('hashchange', read)
    }
  }, [n, isEmbedded])

  const slides = useMemo(() => roomSlides(book), [book])
  // portrait: the live slide (label) and the one the stage rests on (Play)
  const [si, setSi] = useState(() => slideOfView(slides, view))
  const [rest, setRest] = useState(si)
  const [rm] = useState<'carousel' | 'turn'>(() =>
    carousel() ? 'carousel' : 'turn',
  )
  const go = (d: number) => {
    if (port) sapi.current?.go(d)
    else api.current?.go(d)
  }
  const goRef = useRef(go)
  useLayoutEffect(() => {
    goRef.current = go
  })

  // the lightbox: spread i; the cover opens spread 0, the back cover the last
  const slideAt = (v: number) => Math.min(Math.max(v - 1, 0), n - 1)
  const [lb, setLb] = useState<number | null>(null)
  const fsBtn = useRef<HTMLButtonElement>(null)
  const shutLb = (i: number) => {
    setLb(null)
    api.current?.jump(i + 1)
    requestAnimationFrame(() => {
      fsBtn.current?.focus()
    })
  }

  // opened over the home: the closed cover turns once the fade is done
  useEffect(() => {
    if (!over || port) return
    const t = window.setTimeout(
      () => {
        if (live.current.view === 0) goRef.current(1)
      },
      reduced() ? 0 : FADE_MS + COVER_DELAY_MS,
    )
    return () => {
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on open only: a later return to the cover must not turn it again
  }, [])
  const live = useRef({ view, lb, onClose })
  useLayoutEffect(() => {
    live.current = { view, lb, onClose }
  })
  // Esc closes the room (the lightbox takes its own Esc)
  useEffect(() => {
    if (isEmbedded) return
    const k = (e: KeyboardEvent) => {
      const { lb: open, onClose: close } = live.current
      if (e.key !== 'Escape' || open !== null || close === undefined) return
      e.preventDefault()
      close()
    }
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener('keydown', k)
    }
  }, [isEmbedded])

  // autoplay: `delay` = the turn still running when the dwell starts; `n` restarts the line
  const pos = port ? rest : view
  const end = port ? slides.length - 1 : last
  const [play, setPlay] = useState<{ delay: number; n: number } | null>(null)
  const turnMs = (a: number, z: number) => {
    if (port) return 0
    if (reduced() || Math.abs(z - a) !== 1) return 240
    return Math.min(a, z) === 0 || Math.max(a, z) === last ? 1000 : 820
  }
  const prevPos = useRef(pos)
  useEffect(() => {
    const a = prevPos.current
    prevPos.current = pos
    if (a === pos) return
    // a turn landed: the next dwell starts from it
    setPlay((p) =>
      !p || pos >= end ? null : { delay: turnMs(a, pos), n: p.n + 1 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a position change only; end / turnMs are read at that moment
  }, [pos])
  useEffect(() => {
    if (!play) return
    const t = window.setTimeout(() => {
      goRef.current(1)
    }, play.delay + DWELL_MS)
    return () => {
      window.clearTimeout(t)
    }
  }, [play])
  const playing = play !== null
  useEffect(() => {
    if (!playing) return
    // Play itself toggles (its click, Enter, Space); everything else pauses
    const stop = (e: Event) => {
      const t = e.target as Partial<Element> | null
      const own = t?.closest?.('[data-testid="site-play"]') != null
      if (
        !own ||
        (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ')
      ) {
        setPlay(null)
      }
    }
    const vis = () => {
      if (document.hidden) setPlay(null)
    }
    window.addEventListener('keydown', stop, true)
    window.addEventListener('pointerdown', stop, true)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('keydown', stop, true)
      window.removeEventListener('pointerdown', stop, true)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [playing])
  const toggle = () => {
    if (play) {
      setPlay(null)
      return
    }
    setPlay({ delay: 0, n: 0 })
    // at the end: page 1 first (portrait: at once)
    if (pos >= end) {
      if (port) sapi.current?.jump(1)
      else setView(1)
    }
  }

  const swipe = useSwipeBack(root, mode !== 'desk', box.vw, onClose)

  const txt = wide ? 't16' : 'm15'
  const label = port ? (slides[si]?.label ?? '') : viewLabel(view, n)
  const prev = port ? si <= 0 : view <= 0
  const next = port ? si >= end : view >= last
  const homeHref = pageHref(input.catalogHref)
  const closeClick = (e: { preventDefault: () => void }) => {
    if (onClose === undefined) return
    e.preventDefault()
    onClose()
  }

  const playBtn = (
    <button
      type="button"
      className={`${txt} sb-play`}
      aria-pressed={playing}
      onClick={toggle}
      data-testid="site-play"
    >
      {playing ? 'Pause' : 'Play'}
      {play && (
        <span
          key={play.n}
          className="sb-prog"
          style={{
            animationDelay: `${String(play.delay)}ms`,
            animationDuration: `${String(DWELL_MS)}ms`,
          }}
          data-testid="site-progress"
        />
      )}
    </button>
  )
  const btn = (d: -1 | 1) => (
    <button
      type="button"
      className={`${txt} g ss-tx`}
      style={{ minHeight: 44 }}
      disabled={d < 0 ? prev : next}
      onClick={() => {
        go(d)
      }}
      data-testid={d < 0 ? 'site-prev' : 'site-next'}
    >
      {d < 0 ? 'Previous' : 'Next'}
    </button>
  )
  const lbl = (
    <span className="t13 g" aria-live="polite" data-testid="site-label">
      {label}
    </span>
  )
  const back = (style?: CSSProperties) =>
    allBooks ? (
      <a
        className="m15 sb-back"
        style={{ display: 'flex', alignItems: 'center', ...style }}
        href={homeHref}
        onClick={closeClick}
        aria-label="All books"
        data-testid="site-all-books"
      >
        <span className="g" aria-hidden>
          ‹
        </span>
        &nbsp;{entry.title}
      </a>
    ) : (
      <span className="m15 sb-back" style={style}>
        {entry.title}
      </span>
    )
  const shareBtn = share && (
    <ShareButton
      className={txt}
      title={entry.title}
      url={() => bookUrl(input)}
    />
  )
  const fullBtn = mode === 'desk' && (
    <button
      type="button"
      ref={fsBtn}
      className={`${txt} g ss-tx`}
      style={{ minHeight: 44 }}
      onClick={() => {
        setLb(slideAt(view))
      }}
      data-testid="site-fullscreen-btn"
    >
      Fullscreen
    </button>
  )
  const lightbox = lb !== null && (
    <SiteLightbox rb={rb} start={lb} onClose={shutLb} />
  )
  const roomProps = {
    ref: root,
    className: 'ss sb-room',
    'data-testid': 'site-room',
    'data-mode': mode,
    'data-view': view,
    'data-over': over ? '' : undefined,
    'data-embedded': isEmbedded ? '' : undefined,
    'data-full': lb === null ? undefined : '',
    ...swipe,
  }
  const keys = !isEmbedded && lb === null

  if (port && viewport !== null) {
    const g = portGeo(rb, box.vw, box.vh)
    const stage = {
      ref: sapi,
      rb,
      slides,
      w: box.vw,
      top: g.stageTop,
      pw: g.pw,
      ph: g.ph,
      view,
      setView,
      si,
      onSi: setSi,
      onRest: setRest,
      start: rest,
      title: entry.title,
      keys,
    }
    return (
      <div {...roomProps}>
        {/* the rows pass over a curl that overhangs the stage (≤ 24 px) */}
        <div
          className="ss-abs"
          style={{
            ...ROW,
            left: 16,
            right: 16,
            top: g.gt,
            justifyContent: 'space-between',
            gap: 20,
            zIndex: 2,
          }}
        >
          {back()}
          <div style={{ ...ROW, gap: 20, flex: 'none' }}>
            {shareBtn}
            {playBtn}
          </div>
        </div>
        {rm === 'turn' ? <PageTurn {...stage} /> : <Slides {...stage} />}
        <div
          className="ss-abs"
          style={{
            left: 16,
            right: 16,
            top: g.footTop,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          {lbl}
        </div>
      </div>
    )
  }

  const R = spreadRatio(book.settings.trim)
  const reader = (rw: number, left: number, top: number) => (
    <div className="ss-abs" style={{ left, top }} data-testid="site-reader">
      {viewport === null ? (
        <ClosedCover entry={entry} w={rw} h={rw / R} />
      ) : (
        <BookReader
          ref={api}
          rb={rb}
          view={view}
          onView={setView}
          width={rw}
          keys={keys}
        />
      )}
    </div>
  )

  if (mode === 'land') {
    const B = 136
    const W1 = Math.min(box.vw - 2 * B, (box.vh - 24) * R)
    const W3 = Math.min(box.vw - 32, (box.vh - 64) * R)
    const side = W1 >= W3
    const rw = side ? W1 : W3
    const rh = rw / R
    const bottom = box.vh - 52
    return (
      <div {...roomProps} data-layout={side ? 'side' : 'foot'}>
        {reader(
          rw,
          (box.vw - rw) / 2,
          side ? (box.vh - rh) / 2 : 8 + (box.vh - 64 - rh) / 2,
        )}
        {side ? (
          <>
            {back({
              position: 'absolute',
              left: 16,
              top: 8,
              maxWidth: B - 24,
            })}
            <div
              className="ss-abs"
              style={{ ...ROW, right: 16, top: 8, gap: 20 }}
            >
              {shareBtn}
              {playBtn}
            </div>
            <div className="ss-abs" style={{ ...ROW, left: 16, top: bottom }}>
              {lbl}
            </div>
          </>
        ) : (
          // 1fr auto 1fr keeps the label centred
          <div
            className="ss-abs"
            style={{
              ...ROW,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
              columnGap: 16,
              left: 16,
              right: 16,
              top: bottom,
            }}
          >
            {back({ justifySelf: 'start', maxWidth: '100%' })}
            <div style={{ ...ROW, gap: 24 }}>{lbl}</div>
            <div style={{ ...ROW, justifySelf: 'end', gap: 20 }}>
              {shareBtn}
              {playBtn}
            </div>
          </div>
        )}
        {lightbox}
      </div>
    )
  }

  // desktop: grid M 24 / 16, G 16 / 12, 12 / 4 columns
  const M = narrow ? 16 : 24
  const G = narrow ? 12 : 16
  const C = narrow ? 4 : 12
  const col = (box.vw - 2 * M - (C - 1) * G) / C
  const span = (k: number) => k * col + (k - 1) * G
  const x = (k: number) => M + k * (col + G)
  const top = narrow ? 64 : 72
  const foot = narrow ? 104 : 96
  let rw = Math.max(
    200,
    Math.min(span(narrow ? 4 : 10), (box.vh - top - foot) * R),
  )
  let bookTop = top + (box.vh - top - foot - rw / R) / 2
  let footTop = bookTop + rw / R + 24
  let shift = 0
  if (wide) {
    // stand-v8: the visible book centred in [44 (the head's bottom), footTop],
    // ≥ 32 above and below, ≥ 64 each side
    const gl = viewport !== null && renderSlide === undefined && glWanted()
    const [kx = 1, ky = 1, ty = 0, dx = 0] = gl ? BODY[entry.fmt] : CSS_BODY
    const A = 44
    footTop = box.vh - 54
    rw = Math.max(
      200,
      Math.min((box.vw - 128) / kx, ((footTop - A - 64) * R) / ky),
    )
    const H = rw / R
    bookTop = (A + footTop) / 2 - (ky * H) / 2 - ty * H
    shift = dx * rw
  }
  const bookLeft = (box.vw - rw) / 2 - shift
  const about = (
    <p className="sb-about" data-testid="site-about">
      <span className={wide ? 't16' : 'm15'}>{entry.title}</span>
      <span className="t13 g" style={{ marginLeft: 8 }}>
        {roomMeta(entry)}
      </span>
    </p>
  )
  const pager = (
    <div
      className="ss-abs"
      style={{
        ...ROW,
        top: footTop,
        justifyContent: 'center',
        gap: wide ? 40 : 24,
        ...(wide ? { left: x(4), width: span(4) } : { left: M, right: M }),
      }}
      data-testid="site-pager"
    >
      {btn(-1)}
      {lbl}
      {btn(1)}
    </div>
  )
  return (
    <div {...roomProps}>
      {!isEmbedded && (
        <p className="ss-name" data-testid="site-name">
          {homeHead(input.site)}
        </p>
      )}
      {allBooks && (
        <a
          className="t16 g ss-tx ss-abs sb-all"
          href={homeHref}
          onClick={closeClick}
          data-testid="site-all-books"
        >
          All books
        </a>
      )}
      {reader(rw, bookLeft, bookTop)}
      {wide && (
        <div
          className="ss-abs"
          style={{ ...ROW, left: x(0), top: footTop, width: span(4) }}
        >
          {about}
        </div>
      )}
      {pager}
      {wide ? (
        <div
          className="ss-abs"
          style={{
            ...ROW,
            left: x(9),
            width: span(3),
            top: footTop,
            justifyContent: 'flex-end',
            gap: 24,
          }}
          data-testid="site-actions"
        >
          {shareBtn}
          {fullBtn}
          {playBtn}
        </div>
      ) : (
        <div
          className="ss-abs"
          style={{ ...ROW, left: M, right: M, top: footTop + 44 + 16, gap: 16 }}
          data-testid="site-actions"
        >
          {about}
          <div style={{ ...ROW, gap: 24, flex: 'none' }}>
            {shareBtn}
            {fullBtn}
            {playBtn}
          </div>
        </div>
      )}
      {lightbox}
    </div>
  )
}

/** The prerendered book (D42): the closed cover where the reader rests on view 0. */
function ClosedCover({
  entry,
  w,
  h,
}: {
  entry: SiteCatalogBook
  w: number
  h: number
}): ReactNode {
  return (
    <div
      style={{
        position: 'absolute',
        left: w / 4,
        top: 0,
        width: w / 2,
        height: h,
      }}
      data-testid="site-closed-cover"
    >
      <CoverFace b={entry} w={w / 2} h={h} />
    </div>
  )
}

/** The room following the finger by `dx`, or sliding there in `ms`. */
function paintSwipe(el: HTMLElement | null, dx: number, ms: number) {
  if (el === null) return
  // data-swipe: "move" while the room follows the finger or slides (tests wait on it)
  el.dataset.swipe = dx || ms ? 'move' : ''
  el.style.transition = ms
    ? `transform ${String(ms)}ms var(--ease-out), box-shadow ${String(ms)}ms var(--ease-out)`
    : 'none'
  el.style.transform = dx ? `translate3d(${String(dx)}px,0,0)` : ''
  el.style.boxShadow = dx ? '-16px 0 32px rgb(0 0 0 / .5)' : ''
}

/**
 * Swipe back (D25; touch and pen on phones): a rightward swipe that starts
 * outside the book follows the finger once dx > 10 and dx > 1.5·|dy|
 * (abandoned if |dy| > 10 or dx < −10 comes first); a release past 0.25·w or
 * faster than 0.5 px/ms (over the last 80 ms) slides the room out in 200 ms
 * and closes it, else it springs back. Reduced motion: no follow.
 */
function useSwipeBack(
  root: RefObject<HTMLDivElement | null>,
  on: boolean,
  w: number,
  onClose: (() => void) | undefined,
) {
  const s = useRef<{
    id: number
    x0: number
    y0: number
    active: boolean
    dx: number
    trail: [number, number][]
  } | null>(null)
  const timer = useRef(0)
  // the click that may follow an active swipe's release is swallowed
  const swallow = useRef(false)
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )
  if (!on || onClose === undefined) return {}
  const paint = (dx: number, ms: number) => {
    paintSwipe(root.current, dx, ms)
  }
  const end = (e: PointerEvent, cancel: boolean) => {
    const g = s.current
    if (g?.id !== e.pointerId) return
    s.current = null
    if (!g.active) return
    window.setTimeout(() => {
      swallow.current = false
    }, 0)
    const t = e.timeStamp
    const was = g.trail.find(([tt]) => t - tt <= 80) ?? [t, g.dx]
    const v = t > was[0] ? (g.dx - was[1]) / (t - was[0]) : 0
    const shut = !cancel && (g.dx > 0.25 * w || v > 0.5)
    if (reduced()) {
      if (shut) onClose()
      return
    }
    paint(shut ? w : 0, 200)
    timer.current = window.setTimeout(() => {
      if (shut) onClose()
      else paint(0, 0)
    }, 200)
  }
  return {
    style: { touchAction: 'none' } as CSSProperties,
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || s.current) return
      const t = e.target as Element
      if (
        t.closest(
          '[data-testid="ps-strip"],[data-testid="pt-stage"],[data-testid="site-reader"]',
        )
      ) {
        return
      }
      s.current = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        active: false,
        dx: 0,
        trail: [],
      }
    },
    onPointerMove: (e: PointerEvent) => {
      const g = s.current
      if (g?.id !== e.pointerId) return
      const dx = e.clientX - g.x0
      const dy = e.clientY - g.y0
      if (!g.active) {
        if (Math.abs(dy) > 10 || dx < -10) {
          s.current = null
          return
        }
        if (!(dx > 10 && dx > 1.5 * Math.abs(dy))) return
        g.active = true
        root.current?.setPointerCapture(e.pointerId)
        swallow.current = true
      }
      g.dx = Math.max(0, dx)
      g.trail = [
        ...g.trail.filter(([t]) => e.timeStamp - t <= 80),
        [e.timeStamp, g.dx],
      ]
      if (!reduced()) paint(g.dx, 0)
    },
    onClickCapture: (e: {
      stopPropagation: () => void
      preventDefault: () => void
    }) => {
      if (swallow.current) {
        e.stopPropagation()
        e.preventDefault()
      }
    },
    onPointerUp: (e: PointerEvent) => {
      end(e, false)
    },
    onPointerCancel: (e: PointerEvent) => {
      end(e, true)
    },
  }
}

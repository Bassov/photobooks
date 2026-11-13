/*
 * The reading room (Designer personal-site P5; port of the kit's
 * site-book/room.tsx): the book page, and the layer a home book opens.
 * Desktop: the reader centred between the head (y 44) and the foot row at
 * h − 54 (about · pager · Share · Fullscreen · Play on the 12-column grid);
 * narrow desktop (≤ 640): pager row, then about + buttons. Phone portrait
 * (w < 768, h > w): the page turn (`?reader=carousel`: the carousel) under a
 * "‹ Title" row with Share and Play, the label below; no Previous / Next, no
 * Fullscreen. Phone landscape (h < 500): the larger of the side and foot
 * layouts (`roomModel`). Views: 0 cover, v spread v − 1, n + 1 back cover.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { glWanted } from './book/gl/three'
import { BookReader, type ReaderApi } from './book/reader'
import { portGeo, roomMode } from './book/roomLayout'
import { Slides, type SlidesApi } from './book/slides'
import { PageTurn } from './book/turn'
import {
  CSS_BODY,
  deskGeo,
  GL_BODY,
  LAND_SIDE,
  landGeo,
  lightboxSlide,
  pausesPlay,
  SERVER_BOX,
  turnMs,
  wideDesk,
} from './roomModel'
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
import { useSwipeBack } from './useSwipeBack'
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

/** `?reader=carousel` (none on the server) */
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
  const box = viewport ?? SERVER_BOX
  const rb = useMemo<RoomBook>(
    () => ({ entry, book, images, renderSlide }),
    [entry, book, images, renderSlide],
  )
  const api = useRef<ReaderApi>(null)
  const sapi = useRef<SlidesApi>(null)
  const mode = roomMode(box.vw, box.vh)
  const port = mode === 'port'
  const wide = mode === 'desk' && wideDesk(box.vw)

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
  // the latest view and close for timers and window keys
  const viewNow = useRef(view)
  const closeNow = useRef(onClose)
  useLayoutEffect(() => {
    goRef.current = go
    viewNow.current = view
    closeNow.current = onClose
  })

  // the lightbox: spread i (`lightboxSlide`); closing it rests the reader on spread i
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
        if (viewNow.current === 0) goRef.current(1)
      },
      reduced() ? 0 : FADE_MS + COVER_DELAY_MS,
    )
    return () => {
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on open only: a later return to the cover must not turn it again
  }, [])
  // Esc closes the room (the lightbox takes its own Esc before it gets here)
  useEffect(() => {
    if (isEmbedded) return
    const k = (e: KeyboardEvent) => {
      const close = closeNow.current
      if (e.key !== 'Escape' || close === undefined) return
      e.preventDefault()
      close()
    }
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener('keydown', k)
    }
  }, [isEmbedded])

  // autoplay: `play` = the turn still running when the dwell starts (ms)
  const pos = port ? rest : view
  const end = port ? slides.length - 1 : last
  const [play, setPlay] = useState<number | null>(null)
  const prevPos = useRef(pos)
  useEffect(() => {
    const a = prevPos.current
    prevPos.current = pos
    if (a === pos) return
    // a turn landed: the next dwell starts from it
    setPlay((p) =>
      p === null || pos >= end
        ? null
        : port
          ? 0
          : turnMs(a, pos, last, reduced()),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a position change only; end / port are read at that moment
  }, [pos])
  useEffect(() => {
    if (play === null) return
    const t = window.setTimeout(() => {
      goRef.current(1)
    }, play + DWELL_MS)
    return () => {
      window.clearTimeout(t)
    }
  }, [play])
  const playing = play !== null
  useEffect(() => {
    if (!playing) return
    const stop = (e: Event) => {
      if (pausesPlay(e)) setPlay(null)
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
    if (playing) {
      setPlay(null)
      return
    }
    setPlay(0)
    // at the end: page 1 first (portrait: at once)
    if (pos >= end) {
      if (port) sapi.current?.jump(1)
      else setView(1)
    }
  }

  const swipe = useSwipeBack(
    mode === 'desk' ? undefined : onClose,
    box.vw,
    reduced,
  )

  const txt = wide ? 't16' : 'm15'
  const label = port ? (slides[si]?.label ?? '') : viewLabel(view, n)
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
      {playing && (
        <span
          key={pos}
          className="sb-prog"
          style={{
            animationDelay: `${String(play)}ms`,
            animationDuration: `${String(DWELL_MS)}ms`,
          }}
          data-testid="site-progress"
        />
      )}
    </button>
  )
  const step = (testId: string, text: string, d: number, off: boolean) => (
    <button
      type="button"
      className={`${txt} g ss-tx`}
      style={{ minHeight: 44 }}
      disabled={off}
      onClick={() => {
        go(d)
      }}
      data-testid={testId}
    >
      {text}
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
  const lightbox = lb !== null && (
    <SiteLightbox rb={rb} start={lb} onClose={shutLb} />
  )

  if (port) {
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
    const g = landGeo(box.vw, box.vh, R)
    return (
      <div {...roomProps} data-layout={g.side ? 'side' : 'foot'}>
        {reader(g.reader.w, g.reader.left, g.reader.top)}
        {g.side ? (
          <>
            {back({
              position: 'absolute',
              left: 16,
              top: 8,
              maxWidth: LAND_SIDE - 24,
            })}
            <div
              className="ss-abs"
              style={{ ...ROW, right: 16, top: 8, gap: 20 }}
            >
              {shareBtn}
              {playBtn}
            </div>
            <div className="ss-abs" style={{ ...ROW, left: 16, top: g.rowTop }}>
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
              top: g.rowTop,
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

  // the GL reader paints a smaller book in its box (wide desktop centres that)
  const gl = viewport !== null && renderSlide === undefined && glWanted()
  const g = deskGeo(box.vw, box.vh, R, gl ? GL_BODY[entry.fmt] : CSS_BODY)
  const about = (
    <p className="sb-about" data-testid="site-about">
      <span className={txt}>{entry.title}</span>
      <span className="t13 g" style={{ marginLeft: 8 }}>
        {roomMeta(entry)}
      </span>
    </p>
  )
  const buttons = (
    <>
      {shareBtn}
      <button
        type="button"
        ref={fsBtn}
        className={`${txt} g ss-tx`}
        style={{ minHeight: 44 }}
        onClick={() => {
          setLb(lightboxSlide(view, n))
        }}
        data-testid="site-fullscreen-btn"
      >
        Fullscreen
      </button>
      {playBtn}
    </>
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
      {reader(g.reader.w, g.reader.left, g.reader.top)}
      {g.about !== null && (
        <div
          className="ss-abs"
          style={{
            ...ROW,
            left: g.about.left,
            top: g.footTop,
            width: g.about.width,
          }}
        >
          {about}
        </div>
      )}
      <div
        className="ss-abs"
        style={{
          ...ROW,
          top: g.footTop,
          justifyContent: 'center',
          gap: wide ? 40 : 24,
          ...g.pager,
        }}
        data-testid="site-pager"
      >
        {step('site-prev', 'Previous', -1, view <= 0)}
        {lbl}
        {step('site-next', 'Next', 1, view >= last)}
      </div>
      {wide ? (
        <div
          className="ss-abs"
          style={{
            ...ROW,
            ...g.actions,
            top: g.actionsTop,
            justifyContent: 'flex-end',
            gap: 24,
          }}
          data-testid="site-actions"
        >
          {buttons}
        </div>
      ) : (
        <div
          className="ss-abs"
          style={{ ...ROW, ...g.actions, top: g.actionsTop, gap: 16 }}
          data-testid="site-actions"
        >
          {about}
          <div style={{ ...ROW, gap: 24, flex: 'none' }}>{buttons}</div>
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

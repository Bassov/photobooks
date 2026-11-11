/* ReadingRoom (Spec site-stand S6, site-stand-v2 S, v7 R / P, D31–D32, stand-v8): the open book over the personal site,
   opened by the sys shell. Grid M 24 / 16, G 16 / 12, 12 / 4 columns. Desktop: the visible GL book (BODY) centred
   between the head (y 44) and the foot row (pinned at h − 54), as large as fits ≥ 32 above / below and ≥ 64 each side;
   the foot: title + meta (cols 0–3), Previous · label · Next (cols 4–7), Play (cols 9–11). Narrow desktop: top 64, foot
   104. Phone portrait (w < 768, h > w, site-stand-v5 R / D23–D24): Page turn (turn.tsx; `&reader=carousel` gives the
   carousel, slides.tsx); a row above holds "‹ Title" (back) and Play, the label centred below; no Previous / Next, no
   Reader switch, whole-spread slides have no gutter fold. Landscape phone (h < 500, v5 L / D26): the larger of side
   (W = min(w − 272, (h − 24)·R), centred; back + Play top, the label bottom, in 136 px bands) and foot
   (W = min(w − 32, (h − 64)·R) over one row at h − 52: back, label, Play). Opens with a 240 ms fade, focuses the book; at
   view 0 the cover turns 120 ms after the fade (not in portrait: it opens on the cover slide); ← / → turn.
   Swipe back (D25, phones): a rightward swipe that starts outside the book pulls the room aside and closes it.
   Play (fresh C's auto page-turn, D4): after each turn ends wait 4000 ms and turn; stops at the back cover (portrait: the
   last slide); any key, click or drag (outside Play) and a hidden tab pause it; a 1 px line under the label grows over
   the dwell. The autoplay lives here, not in reader.tsx: it drives the reader through its `go` API only. */
import * as React from "react"
import { metaOf, pagesOf, SPREAD_R, viewLabel, viewsOf, type SiteBook } from "../site/sample"
import type { Box } from "./box"
import { glWanted } from "./gl/three"
import { BookReader, type ReaderApi } from "./reader"
import { portGeo, Slides, slideOfView, slidesOf, type SlidesApi } from "./slides"
import { PageTurn } from "./turn"
import "./room.css"

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
type Mode = "port" | "land" | "desk"
export const roomMode = (box: Box): Mode => (box.w < 768 && box.h > box.w ? "port" : box.w > box.h && box.h < 500 ? "land" : "desk")
/** the room fade, then the cover starts turning this much later */
export const FADE_MS = 240, COVER_DELAY_MS = 120

type RoomProps = {
  b: SiteBook; view: number; setView: (v: number) => void; dark?: boolean; box: Box
  /** back to the list (the room's back button, swipe back) */
  onClose?: () => void
  /** a swipe back is pulling the room aside: the home layer shows under it */
  onPeek?: (on: boolean) => void
}

/** desktop reader (site-stand-v7 R): [kx, ky, ty, dx] = the visible GL book's width / W, height / H, top offset / H
   and centre right of the box centre / W, at view 1 (stand-v8: alpha ≥ 200 paint at 1280–1920 wide) */
const BODY: Record<keyof typeof SPREAD_R, readonly [number, number, number, number]> = {
  portrait: [0.8747, 0.8496, 0.0784, 0], landscape: [0.907, 0.894, 0.0533, 0.0006], square: [0.881, 0.8607, 0.0729, 0.0002],
}
/** the CSS reader (`gl=0`, no WebGL 2) paints its whole box */
const CSS_BODY = [1, 1, 0, 0] as const

export function ReadingRoom({ b, view, setView, dark, box, onClose, onPeek }: RoomProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const api = React.useRef<ReaderApi>(null)
  const sapi = React.useRef<SlidesApi>(null)
  const mode = roomMode(box), nar = box.narrow, wide = mode === "desk" && !nar, port = mode === "port"
  const M = nar ? 16 : 24, G = nar ? 12 : 16, C = nar ? 4 : 12
  const col = (box.w - 2 * M - (C - 1) * G) / C, span = (k: number) => k * col + (k - 1) * G, x = (k: number) => M + k * (col + G)
  const R = SPREAD_R[b.fmt], last = viewsOf(b) - 1
  const slides = React.useMemo(() => slidesOf(b), [b])
  // portrait: the live slide (label, Previous / Next) and the one the strip rests on (Play)
  const [si, setSi] = React.useState(() => slideOfView(slides, view))
  const [rest, setRest] = React.useState(si)
  // portrait reader mode (stand-v8): Page turn always, `&reader=carousel` keeps the carousel for comparison
  const [rm] = React.useState<"carousel" | "turn">(() => (/[?&]reader=carousel(&|$)/.test(location.hash) ? "carousel" : "turn"))
  const go =(d: number) => (port ? sapi.current?.go(d) : api.current?.go(d))
  const goRef = React.useRef(go)
  goRef.current = go

  // open, a new mode (the first render may come before the box is measured) and a reader switch: focus the book, no ring
  React.useEffect(() => {
    root.current?.querySelector<HTMLElement>('[role="region"]')?.focus({ preventScroll: true, focusVisible: false } as FocusOptions)
  }, [mode, rm])
  // a closed cover turns once the fade is done (not in portrait)
  React.useEffect(() => {
    const t = view === 0 && !port ? setTimeout(() => goRef.current(1), reduced() ? 0 : FADE_MS + COVER_DELAY_MS) : 0
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on open only: a later return to the cover must not turn it again
  }, [])

  // autoplay: `delay` = the turn still running when the dwell starts; `n` restarts the progress line
  const pos = port ? rest : view, end = port ? slides.length - 1 : last, dwell = 4000
  const [play, setPlay] = React.useState<{ delay: number; n: number } | null>(null)
  const turnMs = (a: number, z: number) => {
    if (port) return 0
    if (reduced() || Math.abs(z - a) !== 1) return 240
    return Math.min(a, z) === 0 || Math.max(a, z) === last ? 1000 : 820
  }
  const prevPos = React.useRef(pos)
  React.useEffect(() => {
    const a = prevPos.current
    prevPos.current = pos
    if (a !== pos) setPlay((p) => (!p || pos >= end ? null : { delay: turnMs(a, pos), n: p.n + 1 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a position change only; end / turnMs (new every render) are read at that moment
  }, [pos])
  React.useEffect(() => {
    if (!play) return
    const t = setTimeout(() => goRef.current(1), play.delay + dwell)
    return () => clearTimeout(t)
  }, [play, dwell])
  const playing = !!play
  React.useEffect(() => {
    if (!playing) return
    // Play itself toggles (its click, Enter, Space); everything else pauses
    const stop = (e: Event) => {
      const own = !!(e.target as Element | null)?.closest?.('[data-testid="site-play"]')
      if (!own || (e instanceof KeyboardEvent && e.key !== "Enter" && e.key !== " ")) setPlay(null)
    }
    const vis = () => { if (document.hidden) setPlay(null) }
    addEventListener("keydown", stop, true); addEventListener("pointerdown", stop, true)
    document.addEventListener("visibilitychange", vis)
    return () => {
      removeEventListener("keydown", stop, true); removeEventListener("pointerdown", stop, true)
      document.removeEventListener("visibilitychange", vis)
    }
  }, [playing])
  const toggle = () => {
    if (play) return setPlay(null)
    setPlay({ delay: 0, n: 0 })
    // at the end: page 1 first (portrait: at once)
    if (pos >= end) { if (port) sapi.current?.jump(1); else setView(1) }
  }

  const swipe = useSwipeBack(root, mode !== "desk", box.w, onClose, onPeek)

  const txt = nar || mode !== "desk" ? "m15" : "t16"
  let label = port ? slides[si]?.label ?? "" : viewLabel(b, view)
  if (!port && label.startsWith("Page")) label += ` of ${pagesOf(b)}`
  const prev = port ? si <= 0 : view <= 0, next = port ? si >= end : view >= last
  const row = { display: "flex", alignItems: "center", height: 44 } as const
  const playBtn = (
    <button type="button" className={`${txt} sb-play`} aria-pressed={playing} onClick={toggle} data-testid="site-play">
      {playing ? "Pause" : "Play"}
      {play && <span key={play.n} className="sb-prog" style={{ animationDelay: `${play.delay}ms`, animationDuration: `${dwell}ms` }} data-testid="sd-progress" />}
    </button>
  )
  const btn = (d: -1 | 1) => (
    <button type="button" className={`${txt} g ss-tx`} style={{ minHeight: 44 }} disabled={d < 0 ? prev : next} onClick={() => go(d)} data-testid={d < 0 ? "ss-prev" : "ss-next"}>
      {d < 0 ? "Previous" : "Next"}
    </button>
  )
  const lbl = <span className="t13 g" data-testid="site-label">{label}</span>
  const pager = (top: number, style?: React.CSSProperties) => (
    <div className="ss-abs" style={{ ...row, top, justifyContent: "center", gap: wide ? 40 : 24, ...style }}>{btn(-1)}{lbl}{btn(1)}</div>
  )
  const back = (style?: React.CSSProperties) => (
    <button type="button" className="m15 sb-back" style={style} onClick={onClose} aria-label="All books" data-testid="site-all-books">
      <span className="g" aria-hidden>‹</span>&nbsp;{b.title}
    </button>
  )
  const roomProps = { ref: root, className: "sb-room", "data-testid": "ss-reader-page", "data-mode": mode, ...swipe }

  if (port) {
    const g = portGeo(b, box.w, box.h)
    const stage = { ref: sapi, b, slides, w: box.w, top: g.stageTop, pw: g.pw, ph: g.ph, view, setView, si, onSi: setSi, onRest: setRest, start: rest }
    return (
      <div {...roomProps}>
        {/* the rows pass over a curl that overhangs the stage (≤ 24 px) */}
        <div className="ss-abs" style={{ ...row, left: 16, right: 16, top: g.gt, justifyContent: "space-between", gap: 16, zIndex: 2 }}>
          {back()}
          {playBtn}
        </div>
        {rm === "turn" ? <PageTurn key={rm} {...stage} /> : <Slides key={rm} {...stage} />}
        {/* site-stand-v7 P1: the label only; the mode comes from the hash (no Reader switch) */}
        <div className="ss-abs" style={{ left: 16, right: 16, top: g.footTop, height: 24, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>{lbl}</div>
      </div>
    )
  }

  const reader = (rw: number, left: number, top: number) => (
    <div className="ss-abs" style={{ left, top }} data-testid="site-room" data-view={view}>
      <BookReader ref={api} b={b} view={view} onView={setView} width={rw} dark={dark} />
    </div>
  )

  if (mode === "land") {
    const B = 136, W1 = Math.min(box.w - 2 * B, (box.h - 24) * R), W3 = Math.min(box.w - 32, (box.h - 64) * R)
    const side = W1 >= W3, rw = side ? W1 : W3, rh = rw / R, left = (box.w - rw) / 2
    const bottom = box.h - 52
    return (
      <div {...roomProps} data-layout={side ? "side" : "foot"}>
        {reader(rw, left, side ? (box.h - rh) / 2 : 8 + (box.h - 64 - rh) / 2)}
        {side ? (
          <>
            {back({ position: "absolute", left: 16, top: 8, maxWidth: B - 24, whiteSpace: "normal", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textAlign: "start" })}
            <div className="ss-abs" style={{ ...row, right: 16, top: 8 }}>{playBtn}</div>
            <div className="ss-abs" style={{ ...row, left: 16, top: bottom }}>{lbl}</div>
          </>
        ) : (
          // 1fr auto 1fr keeps the pager centred; the 16 px gaps leave back its centre-left − 32
          <div className="ss-abs" style={{ ...row, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", columnGap: 16, left: 16, right: 16, top: bottom }}>
            {back({ justifySelf: "start", maxWidth: "100%" })}
            <div style={{ ...row, gap: 24 }}>{lbl}</div>
            <div style={{ justifySelf: "end" }}>{playBtn}</div>
          </div>
        )}
      </div>
    )
  }

  const top = nar ? 64 : 72, foot = nar ? 104 : 96
  let rw = Math.max(200, Math.min(span(nar ? 4 : 10), (box.h - top - foot) * R))
  let bookTop = top + (box.h - top - foot - rw / R) / 2, footTop = bookTop + rw / R + (wide ? 32 : 24), shift = 0
  if (wide) {
    // stand-v8: the visible book centred in [44 (the head's bottom), footTop], ≥ 32 above and below, ≥ 64 each side; a
    // turning leaf may rise over the head (the GL canvas overhangs the box by 0.21·W, reader.tsx)
    const [kx, ky, ty, dx] = glWanted() ? BODY[b.fmt] : CSS_BODY, A = 44
    footTop = box.h - 54
    rw = Math.max(200, Math.min((box.w - 128) / kx, ((footTop - A - 64) * R) / ky))
    const H = rw / R
    bookTop = (A + footTop) / 2 - (ky * H) / 2 - ty * H
    shift = dx * rw
  }
  const bookLeft = (box.w - rw) / 2 - shift
  const about = (
    <p className="sb-about" data-testid="site-about">
      <span className={wide ? "t16" : "m15"}>{b.title}</span>
      <span className="t13 g" style={{ marginLeft: 8 }}>{metaOf(b)}</span>
    </p>
  )
  return (
    <div {...roomProps}>
      {reader(rw, bookLeft, bookTop)}
      {wide && <div className="ss-abs" style={{ ...row, left: x(0), top: footTop, width: span(4) }}>{about}</div>}
      {pager(footTop, wide ? { left: x(4), width: span(4) } : { left: M, right: M })}
      {wide
        ? <div className="ss-abs" style={{ ...row, left: x(9), width: span(3), top: footTop, justifyContent: "flex-end" }}>{playBtn}</div>
        : <div className="ss-abs" style={{ ...row, left: M, right: M, top: footTop + 44 + 16, gap: 16 }}>{about}{playBtn}</div>}
    </div>
  )
}

/** Swipe back (D25; touch and pen on phones): a rightward swipe that starts outside the book (`ps-strip` / `site-room`)
   follows the finger once dx > 10 and dx > 1.5·|dy| (abandoned if |dy| > 10 or dx < −10 comes first); on release past
   0.25·w or faster than 0.5 px/ms (over the last 80 ms) the room slides out in 200 ms and closes, else springs back.
   Reduced motion: no follow, a release past the threshold closes at once. */
function useSwipeBack(root: React.RefObject<HTMLDivElement | null>, on: boolean, w: number, onClose?: () => void, onPeek?: (on: boolean) => void) {
  type S = { id: number; x0: number; y0: number; active: boolean; dx: number; trail: [number, number][] }
  const s = React.useRef<S | null>(null)
  const timer = React.useRef(0)
  // the click that may follow an active swipe's release is swallowed
  const swallow = React.useRef(false)
  React.useEffect(() => () => clearTimeout(timer.current), [])
  if (!on) return {}
  const el = () => root.current!
  const paint = (dx: number, ms: number) => {
    const st = el().style
    // data-swipe: "move" while the room follows the finger or slides out / back (tests wait on it)
    el().dataset.swipe = dx || ms ? "move" : ""
    st.transition = ms ? `transform ${ms}ms var(--ease-out), box-shadow ${ms}ms var(--ease-out)` : "none"
    st.transform = dx ? `translate3d(${dx}px,0,0)` : ""
    st.boxShadow = dx ? "-16px 0 32px rgb(0 0 0 / .5)" : ""
  }
  const end = (e: React.PointerEvent, cancel: boolean) => {
    const g = s.current
    if (!g || g.id !== e.pointerId) return
    s.current = null
    if (!g.active) return
    setTimeout(() => { swallow.current = false }, 0)
    const t = e.timeStamp, back = g.trail.find(([tt]) => t - tt <= 80) ?? [t, g.dx]
    const v = t > back[0] ? (g.dx - back[1]) / (t - back[0]) : 0
    const shut = !cancel && (g.dx > 0.25 * w || v > 0.5)
    if (reduced()) { if (shut) onClose?.(); else onPeek?.(false); return }
    paint(shut ? w : 0, 200)
    timer.current = window.setTimeout(() => {
      if (shut) onClose?.()
      else { paint(0, 0); onPeek?.(false) }
    }, 200)
  }
  return {
    style: { touchAction: "none" } as React.CSSProperties,
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" || s.current) return
      if ((e.target as Element).closest('[data-testid="ps-strip"],[data-testid="pt-stage"],[data-testid="site-room"]')) return
      s.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, dx: 0, trail: [] }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = s.current
      if (!g || g.id !== e.pointerId) return
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0
      if (!g.active) {
        if (Math.abs(dy) > 10 || dx < -10) { s.current = null; return }
        if (!(dx > 10 && dx > 1.5 * Math.abs(dy))) return
        g.active = true
        el().setPointerCapture(e.pointerId)
        onPeek?.(true)
        swallow.current = true
      }
      g.dx = Math.max(0, dx)
      g.trail = [...g.trail.filter(([t]) => e.timeStamp - t <= 80), [e.timeStamp, g.dx]]
      if (!reduced()) paint(g.dx, 0)
    },
    onClickCapture: (e: React.MouseEvent) => { if (swallow.current) { e.stopPropagation(); e.preventDefault() } },
    onPointerUp: (e: React.PointerEvent) => end(e, false),
    onPointerCancel: (e: React.PointerEvent) => end(e, true),
  }
}

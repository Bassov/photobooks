/* ReadingRoom (Spec site-stand S6, site-stand-v2 S): the open book over the site, opened by the sys shell (demos 6, 9).
   Grid M 24 / 16, G 16 / 12, 12 / 4 columns. Desktop: top 72, foot 96, rw = max(200, min(span(10), (h − 168)·R))
   centred; the foot 32 px below: title + meta (cols 0–3), Previous · label · Next (centre), Play (cols 9–11). Phone
   portrait (w < 768, h > w, site-stand-v4 D20): the whole spread at rw = min(w − 32, (h − 184)·R), the group (book + 24
   + row 44 + 16 + row 44) centred between 56 and h; row 1 Previous · label · Next 24 px below the book, row 2 (16 px
   below) title + meta and Play. The book never moves between views. Landscape phone (h < 500): the spread at
   W = min(w − 32, (h − 72)·R), Play at the right of row 1. Opens with a 240 ms fade, focuses the book; at view 0 the
   cover turns 120 ms after the fade; ← / → turn.
   Play (fresh C's auto page-turn, D4): after each turn ends wait 4000 ms and turn; stops at the back cover;
   any key, click or drag (outside Play) and a hidden tab pause it; a 1 px line under the label grows over the dwell.
   The autoplay lives here, not in reader.tsx: it drives the reader through its `go` API only. */
import * as React from "react"
import { pagesOf, SPREAD_R, viewLabel, viewsOf, type SiteBook } from "../site-demo-1/data"
import { metaOf, type Box } from "../site-demo-1/v2"
import { BookReader, type ReaderApi } from "./reader"
import "./room.css"

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
type Mode = "port" | "land" | "desk"
export const roomMode = (box: Box): Mode => (box.w < 768 && box.h > box.w ? "port" : box.w > box.h && box.h < 500 ? "land" : "desk")
/** the room fade, then the cover starts turning this much later */
export const FADE_MS = 240, COVER_DELAY_MS = 120

type RoomProps = { b: SiteBook; view: number; setView: (v: number) => void; dark?: boolean; box: Box }

export function ReadingRoom({ b, view, setView, dark, box }: RoomProps) {
  const root = React.useRef<HTMLDivElement>(null)
  const api = React.useRef<ReaderApi>(null)
  const mode = roomMode(box), nar = box.narrow, wide = mode === "desk" && !nar
  const M = nar ? 16 : 24, G = nar ? 12 : 16, C = nar ? 4 : 12
  const col = (box.w - 2 * M - (C - 1) * G) / C, span = (k: number) => k * col + (k - 1) * G, x = (k: number) => M + k * (col + G)
  const R = SPREAD_R[b.fmt], last = viewsOf(b) - 1
  const go = (d: number) => api.current?.go(d)
  const goRef = React.useRef(go)
  goRef.current = go

  // open: focus the book; a closed cover turns once the fade is done
  React.useEffect(() => {
    root.current?.querySelector<HTMLElement>('[role="region"]')?.focus({ preventScroll: true })
    const t = view === 0 ? setTimeout(() => goRef.current(1), reduced() ? 0 : FADE_MS + COVER_DELAY_MS) : 0
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // autoplay: `delay` = the turn still running when the dwell starts; `n` restarts the progress line
  const pos = view, end = last, dwell = 4000
  const [play, setPlay] = React.useState<{ delay: number; n: number } | null>(null)
  const turnMs = (a: number, z: number) => {
    if (reduced() || Math.abs(z - a) !== 1) return 240
    return Math.min(a, z) === 0 || Math.max(a, z) === last ? 1000 : 820
  }
  const prevPos = React.useRef(pos)
  React.useEffect(() => {
    const a = prevPos.current
    prevPos.current = pos
    if (a !== pos) setPlay((p) => (!p || pos >= end ? null : { delay: turnMs(a, pos), n: p.n + 1 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const own = !!(e.target as Element | null)?.closest?.('[data-testid="sd-play"]')
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
    // at the back cover: view 1 first
    if (pos >= end) setView(1)
  }

  const txt = nar || mode !== "desk" ? "m15" : "t16"
  let label = viewLabel(b, view)
  if (label.startsWith("Page")) label += ` of ${pagesOf(b)}`
  const prev = view <= 0, next = view >= last
  // port: the group (book + 24 + row 44 + 16 + row 44 = rh + 128) centred between the 56 px header and h
  const top = mode === "port" ? 56 : mode === "land" ? 8 : nar ? 64 : 72, foot = mode === "port" ? 128 : mode === "land" ? 64 : nar ? 104 : 96
  const rw = mode === "desk"
    ? Math.max(200, Math.min(span(nar ? 4 : 10), (box.h - top - foot) * R))
    : Math.min(box.w - 32, (box.h - top - foot) * R)
  const rh = rw / R
  const bookLeft = (box.w - rw) / 2, bookTop = top + (box.h - top - foot - rh) / 2, bookBottom = bookTop + rh
  const book = <BookReader ref={api} b={b} view={view} onView={setView} width={rw} dark={dark} />
  const row = { display: "flex", alignItems: "center", height: 44 } as const
  const footTop = bookBottom + (wide ? 32 : mode === "land" ? 12 : 24)
  const playBtn = (
    <button type="button" className={`${txt} sb-play`} aria-pressed={playing} onClick={toggle} data-testid="sd-play">
      {playing ? "Pause" : "Play"}
      {play && <span key={play.n} className="sb-prog" style={{ animationDelay: `${play.delay}ms`, animationDuration: `${dwell}ms` }} data-testid="sd-progress" />}
    </button>
  )
  const about = (
    <p className="sb-about" data-testid="sd-about">
      <span className={wide ? "t16" : "m15"}>{b.title}</span>
      <span className="t13 g" style={{ marginLeft: 8 }}>{metaOf(b)}</span>
    </p>
  )
  return (
    <div ref={root} className="sb-room" data-testid="ss-reader-page" data-mode={mode}>
      <div className="ss-abs" style={{ left: bookLeft, top: bookTop }} data-testid="ss-reader" data-view={view}>{book}</div>
      {wide && <div className="ss-abs" style={{ ...row, left: x(0), top: footTop, width: span(4) }}>{about}</div>}
      <div className="ss-abs" style={{ ...row, left: wide ? x(4) : M, right: wide ? undefined : M, width: wide ? span(5) : undefined, top: footTop, justifyContent: "center", gap: wide ? 40 : 24 }}>
        <button type="button" className={`${txt} g ss-tx`} style={{ minHeight: 44 }} disabled={prev} onClick={() => go(-1)} data-testid="ss-prev">Previous</button>
        <span className="t13 g" data-testid="ss-label">{label}</span>
        <button type="button" className={`${txt} g ss-tx`} style={{ minHeight: 44 }} disabled={next} onClick={() => go(1)} data-testid="ss-next">Next</button>
      </div>
      {wide || mode === "land"
        ? <div className="ss-abs" style={{ ...row, left: wide ? x(9) : undefined, right: wide ? undefined : M, width: wide ? span(3) : undefined, top: footTop, justifyContent: "flex-end" }}>{playBtn}</div>
        : <div className="ss-abs" style={{ ...row, left: M, right: M, top: footTop + 44 + 16, gap: 16 }}>{about}{playBtn}</div>}
    </div>
  )
}

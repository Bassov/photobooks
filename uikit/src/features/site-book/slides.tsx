/* Phone portrait reader (Spec site-stand-v5 R, D23): one page per slide, an Instagram-like carousel on native scroll-snap.
   Slides: the cover, page 1, then per spread either the whole spread (a framed photo crosses the gutter: x < 49.5 and
   x + w > 50.5) or each side that holds a framed photo, read as a right page; blank pages and endpapers are skipped, no back
   cover. Stage: pw = min(w − 32, (h − 147)·rp) (v6 S), pitch pw + 16, so at rest the next paper starts at the screen's right edge.
   The strip is the book: swipes scroll it, a tap on the left / right half turns one slide, ← / → turn, Home / End jump.
   The position (label) follows the scroll live; on scrollend the room's view follows the slide. */
import * as React from "react"
import { T } from "@/data"
import { CoverFace, SpreadArt, TitlePage } from "../site-demo-1/art"
import { pagesOf, SPREAD_R, type SiteBook } from "../site-demo-1/data"
import { paperLayers } from "./paper"
import "./slides.css"

export type Slide = { kind: "cover" | "title" | "spread" | "page"; view: number; label: string; k?: number; side?: "L" | "R" }
export type SlidesApi = { go: (d: number) => void; jump: (i: number) => void }

export function slidesOf(b: SiteBook): Slide[] {
  const n = pagesOf(b)
  const out: Slide[] = [{ kind: "cover", view: 0, label: "Cover" }, { kind: "title", view: 1, label: `Page 1 of ${n}` }]
  b.spreads.forEach((s, i) => {
    const k = i + 1, view = k + 1
    if (s.template === "last") return void out.push({ kind: "page", view, k, side: "L", label: `Page ${2 * k} of ${n}` })
    const frames = T(s.template).frames.filter((_, j) => s.photos[j])
    if (frames.some((f) => f.x < 49.5 && f.x + f.w > 50.5)) return void out.push({ kind: "spread", view, k, label: `Pages ${2 * k}–${2 * k + 1} of ${n}` })
    if (frames.some((f) => f.x < 50)) out.push({ kind: "page", view, k, side: "L", label: `Page ${2 * k} of ${n}` })
    if (frames.some((f) => f.x + f.w > 50)) out.push({ kind: "page", view, k, side: "R", label: `Page ${2 * k + 1} of ${n}` })
  })
  return out
}

/** the first slide showing view v; the back cover maps to the last slide */
export const slideOfView = (slides: Slide[], v: number) => {
  const i = slides.findIndex((s) => s.view === v)
  return i < 0 ? slides.length - 1 : i
}

/** page width / height and the header row top for a w × h portrait screen; the foot ends ≥ 8 px above the reader switch
   (site-stand-v6 S, top h − 30.85) */
export function portGeo(b: SiteBook, w: number, h: number) {
  const rp = SPREAD_R[b.fmt] / 2
  const pw = Math.min(w - 32, (h - 147) * rp), ph = pw / rp
  const gt = Math.max(4, Math.min((h - ph - 104) / 2, h - ph - 143))
  return { pw, ph, gt, stageTop: gt + 52, footTop: gt + 52 + ph + 8 }
}

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches

type Props = {
  b: SiteBook; slides: Slide[]; w: number; top: number; pw: number; ph: number
  view: number; setView: (v: number) => void
  /** the live slide (follows the finger) */
  si: number; onSi: (i: number) => void
  /** the slide the strip came to rest on */
  onRest: (i: number) => void
  /** the slide to open on (a reader switch keeps the R page of a spread, which `slideOfView` would send back to L) */
  start: number
}

export const Slides = React.forwardRef<SlidesApi, Props>(function Slides({ b, slides, w, top, pw, ph, view, setView, si, onSi, onRest, start }, ref) {
  const strip = React.useRef<HTMLDivElement>(null)
  const pitch = pw + 16, n = slides.length
  const clamp = (i: number) => Math.max(0, Math.min(n - 1, i))
  const live = React.useRef({ si, view, aim: null as number | null, idle: 0 })
  const cb = React.useRef({ setView, onSi, onRest })
  cb.current = { setView, onSi, onRest }

  const to = (i: number, smooth: boolean) => {
    const el = strip.current
    if (!el) return
    live.current.aim = smooth ? i : null
    el.scrollTo({ left: i * pitch, behavior: smooth ? "smooth" : "instant" })
  }
  const go = (d: number) => {
    const L = live.current, i = clamp((L.aim ?? L.si) + d)
    if (i !== (L.aim ?? L.si)) to(i, !reduced())
  }
  const goRef = React.useRef(go)
  goRef.current = go
  React.useImperativeHandle(ref, () => ({ go: (d) => goRef.current(d), jump: (i) => to(clamp(i), false) }))

  // mount and a new pitch: rest on `start` (mount) or the current slide (resize)
  const mounted = React.useRef(false)
  React.useLayoutEffect(() => {
    const L = live.current
    const i = mounted.current ? L.si : clamp(start)
    mounted.current = true
    strip.current?.scrollTo({ left: i * pitch, behavior: "instant" })
    L.si = i
    cb.current.onSi(i); cb.current.onRest(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new pitch only: `start` applies on mount, later the current slide stays
  }, [pitch])
  // a view change from outside (the room never shows it yet): jump there
  React.useEffect(() => {
    const L = live.current
    L.view = view
    if (slides[L.si]?.view === view) return
    const i = slideOfView(slides, view)
    to(i, false)
    L.si = i
    cb.current.onSi(i); cb.current.onRest(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- an outside view change only; a new slide list must not jump the strip
  }, [view])

  // the live position on scroll; at rest (scrollend, fallback 150 ms without a scroll event) the view follows
  React.useEffect(() => {
    const el = strip.current
    if (!el) return
    const L = live.current
    // data-scroll: "move" from a scroll event until rest (tests wait on it)
    el.dataset.scroll = "rest"
    const settle = () => {
      el.dataset.scroll = "rest"
      clearTimeout(L.idle)
      L.aim = null
      const s = slides[L.si]
      cb.current.onRest(L.si)
      if (s && s.view !== L.view) { L.view = s.view; cb.current.setView(s.view) }
    }
    const scroll = () => {
      el.dataset.scroll = "move"
      const i = clamp(Math.round(el.scrollLeft / pitch))
      if (i !== L.si) { L.si = i; cb.current.onSi(i) }
      clearTimeout(L.idle)
      L.idle = window.setTimeout(settle, 150)
    }
    el.addEventListener("scroll", scroll, { passive: true })
    el.addEventListener("scrollend", settle)
    return () => { el.removeEventListener("scroll", scroll); el.removeEventListener("scrollend", settle); clearTimeout(L.idle) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clamp (new every render) only reads n, which follows slides
  }, [pitch, slides])

  // ← / → turn, Home / End jump
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if ((e.target as HTMLElement | null)?.closest?.("input,textarea,select,[contenteditable]")) return
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
      if (d) { e.preventDefault(); goRef.current(d) }
      else if (e.key === "Home" || e.key === "End") { e.preventDefault(); to(e.key === "Home" ? 0 : n - 1, !reduced()) }
    }
    addEventListener("keydown", k); return () => removeEventListener("keydown", k)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `to` (new every render) only reads pitch and refs
  }, [n, pitch])

  // a tap (< 8 px, < 350 ms) turns: the left half back, the right half on
  const down = React.useRef<{ x: number; y: number; t: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => { down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp } }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current
    down.current = null
    if (!d || Math.abs(e.clientX - d.x) >= 8 || Math.abs(e.clientY - d.y) >= 8 || e.timeStamp - d.t > 350) return
    const r = strip.current!.getBoundingClientRect()
    go(e.clientX - r.left < r.width / 2 ? -1 : 1)
  }

  return (
    <div ref={strip} className="ps-strip no-scrollbar" style={{ top, height: ph, paddingInline: (w - pitch) / 2 }}
      data-testid="ps-strip" role="region" aria-roledescription="carousel" aria-label={b.title} tabIndex={0}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { down.current = null }}>
      {slides.map((s, i) => (
        <div key={i} className="ps-slide" style={{ width: pitch }} data-testid="ps-slide" data-kind={s.kind} role="group" aria-roledescription="slide" aria-label={s.label}>
          <Paper b={b} s={s} pw={pw} ph={ph} on={Math.abs(i - si) <= 2} />
        </div>
      ))}
    </div>
  )
})

/** a slide's paper; `sheet` (page turn, v6 D29): always pw × ph at the sheet origin, a spread centred on it */
export function Paper({ b, s, pw, ph, on, sheet }: { b: SiteBook; s: Slide; pw: number; ph: number; on: boolean; sheet?: boolean }) {
  const h = s.kind === "spread" && !sheet ? pw / SPREAD_R[b.fmt] : ph
  const [grain, sheen] = paperLayers()
  const layers = <><div aria-hidden style={grain} /><div aria-hidden style={sheen} /></>
  const spread = <SpreadArt b={b} k={s.k!} w={pw} />
  return (
    <div className="ps-paper" style={{ top: (ph - h) / 2, width: pw, height: h, borderRadius: s.kind === "cover" ? 2 : undefined, ...(sheet && { left: 0, boxShadow: "none" }) }} data-testid="ps-paper">
      {on && (s.kind === "cover" ? <CoverFace b={b} w={pw} h={ph} />
        : s.kind === "title" ? <><TitlePage b={b} h={ph} />{layers}</>
        : s.kind === "spread" ? <>{sheet ? <div className="absolute left-0" style={{ top: (ph - pw / SPREAD_R[b.fmt]) / 2 }} data-testid="pt-art">{spread}</div> : spread}{layers}</>
        : <><div className="absolute top-0" style={{ left: s.side === "R" ? -pw : 0 }}><SpreadArt b={b} k={s.k!} w={2 * pw} fold={false} /></div>{layers}</>)}
    </div>
  )
}

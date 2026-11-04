/* Demo 3 book page (Spec site-awards-5, Direction 3): one long scroll that turns the pages. The section is views × 100vh;
   a sticky stage holds the reader with `scrub = p` (p = scroll in the section / 100vh). 140 ms after the last scroll it
   settles on the nearest whole p, so a turn never rests half-way. ← / → / Space / PageUp / PageDown and the timeline
   scroll to whole views. Reduced motion: no scrub; the reader crossfades whole views in 160 ms. */
import * as React from "react"
import { BOOKS, italics, pad2, pagesOf, SPREAD_R, viewLabel, viewsOf, type SiteBook } from "../site-demo-1/data"
import { BookReader } from "../site-demo-1/reader"

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
export type L3 = { vw: number; vh: number; narrow: boolean; stack: boolean; m: number }
export const layoutOf = (vw: number, vh: number): L3 => ({ vw, vh, narrow: vw < 768, stack: vw < 1024, m: vw < 768 ? 20 : 48 })
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
export const metaOf = (b: SiteBook) => `${pad2(BOOKS.indexOf(b) + 1)} · ${b.year} · ${pagesOf(b)} pp · ${b.w} × ${b.h} cm`

/** the reader box: W = min(960, vw − 480), centred, top 176 (mid: vw − 240; narrow: vw − 40); a short window shrinks it */
const readerBox = (l: L3, b: SiteBook) => {
  const R = SPREAD_R[b.fmt], top = l.narrow ? 150 : 176, room = l.vh - top - (l.narrow ? 150 : 110)
  const w = Math.max(200, Math.min(l.narrow ? l.vw - 40 : l.stack ? l.vw - 240 : Math.min(960, l.vw - 480), room * R))
  return { w, h: w / R, top, left: (l.vw - w) / 2 }
}

/** the spread label: when it changes the old one rolls up and out, the new one rolls in from below (400 ms) */
function Slot({ text, align }: { text: string; align: "left" | "right" }) {
  const [st, setSt] = React.useState({ cur: text, prev: null as string | null, id: 0 })
  if (text !== st.cur) setSt({ cur: text, prev: st.cur, id: st.id + 1 })
  return (
    <div className="sd3-slot relative" style={{ textAlign: align }} aria-hidden data-testid="sd3-label">
      {st.prev !== null && <span key={`o${st.id}`} className="sd3-out">{st.prev}</span>}
      <span key={`i${st.id}`} className={st.id ? "sd3-in" : undefined}>{st.cur}</span>
    </div>
  )
}

type PageProps = { b: SiteBook; l: L3; scroller: React.RefObject<HTMLDivElement | null>; onOpen: (id: string) => void }
export function BookPage({ b, l, scroller, onOpen }: PageProps) {
  const n = viewsOf(b), rb = readerBox(l, b), h = l.vh
  const sec = React.useRef<HTMLDivElement>(null)
  const [p, setP] = React.useState(0)
  const live = React.useRef({ p, h, n })
  live.current = { p, h, n }
  const target = React.useRef<number | null>(null)
  const goTo = React.useCallback((q: number) => {
    const s = scroller.current, top = sec.current?.offsetTop ?? 0; if (!s) return
    const { h, n } = live.current, t = clamp(q, 0, n - 1)
    target.current = t
    s.scrollTo({ top: top + t * h, behavior: reduced() ? "auto" : "smooth" })
  }, [scroller])

  // p follows the scroll; 140 ms after the last scroll event the book settles on the nearest whole view
  React.useEffect(() => {
    const s = scroller.current; if (!s) return
    let timer = 0
    const on = () => {
      const { h, n } = live.current, q = clamp((s.scrollTop - (sec.current?.offsetTop ?? 0)) / h, 0, n - 1)
      setP(q)
      if (target.current !== null && Math.abs(q - target.current) < 0.01) target.current = null
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const r = Math.round(q)
        if (q > 0 && q < n - 1 && Math.abs(q - r) > 0.002) goTo(r)
      }, 140)
    }
    s.addEventListener("scroll", on, { passive: true })
    return () => { s.removeEventListener("scroll", on); window.clearTimeout(timer) }
  }, [scroller, goTo])

  // keys while the stage is at least half in view
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const d = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1, " ": e.shiftKey ? -1 : 1 }[e.key]
      if (!d || (e.key === " " && (e.target as HTMLElement | null)?.closest?.("button,a,input,textarea"))) return
      const s = scroller.current, { p, h, n } = live.current; if (!s) return
      const off = s.scrollTop - (sec.current?.offsetTop ?? 0)
      if (off < -h / 2 || off > (n - 1) * h + h / 2) return
      e.preventDefault()
      goTo((target.current ?? Math.round(p)) + d)
    }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [scroller, goTo])

  const still = reduced()
  const view = clamp(Math.round(p), 0, n - 1)
  const label = viewLabel(b, view)
  const next = BOOKS[(BOOKS.indexOf(b) + 1) % BOOKS.length]
  const tl = l.vw - 2 * l.m, tickX = (i: number) => (i * tl) / (n - 1)
  /** click a half of the book: a whole view back or on (the reader itself takes no pointer while it scrubs) */
  const half = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    goTo((target.current ?? view) + (e.clientX < r.left + r.width / 2 ? -1 : 1))
  }
  return (
    <div className="sd3-page" data-testid="sd3-page">
      <section ref={sec} style={{ height: n * h, position: "relative" }} aria-label={b.title}>
        <div className="sd3-stage" style={{ height: h }}>
          <div className="sd3-abs" style={{ left: l.m, top: l.narrow ? 72 : 76 }}>
            <h1 className="sd3-book-title" style={l.narrow ? { fontSize: 32 } : undefined} data-testid="sd3-title">{b.title}</h1>
            <div className="sd3-mono" style={{ marginTop: 12 }}>{metaOf(b)}</div>
          </div>
          {!l.narrow && <div className="sd3-abs" style={{ right: l.m, top: 76, width: 360 }}><Slot text={label} align="right" /></div>}
          <div className={still ? "sd3-abs" : "sd3-abs sd3-hit"} style={{ left: rb.left, top: rb.top, width: rb.w }} onClick={still ? undefined : half} data-testid="sd3-reader" data-view={view}>
            <BookReader b={b} view={view} onView={goTo} width={rb.w} keys={false} scrub={still ? undefined : p} />
          </div>
          {l.narrow && <div className="sd3-abs" style={{ left: l.m, right: l.m, top: rb.top + rb.h + 28 }}><Slot text={label} align="left" /></div>}
          <div className="sd3-abs" style={{ left: l.m, width: tl, top: h - 58 }}>
            <div className="sd3-rule" />
            {Array.from({ length: n }, (_, i) => (
              <button key={i} type="button" className="sd3-tick" style={{ left: tickX(i) }} aria-label={viewLabel(b, i)} aria-current={i === view ? "page" : undefined} onClick={() => goTo(i)} />
            ))}
            <div className="sd3-marker" style={{ left: tickX(p) }} data-testid="sd3-marker" />
            <div className="sd3-mono sd3-s flex justify-between" style={{ marginTop: 17 }}><span>Cover</span><span>Scroll ↓ to turn</span></div>
          </div>
        </div>
      </section>
      <section className="relative" style={{ padding: l.stack ? `96px ${l.m}px 0` : `120px ${l.m}px 0`, display: "grid", gridTemplateColumns: l.stack ? "1fr" : "1fr 576px", gap: 48 }}>
        <dl className="sd3-mono sd3-dl" data-testid="sd3-colophon">
          <dt>Size</dt><dd>{b.w} × {b.h} cm</dd>
          <dt>Pages</dt><dd>{pagesOf(b)}</dd>
          <dt>Binding</dt><dd>Layflat, cloth</dd>
          <dt>Year</dt><dd>{b.year}</dd>
        </dl>
        <p className="sd3-statement" style={{ maxWidth: 576 }}>{italics(b.statement).map((x, i) => (x.it ? <em key={i}>{x.t}</em> : <React.Fragment key={i}>{x.t}</React.Fragment>))}</p>
      </section>
      <section style={{ padding: `${l.stack ? 96 : 140}px ${l.m}px 96px` }}>
        <div className="sd3-mono sd3-s" style={{ marginBottom: 14 }}>Next</div>
        <ol className="sd3-list">
          <li><IndexRow b={next} i={BOOKS.indexOf(next)} l={l} onOpen={onOpen} testid="sd3-next-book" /></li>
        </ol>
      </section>
    </div>
  )
}

/** one index row: number, title, year / pages / size (stacked under the title below 1024) */
export function IndexRow({ b, i, l, onOpen, testid = "sd3-book", onFocus, onBlur, onPointerEnter, onPointerLeave }: {
  b: SiteBook; i: number; l: L3; onOpen: (id: string, el: HTMLElement) => void; testid?: string
  onFocus?: (e: React.FocusEvent<HTMLButtonElement>) => void; onBlur?: () => void
  onPointerEnter?: (e: React.PointerEvent<HTMLButtonElement>) => void; onPointerLeave?: (e: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const H = l.narrow ? 96 : l.stack ? 116 : 132, fs = l.narrow ? 46 : l.stack ? 72 : 112, tx = l.narrow ? 36 : 120
  const mono = l.narrow ? 14 : 26
  return (
    <button type="button" className="sd3-row" style={{ height: H }} onClick={(e) => onOpen(b.id, e.currentTarget)} onFocus={onFocus} onBlur={onBlur}
      onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} aria-label={`${b.title}, ${b.year}`} data-testid={testid} data-id={b.id}>
      <span className="sd3-dot" style={{ top: mono + 2 }} />
      <span className="sd3-no sd3-mono" style={{ top: mono }}>{pad2(i + 1)}</span>
      <span className="sd3-t sd3-title" style={{ left: tx, top: l.narrow ? 12 : 14, fontSize: fs, letterSpacing: l.narrow ? "-.04em" : undefined }}>{b.title}</span>
      {l.stack
        ? <span className="sd3-mono sd3-abs" style={{ left: tx, top: (l.narrow ? 12 : 14) + fs + 6 }}>{b.year} · {pagesOf(b)} pp · {b.w} × {b.h}</span>
        : <>
            <span className="sd3-mono sd3-abs" style={{ left: l.vw - 2 * l.m - 408, top: mono }}>{b.year}</span>
            <span className="sd3-mono sd3-abs" style={{ left: l.vw - 2 * l.m - 312, top: mono }}>{pagesOf(b)}</span>
            <span className="sd3-mono sd3-abs" style={{ right: 0, top: mono }}>{b.w} × {b.h}</span>
          </>}
    </button>
  )
}

/* Site demo 6, Gallery on the system (spec-sys.md "6 · Gallery (system)", site-stand-v2 W / D7): the dark wall, one
   spotlight per book. Lead t24 in columns 0–3; books on a hairline floor at y 640, 14 px/cm, 96 px apart from column 4;
   label under each book; the book is the link. Wheel, drag (with a throw) and ← / → walk the wall; edge fades and a floor
   scrubber (title label on hover / drag) show where you are. A row that fits is centred in columns 4–11, no fades or
   scrubber. Phone: one book per screen with scroll snap. */
import * as React from 'react'
import { Book3D, thick } from '../site-book/book3d'
import type { SiteBook } from '../site-demo-1/data'
import { LEAD, metaOf, reduced, SysSite, type HomeApi } from '../site-sys/sys'
import './site.css'

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
/** system.css --ease-out, cubic-bezier(.16, 1, .3, 1), solved for x by bisection */
const easeOut = (t: number) => {
  const bz = (u: number, a: number, b: number) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3
  let lo = 0, hi = 1
  for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (bz(m, 0.16, 0.3) < t) lo = m; else hi = m }
  return bz((lo + hi) / 2, 1, 1)
}
const GLIDE = 600
/** Book3D's top for its contact shadow (bottom −4, height max(6, T/2); S1) to sit centred on the 1 px floor line at `floor` */
const seat = (b: SiteBook, s: number, floor: number) => floor + 0.5 - (b.h * s + 4 - Math.max(6, thick(b, s) / 2) / 2)
/** One caption row for the whole wall (D10): clear of the widest book's turned corner (0.09 · w_max · s) by 20 px */
const captionTop = (books: SiteBook[], s: number, floor: number) => floor + Math.ceil(0.09 * Math.max(0, ...books.map((b) => b.w)) * s) + 20

export function SiteDemo6() {
  return <SysSite n={6} dark home={(h) => (h.box.narrow ? <Phone {...h} /> : <Wall {...h} />)} />
}

type Drag = { id: number; x0: number; t0: number; lx: number; lt: number; vx: number; on: boolean }
type Glide = { from: number; to: number; t0: number }

/** Wall geometry (Spec W): book lefts from column 4, 96·k apart; the scroll range, the centring offset, the scrubber */
function layout(books: SiteBook[], box: HomeApi['box'], g: HomeApi['g']) {
  const k = Math.min(1, box.h / 900), s = 14 * k, gap = 96 * k
  const ws = books.map((b) => b.w * s), xs: number[] = []
  ws.forEach((w, i) => xs.push(i ? (xs[i - 1] ?? 0) + (ws[i - 1] ?? 0) + gap : g.x(4)))
  const x0 = xs[0] ?? 0, right = (xs.at(-1) ?? 0) + (ws.at(-1) ?? 0), row = right - x0
  const fits = row <= g.span(8)
  const content = right + g.M, end = fits ? 0 : Math.max(0, content - box.w)
  const off = fits ? (g.span(8) - row) / 2 : 0
  return { s, xs, ws, x0, fits, content, end, off, view: box.w, T: box.w - 2 * g.M }
}

function Wall({ books, box, g, active, open }: HomeApi) {
  const L = layout(books, box, g), { s, fits } = L
  const floor = Math.round((640 * box.h) / 900)
  const capY = captionTop(books, s, floor)
  const G = React.useRef(L); G.current = L
  const host = React.useRef<HTMLDivElement>(null), track = React.useRef<HTMLDivElement>(null)
  const scrub = React.useRef<HTMLDivElement>(null), thumb = React.useRef<HTMLDivElement>(null), label = React.useRef<HTMLSpanElement>(null)
  const fadeL = React.useRef<HTMLDivElement>(null), fadeR = React.useRef<HTMLDivElement>(null)
  const st = React.useRef({ cur: 0, tgt: 0, v: 0, moved: false, raf: 0, drag: null as Drag | null, glide: null as Glide | null, bar: null as { id: number; x0: number; c0: number } | null })
  const on = React.useRef(active); on.current = active
  const [at, setAt] = React.useState(0)

  /** the thumb's width and x on the track */
  const thumbOf = (cur: number) => {
    const { T, view, content } = G.current, w = Math.max(24, (T * view) / content)
    return { w, x: clamp((T * cur) / content, 0, T - w) }
  }
  const paint = () => {
    const S = st.current, { off, end, xs, ws, view, T } = G.current
    if (track.current) track.current.style.transform = `translate3d(${off - S.cur}px,0,0)`
    fadeL.current?.toggleAttribute('data-on', S.cur > 0.5)
    fadeR.current?.toggleAttribute('data-on', S.cur < end - 0.5)
    const { w, x } = thumbOf(S.cur)
    if (thumb.current) { thumb.current.style.width = `${w}px`; thumb.current.style.transform = `translate3d(${x}px,0,0)` }
    if (label.current) { const c = x + w / 2; label.current.style.left = `${c}px`; label.current.style.translate = `${(-100 * c) / T}% 0` }
    scrub.current?.setAttribute('aria-valuenow', String(end ? Math.round((S.cur / end) * 100) : 0))
    // the book nearest the viewport centre names the scrubber label
    const mid = view / 2 + S.cur - off
    let best = 0
    xs.forEach((l, i) => { if (Math.abs(l + (ws[i] ?? 0) / 2 - mid) < Math.abs((xs[best] ?? 0) + (ws[best] ?? 0) / 2 - mid)) best = i })
    setAt(best)
  }
  const loop = React.useRef(() => {})
  loop.current = () => {
    const S = st.current, e = G.current.end
    S.raf = 0
    if (S.glide) {
      const t = Math.min(1, (performance.now() - S.glide.t0) / GLIDE)
      S.cur = S.tgt = S.glide.from + (S.glide.to - S.glide.from) * easeOut(t)
      if (t >= 1) S.glide = null
    } else {
      if (S.v && !S.drag) { S.tgt += S.v; S.v *= 0.92; if (Math.abs(S.v) < 0.05 || S.tgt <= 0 || S.tgt >= e) S.v = 0 }
      S.tgt = clamp(S.tgt, 0, e)
      const d = S.tgt - S.cur
      S.cur = reduced() || Math.abs(d) < 0.3 ? S.tgt : S.cur + d * 0.12
    }
    paint()
    if (S.v || S.glide || S.cur !== S.tgt) kick()
  }
  const kick = () => { const S = st.current; if (!S.raf) S.raf = requestAnimationFrame(() => loop.current()) }
  React.useEffect(() => () => cancelAnimationFrame(st.current.raf), [])
  // every render: keeps the track in place on a resize or a new book count
  React.useLayoutEffect(() => { const S = st.current, e = G.current.end; S.tgt = clamp(S.tgt, 0, e); S.cur = clamp(S.cur, 0, e); paint() })
  React.useEffect(() => { if (!active) { const S = st.current; S.drag = null; S.bar = null; S.glide = null; S.v = 0; S.tgt = S.cur } }, [active])
  /** scroll to `x` (wheel, drag, keys: the eased follow) */
  const to = (x: number) => { const S = st.current; S.v = 0; S.glide = null; S.tgt = clamp(x, 0, G.current.end); kick() }
  /** book `i`'s left onto the row start */
  const goTo = (i: number) => { const { xs, x0 } = G.current; to((xs[clamp(i, 0, xs.length - 1)] ?? x0) - x0) }
  // wheel (vertical or horizontal) walks the wall; non-passive so nothing else scrolls
  React.useEffect(() => {
    const el = host.current; if (!el) return
    const w = (e: WheelEvent) => {
      if (!on.current) return
      e.preventDefault()
      const S = st.current
      to((S.glide ? S.cur : S.tgt) + (e.deltaY + e.deltaX) * (e.deltaMode === 1 ? 40 : 1))
    }
    el.addEventListener('wheel', w, { passive: false }); return () => el.removeEventListener('wheel', w)
  }, [])
  // ← / → one book
  React.useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (!on.current || e.altKey || e.ctrlKey || e.metaKey) return
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!d) return
      e.preventDefault()
      const S = st.current, { xs, x0, end } = G.current, t = S.glide ? S.glide.to : S.tgt
      const rel = xs.map((x) => x - x0)
      if (d > 0) to(rel.find((x) => x > t + 1) ?? end)
      else to(rel.filter((x) => x < t - 1).at(-1) ?? 0)
    }
    addEventListener('keydown', kd); return () => removeEventListener('keydown', kd)
  })

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !on.current) return
    const S = st.current; S.moved = false; S.v = 0; S.glide = null
    S.drag = { id: e.pointerId, x0: e.clientX, t0: S.tgt, lx: e.clientX, lt: e.timeStamp, vx: 0, on: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const S = st.current, d = S.drag; if (!d || d.id !== e.pointerId) return
    if (!d.on && Math.abs(e.clientX - d.x0) > 6) { d.on = true; host.current?.setPointerCapture(e.pointerId) }
    if (!d.on) return
    const dt = e.timeStamp - d.lt; if (dt > 0) d.vx = (-(e.clientX - d.lx) / dt) * 16.7
    d.lx = e.clientX; d.lt = e.timeStamp
    S.tgt = clamp(d.t0 - (e.clientX - d.x0), 0, G.current.end); kick()
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const S = st.current, d = S.drag; S.drag = null
    if (!d || d.id !== e.pointerId || !d.on) return
    S.moved = true
    S.v = reduced() || e.timeStamp - d.lt > 100 ? 0 : d.vx // the pointer rested before release: no throw
    kick()
  }

  // scrubber: the thumb drags 1:1 by the content / track ratio; a track click glides to centre the thumb there
  const onBarDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (e.button !== 0 || !on.current) return
    const S = st.current, { content, T, end } = G.current, el = e.currentTarget
    const px = e.clientX - el.getBoundingClientRect().left, { w, x } = thumbOf(S.cur)
    S.v = 0; S.glide = null
    if (px >= x && px <= x + w) {
      S.bar = { id: e.pointerId, x0: e.clientX, c0: S.cur }
      el.setPointerCapture(e.pointerId); el.toggleAttribute('data-drag', true)
      return
    }
    const goal = clamp(((px - w / 2) / T) * content, 0, end)
    if (reduced()) { S.tgt = goal; kick(); return }
    S.glide = { from: S.cur, to: goal, t0: performance.now() }; kick()
  }
  const onBarMove = (e: React.PointerEvent) => {
    const S = st.current, b = S.bar; if (!b || b.id !== e.pointerId) return
    const { content, T, end } = G.current
    S.cur = S.tgt = clamp(b.c0 + ((e.clientX - b.x0) * content) / T, 0, end); paint()
  }
  const onBarUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const S = st.current; if (S.bar?.id !== e.pointerId) return
    S.bar = null; e.currentTarget.toggleAttribute('data-drag', false)
  }
  const onBarKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault(); to(e.key === 'Home' ? 0 : G.current.end)
  }

  return (
    <div ref={host} className="ss6-wall" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={() => { st.current.drag = null }} onScroll={(e) => { e.currentTarget.scrollLeft = 0 }} data-testid="ss6-wall" data-fits={fits ? '' : undefined}>
      <p className="ss-abs t24 ss6-lead" style={{ left: g.x(0), top: 104, width: g.span(4) }}>{LEAD}</p>
      <div className="ss6-floor" style={{ top: floor }} />
      <div ref={track} className="ss6-track">
        {books.map((b, i) => {
          const W = L.ws[i] ?? 0, H = b.h * s
          return (
            <div key={b.id} className="ss6-ex" style={{ left: L.xs[i], top: seat(b, s, floor), width: W }}>
              <div className="ss6-spot" style={{ left: -260, top: H - 600, width: W + 520, height: 720 }} />
              <button type="button" className="ss6-book" aria-label={`${b.title}, ${metaOf(b)}`} data-testid="ss6-book" data-id={b.id}
                onFocus={() => { if (on.current) goTo(i) }}
                onClick={() => { if (st.current.moved) { st.current.moved = false; return } open(b) }}>
                <Book3D b={b} s={s} />
                <span className="ss6-label" style={{ top: capY - seat(b, s, floor) }}>
                  <span className="t13 g" style={{ display: 'block' }}>{metaOf(b)}</span>
                </span>
              </button>
            </div>
          )
        })}
      </div>
      {!fits && (
        <>
          <div ref={fadeL} className="ss6-fade ss6-fade-l" data-testid="ss6-fade-l" />
          <div ref={fadeR} className="ss6-fade ss6-fade-r" data-testid="ss6-fade-r" />
          <div ref={scrub} className="ss6-scrub" style={{ left: g.M, right: g.M }} role="scrollbar" tabIndex={0} aria-label="Books"
            aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-valuetext={books[at]?.title}
            onPointerDown={onBarDown} onPointerMove={onBarMove} onPointerUp={onBarUp} onPointerCancel={onBarUp} onKeyDown={onBarKey} data-testid="ss6-scrub">
            <div className="ss6-rail" />
            <div ref={thumb} className="ss6-thumb" data-testid="ss6-thumb" />
            <span ref={label} className="t13 g ss6-scrub-label" data-testid="ss6-scrub-label">{books[at]?.title}</span>
          </div>
        </>
      )}
    </div>
  )
}

/** Phone: one book per screen, vertical scroll snap; label under the book */
function Phone({ books, box, g, open, showAll }: HomeApi) {
  const n = books.length, base = Math.round((520 * box.h) / 844)
  const s = Math.min(10, (g.span(4) * 0.7) / 30, ((base - 150) * 1) / 30)
  const capY = captionTop(books, s, base)
  return (
    <div className="ss6-phone" data-testid="ss6-phone">
      {books.map((b, i) => {
        const W = b.w * s, H = b.h * s, top = seat(b, s, base)
        return (
          <section key={b.id} className="ss6-screen" style={{ height: box.h }}>
            {i === 0 && (
              <div className="ss-abs" style={{ left: g.M, top: 72, width: g.span(4) }}>
                <p className="m19" style={{ maxWidth: 300 }}>{LEAD}</p>
                {n >= 12 && <button type="button" className="m15 u" style={{ marginTop: 8, minHeight: 44 }} onClick={showAll}>All books</button>}
              </div>
            )}
            <div className="ss6-spot ss6-spot-m" style={{ left: box.w / 2 - W / 2 - 120, top: base - H - 200, width: W + 240, height: H + 320 }} />
            <button type="button" className="ss6-book ss-abs" style={{ left: box.w / 2 - W / 2, top }} aria-label={b.title} onClick={() => open(b)} data-testid="ss6-book" data-id={b.id}>
              <Book3D b={b} s={s} />
            </button>
            <div className="ss6-floor" style={{ top: base, left: g.M, right: g.M }} />
            <div className="ss-abs" style={{ left: g.M, top: capY, width: g.span(4) }}>
              <div className="t13 g">{metaOf(b)}</div>
              <button type="button" className="m15 u" style={{ marginTop: 6, minHeight: 44 }} onClick={() => open(b)}>Open the book</button>
            </div>
          </section>
        )
      })}
    </div>
  )
}

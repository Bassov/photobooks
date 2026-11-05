/* Site demo 6, Gallery on the system (spec-sys.md "6 · Gallery (system)"): the dark wall, one spotlight per book. Lead t24
   in columns 0–3; books on a hairline floor at y 640, 12.5 px/cm, one per 4 columns from column 5; label under each book;
   the book is the link. Wheel, drag (with a throw) and ← / → walk the wall; the bottom row lists all titles and "1 / 6".
   Phone: one book per screen with scroll snap. */
import * as React from 'react'
import { Book3D } from '../site-demo-1/book3d'
import { pad2 } from '../site-demo-1/data'
import { LEAD, metaOf, reduced, SysSite, type HomeApi } from '../site-sys/sys'
import './site.css'

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

export function SiteDemo6() {
  return <SysSite n={6} dark home={(h) => (h.box.narrow ? <Phone {...h} /> : <Wall {...h} />)} />
}

type Drag = { id: number; x0: number; t0: number; lx: number; lt: number; vx: number; on: boolean }

function Wall({ books, box, g, active, open, showAll }: HomeApi) {
  const n = books.length, k = Math.min(1, box.h / 900)
  const s = 12.5 * k, floor = Math.round((640 * box.h) / 900)
  const P = 4 * (g.cw + g.G), X0 = g.x(5) + g.span(2) / 2 + 30
  const end = (n - 1) * P
  const G = React.useRef({ end, P }); G.current = { end, P }
  const host = React.useRef<HTMLDivElement>(null), track = React.useRef<HTMLDivElement>(null)
  const st = React.useRef({ cur: 0, tgt: 0, v: 0, moved: false, raf: 0, drag: null as Drag | null })
  const on = React.useRef(active); on.current = active
  const [at, setAt] = React.useState(0)

  const paint = () => {
    const S = st.current
    if (track.current) track.current.style.transform = `translate3d(${-S.cur}px,0,0)`
    setAt(clamp(Math.round(S.cur / G.current.P), 0, n - 1))
  }
  const loop = React.useRef(() => {})
  loop.current = () => {
    const S = st.current, e = G.current.end
    S.raf = 0
    if (S.v && !S.drag) { S.tgt += S.v; S.v *= 0.92; if (Math.abs(S.v) < 0.05 || S.tgt <= 0 || S.tgt >= e) S.v = 0 }
    S.tgt = clamp(S.tgt, 0, e)
    const d = S.tgt - S.cur
    S.cur = reduced() || Math.abs(d) < 0.3 ? S.tgt : S.cur + d * 0.12
    paint()
    if (S.v || S.cur !== S.tgt) kick()
  }
  const kick = () => { const S = st.current; if (!S.raf) S.raf = requestAnimationFrame(() => loop.current()) }
  React.useEffect(() => () => cancelAnimationFrame(st.current.raf), [])
  // every render: keeps the track in place on a resize or a new book count
  React.useLayoutEffect(() => { const S = st.current; S.tgt = clamp(S.tgt, 0, end); S.cur = clamp(S.cur, 0, end); paint() })
  React.useEffect(() => { if (!active) { const S = st.current; S.drag = null; S.v = 0; S.tgt = S.cur } }, [active])
  const goTo = (i: number) => { const S = st.current; S.v = 0; S.tgt = clamp(i, 0, n - 1) * G.current.P; kick() }
  // wheel (vertical or horizontal) walks the wall; non-passive so nothing else scrolls
  React.useEffect(() => {
    const el = host.current; if (!el) return
    const w = (e: WheelEvent) => {
      if (!on.current) return
      e.preventDefault()
      const S = st.current; S.v = 0
      S.tgt = clamp(S.tgt + (e.deltaY + e.deltaX) * (e.deltaMode === 1 ? 40 : 1), 0, G.current.end); kick()
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
      const S = st.current, i = d > 0 ? Math.floor(S.tgt / G.current.P + 0.01) + 1 : Math.ceil(S.tgt / G.current.P - 0.01) - 1
      goTo(i)
    }
    addEventListener('keydown', kd); return () => removeEventListener('keydown', kd)
  })

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !on.current) return
    const S = st.current; S.moved = false; S.v = 0
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

  return (
    <div ref={host} className="ss6-wall" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      onPointerCancel={() => { st.current.drag = null }} onScroll={(e) => { e.currentTarget.scrollLeft = 0 }} data-testid="ss6-wall">
      <p className="ss-abs t24" style={{ left: g.x(0), top: 104, width: g.span(4) }}>{LEAD}</p>
      <div className="ss6-floor" style={{ top: floor }} />
      <div ref={track} className="ss6-track">
        {books.map((b, i) => {
          const W = b.w * s, H = b.h * s, cx = X0 + i * P
          return (
            <div key={b.id} className="ss6-ex" style={{ left: cx - W / 2, top: floor - H, width: W }}>
              <div className="ss6-spot" style={{ left: -260, top: H - 600, width: W + 520, height: 720 }} />
              <button type="button" className="ss6-book" aria-label={`${b.title}, ${metaOf(b)}`} data-testid="ss6-book" data-id={b.id}
                onFocus={() => { if (on.current) goTo(i) }}
                onClick={() => { if (st.current.moved) { st.current.moved = false; return } open(b) }}>
                <Book3D b={b} s={s} />
                <span className="ss6-label" style={{ top: H + 28 }}>
                  <span className="t16" style={{ display: 'block' }}>{b.title}</span>
                  <span className="t13 g" style={{ display: 'block' }}>{metaOf(b)}</span>
                </span>
              </button>
            </div>
          )
        })}
      </div>
      <div className="ss-abs t16 ss6-bar" style={{ left: g.M, right: g.M, bottom: 20 }}>
        <div className="ss6-titles">
          {books.map((b, i) => (
            <button key={b.id} type="button" tabIndex={-1} className={`ss-tx${i === at ? '' : ' g'}`} aria-current={i === at ? 'true' : undefined} onClick={() => goTo(i)}>{b.title}</button>
          ))}
        </div>
        {n >= 12 && <button type="button" className="ss-tx g" onClick={showAll} data-testid="ss6-all">All books</button>}
        <span className="g" data-testid="ss6-count">{at + 1} / {n}</span>
      </div>
    </div>
  )
}

/** Phone: one book per screen, vertical scroll snap; label under the book */
function Phone({ books, box, g, open, showAll }: HomeApi) {
  const n = books.length, base = Math.round((520 * box.h) / 844)
  const s = Math.min(10, (g.span(4) * 0.7) / 30, ((base - 150) * 1) / 30)
  return (
    <div className="ss6-phone" data-testid="ss6-phone">
      {books.map((b, i) => {
        const W = b.w * s, H = b.h * s
        return (
          <section key={b.id} className="ss6-screen" style={{ height: box.h }}>
            {i === 0 && (
              <div className="ss-abs" style={{ left: g.M, top: 72, width: g.span(4) }}>
                <p className="m19" style={{ maxWidth: 300 }}>{LEAD}</p>
                {n >= 12 && <button type="button" className="m15 u" style={{ marginTop: 8, minHeight: 44 }} onClick={showAll}>All books</button>}
              </div>
            )}
            <div className="ss6-spot ss6-spot-m" style={{ left: box.w / 2 - W / 2 - 120, top: base - H - 200, width: W + 240, height: H + 320 }} />
            <button type="button" className="ss6-book ss-abs" style={{ left: box.w / 2 - W / 2, top: base - H }} aria-label={b.title} onClick={() => open(b)} data-testid="ss6-book" data-id={b.id}>
              <Book3D b={b} s={s} />
            </button>
            <div className="ss6-floor" style={{ top: base, left: g.M, right: g.M }} />
            <div className="ss-abs" style={{ left: g.M, top: base + 20, width: g.span(4) }}>
              <div className="m28">{b.title}</div>
              <div className="t13 g" style={{ marginTop: 6 }}>{metaOf(b)}</div>
              <button type="button" className="m15 u" style={{ marginTop: 6, minHeight: 44 }} onClick={() => open(b)}>Open the book</button>
            </div>
            <div className="ss-abs t13 g" style={{ left: g.M, bottom: 16 }}>{pad2(i + 1)} / {pad2(n)}</div>
          </section>
        )
      })}
    </div>
  )
}

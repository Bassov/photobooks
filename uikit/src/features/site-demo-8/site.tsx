/* Site demo 8, Desk on the system (spec-sys.md "8 · Desk (system)"): the light background, no desk texture. Books lie
   flat in a loose grid from column 4 (3 × 2; 12 books 4 × 3), turned ≤ 3°; drag and throw them, a click opens. Bottom
   left (columns 0–3): the hovered title t44 + meta; at rest one grey t13 line. Phone: a zigzag column, title + year
   beside each book, a tap opens. */
import * as React from 'react'
import { CoverFace } from '../site-demo-1/art'
import { thick } from '../site-demo-1/book3d'
import type { SiteBook } from '../site-demo-1/data'
import { LEAD, metaOf, reduced, SysSite, type HomeApi } from '../site-sys/sys'
import './site.css'

const ROTS = [-3, 2, -1.2, 2.6, -2.2, 1.4, 1.8, -2.6, 0.8, -1.6, 2.4, -0.6]
const L = 16
/** the flat book: cover, the page block under it, the cast shadow; lifted on hover */
const shadows = (b: SiteBook, s: number) => {
  const T = thick(b, s) * 0.5
  return {
    '--sh': `0 1px 1px rgb(30 25 20/.22), 0 ${T}px 0 -${T * 0.4}px #E9E4DA, 0 ${T + 1}px 0 -${T * 0.4}px rgb(0 0 0/.1), 6px 12px 24px -8px rgb(30 25 20/.3)`,
    '--sh-up': `0 ${2 + L}px ${4 + L}px rgb(30 25 20/.16), ${8 + L}px ${16 + L * 2}px ${32 + L * 3}px -6px rgb(30 25 20/.3)`,
  }
}

export function SiteDemo8() {
  return <SysSite n={8} home={(h) => (h.box.narrow ? <Phone {...h} /> : <Desk {...h} />)} />
}

type Drag = { id: number; el: HTMLElement; bid: string; x0: number; y0: number; d0: { x: number; y: number }; lx: number; ly: number; lt: number; vx: number; vy: number; on: boolean }

function Desk({ books, box, g, active, open }: HomeApi) {
  const n = books.length, C = n <= 6 ? 3 : 4, R = Math.ceil(n / C)
  const ax = g.x(4), aw = box.w - g.M - ax, ay = 176, ah = box.h - 96 - ay
  const cw = aw / C, ch = ah / R
  const s = Math.min(8.6, (cw * 0.84) / 30, (ch * 0.84) / 30)
  const off = React.useRef(new Map<string, { x: number; y: number }>())
  const drag = React.useRef<Drag | null>(null), moved = React.useRef(false), raf = React.useRef(0)
  const [hov, setHov] = React.useState<SiteBook | null>(null)
  const [held, setHeld] = React.useState<string | null>(null)
  React.useEffect(() => () => cancelAnimationFrame(raf.current), [])
  React.useEffect(() => { if (!active) setHov(null) }, [active])
  const place = (el: HTMLElement, d: { x: number; y: number }) => { el.style.setProperty('--dx', `${d.x}px`); el.style.setProperty('--dy', `${d.y}px`) }

  const onDown = (e: React.PointerEvent<HTMLButtonElement>, b: SiteBook) => {
    if (e.button !== 0) return
    cancelAnimationFrame(raf.current)
    moved.current = false
    const d0 = off.current.get(b.id) ?? { x: 0, y: 0 }
    drag.current = { id: e.pointerId, el: e.currentTarget, bid: b.id, x0: e.clientX, y0: e.clientY, d0, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, vx: 0, vy: 0, on: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return
    if (!d.on && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) { d.on = true; d.el.setPointerCapture(e.pointerId); setHeld(d.bid) }
    if (!d.on) return
    const dt = e.timeStamp - d.lt
    if (dt > 0) { d.vx = ((e.clientX - d.lx) / dt) * 16.7; d.vy = ((e.clientY - d.ly) / dt) * 16.7 }
    d.lx = e.clientX; d.ly = e.clientY; d.lt = e.timeStamp
    const p = { x: d.d0.x + e.clientX - d.x0, y: d.d0.y + e.clientY - d.y0 }
    off.current.set(d.bid, p); place(d.el, p)
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null
    if (!d || d.id !== e.pointerId || !d.on) return
    moved.current = true
    let vx = reduced() || e.timeStamp - d.lt > 100 ? 0 : d.vx, vy = reduced() || e.timeStamp - d.lt > 100 ? 0 : d.vy
    // keep the book on the desk: its base box + the offset stays inside the root
    const { offsetLeft: bx, offsetTop: by, offsetWidth: bw, offsetHeight: bh } = d.el
    const step = () => {
      const p = off.current.get(d.bid)!
      vx *= 0.92; vy *= 0.92
      p.x = Math.max(-bx, Math.min(box.w - bw - bx, p.x + vx)); p.y = Math.max(64 - by, Math.min(box.h - bh - by, p.y + vy))
      place(d.el, p)
      if (Math.abs(vx) + Math.abs(vy) > 0.2) raf.current = requestAnimationFrame(step)
      else setHeld(null)
    }
    // the throw slides without the transform transition (held until it stops)
    if (vx || vy) raf.current = requestAnimationFrame(step)
    else setHeld(null)
  }

  return (
    <div className="ss-layer ss8-desk" data-testid="ss8-desk" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; setHeld(null) }}>
      <p className="ss-abs t24" style={{ left: g.x(0), top: 104, width: g.span(4) }}>{LEAD}</p>
      {books.map((b, i) => {
        const r = Math.floor(i / C), c = i % C
        const W = b.w * s, H = b.h * s
        const cx = ax + (c + 0.5) * cw + (r % 2 ? cw * 0.12 : -cw * 0.04), cy = ay + (r + 0.5) * ch
        const d = off.current.get(b.id) ?? { x: 0, y: 0 }
        return (
          <button key={b.id} type="button" className="ss8-book" data-held={held === b.id ? '' : undefined}
            style={{ left: cx - W / 2, top: cy - H / 2, width: W, height: H, '--rot': ROTS[i % ROTS.length], '--dx': `${d.x}px`, '--dy': `${d.y}px`, ...shadows(b, s) } as React.CSSProperties}
            aria-label={`${b.title}, ${metaOf(b)}`}
            onPointerDown={(e) => onDown(e, b)}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHov(b) }} onPointerLeave={() => setHov((h) => (h === b ? null : h))}
            onFocus={() => setHov(b)} onBlur={() => setHov((h) => (h === b ? null : h))}
            onClick={() => { if (moved.current) { moved.current = false; return } open(b) }}
            data-testid="ss8-book" data-id={b.id}>
            <CoverFace b={b} w={W} h={H} />
          </button>
        )
      })}
      <div className="ss-abs" style={{ left: g.x(0), bottom: 24, width: g.span(4) }} aria-live="polite" data-testid="ss8-caption">
        {hov ? (
          <div key={hov.id} className="ss8-cap">
            <div className="t44">{hov.title}</div>
            <div className="t13 g" style={{ marginTop: 8 }}>{metaOf(hov)}</div>
          </div>
        ) : <div className="t13 g">Click a book to open it. Drag to move it.</div>}
      </div>
    </div>
  )
}

/** Phone: a zigzag column; title + year on the free side of each book; a tap opens */
function Phone({ books, box, g, open }: HomeApi) {
  let y = 0
  const items = books.map((b, i) => {
    const s = Math.min(220, box.w * 0.56) / Math.max(b.w, b.h), W = b.w * s, H = b.h * s
    const right = i % 2 === 1, x = right ? box.w - g.M - W - 6 : g.M + 6
    const it = { b, i, W, H, x, y, right }
    y += H + 34
    return it
  })
  return (
    <div className="ss-layer ss-scroll" data-testid="ss8-phone">
      <p className="ss-abs m19" style={{ left: g.M, top: 72, width: g.span(4), maxWidth: 340 }}>{LEAD}</p>
      <div style={{ position: 'relative', marginTop: 180, height: y + 48 }}>
        {items.map(({ b, i, W, H, x, y, right }) => (
          <React.Fragment key={b.id}>
            <button type="button" className="ss8-book" style={{ left: x, top: y, width: W, height: H, '--rot': ROTS[i % ROTS.length] * 0.85, '--dx': '0px', '--dy': '0px', ...shadows(b, s8(b, W)) } as React.CSSProperties}
              aria-label={b.title} onClick={() => open(b)} data-testid="ss8-book" data-id={b.id}>
              <CoverFace b={b} w={W} h={H} />
            </button>
            <button type="button" className="ss-abs" style={{ top: y + H - 44, minHeight: 44, width: 120, ...(right ? { left: g.M } : { left: x + W + 16 }) }} onClick={() => open(b)} tabIndex={-1}>
              <span className="m15" style={{ display: 'block' }}>{b.title}</span>
              <span className="t13 g" style={{ display: 'block' }}>{b.year}</span>
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
const s8 = (b: SiteBook, W: number) => W / b.w

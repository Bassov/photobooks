/* Photographer site, demo 4 v2 "Desk" (Spec site-awards-v2 §4): a pale table in window light, the books lying top-down in a
   loose even grid on its right part (3 × 2 at 9.5 px/cm, odd rows +40, turned within ±3.5°). Drag a book and throw it
   (×.92 per frame, bounces off the edges ×−.4). Hover lifts it (scale 1.045, rotation × .3) and the fixed caption at the
   bottom-left changes its text. A click: the book rises to the centre and opens in place, the table dims.
   1 book: large next to its text; 12: 4 × 3 at 6.2 px/cm. Phone ≤ 640: the table scrolls, the books zigzag, tap opens.
   `?books=1|3|6|12`. */
import * as React from "react"
import { EMAIL, type SiteBook } from "../site-demo-1/data"
import { BooksSwitch, clamp, countLabel, coverAt, Header, metaOf, ReaderPage, reduced, Statement, useBooks, useBox, yearsOf, type Box } from "../site-demo-1/v2"
import { FlatBook } from "./book"
import "./site.css"

const ABOUT = "I make books of the trips I take and the people I take them with, printed and bound by hand. *Based in Tbilisi, working wherever the road goes.*"
const ROT = [-3.5, 2.2, -1.2, 3.1, -2.6, 1.6, 2.8, -1.8, 1.1, -3, 2.4, -1.4]
/** the slots on the 1440 × 900 table: px per cm and the centres */
const slotsOf = (n: number) => {
  if (n === 1) return { S: 18, at: [[860, 470, -2]] }
  const [cols, S, step, rowH, x0, y0] = n === 12 ? [4, 6.2, 250, 230, 490, 200] : [3, 9.5, 370, 326, 440, n === 3 ? 440 : 294]
  return { S, at: Array.from({ length: n }, (_, i) => { const r = Math.floor(i / cols), c = i % cols; return [x0 + c * step + (r % 2) * 40, y0 + r * rowH, ROT[i]] }) }
}
/** design units are the 1440 × 900 table: px = o + u·k, centred, k = min(vw / 1440, vh / 900) */
const tableOf = (box: Box) => { const k = Math.min(box.w / 1440, box.h / 900); return { k, ox: box.w / 2 - 720 * k, oy: box.h / 2 - 450 * k } }
type Pos = { x: number; y: number; rz: number; vx: number; vy: number }
type Open = { i: number; phase: "fly" | "read" | "back" }

export function SiteDemo4() {
  const books = useBooks()
  return <Table key={books.length} books={books} />
}

function Table({ books }: { books: SiteBook[] }) {
  const [root, box] = useBox<HTMLDivElement>()
  const opener = React.useRef<HTMLElement | null>(null), timer = React.useRef(0)
  const [open, setOpen] = React.useState<Open | null>(null), [view, setView] = React.useState(0), [about, setAbout] = React.useState(false)
  const live = React.useRef({ open, view, narrow: box.narrow }); live.current = { open, view, narrow: box.narrow }
  const later = (ms: number, f: () => void) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(f, ms) }
  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const openBook = (i: number, el: HTMLElement) => {
    if (live.current.open) return
    opener.current = el; setView(0)
    if (reduced() || live.current.narrow) { setOpen({ i, phase: "read" }); return }
    setOpen({ i, phase: "fly" }); later(600, () => setOpen({ i, phase: "read" }))
  }
  // the reader is in place of the flat book: the cover opens
  React.useEffect(() => {
    if (open?.phase !== "read" || reduced()) return
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setView((v) => (v === 0 ? 1 : v)))); return () => cancelAnimationFrame(r)
  }, [open?.phase])
  /** the book closes, then flies back to its spot (600 ms) while the table relights */
  const close = React.useCallback(() => {
    const { open: o, view: v, narrow } = live.current; if (!o || o.phase === "back") return
    const back = () => { if (reduced() || narrow) { setOpen(null); return } setOpen({ ...o, phase: "back" }); later(600, () => setOpen(null)) }
    if (o.phase === "fly" || narrow) { back(); return }
    setView(0)
    later(reduced() ? 170 : v === 1 ? 1020 : v === 0 ? 0 : 260, back)
  }, [])
  React.useEffect(() => {
    if ((open === null || open.phase === "back") && opener.current) { opener.current.focus({ preventScroll: true }); opener.current = null }
  }, [open])
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && live.current.open) { e.preventDefault(); close() } }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [close])

  const reading = open !== null && open.phase !== "back"
  const ob = open?.phase === "read" ? books[open.i] : null
  const items = [
    { label: "About", pressed: about, onClick: () => setAbout((a) => !a) },
    { label: "Contact", href: `mailto:${EMAIL}` },
  ]
  return (
    <div ref={root} className={`sv2 sv4${box.narrow ? " sv2-narrow" : ""}`} data-surface="site-demo-4" data-allow-border data-open={reading || undefined} data-testid="sd4-root">
      {box.narrow ? <Phone books={books} box={box} about={about} onOpen={openBook} />
        : <Desk books={books} box={box} open={open} about={about} onOpen={openBook} />}
      <div className="sv4-dim" aria-hidden />
      <Header items={items} narrow={box.narrow} />
      {ob && <ReaderPage n={4} b={ob} box={box} view={view} onView={setView} onClose={close} back="Put the book back" />}
      <BooksSwitch demo={4} n={books.length} />
      <div className="sd-grain" aria-hidden />
    </div>
  )
}

type DeskProps = { books: SiteBook[]; box: Box; open: Open | null; about: boolean; onOpen: (i: number, el: HTMLElement) => void }
type Drag = { i: number; id: number; x0: number; y0: number; px: number; py: number; lx: number; ly: number; lt: number; vx: number; vy: number; on: boolean }

/** desktop: the books (one transform per book, written by React and, while they move, by the rAF loop) and the caption */
function Desk({ books, box, open, about, onOpen }: DeskProps) {
  const n = books.length, { S, at } = slotsOf(n), t = tableOf(box), s = S * t.k
  const host = React.useRef<HTMLDivElement>(null), els = React.useRef<(HTMLButtonElement | null)[]>([])
  const pos = React.useRef<Pos[]>(at.map(([x, y, rz]) => ({ x, y, rz, vx: 0, vy: 0 })))
  const order = React.useRef(books.map((_, i) => i))
  const g = React.useRef({ box, t, s, open }); g.current = { box, t, s, open }
  const drag = React.useRef<Drag | null>(null), moved = React.useRef(false), raf = React.useRef(0)
  const [hov, setHov] = React.useState(-1)
  React.useEffect(() => () => cancelAnimationFrame(raf.current), [])

  /** the slot transform of book i, px */
  const pose = (i: number) => {
    const { box: B, t: T, s: sp, open: o } = g.current, b = books[i], W = b.w * sp, H = b.h * sp
    if (o && o.i === i && o.phase !== "back") { const c = coverAt(B, b); return `translate(${c.cx - W / 2}px, ${c.cy - H / 2}px) scale(${c.w / W})` }
    const p = pos.current[i]; return `translate(${T.ox + p.x * T.k - W / 2}px, ${T.oy + p.y * T.k - H / 2}px) rotate(${p.rz}deg)`
  }
  const write = (i: number) => { const e = els.current[i]; if (e) { e.style.transform = pose(i); e.style.setProperty("--rz", pos.current[i].rz.toFixed(2)) } }
  // the transforms are not in the JSX: the loop writes them too, so React could skip a write it thinks is unchanged
  React.useLayoutEffect(() => { books.forEach((_, i) => write(i)) })
  /** fully on the table; a moving book bounces off the edge ×−.4 */
  const keep = (i: number, p: Pos) => {
    const { box: B, t: T } = g.current, b = books[i], a = (p.rz * Math.PI) / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)), W = b.w * S, H = b.h * S
    const hw = (W * c + H * sn) / 2 + 4, hh = (W * sn + H * c) / 2 + 10
    const x0 = -T.ox / T.k + hw, x1 = (B.w - T.ox) / T.k - hw, y0 = (84 - T.oy) / T.k + hh, y1 = (B.h - T.oy) / T.k - hh
    if (p.x < x0) { p.x = x0; p.vx = Math.abs(p.vx) * 0.4 } else if (p.x > x1) { p.x = Math.max(x0, x1); p.vx = -Math.abs(p.vx) * 0.4 }
    if (p.y < y0) { p.y = y0; p.vy = Math.abs(p.vy) * 0.4 } else if (p.y > y1) { p.y = Math.max(y0, y1); p.vy = -Math.abs(p.vy) * 0.4 }
  }
  const step = () => {
    let busy = false
    pos.current.forEach((p, i) => {
      if (drag.current?.i === i || Math.hypot(p.vx, p.vy) < 0.05) { p.vx = p.vy = 0; return }
      p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92
      p.rz = clamp(p.rz + p.vx * 0.05, -12, 12)
      keep(i, p); write(i); busy = true
    })
    raf.current = busy ? requestAnimationFrame(step) : 0
  }
  const toTop = (i: number) => {
    order.current = [...order.current.filter((x) => x !== i), i]
    order.current.forEach((x, z) => { const e = els.current[x]; if (e) e.style.zIndex = String(z + 1) })
  }
  const unit = () => { const h = host.current!, r = h.getBoundingClientRect(); return (r.width / h.clientWidth || 1) * g.current.t.k }

  const onDown = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || g.current.open || reduced()) return
    const p = pos.current[i]; p.vx = p.vy = 0
    drag.current = { i, id: e.pointerId, x0: e.clientX, y0: e.clientY, px: p.x, py: p.y, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, vx: 0, vy: 0, on: false }
    moved.current = false
  }
  const onMove = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current; if (!d || d.i !== i || d.id !== e.pointerId) return
    const u = unit(), el = e.currentTarget
    if (!d.on) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return
      d.on = true; el.setPointerCapture(e.pointerId); el.setAttribute("data-drag", ""); toTop(i)
    }
    const dt = e.timeStamp - d.lt
    if (dt > 0) { d.vx = ((e.clientX - d.lx) / u / dt) * 16.7; d.vy = ((e.clientY - d.ly) / u / dt) * 16.7 }
    d.lx = e.clientX; d.ly = e.clientY; d.lt = e.timeStamp
    const p = pos.current[i]
    p.x = d.px + (e.clientX - d.x0) / u; p.y = d.py + (e.clientY - d.y0) / u
    if (dt > 0) p.rz = clamp(p.rz + d.vx * 0.05 * Math.min(2, dt / 16.7), -12, 12)
    keep(i, p); write(i)
  }
  const onUp = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current; if (!d || d.i !== i || d.id !== e.pointerId) return
    drag.current = null
    if (!d.on) return
    moved.current = true; e.currentTarget.removeAttribute("data-drag")
    const p = pos.current[i]
    if (e.timeStamp - d.lt <= 100) { p.vx = d.vx; p.vy = d.vy; if (!raf.current) raf.current = requestAnimationFrame(step) } // a rested pointer: no throw
  }
  const onCancel = () => { const d = drag.current; drag.current = null; if (d) { els.current[d.i]?.removeAttribute("data-drag"); write(d.i) } }

  const reading = open !== null && open.phase !== "back"
  const hb = hov >= 0 && !reading ? books[hov] : null
  const one = n === 1
  return (
    <div ref={host} className="sv4-desk" data-glide={(open && !reduced()) || undefined} data-still={reading || undefined} data-testid="sd4-desk">
      {one ? (
        <div className="sv4-cap" style={{ left: 48, top: Math.round((520 * box.h) / 900) - 60, width: 380 }}>
          <div key={about ? "a" : "b"} className="sv4-fade">
            <div className="sv2-meta">{about ? "About" : metaOf(books[0])}</div>
            <h1 className="sv2-display" style={{ fontSize: 36, marginTop: 6 }}>{books[0].title}</h1>
            <p className="sv4-text"><Statement s={about ? ABOUT : books[0].statement} /></p>
            <button type="button" className="sv2-link" style={{ marginTop: 14 }} tabIndex={reading ? -1 : undefined} onClick={() => { const el = els.current[0]; if (el) onOpen(0, el) }}>Open the book</button>
          </div>
        </div>
      ) : (
        <div className="sv4-cap" style={{ left: 48, bottom: 48, width: 380, height: 150 }} aria-live="polite">
          <div key={hb ? hb.id : about ? "about" : "rest"} className="sv4-fade">
            {hb ? <>
              <div className="sv2-meta">{metaOf(hb)}</div>
              <div className="sv2-display" style={{ fontSize: 36, marginTop: 6 }}>{hb.title}</div>
              <div className="sv4-hint">Click to open · drag to move</div>
            </> : about ? <>
              <div className="sv2-meta">About</div>
              <p className="sv4-text" style={{ marginTop: 6 }}><Statement s={ABOUT} /></p>
            </> : <>
              <div className="sv2-meta">Photobooks, {yearsOf(books)}</div>
              <h1 className="sv2-display" style={{ fontSize: 36, marginTop: 6 }}>{countLabel(n)} on the table</h1>
              <p className="sv4-text">Pick one up, or move them around.</p>
            </>}
          </div>
        </div>
      )}
      {books.map((b, i) => {
        const W = b.w * s, H = b.h * s, active = open?.i === i
        return (
          <button key={b.id} ref={(x) => { els.current[i] = x }} type="button" className="sv4-book" style={{ width: W, height: H, zIndex: active && open ? 40 : order.current.indexOf(i) + 1 }}
            aria-label={`Open ${b.title}, ${b.year}`} tabIndex={reading ? -1 : undefined}
            data-hidden={active && open?.phase === "read" ? "" : undefined} data-testid="sd4-book" data-id={b.id}
            onPointerDown={onDown(i)} onPointerMove={onMove(i)} onPointerUp={onUp(i)} onPointerCancel={onCancel}
            onPointerEnter={(e) => { if (e.pointerType === "mouse") setHov(i) }} onPointerLeave={() => setHov((h) => (h === i ? -1 : h))}
            onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) setHov(i) }} onBlur={() => setHov((h) => (h === i ? -1 : h))}
            onClick={(e) => { if (moved.current) { moved.current = false; return } setHov(-1); onOpen(i, e.currentTarget) }}>
            <FlatBook b={b} s={s} />
          </button>
        )
      })}
    </div>
  )
}

/** phone: the table scrolls; one book per row, zigzag left / right, its title and year on the free side; tap opens */
function Phone({ books, box, about, onOpen }: { books: SiteBook[]; box: Box; about: boolean; onOpen: (i: number, el: HTMLElement) => void }) {
  const n = books.length
  return (
    <div className="sv2-scroll" data-testid="sd4-phone">
      <div style={{ padding: "84px 20px 96px" }}>
        <div key={about ? "a" : "b"} className="sv4-fade">
          <div className="sv2-meta">{about ? "About" : `Photobooks, ${yearsOf(books)}`}</div>
          {about ? <p className="sv2-intro" style={{ marginTop: 6 }}><Statement s={ABOUT} /></p>
            : <h1 className="sv2-display" style={{ fontSize: 28, marginTop: 4 }}>{countLabel(n, true)} on the table</h1>}
        </div>
        <ol className="sv4-rows">
          {books.map((b, i) => {
            const W = Math.min(b.w > b.h ? 288 : 230, box.w - 40 - 110), s = W / b.w, right = i % 2 === 1
            return (
              <li key={b.id} className="sv4-row" style={{ flexDirection: right ? "row-reverse" : "row" }}>
                <button type="button" className="sv4-book sv4-book-phone" style={{ width: W, height: b.h * s, transform: `rotate(${right ? 2.5 : -2.5}deg)` }}
                  aria-label={`Open ${b.title}, ${b.year}`} data-testid="sd4-book" data-id={b.id} onClick={(e) => onOpen(i, e.currentTarget)}>
                  <FlatBook b={b} s={s} />
                </button>
                <div className="sv4-row-cap" style={{ textAlign: right ? "left" : "right" }}>
                  <div className="sv4-row-t">{b.title}</div>
                  <div className="sv2-meta">{b.year}</div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/* Photographer site, demo 4 "Desk" (Designer Spec site-awards-5, Direction 4): seen from above, the books lie on a linen
   desk under a lamp, at true size, slightly turned. Drag a book (it follows the hand, turns with its speed, lifts 18) and
   throw it (×.92 per frame, bounces off the edges ×−.4); a click opens it: it slides to the centre and straightens
   (600 ms), the others move aside, the desk darkens, then the cover opens in place. Double-click the desk to tidy up.
   Narrow (< 768): one pile; tap the top book to open it, swipe it away to send it to the bottom. */
import * as React from "react"
import { BOOKS, EMAIL } from "../site-demo-1/data"
import "../site-demo-1/site.css"
import { BookPage, FlatBook, layoutOf, readerBox, reduced, tagOf, type L4 } from "./book"
import "./site.css"

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const ABOUT = "I make books of the trips I take and the people I take them with, printed and bound by hand. Based in Tbilisi."
/** centre x, y, rz on the 1440×900 desk */
const SEED: Record<string, [number, number, number]> = {
  "lake-trip": [452, 330, -6], coast: [790, 246, 4], "summer-family": [1108, 372, -3], "desert-road": [640, 612, 7], forest: [958, 640, -9], city: [1262, 668, 5],
}
/** the narrow pile, bottom → top: offset x, rz */
const PILE: [number, number][] = [[-10, 9], [8, -7], [-6, 5], [6, -4], [-4, 3], [0, -2]]
type Pos = { x: number; y: number; rz: number; vx: number; vy: number }
const seeds = (): Pos[] => BOOKS.map((b) => { const [x, y, rz] = SEED[b.id]; return { x, y, rz, vx: 0, vy: 0 } })
/** positions, z-order and the pile live until reload */
const desk = { pos: seeds(), order: BOOKS.map((_, i) => i), pile: BOOKS.map((_, i) => BOOKS.length - 1 - i), hinted: false }
type Open = { i: number; phase: "fly" | "read" | "back" }

export function SiteDemo4() {
  const root = React.useRef<HTMLDivElement>(null)
  const opener = React.useRef<HTMLElement | null>(null)
  const timer = React.useRef(0)
  const [box, setBox] = React.useState({ w: 1440, h: 900 })
  const [open, setOpen] = React.useState<Open | null>(null)
  const [view, setView] = React.useState(0)
  const [flip, setFlip] = React.useState(false)
  const live = React.useRef({ open, view }); live.current = { open, view }
  React.useLayoutEffect(() => {
    const el = root.current; if (!el) return
    const r = () => setBox({ w: el.clientWidth, h: el.clientHeight }); r()
    const ro = new ResizeObserver(r); ro.observe(el); return () => ro.disconnect()
  }, [])
  const l = layoutOf(box.w, box.h)
  const later = (ms: number, f: () => void) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(f, ms) }
  React.useEffect(() => () => window.clearTimeout(timer.current), [])

  const openBook = (i: number, el: HTMLElement) => {
    if (live.current.open) return
    opener.current = el; desk.hinted = true; setFlip(false); setView(0)
    if (reduced()) { setOpen({ i, phase: "read" }); return }
    setOpen({ i, phase: "fly" }); later(600, () => setOpen({ i, phase: "read" }))
  }
  // the reader is in place of the flat book: the cover opens
  React.useEffect(() => {
    if (open?.phase !== "read") return
    const r = requestAnimationFrame(() => setView((v) => (v === 0 ? 1 : v))); return () => cancelAnimationFrame(r)
  }, [open?.phase])
  /** the book closes, then flies back to its spot (600 ms) while the desk relights */
  const close = React.useCallback(() => {
    const { open: o, view: v } = live.current; if (!o || o.phase === "back") return
    const back = () => { if (reduced()) { setOpen(null); return } setOpen({ ...o, phase: "back" }); later(600, () => setOpen(null)) }
    if (o.phase === "fly") { back(); return }
    setView(0)
    later(reduced() ? 170 : v === 1 ? 1020 : v === 0 ? 0 : 260, back)
  }, [])
  // back on the desk: the focus returns to the book that opened
  React.useEffect(() => {
    if ((open === null || open.phase === "back") && opener.current) { opener.current.focus({ preventScroll: true }); opener.current = null }
  }, [open])
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (live.current.open) { e.preventDefault(); close() } else if (flip) { e.preventDefault(); setFlip(false) }
    }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [flip, close])

  const reading = open !== null && open.phase !== "back"
  const b = open && open.phase === "read" ? BOOKS[open.i] : null
  return (
    <div ref={root} className="relative h-full overflow-hidden" data-surface="site-demo-4" data-allow-border data-open={reading || undefined} data-testid="sd4-root">
      <Desk l={l} open={open} flip={flip} onFlip={setFlip} onOpen={openBook} />
      <div className="sd4-dim" aria-hidden />
      {b && <BookPage key={b.id} b={b} l={l} view={view} onView={setView} onClose={close} />}
      <header className="sd4-head">
        <span className="sd4-name sd4-abs" style={{ left: l.narrow ? 20 : 48, top: l.narrow ? 22 : 36, fontSize: l.narrow ? 20 : 26 }}>{l.narrow ? "A. Basov" : "Aleksandr Basov"}</span>
        {!l.narrow && (
          <nav className="sd4-abs flex" style={{ right: 48, top: 42, gap: 28 }}>
            <button type="button" className="sd4-nav" aria-pressed={flip} onClick={() => setFlip((f) => !f)} data-testid="sd4-nav-about">About</button>
            <a className="sd4-nav" href={`mailto:${EMAIL}`}>Contact</a>
          </nav>
        )}
      </header>
      {l.narrow && <p className="sd4-mono sd4-abs" style={{ left: 20, bottom: 40, fontSize: 12, lineHeight: 1.6, color: "var(--d4-card-ink)" }}>Tap to open · swipe the top<br />book away to see the next</p>}
      <div className="sd-grain" aria-hidden />
    </div>
  )
}

type DeskProps = { l: L4; open: Open | null; flip: boolean; onFlip: (f: boolean) => void; onOpen: (i: number, el: HTMLElement) => void }
type Drag = { i: number; id: number; x0: number; y0: number; px: number; py: number; lx: number; ly: number; lt: number; vx: number; vy: number; on: boolean }

/** The desk: the books (one transform per book, written by React and, while they move, by the rAF loop) and the card. */
function Desk({ l, open, flip, onFlip, onOpen }: DeskProps) {
  const host = React.useRef<HTMLDivElement>(null), hint = React.useRef<HTMLSpanElement>(null)
  const els = React.useRef<(HTMLButtonElement | null)[]>([]), wraps = React.useRef<(HTMLDivElement | null)[]>([])
  const [, bump] = React.useReducer((x: number) => x + 1, 0)
  const [glide, setGlide] = React.useState(false)
  const lr = React.useRef(l); lr.current = l
  const or = React.useRef(open); or.current = open
  const drag = React.useRef<Drag | null>(null), moved = React.useRef(false), raf = React.useRef(0), gt = React.useRef(0)
  React.useEffect(() => () => { cancelAnimationFrame(raf.current); window.clearTimeout(gt.current) }, [])
  const glideFor = (ms: number) => { setGlide(true); window.clearTimeout(gt.current); gt.current = window.setTimeout(() => setGlide(false), ms) }

  /** the slot transform of book i, px */
  const pose = (i: number) => {
    const g = lr.current, b = BOOKS[i], W = b.w * g.s, H = b.h * g.s, o = or.current
    if (o && o.i === i && o.phase !== "back") { const rb = readerBox(g, b); return `translate(${g.vw / 2 - W / 2}px, ${rb.top + rb.h / 2 - H / 2}px) scale(${rb.w / 2 / W})` }
    if (g.narrow) { const k = desk.pile.indexOf(i), [dx, rz] = PILE[k]; return `translate(${g.vw / 2 + dx - W / 2}px, ${g.vh * 0.43 + k * 4 - H / 2}px) rotate(${rz}deg)` }
    const p = desk.pos[i]; return `translate(${g.ox + p.x * g.k - W / 2}px, ${g.oy + p.y * g.k - H / 2}px) rotate(${p.rz}deg)`
  }
  const write = (i: number) => { const e = els.current[i]; if (e) { e.style.transform = pose(i); e.style.setProperty("--rz", desk.pos[i].rz.toFixed(2)) } }
  // the transforms are not in the JSX: the loop writes them too, so React could skip a write it thinks is unchanged
  React.useLayoutEffect(() => { BOOKS.forEach((_, i) => write(i)) })
  /** fully on screen; a moving book bounces off the edge ×−.4 */
  const keep = (i: number, p: Pos) => {
    const g = lr.current, b = BOOKS[i], a = (p.rz * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), W = b.w * 9, H = b.h * 9
    const hw = (W * c + H * s) / 2 + 4, hh = (W * s + H * c) / 2 + 10
    const x0 = -g.ox / g.k + hw, x1 = (g.vw - g.ox) / g.k - hw, y0 = -g.oy / g.k + hh, y1 = (g.vh - g.oy) / g.k - hh
    if (p.x < x0) { p.x = x0; p.vx = Math.abs(p.vx) * 0.4 } else if (p.x > x1) { p.x = Math.max(x0, x1); p.vx = -Math.abs(p.vx) * 0.4 }
    if (p.y < y0) { p.y = y0; p.vy = Math.abs(p.vy) * 0.4 } else if (p.y > y1) { p.y = Math.max(y0, y1); p.vy = -Math.abs(p.vy) * 0.4 }
  }
  const step = () => {
    let busy = false
    desk.pos.forEach((p, i) => {
      if (drag.current?.i === i || Math.hypot(p.vx, p.vy) < 0.05) { p.vx = p.vy = 0; return }
      p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92
      p.rz = clamp(p.rz + p.vx * 0.05, -12, 12)
      keep(i, p); write(i); busy = true
    })
    raf.current = busy ? requestAnimationFrame(step) : 0
  }
  const toTop = (i: number) => {
    desk.order = [...desk.order.filter((x) => x !== i), i]
    desk.order.forEach((x, z) => { const w = wraps.current[x]; if (w) w.style.zIndex = String(z + 1) })
  }
  const tidy = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget || or.current || l.narrow) return
    cancelAnimationFrame(raf.current); raf.current = 0; desk.pos = seeds()
    if (!reduced()) glideFor(600)
    bump()
  }
  const unit = (e: React.PointerEvent) => { const h = host.current!, r = h.getBoundingClientRect(); return (r.width / h.clientWidth || 1) * (lr.current.narrow ? 1 : lr.current.k) }

  const onDown = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || or.current || reduced() || (l.narrow && desk.pile[desk.pile.length - 1] !== i)) return
    const p = desk.pos[i]; p.vx = p.vy = 0
    drag.current = { i, id: e.pointerId, x0: e.clientX, y0: e.clientY, px: p.x, py: p.y, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, vx: 0, vy: 0, on: false }
    moved.current = false
  }
  const onMove = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current; if (!d || d.i !== i || d.id !== e.pointerId) return
    const u = unit(e), el = e.currentTarget
    if (!d.on) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return
      d.on = true; el.setPointerCapture(e.pointerId); el.setAttribute("data-drag", ""); desk.hinted = true; hint.current?.removeAttribute("data-on")
      if (!lr.current.narrow) toTop(i)
    }
    const dt = e.timeStamp - d.lt
    if (dt > 0) { d.vx = ((e.clientX - d.lx) / u / dt) * 16.7; d.vy = ((e.clientY - d.ly) / u / dt) * 16.7 }
    d.lx = e.clientX; d.ly = e.clientY; d.lt = e.timeStamp
    if (lr.current.narrow) { const sw = (e.clientX - d.x0) / u; el.style.transform = `translateX(${sw}px) ${pose(i)} rotate(${sw * 0.04}deg)`; return }
    const p = desk.pos[i]
    p.x = d.px + (e.clientX - d.x0) / u; p.y = d.py + (e.clientY - d.y0) / u
    if (dt > 0) p.rz = clamp(p.rz + d.vx * 0.05 * Math.min(2, dt / 16.7), -12, 12)
    keep(i, p); write(i)
  }
  const onUp = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current; if (!d || d.i !== i || d.id !== e.pointerId) return
    drag.current = null
    if (!d.on) return
    moved.current = true; e.currentTarget.removeAttribute("data-drag")
    const rested = e.timeStamp - d.lt > 100 // the pointer rested before release: no throw
    if (lr.current.narrow) {
      const sw = (e.clientX - d.x0) / unit(e), el = e.currentTarget, dir = Math.sign(sw) || 1
      if (Math.abs(sw) > 90 || (!rested && Math.abs(d.vx) > 8)) {
        el.style.transition = "transform 280ms cubic-bezier(.4, 0, 1, 1)"
        el.style.transform = `translateX(${dir * lr.current.vw}px) ${pose(i)} rotate(${dir * 20}deg)`
        window.setTimeout(() => { el.style.transition = ""; desk.pile = [i, ...desk.pile.filter((x) => x !== i)]; glideFor(600); bump() }, 280)
      } else { glideFor(600); bump() } // springs back: the layout effect writes the pile pose under the glide
      return
    }
    const p = desk.pos[i]
    if (!rested) { p.vx = d.vx; p.vy = d.vy; if (!raf.current) raf.current = requestAnimationFrame(step) }
  }
  const onCancel = () => { const d = drag.current; drag.current = null; if (d) { els.current[d.i]?.removeAttribute("data-drag"); write(d.i) } }
  // the cursor hint "Drag · click to open", the first time only
  const onHover = (on: boolean) => (e: React.PointerEvent) => { if (e.pointerType === "mouse" && !desk.hinted && !l.narrow && !reduced()) hint.current?.toggleAttribute("data-on", on) }
  const onDeskMove = (e: React.PointerEvent) => {
    const h = host.current, t = hint.current; if (!h || !t || desk.hinted) return
    const r = h.getBoundingClientRect(), k = r.width / h.clientWidth || 1
    t.style.transform = `translate(${(e.clientX - r.left) / k + 16}px, ${(e.clientY - r.top) / k - 36}px)`
  }

  const reading = open !== null && open.phase !== "back"
  const top = desk.pile[desk.pile.length - 1]
  const card = { left: l.ox + 70 * l.k, top: l.oy + 560 * l.k }
  return (
    <div ref={host} className="sd4-desk absolute inset-0" data-glide={glide || (open && !reduced()) || undefined} data-narrow={l.narrow || undefined} data-still={reading || undefined} onDoubleClick={tidy} onPointerMove={onDeskMove} data-testid="sd4-desk">
      {!l.narrow && (
        <div className="sd4-card" style={card} data-flip={flip || undefined} data-testid="sd4-card">
          <div className="sd4-card-f" aria-hidden={flip}>
            ALEKSANDR BASOV<br />Photobooks, 2023–2026<br /><br />Six books on the desk.<br />Pick one up, or open it.<br /><br />
            <a href={`mailto:${EMAIL}`} className="sd4-card-mail" tabIndex={flip || reading ? -1 : undefined}>{EMAIL}</a>
          </div>
          <div className="sd4-card-b" aria-hidden={!flip}>
            ABOUT<br /><br />{ABOUT}<br /><br />
            <button type="button" className="sd4-card-mail" tabIndex={!flip || reading ? -1 : undefined} onClick={() => onFlip(false)}>Turn the card over</button>
          </div>
        </div>
      )}
      {BOOKS.map((b, i) => {
        const W = b.w * l.s, H = b.h * l.s, active = open?.i === i, z = l.narrow ? desk.pile.indexOf(i) + 1 : desk.order.indexOf(i) + 1
        let away: string | undefined
        if (reading && !active && !reduced()) {
          const p = desk.pos[i], cx = l.narrow ? 0 : l.ox + p.x * l.k - l.vw / 2, cy = l.narrow ? -1 : l.oy + p.y * l.k - l.vh / 2, n = Math.hypot(cx, cy) || 1
          away = `translate(${(cx / n) * 260}px, ${(cy / n) * 260}px)`
        }
        const lower = l.narrow && i !== top
        return (
          <div key={b.id} ref={(x) => { wraps.current[i] = x }} className="sd4-away" style={{ zIndex: active && open ? 30 : z, transform: away }} data-away={away ? "" : undefined}>
            <button ref={(x) => { els.current[i] = x }} type="button" className="sd4-book" style={{ width: W, height: H }}
              aria-label={`Open ${b.title}, ${b.year}`} tabIndex={lower || reading ? -1 : undefined} data-top={l.narrow && i === top ? "" : undefined}
              data-hidden={active && open?.phase === "read" ? "" : undefined} data-testid="sd4-book" data-id={b.id}
              onPointerDown={onDown(i)} onPointerMove={onMove(i)} onPointerUp={onUp(i)} onPointerCancel={onCancel} onPointerEnter={onHover(true)} onPointerLeave={onHover(false)}
              onClick={(e) => { if (moved.current) { moved.current = false; return } hint.current?.removeAttribute("data-on"); onOpen(i, e.currentTarget) }}>
              <FlatBook b={b} s={l.s}>
                <span className="sd4-paper sd4-tag" aria-hidden>{l.narrow ? `${b.title} · ${b.year}` : tagOf(b)}</span>
              </FlatBook>
            </button>
          </div>
        )
      })}
      <span ref={hint} className="sd4-hint" aria-hidden>Drag · click to open</span>
    </div>
  )
}

/* Photographer site, demo 2 "Night gallery" (Designer Spec site-awards-5, Direction 2): one exhibition room. The books
   hang face-out on a lit ledge along one long wall; wheel, drag and ← / → walk along it (lerp .12, drag inertia ×.92).
   Each book turns toward you as it passes the centre (ry ±18) and its spotlight brightens. Open = the camera walks up
   to the book (900 ms), then the reader with the paper leaf fades in. Narrow (< 768): one bay per screen, vertical snap. */
import * as React from "react"
import { Book3D } from "../site-demo-1/book3d"
import { AUTHOR, BOOKS, EMAIL, pad2, pagesOf, type SiteBook } from "../site-demo-1/data"
import "../site-demo-1/site.css"
import { BookPage, IndexOverlay, layoutOf, readerBox, reduced, type L2 } from "./book"
import "./site.css"

const INTRO = 560, ABOUT = 640
const cxOf = (l: L2, i: number) => INTRO + l.bay * (i + 0.5)
const endOf = (l: L2) => Math.max(0, INTRO + BOOKS.length * l.bay + ABOUT - l.vw)
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const STATEMENT = "I make books of the trips I take and the people I take them with: six so far, printed and bound by hand. Based in Tbilisi."
type HomeApi = { jump: (id: string) => void; about: () => void; start: () => void; hold: () => void }
type HomeProps = { l: L2; frozen: boolean; activeId?: string; onOpen: (id: string, el: HTMLElement) => void }

export function SiteDemo2() {
  const root = React.useRef<HTMLDivElement>(null)
  const home = React.useRef<HomeApi>(null)
  const opener = React.useRef<HTMLElement | null>(null)
  const timer = React.useRef(0)
  const [box, setBox] = React.useState({ w: 1440, h: 900 })
  const [open, setOpen] = React.useState<{ id: string; walk: boolean; origin?: string; to?: string } | null>(null)
  const [view, setView] = React.useState(0)
  const [index, setIndex] = React.useState(false)
  React.useLayoutEffect(() => {
    const el = root.current; if (!el) return
    const r = () => setBox({ w: el.clientWidth, h: el.clientHeight }); r()
    const ro = new ResizeObserver(r); ro.observe(el); return () => ro.disconnect()
  }, [])
  const l = layoutOf(box.w, box.h)
  const b = BOOKS.find((x) => x.id === open?.id)

  /** the camera walk: scale 1.6 around the book while its centre pans to the reader's centre */
  const openBook = (id: string, el: HTMLElement) => {
    const host = root.current, bk = BOOKS.find((x) => x.id === id); if (!host || !bk || open) return
    window.clearTimeout(timer.current)
    opener.current = el
    home.current?.hold() // the wall stops where it is now, before a late wheel or throw can move it under the camera
    const R = host.getBoundingClientRect(), k = R.width / host.clientWidth || 1
    const r = (el.querySelector('[data-testid="book3d"]') ?? el).getBoundingClientRect()
    const bx = (r.left + r.width / 2 - R.left) / k, by = (r.top + r.height / 2 - R.top) / k, rb = readerBox(l, bk)
    setView(0)
    setOpen(reduced() ? { id, walk: false } : { id, walk: false, origin: `${bx}px ${by}px`, to: `translate(${l.vw / 2 - bx}px, ${rb.top + rb.h / 2 - by}px) scale(1.6)` })
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen((o) => (o && o.id === id ? { ...o, walk: true } : o))))
  }
  const close = React.useCallback(() => {
    setOpen((o) => o && { ...o, walk: false })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(null), reduced() ? 160 : 900)
  }, [])
  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  // back home: the focus returns to the book that opened (once the wall is no longer inert)
  React.useEffect(() => { if (!open && opener.current) { opener.current.focus({ preventScroll: true }); opener.current = null } }, [open])
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (index) { e.preventDefault(); setIndex(false) } else if (open?.walk) { e.preventDefault(); close() }
    }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [index, open, close])
  const pick = (id: string) => {
    setIndex(false); home.current?.jump(id)
    requestAnimationFrame(() => { const el = root.current?.querySelector<HTMLElement>(`[data-testid="sd2-book"][data-id="${id}"]`); if (el) openBook(id, el) })
  }
  const nav = (to: "room" | "about") => {
    const go = () => (to === "about" ? home.current?.about() : home.current?.start())
    if (open) { close(); window.setTimeout(go, reduced() ? 180 : 920) } else go()
  }
  const cam: React.CSSProperties | undefined = open?.origin ? { transformOrigin: open.origin, transform: open.walk ? open.to : "none" } : undefined
  const props: HomeProps = { l, frozen: !!open || index, activeId: open?.id, onOpen: openBook }
  return (
    <div ref={root} className={open?.walk ? "sd2-walk relative h-full overflow-hidden" : "relative h-full overflow-hidden"} data-surface="site-demo-2" data-allow-border data-testid="sd2-root">
      <div className="sd2-camera" style={cam} inert={!!open || index || undefined}>
        {l.narrow ? <Rooms ref={home} {...props} /> : <Wall ref={home} {...props} />}
      </div>
      {b && <BookPage key={b.id} b={b} l={l} view={view} onView={setView} onClose={close} />}
      <header className="sd2-abs inset-x-0 top-0" style={{ zIndex: 40 }} inert={index || undefined}>
        <button type="button" className="sd2-cap sd2-name sd2-link sd2-abs" style={{ left: l.m, top: l.narrow ? 24 : 34 }} onClick={() => nav("room")} data-testid="sd2-home">{l.narrow ? "A. Basov" : AUTHOR}</button>
        {!l.narrow && <div className="sd2-cap sd2-abs" style={{ left: "50%", top: 34, transform: "translateX(-50%)" }}>Photobooks · a room of six</div>}
        <nav className="sd2-abs flex" style={{ right: l.m, top: l.narrow ? 24 : 34, gap: 28 }}>
          {!l.narrow && <button type="button" className="sd2-cap sd2-nav sd2-link" aria-current={!open ? "page" : undefined} onClick={() => nav("room")}>Room</button>}
          <button type="button" className="sd2-cap sd2-nav sd2-link" onClick={() => setIndex(true)} data-testid="sd2-nav-index">Index</button>
          {!l.narrow && <button type="button" className="sd2-cap sd2-nav sd2-link" onClick={() => nav("about")} data-testid="sd2-nav-about">About</button>}
        </nav>
      </header>
      {index && <IndexOverlay onPick={pick} onClose={() => setIndex(false)} />}
      <div className="sd-grain" aria-hidden />
    </div>
  )
}

const meta = (b: SiteBook) => `${b.year} · ${pagesOf(b)} pages · ${b.w} × ${b.h} cm`
/** wall label: number, title, year · pages · size, "Open the book →" */
function Label({ b, i, style }: { b: SiteBook; i: number; style: React.CSSProperties }) {
  return (
    <span className="sd2-label" style={style}>
      <span className="sd2-cap block">{pad2(i + 1)}</span>
      <span className="sd2-title block" style={{ marginTop: 10 }}>{b.title}</span>
      <span className="sd2-meta block" style={{ marginTop: 4 }}>{meta(b)}</span>
      <span className="sd2-cap sd2-on block" style={{ marginTop: 12 }}>Open the book →</span>
    </span>
  )
}

/** Wide / mid home: the horizontal track. One rAF loop lerps the scroll and the hover, and writes the poses to the DOM. */
const Wall = React.forwardRef<HomeApi, HomeProps>(function Wall({ l, frozen, activeId, onOpen }, api) {
  const host = React.useRef<HTMLDivElement>(null), track = React.useRef<HTMLDivElement>(null)
  const bar = React.useRef<HTMLDivElement>(null), count = React.useRef<HTMLSpanElement>(null), ring = React.useRef<HTMLDivElement>(null)
  const books = React.useRef<(HTMLDivElement | null)[]>([]), spots = React.useRef<(HTMLDivElement | null)[]>([])
  const st = React.useRef({ cur: 0, tgt: 0, v: 0, hov: BOOKS.map(() => 0), want: BOOKS.map(() => false), moved: false, px: 0, py: 0, rx: 0, ry: 0,
    drag: null as null | { id: number; x0: number; t0: number; lx: number; lt: number; vx: number; on: boolean } })
  const lr = React.useRef(l); lr.current = l
  const fr = React.useRef(frozen); fr.current = frozen
  const E = endOf(l), half = l.vw / 2, L = l.y(700)
  const stops = () => { const L2 = lr.current, e = endOf(L2); return [...new Set([0, ...BOOKS.map((_, i) => clamp(cxOf(L2, i) - L2.vw / 2, 0, e)), e])].sort((a, b) => a - b) }

  const paint = React.useCallback(() => {
    const s = st.current, g = lr.current, h2 = g.vw / 2, e = endOf(g), rm = reduced()
    if (track.current) track.current.style.transform = `translate3d(${-s.cur}px,0,0)`
    BOOKS.forEach((_, i) => {
      const off = (cxOf(g, i) - s.cur - h2) / h2, h = s.hov[i], base = 1 - 0.6 * Math.min(1, Math.abs(off)), el = books.current[i]
      if (el) { el.style.setProperty("--ry", rm ? "0" : clamp(off * 18, -18, 18).toFixed(2)); el.style.setProperty("--rx", "0"); el.style.setProperty("--lift", (10 * h).toFixed(2)); el.style.setProperty("--peek", (18 * h).toFixed(2)) }
      const sp = spots.current[i]; if (sp) sp.style.opacity = (base + (1 - base) * h).toFixed(3)
    })
    if (bar.current) bar.current.style.width = `${e ? (s.cur / e) * (g.vw - 96) : 0}px`
    const n = pad2(clamp(Math.round((s.cur + h2 - INTRO) / g.bay - 0.5), 0, BOOKS.length - 1) + 1) + " / " + pad2(BOOKS.length)
    if (count.current && count.current.textContent !== n) count.current.textContent = n
    if (ring.current) ring.current.style.transform = `translate(${s.rx}px, ${s.ry}px)`
  }, [])
  React.useLayoutEffect(() => { const s = st.current, e = endOf(l); s.tgt = clamp(s.tgt, 0, e); s.cur = clamp(s.cur, 0, e); paint() }, [l, paint])
  React.useEffect(() => {
    let raf = 0
    const tick = () => {
      const s = st.current, rm = reduced(), e = endOf(lr.current)
      if (fr.current) { s.tgt = s.cur; s.v = 0 } // open / Index: the wall holds still under the camera
      if (s.v && !s.drag) { s.tgt += s.v; s.v *= 0.92; if (Math.abs(s.v) < 0.05 || s.tgt <= 0 || s.tgt >= e) s.v = 0 }
      s.tgt = clamp(s.tgt, 0, e)
      const d = s.tgt - s.cur
      s.cur = rm || Math.abs(d) < 0.05 ? s.tgt : s.cur + d * 0.12
      let busy = d !== 0
      s.hov = s.hov.map((h, i) => { const t = s.want[i] && !rm ? 1 : 0, x = Math.abs(t - h) < 0.002 ? t : h + (t - h) * 0.16; if (x !== h) busy = true; return x })
      const rx = s.rx + (s.px - s.rx) * 0.3, ry = s.ry + (s.py - s.ry) * 0.3
      if (Math.abs(rx - s.rx) + Math.abs(ry - s.ry) > 0.05) { s.rx = rx; s.ry = ry; busy = true }
      if (busy) paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [paint])
  // wheel (vertical or horizontal) walks the wall; non-passive so the page itself never scrolls
  React.useEffect(() => {
    const el = host.current; if (!el) return
    const w = (e: WheelEvent) => { if (fr.current) return; e.preventDefault(); const s = st.current; s.v = 0; s.tgt += (e.deltaY + e.deltaX) * (e.deltaMode === 1 ? 40 : 1) }
    el.addEventListener("wheel", w, { passive: false }); return () => el.removeEventListener("wheel", w)
  }, [])
  // ← / → one bay
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (fr.current || e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return
      const s = st.current, all = stops(), nx = e.key === "ArrowRight" ? all.find((x) => x > s.tgt + 1) : [...all].reverse().find((x) => x < s.tgt - 1)
      e.preventDefault(); s.v = 0; if (nx !== undefined) s.tgt = nx
    }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [])
  React.useImperativeHandle(api, () => ({
    jump: (id) => { const s = st.current, g = lr.current, i = BOOKS.findIndex((x) => x.id === id); s.v = 0; s.tgt = s.cur = clamp(cxOf(g, i) - g.vw / 2, 0, endOf(g)); paint() },
    about: () => { const s = st.current; s.v = 0; s.tgt = endOf(lr.current) },
    hold: () => { const s = st.current; fr.current = true; s.drag = null; s.v = 0; s.tgt = s.cur },
    start: () => { const s = st.current; s.v = 0; s.tgt = 0 },
  }), [paint])

  const local = (e: React.PointerEvent) => { const r = host.current!.getBoundingClientRect(), k = r.width / host.current!.clientWidth || 1; return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k, k } }
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || fr.current) return
    const s = st.current; s.moved = false; s.v = 0
    s.drag = { id: e.pointerId, x0: e.clientX, t0: s.tgt, lx: e.clientX, lt: e.timeStamp, vx: 0, on: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = st.current, p = local(e); s.px = p.x; s.py = p.y
    const d = s.drag; if (!d || d.id !== e.pointerId) return
    if (!d.on && Math.abs(e.clientX - d.x0) > 6) { d.on = true; host.current?.setPointerCapture(e.pointerId); ring.current?.removeAttribute("data-on") }
    if (!d.on) return
    const dt = e.timeStamp - d.lt; if (dt > 0) d.vx = (-(e.clientX - d.lx) / p.k / dt) * 16.7
    d.lx = e.clientX; d.lt = e.timeStamp
    s.tgt = d.t0 - (e.clientX - d.x0) / p.k
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const s = st.current, d = s.drag; s.drag = null
    if (!d || d.id !== e.pointerId || !d.on) return
    s.moved = true
    s.v = reduced() || e.timeStamp - d.lt > 100 ? 0 : d.vx // the pointer rested before release: no throw
  }
  const hover = (i: number, on: boolean) => { st.current.want[i] = on; if (ring.current) ring.current.toggleAttribute("data-on", on && !st.current.drag?.on) }

  return (
    <div ref={host} className="sd2-wall absolute inset-0 overflow-hidden" style={{ touchAction: "pan-y" }} data-testid="sd2-wall"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { st.current.drag = null }} onScroll={(e) => { e.currentTarget.scrollLeft = 0 }}>
      <div ref={track} className="absolute left-0 top-0" style={{ width: INTRO + BOOKS.length * l.bay + ABOUT, height: l.vh, willChange: "transform" }}>
        <div className="sd2-fade">
          <h1 className="sd2-display sd2-abs" style={{ left: 48, top: l.y(214), fontSize: l.mid ? 96 : 112 }}>Six books,<br />one room.</h1>
          <p className="sd2-body sd2-abs" style={{ left: 52, top: l.y(462), width: 330 }}>Lakes, coasts and the people I travel with. Walk along the wall; open any book and turn its pages.</p>
          <div className="sd2-cap sd2-abs" style={{ left: 52, top: l.y(600) }}>Scroll or drag&nbsp;&nbsp;→</div>
          <div className="sd2-ledge" style={{ left: INTRO, width: BOOKS.length * l.bay, top: L }} />
        </div>
        {BOOKS.map((b, i) => {
          const W = b.w * l.s, H = b.h * l.s, cx = cxOf(l, i)
          return (
            <div key={b.id} className="sd2-bay" data-active={activeId === b.id || undefined}>
              <div ref={(x) => { spots.current[i] = x }} className="sd2-spot" style={{ left: cx - W * 0.85, top: L - H - 300, width: W * 1.7, height: H + 420 }} />
              <button type="button" className="sd2-book" style={{ left: cx - W / 2, top: L - H, width: W, height: H }} aria-label={`Open ${b.title}, ${b.year}`} data-testid="sd2-book" data-id={b.id}
                onPointerEnter={() => hover(i, true)} onPointerLeave={() => hover(i, false)}
                onFocus={(e) => { if (!e.currentTarget.matches(":focus-visible")) return; hover(i, true); const s = st.current; s.v = 0; s.tgt = clamp(cx - lr.current.vw / 2, 0, endOf(lr.current)) }} onBlur={() => hover(i, false)}
                onClick={(e) => { if (st.current.moved) { st.current.moved = false; return } hover(i, false); onOpen(b.id, e.currentTarget) }}>
                <Book3D ref={(x) => { books.current[i] = x }} b={b} s={l.s} />
                <Label b={b} i={i} style={{ left: W + 30, top: H - 104 }} />
              </button>
            </div>
          )
        })}
        <div className="sd2-fade sd2-abs" style={{ left: INTRO + BOOKS.length * l.bay + 24, top: l.y(214), width: ABOUT - 48 }} data-testid="sd2-about">
          <div className="sd2-cap">About</div>
          <p style={{ font: "300 32px/1.3 var(--site-sans)", letterSpacing: "-.01em", marginTop: 28, textWrap: "pretty" }}>{STATEMENT}</p>
          <a href={`mailto:${EMAIL}`} className="sd2-email inline-block" style={{ marginTop: l.y(72) }}>{EMAIL}</a>
        </div>
      </div>
      <div className="sd2-fade">
        <div className="sd2-bar" style={{ left: 48, width: l.vw - 96, top: l.vh - 54 }}>
          {BOOKS.map((b, i) => <div key={b.id} className="sd2-tick" style={{ left: E ? (clamp(cxOf(l, i) - half, 0, E) / E) * (l.vw - 96) : 0 }} />)}
          <div ref={bar} className="sd2-progress" />
        </div>
        <div className="sd2-cap sd2-abs" style={{ left: 48, top: l.vh - 36 }}>Room · books 2023 — 2026</div>
        <span ref={count} className="sd2-cap sd2-on sd2-abs tabular-nums" style={{ right: 48, top: l.vh - 36 }} data-testid="sd2-count">01 / 06</span>
      </div>
      <div ref={ring} className="sd2-ring" aria-hidden><span className="sd2-cap">View</span></div>
    </div>
  )
})

/** Narrow home: one bay per screen, vertical scroll-snap, ry 0. */
const Rooms = React.forwardRef<HomeApi, HomeProps>(function Rooms({ l, activeId, onOpen }, api) {
  const sc = React.useRef<HTMLDivElement>(null)
  const [at, setAt] = React.useState(0)
  const L = Math.round(l.vh * 0.56)
  const scrollTo = (i: number, instant?: boolean) => sc.current?.scrollTo({ top: i * l.vh, behavior: instant || reduced() ? "auto" : "smooth" })
  React.useImperativeHandle(api, () => ({ jump: (id) => scrollTo(BOOKS.findIndex((x) => x.id === id) + 1, true), about: () => scrollTo(BOOKS.length + 1), start: () => scrollTo(0), hold: () => {} }))
  const sec: React.CSSProperties = { height: l.vh }
  return (
    <>
      <div ref={sc} className="sd2-snap no-scrollbar" onScroll={(e) => setAt(clamp(Math.round(e.currentTarget.scrollTop / l.vh) - 1, 0, BOOKS.length - 1))} data-testid="sd2-rooms">
        <section className="sd2-fade" style={sec}>
          <h1 className="sd2-display sd2-abs" style={{ left: 20, top: l.vh * 0.3, fontSize: 56 }}>Six books,<br />one room.</h1>
          <p className="sd2-body sd2-abs" style={{ left: 20, right: 20, top: l.vh * 0.3 + 140 }}>Lakes, coasts and the people I travel with. Open any book and turn its pages.</p>
        </section>
        {BOOKS.map((b, i) => {
          const W = b.w * l.s, H = b.h * l.s
          return (
            <section key={b.id} className="sd2-bay" style={sec} data-active={activeId === b.id || undefined}>
              <div className="sd2-spot" style={{ left: -40, top: L - H - 160, width: l.vw + 80, height: H + 330 }} />
              <div className="sd2-ledge" style={{ left: 0, right: 0, top: L }} />
              <button type="button" className="sd2-book" style={{ left: (l.vw - W) / 2, top: L - H, width: W, height: H }} aria-label={`Open ${b.title}, ${b.year}`} data-testid="sd2-book" data-id={b.id} onClick={(e) => onOpen(b.id, e.currentTarget)}>
                <Book3D b={b} s={l.s} pose={{ ry: 0, rx: 0 }} />
              </button>
              <Label b={b} i={i} style={{ left: 20, top: L + 42 }} />
            </section>
          )
        })}
        <section className="sd2-fade" style={{ ...sec, padding: `${l.vh * 0.22}px 20px 0` }}>
          <div className="sd2-cap">About</div>
          <p style={{ font: "300 22px/1.35 var(--site-sans)", marginTop: 20 }}>{STATEMENT}</p>
          <a href={`mailto:${EMAIL}`} className="sd2-email inline-block" style={{ fontSize: 26, marginTop: 40 }}>{EMAIL}</a>
        </section>
      </div>
      <div className="sd2-fade">
        <div className="sd2-cap sd2-abs" style={{ left: 20, top: l.vh - 40 }}>Swipe ↑ next book</div>
        <div className="sd2-cap sd2-on sd2-abs tabular-nums" style={{ right: 20, top: l.vh - 40 }} data-testid="sd2-count">{pad2(at + 1)} / {pad2(BOOKS.length)}</div>
      </div>
    </>
  )
})

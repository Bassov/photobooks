/* Photographer site, demo 3 "Index" (Designer Spec site-awards-5, Direction 3): a catalogue raisonné. The home is a
   typographic index of the books in Lora 112; hovering a row dims the others, slides the title into italic and lets the
   closed book float after the pointer, tilting with its speed (lerp .14). The book page turns its pages as you scroll
   (./book). Paper white #F7F5F0, ink #111110, one vermilion mark #C8401E. */
import * as React from "react"
import { Book3D } from "../site-demo-1/book3d"
import { AUTHOR, BOOKS, EMAIL, italics } from "../site-demo-1/data"
import "../site-demo-1/site.css"
import { BookPage, IndexRow, layoutOf, reduced, type L3 } from "./book"
import "./site.css"

const STATEMENT = "Six books about lakes, coasts and *the people I travel with.*"
const ABOUT = "I make books of the trips I take and the people I take them with, printed and bound by hand. *Based in Tbilisi,* working wherever the road goes."
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const rich = (s: string) => italics(s).map((x, i) => (x.it ? <em key={i}>{x.t}</em> : <React.Fragment key={i}>{x.t}</React.Fragment>))
const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches

export function SiteDemo3() {
  const root = React.useRef<HTMLDivElement>(null)
  const scroller = React.useRef<HTMLDivElement>(null)
  const homeTop = React.useRef(0)
  const [box, setBox] = React.useState({ w: 1440, h: 900 })
  const [open, setOpen] = React.useState<string | null>(null)
  const [back, setBack] = React.useState<{ id: string; to?: "about" | "contact" } | null>(null)
  React.useLayoutEffect(() => {
    const el = root.current; if (!el) return
    const r = () => setBox({ w: el.clientWidth, h: el.clientHeight }); r()
    const ro = new ResizeObserver(r); ro.observe(el); return () => ro.disconnect()
  }, [])
  const l = layoutOf(box.w, box.h)
  const b = BOOKS.find((x) => x.id === open)

  const openBook = (id: string) => {
    const s = scroller.current
    if (!open && s) homeTop.current = s.scrollTop
    setOpen(id)
    if (s) s.scrollTop = 0
  }
  const close = (to?: "about" | "contact") => { if (open) { setBack({ id: open, to }); setOpen(null) } }
  // back home: the index scrolls to where it was (or to About / Contact) and the book's row takes the focus
  React.useLayoutEffect(() => {
    const s = scroller.current; if (!back || !s) return
    const row = s.querySelector<HTMLElement>(`[data-testid="sd3-book"][data-id="${back.id}"]`)
    if (back.to) s.querySelector(`#sd3-${back.to}`)?.scrollIntoView()
    else s.scrollTop = homeTop.current
    row?.focus({ preventScroll: true })
    setBack(null)
  }, [back])
  const esc = React.useRef(close)
  esc.current = close
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) esc.current() }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [])
  const nav = (to?: "about" | "contact") => {
    if (open) { close(to); return }
    const s = scroller.current; if (!s) return
    const smooth: ScrollBehavior = reduced() ? "auto" : "smooth"
    if (to) s.querySelector(`#sd3-${to}`)?.scrollIntoView({ behavior: smooth })
    else s.scrollTo({ top: 0, behavior: smooth })
  }
  return (
    <div ref={root} className="relative h-full overflow-hidden" data-surface="site-demo-3" data-allow-border data-testid="sd3-root">
      <div ref={scroller} className="sd3-scroll" data-testid="sd3-scroll">
        {b ? <BookPage key={b.id} b={b} l={l} scroller={scroller} onOpen={openBook} /> : <Home l={l} onOpen={openBook} />}
      </div>
      <Mast l={l} open={!!b} onNav={nav} />
      <div className="sd-grain" aria-hidden />
    </div>
  )
}

/** height 56: the name (Lora 20) and "Index · About · Contact"; narrow: "A. Basov" and a Menu */
function Mast({ l, open, onNav }: { l: L3; open: boolean; onNav: (to?: "about" | "contact") => void }) {
  const [menu, setMenu] = React.useState(false)
  const go = (to?: "about" | "contact") => { setMenu(false); onNav(to) }
  const links = (
    <>
      <button type="button" className="sd3-link" aria-current={!open ? "page" : undefined} onClick={() => go()} data-testid={open ? "sd3-close" : "sd3-nav-index"}>Index</button>
      <button type="button" className="sd3-link" onClick={() => go("about")} data-testid="sd3-nav-about">About</button>
      <button type="button" className="sd3-link" onClick={() => go("contact")}>Contact</button>
    </>
  )
  return (
    <header className="sd3-mast">
      <button type="button" className="sd3-link sd3-abs" style={{ left: l.m, top: l.narrow ? 18 : 20, font: `400 ${l.narrow ? 18 : 20}px/1 var(--site-serif)`, letterSpacing: "-.01em", color: "var(--d3-ink)" }} onClick={() => go()}>
        {l.narrow ? "A. Basov" : AUTHOR}
      </button>
      {l.narrow
        ? <>
            <button type="button" className="sd3-link sd3-abs" style={{ right: l.m, top: 20, color: "var(--d3-ink)" }} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>Menu</button>
            {menu && <nav className="sd3-menu">{links}</nav>}
          </>
        : <nav className="sd3-abs flex" style={{ right: l.m, top: 22, gap: 28 }}>{links}</nav>}
    </header>
  )
}

type Float = { id: string; kb: boolean }
/** the index, the book that floats after the pointer, About and Contact */
function Home({ l, onOpen }: { l: L3; onOpen: (id: string) => void }) {
  const [float, setFloat] = React.useState<Float | null>(null)
  const [on, setOn] = React.useState(false)
  const [follow, setFollow] = React.useState(false)
  const main = React.useRef<HTMLElement>(null)
  const box = React.useRef<HTMLDivElement>(null), book = React.useRef<HTMLDivElement>(null), dot = React.useRef<HTMLDivElement>(null)
  const st = React.useRef({ x: 0, y: 0, tx: 0, ty: 0, init: false, on: false, raf: 0 })
  React.useEffect(() => { setFollow(fine()) }, [])
  React.useEffect(() => () => cancelAnimationFrame(st.current.raf), [])

  const pose = (ry: number, rz: number) => {
    const s = book.current?.style; if (!s) return
    s.setProperty("--ry", `${ry}`); s.setProperty("--rx", "-8"); s.setProperty("--rz", `${rz}`); s.setProperty("--lift", "6")
  }
  const place = (x: number, y: number) => { st.current.x = x; st.current.y = y; if (box.current) box.current.style.transform = `translate(${x}px, ${y}px)` }
  /** one frame: lerp .14 toward the pointer; the speed tilts the book (ry 18 + vx·.6, rz vx·.15) */
  const tick = () => {
    const s = st.current, nx = s.x + (s.tx - s.x) * 0.14, vx = nx - s.x
    place(nx, s.y + (s.ty - s.y) * 0.14); pose(18 + clamp(vx * 0.6, -20, 20), clamp(vx * 0.15, -6, 6))
    s.raf = s.on || Math.abs(vx) > 0.05 || Math.abs(s.ty - s.y) > 0.5 ? requestAnimationFrame(tick) : 0
  }
  /** client → main (the float's containing block, which scrolls with the index) */
  const rel = (cx: number, cy: number) => { const r = main.current!.getBoundingClientRect(); return { x: cx - r.left, y: cy - r.top } }
  const onMove = (e: React.PointerEvent) => {
    if (!follow || e.pointerType !== "mouse") return
    const p = rel(e.clientX, e.clientY), s = st.current
    if (dot.current) dot.current.style.transform = `translate(${p.x}px, ${p.y}px)`
    if (reduced() || !s.on) return
    s.tx = p.x + 24; s.ty = p.y - 170
    if (!s.init) { s.init = true; place(s.tx, s.ty) }
    if (!s.raf) s.raf = requestAnimationFrame(tick)
  }
  /** keyboard focus (and reduced motion): the book rests at x vw − 360, centred on the row */
  const pin = (row: HTMLElement, id: string) => {
    const bk = BOOKS.find((x) => x.id === id)!, r = row.getBoundingClientRect(), p = rel(r.left, r.top + r.height / 2)
    place(l.vw - 360, p.y - (bk.h * 10) / 2); pose(18, 0)
  }
  /** show the float: a fresh one mounts at scale .6 / opacity 0 and comes in on the next frame */
  const show = (f: Float) => {
    const fresh = !float; setFloat(f)
    if (fresh) requestAnimationFrame(() => setOn(true)); else setOn(true)
  }
  const enter = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (!follow || l.narrow || e.pointerType !== "mouse") return
    st.current.on = true; show({ id, kb: false })
    if (reduced()) pin(e.currentTarget, id)
  }
  const leave = () => { st.current.on = false; st.current.init = false; setOn(false) }
  const focus = (e: React.FocusEvent<HTMLButtonElement>, id: string) => {
    if (l.narrow || !e.currentTarget.matches(":focus-visible")) return
    show({ id, kb: true }); pin(e.currentTarget, id)
  }
  const fb = BOOKS.find((x) => x.id === float?.id)
  // a freshly mounted float starts where the pointer or the row put it
  React.useLayoutEffect(() => { if (fb) place(st.current.x, st.current.y) }, [fb])

  const listTop = l.narrow ? 236 : 298
  return (
    <main ref={main} className={follow && !l.narrow ? "sd3-fine relative" : "relative"} onPointerMove={onMove}>
      <div className="relative" style={{ height: listTop }}>
        {!l.narrow && <div className="sd3-mono sd3-abs" style={{ left: l.m, top: 112 }}>Photobooks<br />2023 — 2026<br />{String(BOOKS.length).padStart(2, "0")} titles</div>}
        <p className="sd3-statement sd3-abs" style={l.narrow ? { left: l.m, top: 84, width: l.vw - 40, fontSize: 22, lineHeight: 1.35 } : { left: Math.max(l.m + 200, l.vw - 624), top: 106, width: 576 }}>{rich(STATEMENT)}</p>
        {!l.stack && (
          <div className="sd3-mono sd3-s sd3-abs" style={{ left: l.m, right: l.m, top: listTop - 26, lineHeight: 1 }} aria-hidden>
            <span className="sd3-abs" style={{ left: 0 }}>No.</span><span className="sd3-abs" style={{ left: 120 }}>Title</span>
            <span className="sd3-abs" style={{ left: l.vw - 2 * l.m - 408 }}>Year</span><span className="sd3-abs" style={{ left: l.vw - 2 * l.m - 312 }}>Pages</span>
            <span className="sd3-abs" style={{ right: 0 }}>Size, cm</span>
          </div>
        )}
      </div>
      <ol className="sd3-list" style={{ margin: `0 ${l.m}px` }} aria-label="Photobooks" data-testid="sd3-index">
        {BOOKS.map((bk, i) => (
          <li key={bk.id}>
            <IndexRow b={bk} i={i} l={l} onOpen={(id) => onOpen(id)} onPointerEnter={(e) => enter(e, bk.id)} onPointerLeave={leave}
              onFocus={(e) => focus(e, bk.id)} onBlur={() => { if (float?.kb) setOn(false) }} />
          </li>
        ))}
      </ol>
      <section id="sd3-about" className="relative" style={{ padding: `${l.stack ? 120 : 200}px ${l.m}px 0`, display: "grid", gridTemplateColumns: l.stack ? "1fr" : "1fr 576px", gap: 24 }}>
        <div className="sd3-mono sd3-s">About</div>
        <p className="sd3-statement" style={l.narrow ? { fontSize: 22, lineHeight: 1.35 } : undefined}>{rich(ABOUT)}</p>
      </section>
      <section id="sd3-contact" className="relative" style={{ padding: `${l.stack ? 96 : 140}px ${l.m}px ${l.stack ? 72 : 96}px` }}>
        <div className="sd3-mono sd3-s" style={{ marginBottom: 20 }}>Contact</div>
        <a className="sd3-email" style={l.narrow ? { fontSize: 28 } : undefined} href={`mailto:${EMAIL}`}>{EMAIL}</a>
        <div className="sd3-mono sd3-s" style={{ marginTop: l.stack ? 72 : 120 }}>© 2026 {AUTHOR}</div>
      </section>
      {fb && (
        <div ref={box} className="sd3-float" aria-hidden data-testid="sd3-float" data-id={fb.id}>
          <div className="sd3-float-in" data-on={on || undefined} onTransitionEnd={() => { if (!on) setFloat(null) }}>
            <Book3D ref={book} b={fb} s={10} pose={{ ry: 18, rx: -8, lift: 6 }} />
          </div>
        </div>
      )}
      {follow && <div ref={dot} className="sd3-cursor sd3-mono sd3-s" style={{ color: "var(--d3-ink)" }} data-on={(on && !float?.kb) || undefined} aria-hidden>Open</div>}
    </main>
  )
}

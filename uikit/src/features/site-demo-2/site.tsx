/* Photographer site, demo 2 v2 "Gallery" (Spec site-awards-v2 §2): a warm black room, one book per 560 px of wall on a
   hairline ledge under its spotlight, a museum label at its right. Wheel, drag (with inertia), ← / → and the titles row
   walk the wall. Hover: the spotlight brightens, the book turns to show its spine. 1 book: one exhibit, no walk;
   12 books: "Books" opens the All books overlay. Phone ≤ 640: vertical, one exhibit per screen (scroll-snap).
   `?books=1|3|6|12`. */
import * as React from "react"
import { Book3D, type Pose } from "../site-demo-1/book3d"
import { EMAIL, pad2, pagesOf, type SiteBook } from "../site-demo-1/data"
import { BooksSwitch, clamp, Header, metaOf, ReaderPage, reduced, Statement, useBooks, useBox, yearsOf, type Box } from "../site-demo-1/v2"
import "./site.css"

const X0 = 560, P = 560, ABOUT_W = 640
const INTRO = "Lakes, coasts and the people I travel with. *Walk along the wall and open any book.*"
const ABOUT = "I make books of the trips I take and the people I take them with, printed and bound by hand. *Based in Tbilisi, working wherever the road goes.*"
const REST: Pose = { ry: -4, rx: -2 }, HOVER: Pose = { ry: -16, rx: -2, lift: 6 }
const poseOf = (on: boolean) => (on && !reduced() ? HOVER : REST)
type Opener = (b: SiteBook, el: HTMLElement) => void
type WallApi = { go: (i: number, instant?: boolean) => void; end: () => void }

export function SiteDemo2() {
  const books = useBooks()
  return <Gallery key={books.length} books={books} />
}

function Gallery({ books }: { books: SiteBook[] }) {
  const [root, box] = useBox<HTMLDivElement>()
  const wall = React.useRef<WallApi>(null), phone = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState<SiteBook | null>(null), [view, setView] = React.useState(0)
  const [all, setAll] = React.useState(false), [about, setAbout] = React.useState(false)
  const [back, setBack] = React.useState<string | null>(null)
  const n = books.length

  const openBook: Opener = (b) => { setAll(false); setView(0); setOpen(b) }
  // the reader opens on the closed cover, then the cover opens
  React.useEffect(() => {
    if (!open || reduced()) return
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setView((v) => (v === 0 ? 1 : v))))
    return () => cancelAnimationFrame(r)
  }, [open])
  const close = () => { if (open) { setBack(open.id); setOpen(null) } }
  // back home: the wall stands at the book and the book takes the focus
  React.useLayoutEffect(() => {
    if (!back) return
    const i = books.findIndex((b) => b.id === back), el = root.current?.querySelector<HTMLElement>(`[data-testid="sd2-book"][data-id="${back}"]`)
    wall.current?.go(i, true)
    if (box.narrow) el?.closest("section")?.scrollIntoView()
    el?.focus({ preventScroll: true })
    setBack(null)
  }, [back, books, box.narrow, root])
  const esc = React.useRef(() => {})
  esc.current = () => { if (all) setAll(false); else close() }
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); esc.current() } }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [])
  const toAbout = () => {
    close(); setAll(false)
    if (n === 1 && !box.narrow) setAbout((a) => !a)
    else if (box.narrow) phone.current?.querySelector("#sv2g-about")?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" })
    else wall.current?.end()
  }
  const toBooks = () => {
    close(); setAbout(false)
    if (n === 12) setAll(true)
    else if (box.narrow) phone.current?.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" })
    else wall.current?.go(0)
  }
  const items = [
    { label: "Books", current: !open && !about, pressed: n === 12 ? all : undefined, onClick: toBooks },
    { label: "About", pressed: about || undefined, onClick: toAbout },
    { label: "Contact", href: `mailto:${EMAIL}` },
  ]
  return (
    <div ref={root} className={`sv2 sv2g${box.narrow ? " sv2-narrow" : ""}`} data-surface="site-demo-2" data-allow-border data-open={open ? "" : undefined} data-testid="sd2-root">
      <div className="sv2g-home" inert={!!open || all || undefined}>
        {box.narrow ? <Phone ref={phone} books={books} box={box} onOpen={openBook} />
          : n === 1 ? <Single b={books[0]} box={box} about={about} onOpen={openBook} />
          : <Wall ref={wall} books={books} box={box} frozen={!!open || all} onOpen={openBook} />}
        <Header items={items} narrow={box.narrow} />
      </div>
      {open && <ReaderPage n={2} b={open} box={box} view={view} onView={setView} onClose={close} back="Back to the wall" leaf="paper" dark />}
      {all && <AllBooks books={books} narrow={box.narrow} onPick={openBook} onClose={() => setAll(false)} />}
      <BooksSwitch demo={2} n={n} />
      <div className="sd-grain" aria-hidden />
    </div>
  )
}

/** the book on its ledge under the spotlight; `x` = the book's centre, `L` = the ledge */
function Exhibit({ b, x, L, s, on, spot, onHover, onFocus, onOpen, children }: {
  b: SiteBook; x: number; L: number; s: number; on: boolean; spot?: number
  onHover: (on: boolean) => void; onFocus?: () => void; onOpen: (el: HTMLElement) => void; children?: React.ReactNode
}) {
  const W = b.w * s, H = b.h * s
  return (
    <div className="sv2g-ex" data-on={on || undefined}>
      <div className="sv2g-spot" style={{ left: x - 1.3 * W, width: 2.6 * W, top: L - H - 240, height: H + 330, ...(spot && { opacity: spot }) }} />
      <div className="sv2g-ledge" style={{ left: x - W / 2 - 40, width: W + 80, top: L }} />
      <button type="button" className="sv2g-book" style={{ left: x - W / 2, top: L - H, width: W, height: H }} aria-label={`Open ${b.title}, ${b.year}`} data-testid="sd2-book" data-id={b.id}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") onHover(true) }} onPointerLeave={() => onHover(false)}
        onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) { onHover(true); onFocus?.() } }} onBlur={() => onHover(false)}
        onClick={(e) => onOpen(e.currentTarget)}>
        <Book3D b={b} s={s} pose={poseOf(on)} />
      </button>
      {children}
    </div>
  )
}

/** the museum label: number, title, meta, "Open the book" (the link is for the mouse; the book is the tab stop) */
function Label({ b, i, on, style, phone, onHover, onOpen }: { b: SiteBook; i: number; on: boolean; style: React.CSSProperties; phone?: boolean; onHover?: (on: boolean) => void; onOpen: () => void }) {
  return (
    <div className="sv2g-label" style={style} onPointerEnter={(e) => { if (e.pointerType === "mouse") onHover?.(true) }} onPointerLeave={() => onHover?.(false)}>
      <div className="sv2-num sv2g-old">{pad2(i + 1)}</div>
      <div className="sv2g-title">{b.title}</div>
      <div className="sv2-meta">{phone ? metaOf(b) : <>{b.year}<br />{pagesOf(b)} pages · {b.w} × {b.h} cm</>}</div>
      <button type="button" className="sv2-link" style={{ marginTop: 12, ...(phone && { fontSize: 15 }) }} data-on={on || undefined} tabIndex={-1} onClick={onOpen}>Open the book</button>
    </div>
  )
}

/** desktop, 3+ books: the horizontal wall. A rAF loop (only while moving) lerps the walk and writes the track. */
const Wall = React.forwardRef<WallApi, { books: SiteBook[]; box: Box; frozen: boolean; onOpen: Opener }>(function Wall({ books, box, frozen, onOpen }, api) {
  const n = books.length, k = Math.min(1, box.h / 900), y = (v: number) => Math.round((v * box.h) / 900)
  const s = 13 * k, L = y(680), trackW = X0 + n * P + ABOUT_W
  const g = { w: box.w, end: Math.max(0, trackW - box.w) }
  const gr = React.useRef(g); gr.current = g
  const host = React.useRef<HTMLDivElement>(null), track = React.useRef<HTMLDivElement>(null), seg = React.useRef<HTMLDivElement>(null), row = React.useRef<HTMLDivElement>(null)
  const st = React.useRef({ cur: 0, tgt: 0, v: 0, moved: false, raf: 0, drag: null as null | { id: number; x0: number; t0: number; lx: number; lt: number; vx: number; on: boolean } })
  const fr = React.useRef(frozen); fr.current = frozen
  const [at, setAt] = React.useState(0), [hov, setHov] = React.useState(-1)
  const cx = (i: number) => X0 + i * P
  // the stop of exhibit i: book + label centred in the window
  const stop = (i: number) => clamp(cx(i) + 120 - gr.current.w / 2, 0, gr.current.end)

  const paint = () => {
    const S = st.current, G = gr.current
    if (track.current) track.current.style.transform = `translate3d(${-S.cur}px,0,0)`
    if (seg.current) seg.current.style.transform = `translateX(${(G.end ? S.cur / G.end : 0) * (n - 1) * 100}%)`
    setAt(clamp(Math.round((S.cur + G.w / 2 - 120 - X0) / P), 0, n - 1))
  }
  const loop = React.useRef(() => {})
  loop.current = () => {
    const S = st.current, e = gr.current.end
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
  React.useLayoutEffect(() => { const S = st.current; S.tgt = clamp(S.tgt, 0, g.end); S.cur = clamp(S.cur, 0, g.end); paint() }) // every render: cheap, keeps the track on a resize
  React.useEffect(() => { if (frozen) { const S = st.current; S.drag = null; S.v = 0; S.tgt = S.cur } }, [frozen])
  // the current title stays in view in the titles row (12 books: centred)
  React.useEffect(() => {
    const r = row.current, el = r?.children[at] as HTMLElement | undefined; if (!r || !el) return
    r.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - r.clientWidth / 2, behavior: reduced() ? "auto" : "smooth" })
  }, [at])
  // wheel (vertical or horizontal) walks the wall; non-passive so the page never scrolls
  React.useEffect(() => {
    const el = host.current; if (!el) return
    const w = (e: WheelEvent) => { if (fr.current) return; e.preventDefault(); const S = st.current; S.v = 0; S.tgt = clamp(S.tgt + (e.deltaY + e.deltaX) * (e.deltaMode === 1 ? 40 : 1), 0, gr.current.end); kick() }
    el.addEventListener("wheel", w, { passive: false }); return () => el.removeEventListener("wheel", w)
  }, [])
  const goTo = (i: number, instant?: boolean) => { const S = st.current; S.v = 0; S.tgt = stop(clamp(i, 0, n - 1)); if (instant) { S.cur = S.tgt; paint() } else kick() }
  // ← / → one exhibit
  React.useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (fr.current || e.altKey || e.ctrlKey || e.metaKey || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return
      const S = st.current, stops = books.map((_, i) => stop(i)).concat(gr.current.end)
      const nx = e.key === "ArrowRight" ? stops.find((x) => x > S.tgt + 1) : [0, ...stops].reverse().find((x) => x < S.tgt - 1)
      e.preventDefault(); S.v = 0; if (nx !== undefined) { S.tgt = nx; kick() }
    }
    window.addEventListener("keydown", kd); return () => window.removeEventListener("keydown", kd)
  })
  React.useImperativeHandle(api, () => ({ go: goTo, end: () => { const S = st.current; S.v = 0; S.tgt = gr.current.end; kick() } }))

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || fr.current) return
    const S = st.current; S.moved = false; S.v = 0
    S.drag = { id: e.pointerId, x0: e.clientX, t0: S.tgt, lx: e.clientX, lt: e.timeStamp, vx: 0, on: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const S = st.current, d = S.drag; if (!d || d.id !== e.pointerId) return
    if (!d.on && Math.abs(e.clientX - d.x0) > 6) { d.on = true; host.current?.setPointerCapture(e.pointerId) }
    if (!d.on) return
    const dt = e.timeStamp - d.lt; if (dt > 0) d.vx = (-(e.clientX - d.lx) / dt) * 16.7
    d.lx = e.clientX; d.lt = e.timeStamp
    S.tgt = clamp(d.t0 - (e.clientX - d.x0), 0, gr.current.end); kick()
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const S = st.current, d = S.drag; S.drag = null
    if (!d || d.id !== e.pointerId || !d.on) return
    S.moved = true
    S.v = reduced() || e.timeStamp - d.lt > 100 ? 0 : d.vx // the pointer rested before release: no throw
    kick()
  }
  const open = (b: SiteBook, el: HTMLElement) => { if (st.current.moved) { st.current.moved = false; return } onOpen(b, el) }

  return (
    <div ref={host} className="sv2g-wall" style={{ touchAction: "pan-y" }} data-testid="sd2-wall"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { st.current.drag = null }} onScroll={(e) => { e.currentTarget.scrollLeft = 0 }}>
      <div ref={track} className="sv2-abs" style={{ left: 0, top: 0, width: trackW, height: box.h, willChange: "transform" }}>
        <div className="sv2-abs" style={{ left: 48, top: y(216), width: 300 }}>
          <div className="sv2-meta">Photobooks, {yearsOf(books)}</div>
          <p className="sv2-intro" style={{ marginTop: 12 }}><Statement s={INTRO} /></p>
        </div>
        {books.map((b, i) => {
          const W = b.w * s, nb = books[i + 1], room = nb ? cx(i + 1) - (nb.w * s) / 2 - (cx(i) + W / 2 + 40) - 24 : 220
          const lb = (el?: HTMLElement) => open(b, el ?? host.current!.querySelector<HTMLElement>(`[data-testid="sd2-book"][data-id="${b.id}"]`)!)
          return (
            <Exhibit key={b.id} b={b} x={cx(i)} L={L} s={s} on={hov === i} onHover={(on) => setHov((h) => (on ? i : h === i ? -1 : h))} onFocus={() => goTo(i)} onOpen={lb}>
              <Label b={b} i={i} on={hov === i} style={{ left: cx(i) + W / 2 + 40, top: L - 150, height: 150, width: clamp(room, 140, 220) }} onHover={(on) => setHov((h) => (on ? i : h === i ? -1 : h))} onOpen={() => lb()} />
            </Exhibit>
          )
        })}
        <section className="sv2-abs" style={{ left: X0 + n * P, top: y(216), width: ABOUT_W - 96 }} data-testid="sd2-about">
          <div className="sv2-meta">About</div>
          <p className="sv2-intro" style={{ marginTop: 12 }}><Statement s={ABOUT} /></p>
          <div className="sv2-meta" style={{ marginTop: 40 }}>Contact</div>
          <a className="sv2g-email" href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </section>
      </div>
      <div className="sv2g-bar" style={{ left: 48, right: 48, bottom: 36 }}>
        <div className="sv2g-rule"><div ref={seg} className="sv2g-seg" style={{ width: `${100 / n}%` }} /></div>
        <div className="flex items-baseline" style={{ gap: 24, marginTop: 14 }}>
          <div ref={row} className="sv2g-titles" data-testid="sd2-titles">
            {books.map((b, i) => <button key={b.id} type="button" className="sv2g-t" aria-current={i === at || undefined} onClick={() => goTo(i)}>{b.title}</button>)}
          </div>
          <span className="sv2-meta" data-testid="sd2-count">{at + 1} / {n}</span>
        </div>
      </div>
    </div>
  )
})

/** desktop, 1 book: no walk, the title and statement at left, the book at 16 px/cm, its meta at the right */
function Single({ b, box, about, onOpen }: { b: SiteBook; box: Box; about: boolean; onOpen: Opener }) {
  const [on, setOn] = React.useState(false)
  const k = Math.min(1, box.h / 900), y = (v: number) => Math.round((v * box.h) / 900)
  const s = 16 * k, W = b.w * s, L = y(680), x = Math.max((box.w * 860) / 1440, 48 + 380 + 64 + W / 2)
  const host = React.useRef<HTMLDivElement>(null)
  const go = () => { const el = host.current?.querySelector<HTMLElement>('[data-testid="sd2-book"]'); if (el) onOpen(b, el) }
  return (
    <div ref={host} className="sv2g-wall">
      <div className="sv2-abs" style={{ left: 48, top: y(300), width: 380 }}>
        <h1 className="sv2-display" style={{ fontSize: 50 }}>{b.title}</h1>
        <p key={about ? "a" : "b"} className="sv2-intro sv2-fade" style={{ marginTop: 18 }}><Statement s={about ? ABOUT : b.statement} /></p>
        <button type="button" className="sv2-link" style={{ marginTop: 18 }} data-on={on || undefined} onClick={go}>Open the book</button>
      </div>
      <Exhibit b={b} x={x} L={L} s={s} on={on} spot={on ? 1 : 0.82} onHover={setOn} onOpen={(el) => onOpen(b, el)}>
        <div className="sv2g-label sv2-meta" style={{ left: x + W / 2 + 64, top: L - 80, height: 80 }}>{b.year}<br />{pagesOf(b)} pages · {b.w} × {b.h} cm</div>
      </Exhibit>
    </div>
  )
}

/** phone: one exhibit per screen under the header (snap padding 64), the book at the section top, so the next one peeks
   at the bottom (70 px of its section) */
const Phone = React.forwardRef<HTMLDivElement, { books: SiteBook[]; box: Box; onOpen: Opener }>(function Phone({ books, box, onOpen }, ref) {
  const hs = box.h - 64 - 70, x = box.w / 2
  return (
    <div ref={ref} className="sv2-scroll sv2g-snap" data-testid="sd2-phone">
      {books.map((b, i) => {
        const s = Math.min(11, (hs - 32 - 170) / b.h), L = Math.round(32 + b.h * s)
        return (
          <section key={b.id} style={{ height: hs }}>
            {i === 0 && <div className="sv2-meta sv2-abs" style={{ left: 20, top: 0 }}>Photobooks, {yearsOf(books)}</div>}
            <Exhibit b={b} x={x} L={L} s={s} on={false} onHover={() => {}} onOpen={(el) => onOpen(b, el)}>
              <Label b={b} i={i} on={false} phone style={{ left: 20, right: 20, top: L + 24 }} onOpen={() => onOpen(b, document.querySelector<HTMLElement>(`[data-testid="sd2-book"][data-id="${b.id}"]`)!)} />
            </Exhibit>
          </section>
        )
      })}
      <section id="sv2g-about" style={{ height: box.h, padding: "120px 20px 0" }} data-testid="sd2-about">
        <div className="sv2-meta">About</div>
        <p className="sv2-intro" style={{ marginTop: 12 }}><Statement s={ABOUT} /></p>
        <div className="sv2-meta" style={{ marginTop: 40 }}>Contact</div>
        <a className="sv2g-email" style={{ fontSize: 22 }} href={`mailto:${EMAIL}`}>{EMAIL}</a>
      </section>
    </div>
  )
})

/** 12 books: "Books" opens every book in a grid (6 columns, 3 on a phone) */
function AllBooks({ books, narrow, onPick, onClose }: { books: SiteBook[]; narrow: boolean; onPick: Opener; onClose: () => void }) {
  const s = narrow ? 3.2 : 6.2
  return (
    <div className="sv2g-all" role="dialog" aria-modal="true" aria-label="All books" data-testid="sd2-all">
      <div className="sv2-meta">All books · {books.length}</div>
      <ol className="sv2g-grid" style={{ gridTemplateColumns: `repeat(${narrow ? 3 : 6}, minmax(0, 1fr))` }}>
        {books.map((b, i) => (
          <li key={b.id}>
            <button type="button" className="sv2g-cell" autoFocus={i === 0} aria-label={`Open ${b.title}, ${b.year}`} onClick={(e) => onPick(b, e.currentTarget)}>
              <span className="sv2g-cellbook" style={{ height: 30 * s }}><Book3D b={b} s={s} pose={{ ry: -8, rx: -2 }} floor={false} /></span>
              <span className="sv2g-celltitle">{b.title}</span>
              <span className="sv2-meta">{b.year}</span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="sv2-nav sv2-abs" style={{ right: narrow ? 20 : 48, top: narrow ? 20 : 28 }} onClick={onClose} data-testid="sd2-all-close">Close</button>
    </div>
  )
}

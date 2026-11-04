/* Photographer site, demo 3 v2 "Index" (Spec site-awards-v2 §3): a typographic list on paper. Left: rows of 112 with the
   number, the title 62 and the meta; right of a hairline: a sticky preview (Book3D 12.5 px/cm, ry −14) with the statement.
   Hover / focus a row: the other rows fade to .3, the preview crossfades to that book. A click opens the scroll-scrubbed
   book page (./book). 12 books: rows grouped by year; 1 book: one big row. Phone ≤ 640: rows with a flat cover thumbnail.
   `?books=1|3|6|12`. */
import * as React from "react"
import { Book3D } from "../site-demo-1/book3d"
import { AUTHOR, EMAIL, pad2, pagesOf, src, type SiteBook } from "../site-demo-1/data"
import { BooksSwitch, clamp, countLabel, Header, metaOf, reduced, Statement, useBooks, useBox, type Box } from "../site-demo-1/v2"
import { BookPage, layoutOf } from "./book"
import "./site.css"

const ABOUT = "I make books of the trips I take and the people I take them with, printed and bound by hand. *Based in Tbilisi, working wherever the road goes.*"
const intro = (n: number) => `${countLabel(n, n === 1)} about lakes, coasts and *the people I travel with.*`

/** desktop columns: list from 48, the rule 40 left of the preview, the preview (≤ 420) 48 from the right */
const colsOf = (box: Box) => {
  const pw = Math.round(clamp(box.w * 0.29, 300, 420)), px = box.w - 48 - pw, rx = px - 40
  return { pw, px, rx, lw: rx - 64 - 48 }
}

export function SiteDemo3() {
  const books = useBooks()
  return <Index key={books.length} books={books} />
}

function Index({ books }: { books: SiteBook[] }) {
  const [root, box] = useBox<HTMLDivElement>()
  const scroller = React.useRef<HTMLDivElement>(null)
  const homeTop = React.useRef(0)
  const [open, setOpen] = React.useState<string | null>(null)
  const [back, setBack] = React.useState<{ id: string; to?: "about" | "contact" } | null>(null)
  const b = books.find((x) => x.id === open)

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
    if (back.to) s.querySelector(`#sv3-${back.to}`)?.scrollIntoView()
    else s.scrollTop = homeTop.current
    s.querySelector<HTMLElement>(`[data-testid="sd3-book"][data-id="${back.id}"]`)?.focus({ preventScroll: true })
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
    if (to) s.querySelector(`#sv3-${to}`)?.scrollIntoView({ behavior: smooth })
    else s.scrollTo({ top: 0, behavior: smooth })
  }
  const items = [
    { label: "Index", href: "#/full/site-demo-3", current: !b, onClick: () => nav() },
    { label: "About", href: "#about", onClick: () => nav("about") },
    { label: "Contact", href: "#contact", onClick: () => nav("contact") },
  ]
  return (
    <div ref={root} className={`sv2${box.narrow ? " sv2-narrow" : ""}`} data-surface="site-demo-3" data-allow-border data-testid="sd3-root">
      <div ref={scroller} className="sv3-scroll" data-testid="sd3-scroll">
        {b ? <BookPage key={b.id} b={b} books={books} l={layoutOf(box.w, box.h)} scroller={scroller} onOpen={openBook} /> : <Home books={books} box={box} onOpen={openBook} />}
        <Header items={items} narrow={box.narrow} />
      </div>
      <BooksSwitch demo={3} n={books.length} />
      <div className="sd-grain" aria-hidden />
    </div>
  )
}

/** rows, grouped by year when there are 12 */
const groupsOf = (books: SiteBook[]) => {
  if (books.length < 12) return [{ label: "", items: books.map((b, i) => ({ b, i })) }]
  const g: { label: string; items: { b: SiteBook; i: number }[] }[] = []
  books.forEach((b, i) => { const y = `${b.year}`; if (g[g.length - 1]?.label !== y) g.push({ label: y, items: [] }); g[g.length - 1].items.push({ b, i }) })
  return g
}

function Home({ books, box, onOpen }: { books: SiteBook[]; box: Box; onOpen: (id: string) => void }) {
  const [hov, setHov] = React.useState(-1), [shown, setShown] = React.useState(0)
  const n = books.length, one = n === 1, c = colsOf(box)
  const on = (i: number) => { setHov(i); if (i >= 0) setShown(i) }
  const k = Math.min(1, box.h / 900), s = (one ? 15 : 12.5) * k
  const fs = one ? Math.min(150, c.lw / 5.4) : Math.min(62, c.lw / 13.2), rowH = one ? 170 : 112
  const rows = groupsOf(books).map((g) => (
    <li key={g.label || "all"} className="sv3-group">
      {g.label && <div className="sv2-meta sv3-year">{g.label}</div>}
      <ol className="sv3-rows">
        {g.items.map(({ b, i }) => (
          <li key={b.id}>
            {box.narrow ? <PhoneRow b={b} i={i} w={box.w} onOpen={onOpen} />
              : <button type="button" className="sv3-row" style={{ height: rowH }} data-on={hov === i || undefined} aria-label={`${b.title}, ${b.year}`} data-testid="sd3-book" data-id={b.id}
                  onPointerEnter={(e) => { if (e.pointerType === "mouse") on(i) }} onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) on(i) }} onBlur={() => setHov(-1)} onClick={() => onOpen(b.id)}>
                  <span className="sv2-num">{pad2(i + 1)}</span>
                  <span className="sv3-title" style={{ fontSize: fs }}>{b.title}</span>
                  <span className="sv2-meta sv3-meta">{b.year}<br />{pagesOf(b)} pp</span>
                </button>}
          </li>
        ))}
      </ol>
    </li>
  ))
  if (box.narrow) return (
    <main className="relative" style={{ padding: "100px 20px 0" }}>
      <p className="sv2-intro"><Statement s={intro(n)} /></p>
      <ol className="sv3-list" style={{ marginTop: 40 }} aria-label="Photobooks" data-testid="sd3-index">{rows}</ol>
      <More narrow />
    </main>
  )
  return (
    <main className="relative" style={{ paddingTop: 250 }}>
      <p className="sv2-intro sv2-abs" style={{ left: 48, top: 132, width: Math.min(600, c.lw) }}><Statement s={intro(n)} /></p>
      <div className="relative flex">
        <ol className="sv3-list" style={{ marginLeft: 48, width: c.lw }} data-hov={hov >= 0 || undefined} onPointerLeave={() => setHov(-1)} aria-label="Photobooks" data-testid="sd3-index">{rows}</ol>
        <div className="sv3-rule" style={{ left: c.rx }} aria-hidden />
        <div className="relative" style={{ marginLeft: c.px - 48 - c.lw, width: c.pw, marginTop: -130 }}>
          <Preview b={books[shown]} s={s} k={k} onOpen={onOpen} />
        </div>
      </div>
      <More narrow={false} />
    </main>
  )
}

/** phone row: a flat cover 64 wide at its true ratio, the title (36, fitted) and the meta */
function PhoneRow({ b, i, w, onOpen }: { b: SiteBook; i: number; w: number; onOpen: (id: string) => void }) {
  const fs = Math.min(36, (w - 40 - 64 - 18) / (b.title.length * 0.52))
  return (
    <button type="button" className="sv3-row sv3-row-phone" aria-label={`${b.title}, ${b.year}`} data-testid="sd3-book" data-id={b.id} onClick={() => onOpen(b.id)}>
      <span className="sv3-thumb" style={{ width: 64, height: (64 * b.h) / b.w, backgroundImage: `url(${src(b.cover)})`, backgroundColor: b.spine }} />
      <span className="min-w-0">
        <span className="sv3-title block" style={{ fontSize: fs }}>{b.title}</span>
        <span className="sv2-meta block" style={{ marginTop: 6 }}>{pad2(i + 1)} · {b.year} · {pagesOf(b)} pp</span>
      </span>
    </button>
  )
}

/** the sticky preview: the book standing over a soft floor shadow, its statement, meta and link; it crossfades */
function Preview({ b, s, k, onOpen }: { b: SiteBook; s: number; k: number; onOpen: (id: string) => void }) {
  const [st, setSt] = React.useState({ cur: b, prev: null as SiteBook | null, id: 0 })
  if (b !== st.cur) setSt({ cur: b, prev: st.cur, id: st.id + 1 })
  const card = (x: SiteBook, live: boolean) => (
    <>
      <div className="sv3-stand" style={{ height: 480 * k }}><Book3D b={x} s={s} pose={{ ry: -14, rx: -3 }} /></div>
      <p className="sv3-pv-st"><Statement s={x.statement} /></p>
      <div className="sv2-meta" style={{ marginTop: 12 }}>{metaOf(x)}</div>
      <button type="button" className="sv2-link" style={{ marginTop: 16 }} tabIndex={live ? undefined : -1} onClick={() => onOpen(x.id)}>Open the book</button>
    </>
  )
  return (
    <div className="sv3-prev" data-testid="sd3-preview" data-id={st.cur.id}>
      {st.prev && <div key={`o${st.id}`} className="sv3-pv sv3-pv-out" aria-hidden>{card(st.prev, false)}</div>}
      <div key={`i${st.id}`} className={st.id ? "sv3-pv sv3-pv-in" : "sv3-pv"}>{card(st.cur, true)}</div>
    </div>
  )
}

function More({ narrow }: { narrow: boolean }) {
  const m = narrow ? 0 : 48
  return (
    <>
      <section id="sv3-about" className="sv3-sec" style={{ padding: `${narrow ? 120 : 200}px ${m}px 0` }}>
        <div className="sv2-meta">About</div>
        <p className="sv2-intro" style={{ maxWidth: 600 }}><Statement s={ABOUT} /></p>
      </section>
      <section id="sv3-contact" className="sv3-sec" style={{ padding: `${narrow ? 96 : 140}px ${m}px ${narrow ? 88 : 96}px` }}>
        <div className="sv2-meta">Contact</div>
        <div>
          <a className="sv3-email" style={narrow ? { fontSize: 26 } : undefined} href={`mailto:${EMAIL}`}>{EMAIL}</a>
          <div className="sv2-meta" style={{ marginTop: narrow ? 72 : 120 }}>© 2026 {AUTHOR}</div>
        </div>
      </section>
    </>
  )
}

/* Site fresh A (concept.md): the books lie in one pile; scrolling takes them off one at a time and reads them.
   #/full/site-fresh-a?books=1|3|6|12 · &b=<id> the book page · &p=about|contact. */
import * as React from "react"
import { AUTHOR, BOOKS, EMAIL, type SiteBook } from "../site-demo-1/data"
import { EXTRA } from "../site-demo-1/data-extra"
import { Chapter } from "./chapter"
import { Pile, pileScale } from "./stack"
import { Scroll, smooth, useScroller } from "./scroll"
import "./site.css"

const LEAD = "Photographs of lakes, coasts and the people I travel with, made into books."
const ABOUT = "I photograph lakes, coasts and the people I travel with, and make the pictures into small hardcover books that I design and print myself."

const query = () => new URLSearchParams(location.hash.split("?")[1] ?? "")
function useQuery() {
  const [s, set] = React.useState(() => query().toString())
  React.useEffect(() => {
    const on = () => set(query().toString())
    window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on)
  }, [])
  return React.useMemo(() => new URLSearchParams(s), [s])
}
const navigate = (patch: Record<string, string | null>) => {
  const p = query()
  for (const [k, v] of Object.entries(patch)) { if (v === null) p.delete(k); else p.set(k, v) }
  const base = location.hash.split("?")[0].slice(1), qs = p.toString()
  location.hash = qs ? `${base}?${qs}` : base
}
const booksFor = (n: number): SiteBook[] => (n === 1 ? BOOKS.slice(0, 1) : n === 3 ? BOOKS.slice(0, 3) : n === 12 ? [...BOOKS, ...EXTRA] : BOOKS)

type Lay = { W: number; vh: number; phone: boolean; col: number; span: (n: number) => number }
function useLayout(el: React.RefObject<HTMLDivElement | null>): Lay {
  const [sz, setSz] = React.useState({ W: 1440, vh: 900 })
  React.useLayoutEffect(() => {
    const e = el.current; if (!e) return
    const ro = new ResizeObserver(() => setSz({ W: e.clientWidth, vh: e.clientHeight }))
    ro.observe(e); setSz({ W: e.clientWidth, vh: e.clientHeight })
    return () => ro.disconnect()
  }, [el])
  const phone = sz.W < 768
  const M = phone ? 16 : 24, G = phone ? 12 : 16, C = phone ? 4 : 12
  const col = (sz.W - 2 * M - (C - 1) * G) / C
  return { ...sz, phone, col, span: (n) => n * col + (n - 1) * G }
}

/** chapter scale: one px/cm for every book (true relative size), the widest spread and the tallest book fit */
function chapterGeo(books: SiteBook[], L: Lay) {
  const maxSpread = Math.max(...books.map((b) => 2 * b.w)), maxH = Math.max(...books.map((b) => b.h))
  if (L.phone) {
    const stageH = Math.min(L.vh * 0.42, L.vh - 48 - 96 - 200)
    return { s: Math.min((L.W - 32) / maxSpread, (stageH - 16) / maxH), stageH }
  }
  // the caption takes ~152 px under a 40 px gap; a turning leaf reaches ~10 % past the book toward the viewer
  const stageH = L.vh - 48 - 152 - 40
  return { s: Math.min(L.span(9) / maxSpread, (stageH - 16) / (maxH * 1.12), 24), stageH }
}

function Header({ page, multi, phone, go }: { page: string; multi: boolean; phone: boolean; go: (p: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const items = [...(multi ? [["home", "Books"]] : [["home", "Book"]]), ["about", "About"], ["contact", "Contact"]]
  const cur = page === "book" ? "home" : page
  const pick = (p: string) => { setOpen(false); go(p) }
  return (
    <header className="sfa-grid sfa-head" data-testid="sfa-head">
      <button className="sfa-name" onClick={() => pick("home")}>{AUTHOR}</button>
      <nav className="sfa-nav" aria-label="Site">
        {phone
          ? <button aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ color: "var(--ink)" }}>{open ? "Close" : "Menu"}</button>
          : items.map(([id, t]) => <button key={id} aria-current={cur === id ? "page" : undefined} onClick={() => pick(id)}>{t}</button>)}
      </nav>
      {phone && open && (
        <div className="sfa-menu" data-testid="sfa-menu">
          {items.map(([id, t]) => <button key={id} aria-current={cur === id ? "page" : undefined} onClick={() => pick(id)}>{t}</button>)}
        </div>
      )}
    </header>
  )
}

/** the contents: title + year rows; more than six books → grouped by year */
function Contents({ books, cur, hot, onHot, onPick, label }: {
  books: SiteBook[]; cur: string | null; hot?: string | null; onHot?: (id: string | null) => void; onPick: (id: string) => void; label: string
}) {
  const grouped = books.length > 6
  const years = [...new Set(books.map((b) => b.year))]
  const row = (b: SiteBook) => (
    <button key={b.id} className="sfa-row" aria-current={cur === b.id ? "true" : undefined} data-hot={hot === b.id || undefined}
      onMouseEnter={() => onHot?.(b.id)} onMouseLeave={() => onHot?.(null)} onFocus={() => onHot?.(b.id)} onBlur={() => onHot?.(null)}
      onClick={() => onPick(b.id)} data-testid="sfa-row" data-book={b.id}>
      <span>{b.title}</span>{!grouped && <span className="t-meta">{b.year}</span>}
    </button>
  )
  return (
    <nav className="sfa-list" aria-label={label} data-cur={cur ? "" : undefined}>
      {grouped ? years.map((y) => <React.Fragment key={y}><p className="sfa-year t-meta">{y}</p>{books.filter((b) => b.year === y).map(row)}</React.Fragment>) : books.map(row)}
    </nav>
  )
}

function Home({ books, L, open }: { books: SiteBook[]; L: Lay; open: (id: string) => void }) {
  const ctx = React.useContext(Scroll)
  const [hot, setHot] = React.useState<string | null>(null)
  const [cur, setCur] = React.useState<string | null>(null)
  const geo = chapterGeo(books, L)
  const steps = books.length > 6 ? 2 : 3
  const step = Math.round(L.vh * 0.45)
  const years = books.map((b) => b.year)
  const span = `${books.length} books, ${Math.min(...years)}–${Math.max(...years)}`
  const heroH = L.phone ? 0 : L.vh - 56
  const pileS = L.phone ? pileScale(books, L.W - 32, Math.min(380, L.vh * 0.46), 16) : pileScale(books, L.span(9), heroH - 40 - 72 - 64 - 40)
  const jump = (id: string) => {
    const sc = ctx?.el.current, t = sc?.querySelector<HTMLElement>(`[data-testid="sfa-chapter"][data-book="${id}"]`)
    if (sc && t) sc.scrollTo({ top: sc.scrollTop + t.getBoundingClientRect().top - sc.getBoundingClientRect().top + step * 0.999, behavior: smooth() })
  }
  // the hero is on screen until the first chapter takes over
  const onActive = React.useCallback((id: string) => setCur(id), [])
  React.useEffect(() => ctx?.sub(() => { const sc = ctx.el.current; if (sc && sc.scrollTop < L.vh * 0.5) setCur(null) }), [ctx, L.vh])

  const chapters = books.map((b) => (
    <Chapter key={b.id} b={b} s={geo.s} vh={L.vh} phone={L.phone} stageH={geo.stageH} mode="home" steps={steps} step={step} onActive={onActive} onOpen={open} />
  ))
  const pile = <Pile books={books} s={pileS} hot={hot} onHot={setHot} onPick={jump} />
  if (L.phone) return (
    <div className="sfa-page" data-testid="sfa-home">
      <section style={{ padding: "24px 16px 0" }}>
        <p className="t-lead">{LEAD}</p>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>{pile}</div>
        <p className="t-meta" style={{ textAlign: "center", marginBottom: 24 }}>{span}</p>
        <Contents books={books} cur={null} onPick={jump} label="Books" />
      </section>
      <div style={{ padding: "0 16px" }}>{chapters}</div>
    </div>
  )
  return (
    <div className="sfa-grid sfa-page" data-testid="sfa-home">
      <aside className="sfa-aside"><Contents books={books} cur={cur} hot={hot} onHot={setHot} onPick={jump} label="Books" /></aside>
      <section className="sfa-main sfa-hero" style={{ height: heroH }}>
        <p className="t-lead" style={{ maxWidth: L.span(6) }}>{LEAD}</p>
        <div className="sfa-hero-pile">{pile}</div>
        <p className="sfa-hero-meta t-meta">{span}</p>
      </section>
      <div className="sfa-main">{chapters}</div>
    </div>
  )
}

function BookPage({ b, books, L, open, home }: { b: SiteBook; books: SiteBook[]; L: Lay; open: (id: string) => void; home: () => void }) {
  const geo = chapterGeo(books, L)
  const step = Math.round(L.vh * (L.phone ? 0.5 : 0.6))
  const multi = books.length > 1
  const next = books[(books.indexOf(b) + 1) % books.length]
  const chapter = <Chapter key={b.id} b={b} s={geo.s} vh={L.vh} phone={L.phone} stageH={geo.stageH} mode="book" steps={b.spreads.length + 2} step={step} />
  const tail = multi && (
    <p className="sfa-next"><span className="t-meta">Next book</span><button className="sfa-link" onClick={() => open(next.id)}>{next.title}</button></p>
  )
  if (L.phone) return (
    <div className="sfa-page" data-testid="sfa-book" data-book={b.id} style={{ padding: "0 16px" }}>
      {multi ? <button className="sfa-link sfa-back" style={{ marginTop: 8, marginBottom: 0, minHeight: 44 }} onClick={home}>All books</button> : <p className="t-lead" style={{ paddingTop: 24 }}>{LEAD}</p>}
      {chapter}{tail}
    </div>
  )
  return (
    <div className="sfa-grid sfa-page" data-testid="sfa-book" data-book={b.id}>
      <aside className="sfa-aside">
        {multi ? <>
          <button className="sfa-link sfa-back" onClick={home}>All books</button>
          <Contents books={books} cur={b.id} onPick={open} label="Books" />
        </> : <p className="t-lead">{LEAD}</p>}
      </aside>
      <div className="sfa-main">{chapter}{tail}</div>
    </div>
  )
}

function TextPage({ kind }: { kind: "about" | "contact" }) {
  return (
    <div className="sfa-grid sfa-page" data-testid={`sfa-${kind}`}>
      <section className="sfa-text-page">
        {kind === "about" ? <>
          <p className="t-lead">{ABOUT}</p>
          <p className="t-meta">Based between lakes and the sea. Books in editions of 30 to 100.</p>
        </> : <>
          <p className="t-lead">Write to <a className="sfa-link" href={`mailto:${EMAIL}`} style={{ color: "inherit" }}>{EMAIL}</a> about a book, a print or a commission.</p>
          <p className="t-meta">I answer within a week.</p>
        </>}
      </section>
    </div>
  )
}

export function SiteFreshA() {
  const el = React.useRef<HTMLDivElement>(null)
  const ctx = useScroller(el)
  const L = useLayout(el)
  const q = useQuery()
  const books = booksFor(Number(q.get("books")) || 6)
  const multi = books.length > 1
  const p = q.get("p")
  const page = p === "about" || p === "contact" ? p : !multi || q.get("b") ? "book" : "home"
  const book = books.find((x) => x.id === q.get("b")) ?? books[0]
  const key = `${page}:${page === "book" ? book.id : ""}`
  React.useLayoutEffect(() => { el.current?.scrollTo({ top: 0 }) }, [key])
  // the kit body keeps min-width 1280 for its own pages; a phone-width site must not scroll sideways
  React.useLayoutEffect(() => {
    const b = document.body.style, was = b.minWidth
    b.minWidth = "0"; return () => { b.minWidth = was }
  }, [])
  const open = (id: string) => navigate({ b: id, p: null })
  const home = () => navigate({ b: null, p: null })
  const go = (pg: string) => (pg === "home" ? home() : navigate({ b: null, p: pg }))
  return (
    <Scroll.Provider value={ctx}>
      <div ref={el} className={`sfa${L.phone ? " sfa-phone" : ""}${page === "book" ? " sfa-snap" : ""}`} data-testid="sfa" data-books={books.length}>
        <Header page={page} multi={multi} phone={L.phone} go={go} />
        <main key={key}>
          {page === "home" && <Home books={books} L={L} open={open} />}
          {page === "book" && <BookPage b={book} books={books} L={L} open={open} home={home} />}
          {(page === "about" || page === "contact") && <TextPage kind={page} />}
        </main>
        <footer className="sfa-grid sfa-foot t-meta">
          <p>{AUTHOR} · photobooks</p>
          <p><a className="sfa-link" href={`mailto:${EMAIL}`} style={{ color: "inherit" }}>{EMAIL}</a></p>
        </footer>
      </div>
    </Scroll.Provider>
  )
}

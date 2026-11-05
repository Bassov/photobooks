/* Site fresh C, the programme (concept.md): the site runs on the clock. Each book owns one minute in turn and turns its
   own pages through it; the visitor takes over by touching the book (or Pause) and Play goes back to the programme.
   Reduced motion starts paused. Book page, About and Contact share the header and the programme row. */
import * as React from "react"
import "./site.css"
import { Book3D } from "../site-demo-1/book3d"
import { BookReader } from "../site-demo-1/reader"
import { AUTHOR, BOOKS, EMAIL, SPREAD_R, italics, pagesOf, sizeOf, viewLabel, viewsOf, type SiteBook } from "../site-demo-1/data"
import { EXTRA } from "../site-demo-1/data-extra"
import { SLOT_MS, at, hhmm, pick, startOf, type At } from "./programme"

const ROUTE = "#/full/site-fresh-c"
const LEAD = "Photographs of lakes, coasts and the people I travel with, made into books."
const ALL = [...BOOKS, ...EXTRA]
type Page = "home" | "book" | "about" | "contact"
type Loc = { n: number; page: Page; book?: string }

function readLoc(): Loc {
  const q = new URLSearchParams(location.hash.split("?")[1] ?? "")
  const n = Number(q.get("books")) || 6
  const p = q.get("p"), book = q.get("b") ?? undefined
  return { n, book, page: p === "about" || p === "contact" ? p : book ? "book" : "home" }
}
function hrefOf(n: number, to: { p?: "about" | "contact"; b?: string } = {}) {
  const q = new URLSearchParams()
  if (n !== 6) q.set("books", String(n))
  if (to.p) q.set("p", to.p)
  if (to.b) q.set("b", to.b)
  const s = q.toString()
  return s ? `${ROUTE}?${s}` : ROUTE
}
function useLoc() {
  const [loc, setLoc] = React.useState(readLoc)
  React.useEffect(() => {
    const on = () => setLoc(readLoc())
    window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on)
  }, [])
  return loc
}
function useWin() {
  const [w, setW] = React.useState(() => ({ w: innerWidth, h: innerHeight }))
  React.useEffect(() => {
    const on = () => setW((p) => (p.w === innerWidth && p.h === innerHeight ? p : { w: innerWidth, h: innerHeight }))
    // a phone's first innerWidth is the kit body's 1280 min-width; dropping it shrinks the layout viewport without a resize event
    const ro = new ResizeObserver(on)
    ro.observe(document.documentElement)
    window.addEventListener("resize", on)
    return () => { ro.disconnect(); window.removeEventListener("resize", on) }
  }, [])
  return w
}
const reducedNow = () => matchMedia("(prefers-reduced-motion: reduce)").matches
function useReduced() {
  const [r, setR] = React.useState(reducedNow)
  React.useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)"), on = () => setR(mq.matches)
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on)
  }, [])
  return r
}
/** the clock, re-read at every programme step (a view or a minute) and when the tab comes back */
function useNow(books: SiteBook[]) {
  const [now, setNow] = React.useState(() => Date.now())
  const next = at(books, now).nextAt
  React.useEffect(() => {
    const id = setTimeout(() => setNow(Date.now()), Math.max(16, next - Date.now() + 8))
    return () => clearTimeout(id)
  }, [now, next])
  React.useEffect(() => {
    const on = () => { if (!document.hidden) setNow(Date.now()) }
    document.addEventListener("visibilitychange", on); return () => document.removeEventListener("visibilitychange", on)
  }, [])
  return now
}

const metaOf = (b: SiteBook) => `${b.year} · ${pagesOf(b)} pages · ${sizeOf(b)}`
/** reader geometry in cm: the open spread is H × H·R */
const spreadW = (b: SiteBook) => b.h * SPREAD_R[b.fmt]

type Geo = { phone: boolean; s: number; stageH: number; sr: number; span: number; standH: number; listS: number }
function geoOf(books: SiteBook[], w: number, h: number): Geo {
  const phone = w < 768
  const maxW = Math.max(...books.map(spreadW)), maxH = Math.max(...books.map((b) => b.h))
  const listS = 80 / maxH
  if (phone) {
    const s = (w - 32 - 32) / maxW
    return { phone, s, stageH: Math.round(maxH * s + 40), sr: listS, span: 0, standH: 0, listS }
  }
  const cw = w - 48, col = (cw - 11 * 16) / 12, playerW = 8 * col + 7 * 16
  // the programme row sits on the grid: each book gets 12 / N columns
  const N = books.length, span = Math.max(1, Math.floor(12 / N)), cellW = span * col + (span - 1) * 16
  const sr = N > 1 ? Math.min(h < 800 ? 3.6 : 4.6, (cellW * 0.9) / Math.max(...books.map((b) => b.w))) : 0
  const standH = N > 1 ? Math.ceil(maxH * sr + 16) : 0
  // programme: rule + heading 67, labels 54 (two title lines over six books), page bottom 24
  const rowH = N > 1 ? standH + 67 + (N > 6 ? 77 : 54) : 0
  // header 56, hero: top 24, line and page label 52
  const stageH = Math.max(280, Math.min(N > 1 ? 600 : 760, h - 56 - 24 - 52 - rowH - 24))
  const s = Math.min((playerW - 32) / maxW, (stageH - 24) / maxH)
  return { phone, s, stageH, sr, span, standH, listS }
}

export function SiteFreshC() {
  const loc = useLoc()
  const { w, h } = useWin()
  const books = React.useMemo(() => pick(ALL, loc.n), [loc.n])
  const g = geoOf(books, w, h)
  const now = useNow(books)
  const scroller = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { scroller.current?.scrollTo(0, 0) }, [loc.page, loc.book])
  // the kit body is min-width 1280; the site has its own phone layout
  React.useEffect(() => {
    const prev = document.body.style.minWidth
    document.body.style.minWidth = "0"
    return () => { document.body.style.minWidth = prev }
  }, [])
  const book = books.find((b) => b.id === loc.book)
  const page: Page = loc.page === "book" && !book ? "home" : loc.page
  return (
    <div ref={scroller} lang="en" className={`sfc${g.phone ? " sfc-phone" : ""}`} data-testid="sfc" data-page={page} data-books={books.length}>
      <Header n={loc.n} page={page} phone={g.phone} />
      <main className="sfc-main">
        {page === "home" && <Home key="home" books={books} now={now} g={g} n={loc.n} />}
        {page === "book" && book && <BookPage key={book.id} b={book} g={g} />}
        {page === "about" && <p className="sfc-lead sfc-about" data-testid="sfc-about">I photograph lakes, coasts and the people I travel with, and lay the photographs out as books, printed and bound in small runs.</p>}
        {page === "contact" && <p className="sfc-lead sfc-about" data-testid="sfc-contact">For books, prints and commissions write to <a className="sfc-link" href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>}
        {books.length > 1 && <Programme books={books} now={now} g={g} n={loc.n} sel={page === "book" ? book?.id : undefined} />}
        {books.length > 6 && <AllBooks books={books} n={loc.n} />}
      </main>
    </div>
  )
}

function Header({ n, page, phone }: { n: number; page: Page; phone: boolean }) {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [open])
  React.useEffect(() => setOpen(false), [page])
  const items: [string, string, boolean][] = [
    ["Books", hrefOf(n), page === "home" || page === "book"],
    ["About", hrefOf(n, { p: "about" }), page === "about"],
    ["Contact", hrefOf(n, { p: "contact" }), page === "contact"],
  ]
  const links = items.map(([t, href, on]) => <a key={t} href={href} className={on ? "sfc-nav-on" : undefined} aria-current={on ? "page" : undefined}>{t}</a>)
  return (
    <header className="sfc-head">
      <a className="sfc-name" href={hrefOf(n)}>{AUTHOR}</a>
      {phone ? (
        <>
          <button type="button" className="sfc-menu-btn" aria-expanded={open} aria-controls="sfc-menu" onClick={() => setOpen((o) => !o)} data-testid="sfc-menu-btn">{open ? "Close" : "Menu"}</button>
          {open && <nav id="sfc-menu" className="sfc-menu" data-testid="sfc-menu">{links}</nav>}
        </>
      ) : <nav className="sfc-nav">{links}</nav>}
    </header>
  )
}

/** the hairline under the book: fills over the minute while live (frozen start, so re-renders don't re-time it) */
function Line({ live, at: a, view, n }: { live: boolean; at?: At; view: number; n: number }) {
  if (live && a) return <div className="sfc-line" aria-hidden><Grow key={a.slot} elapsed={a.elapsed} /></div>
  return <div className="sfc-line" aria-hidden><i style={{ transform: `scaleX(${n > 1 ? view / (n - 1) : 1})` }} /></div>
}
function Grow({ elapsed }: { elapsed: number }) {
  const [d] = React.useState(elapsed)
  return <i className="sfc-grow" style={{ animationDuration: `${SLOT_MS}ms`, animationDelay: `-${d}ms` }} />
}

function Stage({ b, view, onView, g }: { b: SiteBook; view: number; onView: (v: number) => void; g: Geo }) {
  const W = Math.round(spreadW(b) * g.s)
  return (
    <div className="sfc-stage" style={{ height: g.stageH }} data-testid="sfc-stage">
      <div key={b.id} className="sfc-in"><BookReader b={b} view={view} onView={onView} width={W} leaf="paper" /></div>
    </div>
  )
}

function Home({ books, now, g, n }: { books: SiteBook[]; now: number; g: Geo; n: number }) {
  const reduced = useReduced()
  const cur = at(books, now)
  /** null = live (the programme turns the pages); else the visitor's own book and view */
  const [own, setOwn] = React.useState<{ i: number; view: number } | null>(() => (reducedNow() ? { i: cur.i, view: cur.view } : null))
  const live = own === null
  const i = own ? own.i : cur.i
  const b = books[i], view = own ? own.view : cur.view, nv = viewsOf(b)
  const nextAt = (cur.slot + 1) * SLOT_MS
  const next = books[(cur.i + 1) % books.length]
  const status = live
    ? books.length === 1 ? `Now, again at ${hhmm(nextAt)}` : `Now, until ${hhmm(nextAt)}`
    : own.i === cur.i ? "Paused" : `Paused. On the programme now: ${books[cur.i].title}`
  const toggle = <button type="button" className="sfc-btn" onClick={() => setOwn(live ? { i: cur.i, view: cur.view } : null)} data-testid="sfc-toggle">{live ? "Pause" : "Play"}</button>
  const text = (
    <div className="sfc-now" data-testid="sfc-now">
      <p className="sfc-meta" data-testid="sfc-status">{status}</p>
      <h2 className="sfc-title"><a href={hrefOf(n, { b: b.id })} className="sfc-tlink" data-testid="sfc-now-title">{b.title}</a></h2>
      <p className="sfc-meta">{metaOf(b)}</p>
      <div className="sfc-actions">{toggle}<a className="sfc-link" href={hrefOf(n, { b: b.id })}>About this book</a></div>
    </div>
  )
  return (
    <section className="sfc-grid sfc-hero" data-testid="sfc-home" data-live={live}>
      <div className="sfc-side">
        <p className="sfc-lead">{LEAD}</p>
        {!g.phone && text}
      </div>
      <div className="sfc-play" data-testid="sfc-player" data-book={b.id} data-view={view}>
        <Stage b={b} view={view} onView={(v) => setOwn({ i, view: v })} g={g} />
        <Line live={live && !reduced} at={cur} view={view} n={nv} />
        <div className="sfc-under sfc-meta">
          <span data-testid="sfc-page">{viewLabel(b, view)}</span>
          {books.length > 1 && <span>Next: {next.title}, {hhmm(nextAt)}</span>}
        </div>
      </div>
      {g.phone && text}
    </section>
  )
}

function BookPage({ b, g }: { b: SiteBook; g: Geo }) {
  const [view, setView] = React.useState(0)
  const [play, setPlay] = React.useState(false)
  const n = viewsOf(b)
  React.useEffect(() => {
    if (!play) return
    if (view >= n - 1) { setPlay(false); return }
    const id = setTimeout(() => setView((v) => Math.min(n - 1, v + 1)), view === 0 ? 900 : SLOT_MS / n)
    return () => clearTimeout(id)
  }, [play, view, n])
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") location.hash = hrefOf(readLoc().n).slice(1) }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [])
  const onView = (v: number) => { setPlay(false); setView(v) }
  const open = view > 0 && view < n - 1
  return (
    <section className="sfc-grid sfc-hero" data-testid="sfc-book" data-book={b.id}>
      <div className="sfc-side sfc-side-book">
        <h1 className="sfc-title">{b.title}</h1>
        <p className="sfc-lead">{italics(b.statement).map((p, k) => p.it ? <span key={k} className="sfc-mute">{p.t}</span> : p.t)}</p>
        <p className="sfc-meta">{metaOf(b)}</p>
        <div className="sfc-actions">
          <button type="button" className="sfc-btn" onClick={() => onView(open ? 0 : 1)} data-testid="sfc-open">{open ? "Close the book" : "Open the book"}</button>
          <button type="button" className="sfc-btn" onClick={() => { if (play) setPlay(false); else { if (view >= n - 1) setView(0); setPlay(true) } }} data-testid="sfc-read">{play ? "Pause" : "Let it read itself"}</button>
        </div>
      </div>
      <div className="sfc-play" data-testid="sfc-player" data-book={b.id} data-view={view}>
        <Stage b={b} view={view} onView={onView} g={g} />
        <Line live={false} view={view} n={n} />
        <div className="sfc-under sfc-meta"><span data-testid="sfc-page">{viewLabel(b, view)}</span><span>{g.phone ? "Tap a page to turn it" : "Click a page or use ← / →"}</span></div>
      </div>
    </section>
  )
}

/** the programme: every book with the time it next opens; desktop a row of standing books, phone a list */
function Programme({ books, now, g, n, sel }: { books: SiteBook[]; now: number; g: Geo; n: number; sel?: string }) {
  const cur = at(books, now)
  const order = g.phone && books.length > 6 ? Array.from({ length: 4 }, (_, k) => (cur.i + k) % books.length) : books.map((_, k) => k)
  const label = (j: number) => (j === cur.i ? "Now" : hhmm(startOf(books, j, now)))
  if (g.phone) return (
    <section className="sfc-prog" aria-label="Programme" data-testid="sfc-row">
      <p className="sfc-meta sfc-prog-h">{books.length > 6 ? "Next on the programme" : "The programme, one book a minute"}</p>
      <ol className="sfc-list">
        {order.map((j) => { const b = books[j]; return (
          <li key={b.id}>
            <a className="sfc-li" href={hrefOf(n, { b: b.id })} data-testid="sfc-item" data-book={b.id} data-now={j === cur.i} aria-current={b.id === sel ? "page" : undefined}>
              <span className="sfc-li-book"><Book3D b={b} s={g.listS} floor={false} /></span>
              <span className="sfc-li-t">
                <span className={`sfc-meta${j === cur.i ? " sfc-ink" : ""}`}>{label(j)}</span>
                <span className="sfc-text">{b.title}</span>
                <span className="sfc-meta">{metaOf(b)}</span>
              </span>
            </a>
          </li>
        ) })}
      </ol>
    </section>
  )
  return (
    <section className="sfc-prog" aria-label="Programme" data-testid="sfc-row">
      <p className="sfc-meta sfc-prog-h">The programme, one book a minute</p>
      <ol className="sfc-row" data-many={books.length > 6 || undefined}>
        {order.map((j) => { const b = books[j]; return (
          <li key={b.id} style={{ gridColumn: `span ${g.span}` }}>
            <a className="sfc-item" href={hrefOf(n, { b: b.id })} data-testid="sfc-item" data-book={b.id} data-now={j === cur.i} aria-current={b.id === sel ? "page" : undefined}>
              <span className="sfc-standbox" style={{ height: g.standH }}><Book3D b={b} s={g.sr} /></span>
              <span className={`sfc-meta sfc-time${j === cur.i ? " sfc-ink" : ""}`}>{label(j)}</span>
              <span className="sfc-text sfc-item-t">{b.title}</span>
            </a>
          </li>
        ) })}
      </ol>
    </section>
  )
}

/** 12 books: all of them by year */
function AllBooks({ books, n }: { books: SiteBook[]; n: number }) {
  const years = [...new Set(books.map((b) => b.year))].sort((a, b) => b - a)
  return (
    <section className="sfc-all" aria-label="All books" data-testid="sfc-all">
      <p className="sfc-meta sfc-prog-h">All books</p>
      {years.map((y) => (
        <div key={y} className="sfc-year">
          <span className="sfc-meta">{y}</span>
          <ul>
            {books.filter((b) => b.year === y).map((b) => (
              <li key={b.id}><a className="sfc-all-a" href={hrefOf(n, { b: b.id })}><span className="sfc-text">{b.title}</span><span className="sfc-meta">{pagesOf(b)} pages · {sizeOf(b)}</span></a></li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

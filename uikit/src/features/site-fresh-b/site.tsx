/* site-fresh-b (DEMO): the photographer's book site built around one gesture, the row (./row.tsx). Pages: home (the row +
   the index), the book (a paper-page reader), About, Contact. `?books=1|3|6|12`; in #/full the page lives in the hash query
   (`&book=<id>`, `&p=about|contact`) so Back works. Type, colour and grid: shared/design/fresh-ideas/system.md. */
import * as React from "react"
import { Book3D } from "../site-demo-1/book3d"
import { BookReader } from "../site-demo-1/reader"
import { AUTHOR, BOOKS, EMAIL, pagesOf, sizeOf, viewLabel, viewsOf, type SiteBook } from "../site-demo-1/data"
import { EXTRA } from "../site-demo-1/data-extra"
import { Row, type RowApi } from "./row"
import "./site.css"

const SLUG = "site-fresh-b"
/** the three-quarter turn of the row and of the held book: the spine shows on the left */
const ANG = 32
const LEAD = "Photographs of lakes, coasts and the people I travel with, made into books."
const PHONE = 720
const plain = (s: string) => s.replace(/\*/g, "")
const meta = (b: SiteBook) => `${b.year} · ${sizeOf(b)} · ${pagesOf(b)} pages`

/** the query of #/full/site-fresh-b?…; on the kit feature page the state stays in memory */
function useQuery() {
  const full = typeof location !== "undefined" && location.hash.startsWith(`#/full/${SLUG}`)
  const read = () => new URLSearchParams(full ? (location.hash.split("?")[1] ?? "") : "")
  const [q, setQ] = React.useState(read)
  React.useEffect(() => {
    if (!full) return
    const on = () => setQ(read())
    addEventListener("hashchange", on); return () => removeEventListener("hashchange", on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full])
  const nav = (patch: Record<string, string | null>) => {
    const nq = new URLSearchParams(q)
    for (const [k, v] of Object.entries(patch)) if (v === null) nq.delete(k); else nq.set(k, v)
    const str = nq.toString()
    if (full) location.hash = `#/full/${SLUG}${str ? `?${str}` : ""}`
    else setQ(nq)
  }
  return [q, nav] as const
}

function useSize(el: React.RefObject<HTMLElement | null>) {
  const [sz, setSz] = React.useState({ w: 1440, h: 900 })
  React.useLayoutEffect(() => {
    const e = el.current; if (!e) return
    const set = () => setSz({ w: e.clientWidth, h: e.clientHeight })
    set()
    const ro = new ResizeObserver(set); ro.observe(e); return () => ro.disconnect()
  }, [el])
  return sz
}

type Page = "home" | "book" | "about" | "contact"

export function SiteFreshB() {
  const [q, nav] = useQuery()
  const root = React.useRef<HTMLDivElement>(null)
  const { w, h } = useSize(root)
  const phone = w < PHONE
  const count = [1, 3, 6, 12].includes(Number(q.get("books"))) ? Number(q.get("books")) : 6
  const books = React.useMemo(() => (count === 12 ? [...BOOKS, ...EXTRA] : BOOKS.slice(0, count)), [count])
  const n = books.length
  const p = q.get("p")
  const bi = books.findIndex((b) => b.id === q.get("book"))
  const page: Page = p === "about" || p === "contact" ? p : bi >= 0 || n === 1 ? "book" : "home"
  const [front, setFront] = React.useState(0)
  const [menu, setMenu] = React.useState(false)
  const open = (i: number) => { setFront(i); nav({ book: books[i].id, p: null }) }
  const go = (pg: Page) => { setMenu(false); nav({ p: pg === "about" || pg === "contact" ? pg : null, book: null }) }
  React.useEffect(() => { root.current?.scrollTo({ top: 0 }) }, [page, bi])
  React.useEffect(() => { if (front >= n) setFront(0) }, [front, n])
  // the kit body keeps a 1280 px floor for its own pages; the site in the full window is a phone page too
  React.useEffect(() => {
    if (!location.hash.startsWith("#/full/")) return
    const was = document.body.style.minWidth
    document.body.style.minWidth = "0"
    return () => { document.body.style.minWidth = was }
  }, [])

  const links: [Page, string][] = [...(n > 1 ? [["home", "Books"] as [Page, string]] : []), ["about", "About"], ["contact", "Contact"]]
  const active = page === "book" && n > 1 ? "home" : page
  return (
    <div ref={root} className={phone ? "sfb is-phone" : "sfb"} data-testid="sfb" data-page={page}>
      <div className="sfb-clip">
        <header className="sfb-head">
          <button type="button" className="sfb-name" onClick={() => go("home")}>{AUTHOR}</button>
          {phone ? (
            <button type="button" className="sfb-link sfb-menu-btn" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? "Close" : "Menu"}</button>
          ) : (
            <nav className="sfb-nav" aria-label="Site">
              {links.map(([pg, l]) => <button key={pg} type="button" className={pg === active ? "sfb-link is-on" : "sfb-link"} aria-current={pg === active ? "page" : undefined} onClick={() => go(pg)}>{l}</button>)}
            </nav>
          )}
        </header>
        {phone && menu && (
          <nav className="sfb-menu" aria-label="Site">
            {links.map(([pg, l]) => <button key={pg} type="button" className={pg === active ? "sfb-mlink is-on" : "sfb-mlink"} onClick={() => go(pg)}>{l}</button>)}
          </nav>
        )}
        {page === "home" && <Home books={books} front={Math.min(front, n - 1)} setFront={setFront} onOpen={open} w={w} h={h} phone={phone} />}
        {page === "book" && <BookPage key={books[Math.max(0, bi)].id} books={books} i={Math.max(0, bi)} onOpen={open} onAll={() => go("home")} w={w} h={h} phone={phone} />}
        {page === "about" && (
          <section className="sfb-plain">
            <p className="t-lead">I photograph lakes, coasts and the people I travel with, and make the photographs into books: {n === 1 ? "one book" : `${n} books`} since {Math.min(...books.map((b) => b.year))}.</p>
          </section>
        )}
        {page === "contact" && (
          <section className="sfb-plain">
            <p className="t-lead">Write to me at <a className="sfb-ul" href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
          </section>
        )}
      </div>
    </div>
  )
}

function Home({ books, front, setFront, onOpen, w, h, phone }: {
  books: SiteBook[]; front: number; setFront: (i: number) => void; onOpen: (i: number) => void; w: number; h: number; phone: boolean
}) {
  const row = React.useRef<RowApi>(null)
  const n = books.length, b = books[front]
  // the 12-column grid: the row takes columns 5–12 on desktop, the full width on the phone
  const col = (w - 48 - 11 * 16) / 12
  const sceneW = phone ? w - 32 : Math.floor(col * 8 + 7 * 16)
  const sceneH = phone ? Math.round(Math.min(400, Math.max(300, w * 0.86))) : Math.max(360, h - 56 - 176)
  return (
    <main className="sfb-home" style={phone ? undefined : { height: Math.max(560, h - 56) }}>
      <div className="sfb-intro">
        <p className="t-lead">{LEAD}</p>
        {!phone && <Index books={books} front={front} onPick={(i) => row.current?.go(i)} />}
      </div>
      <div className="sfb-stagecol">
        <Row ref={row} books={books} front={front} onFront={setFront} onOpen={onOpen} w={sceneW} h={sceneH} ang={ANG} />
        <div className="sfb-cap">
          <div className="sfb-cap-l">
            <h2 className="t-title" data-testid="sfb-cap-title">{b.title}</h2>
            <p className="t-meta sfb-grey">{meta(b)}</p>
          </div>
          <div className="sfb-cap-r">
            <button type="button" className="t-text sfb-ul" onClick={() => onOpen(front)}>Open the book</button>
            <p className="t-meta sfb-grey"><span className="sfb-num">{front + 1} of {n}</span> · {phone ? "Swipe the front book aside for the next" : "Pull the front book aside for the next"}</p>
          </div>
        </div>
      </div>
      {phone && <Index books={books} front={front} onPick={(i) => { row.current?.go(i); document.querySelector(".sfb-stagecol")?.scrollIntoView({ behavior: "smooth", block: "start" }) }} />}
    </main>
  )
}

function Index({ books, front, onPick }: { books: SiteBook[]; front: number; onPick: (i: number) => void }) {
  const many = books.length >= 12
  const item = (b: SiteBook, i: number) => (
    <li key={b.id}>
      <button type="button" className={i === front ? "sfb-ix is-on" : "sfb-ix"} aria-current={i === front || undefined} onClick={() => onPick(i)}>
        <span className="t-text">{b.title}</span><span className="t-meta sfb-num">{many ? sizeOf(b) : b.year}</span>
      </button>
    </li>
  )
  const all = books.map((b, i) => [b, i] as const)
  return (
    <div className={many ? "sfb-index is-many" : "sfb-index"} data-testid="sfb-index">
      <p className="t-meta sfb-grey sfb-index-h">{books.length} books</p>
      {many
        ? [...new Set(books.map((b) => b.year))].sort((a, c) => c - a).map((y) => (
          <div key={y} className="sfb-year">
            <p className="t-meta sfb-grey sfb-num">{y}</p>
            <ol>{all.filter(([b]) => b.year === y).map(([b, i]) => item(b, i))}</ol>
          </div>
        ))
        : <ol>{all.map(([b, i]) => item(b, i))}</ol>}
    </div>
  )
}

function BookPage({ books, i, onOpen, onAll, w, h, phone }: {
  books: SiteBook[]; i: number; onOpen: (i: number) => void; onAll: () => void; w: number; h: number; phone: boolean
}) {
  const b = books[i], n = books.length
  const [view, setView] = React.useState(0)
  // closed, the book is held in 3D (Held below); opening turns it to face you, then the reader turns the cover
  const [held, setHeld] = React.useState(true)
  const wasOpen = React.useRef(false)
  const openBook = () => { wasOpen.current = true; setHeld(false); requestAnimationFrame(() => requestAnimationFrame(() => setView(1))) }
  React.useEffect(() => {
    if (held || view !== 0) return
    const t = setTimeout(() => setHeld(true), 1100); return () => clearTimeout(t)
  }, [held, view])
  const last = viewsOf(b) - 1
  const col = (w - 48 - 11 * 16) / 12
  const areaW = col * 8 + 7 * 16 - 40, areaH = Math.max(320, h - 56 - 40 - 120)
  // one px-per-cm for every book, so a small book reads small; the phone gives the reader the full width
  const sr = Math.min(areaW / 60, areaH / 31)
  const W = phone ? w - 32 - 28 : Math.round(2 * b.w * sr)
  const m = phone ? Math.min(1.7, ((w - 32) * 0.66) / (W / 2)) : 1
  const [openReq, setOpenReq] = React.useState(0)
  const prev = books[(i - 1 + n) % n], next = books[(i + 1) % n]
  return (
    <main className="sfb-bookpage" data-testid="sfb-book" data-book={b.id}>
      <div className="sfb-bk-text">
        {n > 1 && <button type="button" className="t-text sfb-link" onClick={onAll}>All books</button>}
        <h1 className="t-title">{b.title}</h1>
        <p className="t-lead">{plain(b.statement)}</p>
        <p className="t-meta sfb-grey">{meta(b)}</p>
      </div>
      <div className="sfb-bk-reader" style={{ minHeight: phone ? Math.round((b.h * W) / 2 / b.w * m) + 64 : areaH }}>
        {held && view === 0
          ? <Held b={b} W={W} m={m} flat={wasOpen.current} req={openReq} onOpen={openBook} />
          : <BookReader b={b} view={view} onView={setView} width={W} leaf="paper" turnMs={900} corner={phone ? 0 : 72} />}
      </div>
      <div className="sfb-bk-ctrl">
        <button type="button" className="t-text sfb-ul" onClick={() => (view !== 0 ? setView(0) : held ? setOpenReq(openReq + 1) : openBook())} data-testid="sfb-open">{view === 0 ? "Open the book" : "Close the book"}</button>
        <p className="t-meta sfb-grey"><span className="sfb-num">{viewLabel(b, view)}</span>{view === 0 ? (phone ? " · turn it with a finger" : " · drag to turn it in your hand") : view < last ? " · drag a page or use the arrow keys" : ""}</p>
      </div>
      {n > 1 && (
        <nav className="sfb-pn" aria-label="Other books">
          <button type="button" className="sfb-pn-b" onClick={() => onOpen((i - 1 + n) % n)}><span className="t-meta sfb-grey">Previous book</span><span className="t-text">{prev.title}</span></button>
          <button type="button" className="sfb-pn-b is-next" onClick={() => onOpen((i + 1) % n)}><span className="t-meta sfb-grey">Next book</span><span className="t-text">{next.title}</span></button>
        </nav>
      )}
    </main>
  )
}

/** The closed book in the hand: Book3D at the row's three-quarter turn. Drag turns it around its spine axis (it stays
   where you leave it); a click or Enter opens it: it turns to face you, then the reader takes over at the cover. */
function Held({ b, W, m, flat, req, onOpen }: { b: SiteBook; W: number; m: number; flat: boolean; req: number; onOpen: () => void }) {
  const s = W / 2 / b.w, H = b.h * s
  const [ry, setRy] = React.useState(flat ? 0 : ANG)
  /** the phone holds the book larger (m) than the reader's cover and lets it settle to that size as it opens */
  const [scale, setScale] = React.useState(flat ? 1 : m)
  const [grab, setGrab] = React.useState(false)
  const opening = React.useRef(false)
  // back from the reader (closed by the visitor) it arrives facing you and settles into the three-quarter turn
  React.useEffect(() => {
    if (!flat) return
    const r = requestAnimationFrame(() => { setRy(ANG); setScale(m) }); return () => cancelAnimationFrame(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat])
  const ptr = React.useRef<{ id: number; x0: number; ry0: number; on: boolean } | null>(null)
  const live = React.useRef(ry); live.current = ry
  const open = () => {
    if (opening.current) return
    opening.current = true
    const r = live.current, face = ((r % 360) + 540) % 360 - 180
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    setRy(r - face); setScale(1)
    setTimeout(onOpen, reduce || (Math.abs(face) < 2 && m === 1) ? 0 : 520)
  }
  // "Open the book" outside the book asks through `req`
  const req0 = React.useRef(req)
  React.useEffect(() => { if (req !== req0.current) open() }, [req]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={grab ? "sfb-held is-grab" : "sfb-held"} style={{ width: W, height: H * m, "--m": scale, "--hm": `${(H * m - H) / 2}px` } as React.CSSProperties} data-testid="sfb-held"
      role="button" tabIndex={0} aria-label={`${b.title}. Open the book`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open() } }}
      onPointerDown={(e) => { if (e.button === 0) ptr.current = { id: e.pointerId, x0: e.clientX, ry0: ry, on: false } }}
      onPointerMove={(e) => {
        const p = ptr.current; if (!p || p.id !== e.pointerId) return
        const dx = e.clientX - p.x0
        if (!p.on) { if (Math.abs(dx) < 6) return; p.on = true; setGrab(true); e.currentTarget.setPointerCapture(e.pointerId) }
        setRy(p.ry0 + dx * 0.45)
      }}
      onPointerUp={(e) => { const p = ptr.current; ptr.current = null; setGrab(false); if (p && p.id === e.pointerId && !p.on) open() }}
      onPointerCancel={() => { ptr.current = null; setGrab(false) }}>
      <div className="sfb-held-in" style={{ left: (W - b.w * s) / 2, width: b.w * s, height: H }}>
        <Book3D b={b} s={s} pose={{ ry, rx: -6 }} />
      </div>
    </div>
  )
}

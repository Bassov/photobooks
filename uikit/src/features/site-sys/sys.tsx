/* site-sys shared parts (Designer spec-sys.md "Shared for 6–12", rules in system.md): the 12-col grid, Head (phone: Menu),
   the demo-only books switch, BookPage (cover, title, meta, statement, "Open the book"; the reader opens in place), About /
   Contact, All books, and SysSite: the shell every demo 6–9 renders its home into. Data, Book3D and the reader come from
   site-demo-1; `?books=1|3|6|12` from the v2 work. 1 book = BookPage as the home page. */
import * as React from 'react'
import { Book3D } from '../site-demo-1/book3d'
import { AUTHOR, EMAIL, pagesOf, SPREAD_R, viewLabel, viewsOf, type SiteBook } from '../site-demo-1/data'
import { BookReader, type ReaderApi } from '../site-demo-1/reader'
import { COUNTS, metaOf, reduced, useBooks, useBox, type Box } from '../site-demo-1/v2'
import '../site-demo-1/site.css'
import './system.css'

export { metaOf, reduced, useBooks, type Box }
export const LEAD = 'Photographs of lakes, coasts and the people I travel with, made into books.'
const ABOUT = 'I make one or two books a year from the trips I take and the people I take them with. Each is printed and bound by hand in a small run.'
const PLACE = 'Based in Tbilisi, working wherever the road goes.'

export type Grid = { narrow: boolean; M: number; G: number; C: number; cw: number; x: (n: number) => number; span: (n: number) => number }
/** desktop 12 cols, margin 24, gutter 16; ≤ 640 px 4 cols, 16 / 12 */
export const gridOf = (box: Box): Grid => {
  const narrow = box.narrow, M = narrow ? 16 : 24, G = narrow ? 12 : 16, C = narrow ? 4 : 12
  const cw = (box.w - 2 * M - (C - 1) * G) / C
  return { narrow, M, G, C, cw, x: (n) => M + n * (cw + G), span: (n) => n * cw + (n - 1) * G }
}
/** px per cm so the largest book of the set fits `w` × `h` (honest relative sizes) */
export const fitScale = (books: SiteBook[], w: number, h: number) =>
  Math.min(w / Math.max(...books.map((b) => b.w)), h / Math.max(...books.map((b) => b.h)))

/** "… *the water, the roads between,* …" → the starred part in grey (emphasis = the second colour) */
export function Statement({ s }: { s: string }) {
  return <>{s.split('*').map((x, i) => (i % 2 ? <span key={i} className="g">{x}</span> : x))}</>
}

type Page = 'home' | 'about' | 'contact' | 'all'
export type HomeApi = { books: SiteBook[]; box: Box; g: Grid; active: boolean; open: (b: SiteBook) => void; showAll: () => void }

/** The site shell: home (kept mounted under the book page, so the place is kept), the book page, About / Contact,
    All books, Head, the switch; Esc closes the reader → the book page → home. */
export function SysSite({ n, dark, home, testId }: { n: number; dark?: boolean; home: (h: HomeApi) => React.ReactNode; testId?: string }) {
  const books = useBooks()
  const [root, box] = useBox<HTMLDivElement>()
  const g = gridOf(box)
  const [page, setPage] = React.useState<Page>('home'), [book, setBook] = React.useState<SiteBook | null>(null)
  const [reading, setReading] = React.useState(false), [view, setView] = React.useState(0), [menu, setMenu] = React.useState(false)
  const back = React.useRef<HTMLElement | null>(null)
  const single = books.length === 1
  const open = (b: SiteBook) => {
    back.current = document.activeElement as HTMLElement | null
    setPage('home'); setBook(b); setReading(false); setView(0)
  }
  const closeBook = () => {
    setBook(null); setReading(false)
    requestAnimationFrame(() => back.current?.focus({ preventScroll: true }))
  }
  const go = (p: Page) => { setMenu(false); setBook(null); setReading(false); setPage(p) }
  React.useEffect(() => { setBook(null); setReading(false); setPage('home') }, [books])
  const esc = React.useRef(() => {})
  esc.current = () => {
    if (menu) setMenu(false)
    else if (reading) setReading(false)
    else if (book) closeBook()
    else if (page !== 'home') setPage('home')
  }
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); esc.current() } }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [])
  const covered = (!single && !!book) || page !== 'home'
  const bookPage = (b: SiteBook, i: number) => (
    <BookPage b={b} books={books} box={box} g={g} dark={dark} reading={reading} setReading={setReading} view={view} setView={setView}
      onBack={single ? undefined : closeBook} next={single ? undefined : books[(i + 1) % books.length]} onNext={open} />
  )
  return (
    <div ref={root} className={`ss${dark ? ' ss-dark' : ''}`} data-testid={testId ?? `ss${n}`} data-books={books.length}>
      <div className="ss-layer" data-off={covered ? '' : undefined} inert={covered || menu}>
        {single ? bookPage(books[0], 0) : home({ books, box, g, active: !covered && !menu, open, showAll: () => go('all') })}
      </div>
      {page !== 'home' && (
        <div className="ss-page ss-scroll" inert={menu} data-testid={`ss${n}-${page}`}>
          {page === 'all' ? <AllBooks books={books} g={g} onOpen={open} /> : <Info g={g} contact={page === 'contact'} />}
        </div>
      )}
      {!single && book && <div className="ss-page" inert={menu} key={book.id}>{bookPage(book, books.indexOf(book))}</div>}
      {menu && <Menu g={g} page={book ? 'home' : page} go={go} />}
      <Head g={g} page={book ? 'home' : page} go={go} menu={menu} setMenu={setMenu} />
      <Switch demo={n} count={books.length} g={g} />
    </div>
  )
}

function Head({ g, page, go, menu, setMenu }: { g: Grid; page: Page; go: (p: Page) => void; menu: boolean; setMenu: (on: boolean) => void }) {
  const items: [string, Page][] = [['Books', 'home'], ['About', 'about'], ['Contact', 'contact']]
  return (
    <header className={`ss-head ${g.narrow ? 'm15' : 't16'}`} style={{ left: g.M, right: g.M, top: g.narrow ? 16 : 20 }}>
      <button type="button" className="w5" onClick={() => go('home')}>{AUTHOR}</button>
      <nav>
        {g.narrow
          ? <button type="button" aria-expanded={menu} onClick={() => setMenu(!menu)} data-testid="ss-menu">{menu ? 'Close' : 'Menu'}</button>
          : items.map(([l, p]) => (
            <button key={l} type="button" className="ss-tx g" aria-current={page === p || (p === 'home' && page === 'all') ? 'page' : undefined} onClick={() => go(p)}>{l}</button>
          ))}
      </nav>
    </header>
  )
}

function Menu({ g, page, go }: { g: Grid; page: Page; go: (p: Page) => void }) {
  return (
    <div className="ss-menu" data-testid="ss-menu-list">
      <nav className="ss-menu-list ss-abs m28" style={{ left: g.M, top: 88 }}>
        {([['Books', 'home'], ['About', 'about'], ['Contact', 'contact']] as [string, Page][]).map(([l, p]) => (
          <button key={l} type="button" className={page === p ? '' : 'g'} onClick={() => go(p)}>{l}</button>
        ))}
      </nav>
    </div>
  )
}

/** "Books 1 · 3 · 6 · 12": the demo-only switch, top centre (phone: bottom right) */
function Switch({ demo, count, g }: { demo: number; count: number; g: Grid }) {
  return (
    <div className="ss-switch t13" style={g.narrow ? { left: 'auto', right: g.M, translate: 'none', bottom: 12 } : { top: 22 }} data-testid="ss-switch">
      <span>Books</span>
      {COUNTS.map((c) => (
        <a key={c} className="ss-tx" href={`#/full/site-demo-${demo}?books=${c}`} aria-current={c === count ? 'true' : undefined}>{c}</a>
      ))}
    </div>
  )
}

function Info({ g, contact }: { g: Grid; contact: boolean }) {
  const big = g.narrow ? 'm19' : 't24', txt = g.narrow ? 'm15' : 't16'
  return (
    <div className="ss-abs" style={{ left: g.x(0), top: g.narrow ? 72 : 104, width: g.narrow ? g.span(4) : g.span(5), paddingBottom: 64 }}>
      {contact ? (
        <>
          <a className={`${big} u`} href={`mailto:${EMAIL}`}>{EMAIL}</a>
          <p className={`${txt} g`} style={{ marginTop: 24 }}>Write about a book, a print or a commission. I answer within a week.</p>
        </>
      ) : (
        <>
          <p className={big}>{LEAD}</p>
          <p className={txt} style={{ marginTop: 24 }}>{ABOUT}</p>
          <p className={`${txt} g`}>{PLACE}</p>
        </>
      )}
    </div>
  )
}

/** All books (12+): a plain list, grouped by year when there are more than two years */
function AllBooks({ books, g, onOpen }: { books: SiteBook[]; g: Grid; onOpen: (b: SiteBook) => void }) {
  const years = [...new Set(books.map((b) => b.year))]
  const groups = years.length > 2 ? years.map((y) => books.filter((b) => b.year === y)) : [books]
  return (
    <div className="ss-abs" style={{ left: g.x(0), top: g.narrow ? 72 : 104, width: g.narrow ? g.span(4) : g.span(6), paddingBottom: 64 }} data-testid="ss-all">
      {groups.map((gr) => (
        <section key={gr[0].year} style={{ marginBottom: 24 }}>
          {groups.length > 1 && <h2 className="t13 g" style={{ marginBottom: 8 }}>{gr[0].year}</h2>}
          {gr.map((b) => (
            <button key={b.id} type="button" className="ss-row" onClick={() => onOpen(b)} style={{ display: 'flex', width: '100%', alignItems: 'baseline', minHeight: 44, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <span className={g.narrow ? 'm15' : 't16'}>{b.title}</span>
              <span className="t13 g" style={{ marginLeft: 'auto' }}>{pagesOf(b)} pages · {b.w} × {b.h} cm</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}
type BookPageProps = {
  b: SiteBook; books: SiteBook[]; box: Box; g: Grid; dark?: boolean
  reading: boolean; setReading: (on: boolean) => void; view: number; setView: (v: number) => void
  onBack?: () => void; next?: SiteBook; onNext: (b: SiteBook) => void
}
/** The book page (same for 6–9): cover on the left 6 columns; title t44, meta t13, statement t16, "Open the book" at
    column 7; "Open" opens the reader in place (the cover and text fade, the spread comes in and the cover opens). */
export function BookPage({ b, books, box, g, dark, reading, setReading, view, setView, onBack, next, onNext }: BookPageProps) {
  const api = React.useRef<ReaderApi>(null), openBtn = React.useRef<HTMLButtonElement>(null), hostRef = React.useRef<HTMLDivElement>(null)
  const nar = g.narrow, top = nar ? 64 : 72, foot = nar ? 104 : 96
  // cover: honest scale across the set
  const s = nar ? fitScale(books, g.span(4) * 0.66, (box.h - 360) * 0.75) : fitScale(books, g.span(6) * 0.72, box.h - 280)
  const W = b.w * s, H = b.h * s
  const cy = nar ? 0 : top + (box.h - top - 64) / 2
  // reader box
  const R = SPREAD_R[b.fmt]
  const rw = Math.max(200, Math.min(nar ? g.span(4) : g.span(10), (box.h - top - foot) * R)), rh = rw / R
  const rTop = top + (box.h - top - foot - rh) / 2
  const label = viewLabel(b, view), last = viewsOf(b) - 1
  React.useEffect(() => {
    if (!reading) { openBtn.current?.focus({ preventScroll: true }); return }
    hostRef.current?.querySelector<HTMLElement>('[role="region"]')?.focus({ preventScroll: true })
    const t = setTimeout(() => api.current?.go(1), reduced() ? 0 : 250)
    return () => clearTimeout(t)
  }, [reading])
  const text = (
    <>
      <h1 className={nar ? 'm28' : 't44'} data-testid="ss-title">{b.title}</h1>
      <p className="t13 g" style={{ marginTop: 8 }}>{metaOf(b)}</p>
      <p className={nar ? 'm15' : 't16'} style={{ marginTop: nar ? 16 : 24 }}><Statement s={b.statement} /></p>
      <button ref={openBtn} type="button" className={`${nar ? 'm15' : 't16'} u`} style={{ marginTop: 24, minHeight: 24 }} onClick={() => setReading(true)} data-testid="ss-open">Open the book</button>
    </>
  )
  const cover = (
    <button type="button" className="ss-host" aria-label={`Open ${b.title}`} onClick={() => setReading(true)} tabIndex={-1}>
      <Book3D b={b} s={s} />
    </button>
  )
  return (
    <div ref={hostRef} className="ss-layer" data-testid="ss-book" data-book={b.id} data-reading={reading ? '' : undefined}>
      <div className={`ss-fade ss-layer${nar ? ' ss-scroll' : ''}`} data-off={reading ? '' : undefined} inert={reading}>
        {nar ? (
          <div style={{ padding: `${top + 24}px ${g.M}px 64px` }}>
            <div style={{ display: 'grid', placeItems: 'center', height: H + 32 }}>{cover}</div>
            <div style={{ marginTop: 32 }}>{text}</div>
            {onBack && <button type="button" className="m15 g ss-tx" style={{ marginTop: 40, minHeight: 44 }} onClick={onBack} data-testid="ss-back">Back</button>}
          </div>
        ) : (
          <>
            <div className="ss-abs" style={{ left: g.x(0) + g.span(6) / 2 - W / 2, top: cy - H / 2 }}>{cover}</div>
            <div className="ss-abs" style={{ left: g.x(7), top: cy - H / 2, width: g.span(4) }}>{text}</div>
            <div className="ss-abs t16" style={{ left: g.M, right: g.M, bottom: 20, display: 'flex' }}>
              {onBack && <button type="button" className="g ss-tx" onClick={onBack} data-testid="ss-back">Back</button>}
              {next && next !== b && <button type="button" className="g ss-tx" style={{ marginLeft: 'auto' }} onClick={() => onNext(next)}>Next book: {next.title}</button>}
            </div>
          </>
        )}
      </div>
      {reading && (
        <div className="ss-page" style={{ zIndex: 1 }} data-testid="ss-reader-page">
          <div className="ss-abs" style={{ left: (box.w - rw) / 2, top: rTop, width: rw }} data-testid="ss-reader" data-view={view}>
            <BookReader ref={api} b={b} view={view} onView={setView} width={rw} dark={dark} />
          </div>
          <div className="ss-abs" style={{ left: g.M, right: g.M, top: rTop + rh + (nar ? 24 : 32), display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: nar ? 24 : 40 }}>
            <button type="button" className={`${nar ? 'm15' : 't16'} g ss-tx`} style={{ minHeight: 44 }} disabled={view <= 0} onClick={() => api.current?.go(-1)}>Previous</button>
            <span className="t13 g" data-testid="ss-label">{label}{label.startsWith('Page') && ` of ${pagesOf(b)}`}</span>
            <button type="button" className={`${nar ? 'm15' : 't16'} g ss-tx`} style={{ minHeight: 44 }} disabled={view >= last} onClick={() => api.current?.go(1)}>Next</button>
          </div>
          <button type="button" className={`ss-abs ${nar ? 'm15' : 't16'} g ss-tx`} style={{ left: g.M, bottom: nar ? 40 : 20, minHeight: nar ? 44 : undefined }} onClick={() => setReading(false)} data-testid="ss-close">Close the book</button>
        </div>
      )}
    </div>
  )
}

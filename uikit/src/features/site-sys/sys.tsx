/* site-sys shared parts (Designer spec-sys.md "Shared for 6–12", site-stand-v2 S): the 12-col grid, Head, the demo-only
   books switch, and SysSite: the shell every demo renders its home into. Two states (D3): home and the open book. A click
   opens the reading room (`&book=<id>` pushed, so browser Back closes it); Esc, "All books" and the site name close it and
   focus returns to the book. A deep link opens at view 1. One book keeps the demo's own home (D6). Data, Book3D and the
   reader come from site-demo-1 / site-book; `?books=1|3|6|12|30|100` from site-book/many. */
import * as React from 'react'
import { AUTHOR, pagesOf, type SiteBook } from '../site-demo-1/data'
import { COUNTS, useBooks } from '../site-book/many'
import { ReadingRoom, roomMode } from '../site-book/room'
import { metaOf, reduced, useBox, type Box } from '../site-demo-1/v2'
import '../site-demo-1/site.css'
import './system.css'

export { metaOf, reduced, useBooks, type Box }
export const LEAD = 'Photographs of lakes, coasts and the people I travel with, made into books.'

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

export type HomeApi = { books: SiteBook[]; box: Box; g: Grid; active: boolean; open: (b: SiteBook) => void; showAll: () => void }

/** `#/full/<id>?books=6&book=<id>`: the book id on the hash (full-window routes only) */
const bookOfHash = () => (/^#\/full\//.test(location.hash) ? (/[?&]book=([^&]+)/.exec(location.hash)?.[1] ?? null) : null)
const hashWith = (id: string | null) => {
  const [path, q = ''] = location.hash.split('?')
  const p = new URLSearchParams(q)
  if (id) p.set('book', id)
  else p.delete('book')
  const s = p.toString()
  return `${path}${s ? `?${s}` : ''}`
}

type Open = { b: SiteBook; pushed: boolean }

/** The site shell: home (kept mounted under the room, so the place is kept), the reading room, Head, the switch. */
export function SysSite({ n, dark, home, testId }: { n: number; dark?: boolean; home: (h: HomeApi) => React.ReactNode; testId?: string }) {
  const books = useBooks()
  const [root, box] = useBox<HTMLDivElement>()
  const g = gridOf(box)
  const find = (id: string | null) => books.find((b) => b.id === id) ?? null
  // a deep link opens at view 1, without the cover turn
  const [cur, setCur] = React.useState<Open | null>(() => { const b = find(bookOfHash()); return b ? { b, pushed: false } : null })
  const [view, setView] = React.useState(1)
  const [list, setList] = React.useState(false)
  const trigger = React.useRef<HTMLElement | null>(null)
  // a new count closes the book
  const [seen, setSeen] = React.useState(books)
  if (seen !== books) { setSeen(books); setCur(null); setList(false) }

  const refocus = (id: string) => requestAnimationFrame(() => {
    const el = trigger.current?.isConnected ? trigger.current : [...(root.current?.querySelectorAll<HTMLElement>(`button[data-id="${id}"]`) ?? [])].find((b) => b.offsetParent)
    el?.focus({ preventScroll: true })
    trigger.current = null
  })
  const open = (b: SiteBook) => {
    trigger.current = document.activeElement as HTMLElement | null
    const url = /^#\/full\//.test(location.hash)
    if (url) history.pushState(history.state, '', hashWith(b.id))
    setList(false); setView(reduced() ? 1 : 0); setCur({ b, pushed: url })
  }
  const shut = (id: string) => { setCur(null); refocus(id) }
  const close = () => {
    if (!cur) return
    if (cur.pushed) history.back()
    else {
      if (bookOfHash()) history.replaceState(history.state, '', hashWith(null))
      shut(cur.b.id)
    }
  }
  // browser Back / Forward: the hash decides
  const live = React.useRef({ cur, find, shut })
  live.current = { cur, find, shut }
  React.useEffect(() => {
    const pop = () => {
      const { cur: c, find: f, shut: s } = live.current, b = f(bookOfHash())
      if (!b && c) s(c.b.id)
      else if (b && b !== c?.b) { setView(1); setCur({ b, pushed: false }) }
    }
    addEventListener('popstate', pop); return () => removeEventListener('popstate', pop)
  }, [])
  const esc = React.useRef(() => {})
  esc.current = () => { if (cur) close(); else if (list) setList(false) }
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); esc.current() } }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [])
  const covered = !!cur || list
  // a phone room has its own header (site-stand-v5 D24); a swipe back peeks at the home under it (D25)
  const phoneRoom = !!cur && roomMode(box) !== 'desk'
  const [peek, setPeek] = React.useState(false)
  if (peek && !cur) setPeek(false)
  return (
    <div ref={root} className={`ss${dark ? ' ss-dark' : ''}`} data-testid={testId ?? `ss${n}`} data-books={books.length} data-open={cur?.b.id}>
      <div className="ss-layer" data-off={covered && !peek ? '' : undefined} inert={covered}>
        {home({ books, box, g, active: !covered, open, showAll: () => setList(true) })}
      </div>
      {list && !cur && (
        <div className="ss-page ss-scroll" data-testid={`ss${n}-list`}>
          <AllBooks books={books} g={g} onOpen={open} />
        </div>
      )}
      {cur && <ReadingRoom key={cur.b.id} b={cur.b} view={view} setView={setView} dark={dark} box={box} onClose={close} onPeek={setPeek} />}
      {!phoneRoom && <Head g={g} reading={!!cur} onHome={() => (cur ? close() : setList(false))} />}
      {!phoneRoom && <Switch demo={n} count={books.length} g={g} />}
    </div>
  )
}

/** the name left (home); right, in the reader only: "All books" */
function Head({ g, reading, onHome }: { g: Grid; reading: boolean; onHome: () => void }) {
  return (
    <header className={`ss-head ${g.narrow ? 'm15' : 't16'}`} style={{ left: g.M, right: g.M, top: g.narrow ? 16 : 20 }}>
      <button type="button" className="w5" style={{ minHeight: 24 }} onClick={onHome}>{AUTHOR}</button>
      {reading && (
        <nav>
          <button type="button" className="ss-tx g" style={{ minHeight: g.narrow ? 44 : 24, marginTop: g.narrow ? -10 : 0 }} onClick={onHome} data-testid="ss-all">All books</button>
        </nav>
      )}
    </header>
  )
}

/** "Books 1 · 3 · 6 · 12 · 30 · 100": the demo-only switch, top centre (phone: bottom right) */
function Switch({ demo, count, g }: { demo: number; count: number; g: Grid }) {
  // the phone reader mode (v6 D27) survives a books switch
  const turn = /[?&]reader=turn(&|$)/.test(location.hash) ? '&reader=turn' : ''
  return (
    <div className="ss-switch t13" style={g.narrow ? { left: 'auto', right: g.M, translate: 'none', bottom: 12 } : { top: 22 }} data-testid="ss-switch">
      <span>Books</span>
      {COUNTS.map((c) => (
        <a key={c} className="ss-tx" href={`#/full/site-demo-${demo}?books=${c}${turn}`} aria-current={c === count ? 'true' : undefined}>{c}</a>
      ))}
    </div>
  )
}

/** the plain list some homes link to (12+), grouped by year when there are more than two years */
function AllBooks({ books, g, onOpen }: { books: SiteBook[]; g: Grid; onOpen: (b: SiteBook) => void }) {
  const years = [...new Set(books.map((b) => b.year))]
  const groups = years.length > 2 ? years.map((y) => books.filter((b) => b.year === y)) : [books]
  return (
    <div className="ss-abs" style={{ left: g.x(0), top: g.narrow ? 72 : 104, width: g.narrow ? g.span(4) : g.span(6), paddingBottom: 64 }}>
      {groups.map((gr) => (
        <section key={gr[0].year} style={{ marginBottom: 24 }}>
          {groups.length > 1 && <h2 className="t13 g" style={{ marginBottom: 8 }}>{gr[0].year}</h2>}
          {gr.map((b) => (
            <button key={b.id} type="button" className="ss-row" onClick={() => onOpen(b)} data-id={b.id} style={{ display: 'flex', width: '100%', alignItems: 'baseline', minHeight: 44, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <span className={g.narrow ? 'm15' : 't16'}>{b.title}</span>
              <span className="t13 g" style={{ marginLeft: 'auto' }}>{pagesOf(b)} pages · {b.w} × {b.h} cm</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  )
}

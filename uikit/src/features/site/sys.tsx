/* Personal site shell (stand site-sys, Designer spec-sys.md, site-stand-v2 S; personal-site K1): the 12-col grid, Head and
   SysSite, the shell the home renders into. Two states (D3): home and the open book. A click opens the reading room
   (`&book=<id>` pushed, so browser Back closes it); Esc, "All books" and the site name close it and focus returns to the
   book. A deep link opens on the cover (D41 / D42); a tap turns it. Data and art come from ./sample, Book3D and the reader from site-book;
   `?books=1|3|6|12|30|100` from site-book/many (the kit page's scenario switch sets it, D35), or `books` (#/demo, K2). */
import * as React from 'react'
import { AUTHOR, SAMPLE_SITE_TEXTS, metaOf, pagesOf, siteLead, type SiteBook, type SiteTexts } from './sample'
import { reduced, useBox, type Box } from '../site-book/box'
import { useBooks } from '../site-book/many'
import { ReadingRoom, roomMode, type RoomKeys } from '../site-book/room'
import './base.css'
import './system.css'

export { metaOf, reduced, useBooks, type Box }

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

export type HomeApi = { books: SiteBook[]; box: Box; g: Grid; active: boolean; open: (b: SiteBook) => void; showAll: () => void
  /** D37: the home lead; null = no lead */ lead: string | null }

/** site-stand-v7 F: the browser bars (html, body, theme-color) take the site's paper colour; restored on leaving */
function usePaperBars(root: React.RefObject<HTMLDivElement | null>) {
  React.useLayoutEffect(() => {
    if (!root.current) return
    const bg = getComputedStyle(root.current).backgroundColor
    const html = document.documentElement, body = document.body
    const was = { html: html.style.background, body: body.style.background }
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const made = !meta, content = meta?.content ?? ''
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta) }
    html.style.background = bg; body.style.background = bg; meta.content = bg
    return () => {
      html.style.background = was.html; body.style.background = was.body
      if (made) meta.remove()
      else meta.content = content
    }
  }, [root])
}

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

/** `turn`: a tap opened it, so the closed cover turns (D23); a deep link rests on the cover (D41 / D42) */
type Open = { b: SiteBook; pushed: boolean; turn?: boolean }
/** open this book at mount, at `view` (default 0 = the cover, no cover turn); `full` = the lightbox open at that zoom */
export type SiteStart = { book: string; view?: number; full?: number }
export type SiteProps = {
  /** the books (#/demo: the session's published books); default the `?books=` sample */
  books?: SiteBook[]
  start?: SiteStart
  /** the open room's keys (the #/demo Preview routes ← / → here past its key guard) */
  roomRef?: React.Ref<RoomKeys>
  /** the editor Preview (D45): the start room only; no "All books", Share or home, the name is plain text */
  preview?: boolean
  /** Settings → Site (#/demo: the session's); default the sample */
  texts?: SiteTexts
}

/** The site shell: home (kept mounted under the room, so the place is kept), the reading room, Head. */
export function SysSite({ home, books: given, start, roomRef, preview, texts = SAMPLE_SITE_TEXTS }: SiteProps & { home: (h: HomeApi) => React.ReactNode }) {
  const sample = useBooks(), books = given ?? sample
  const [root, box] = useBox<HTMLDivElement>()
  const g = gridOf(box)
  usePaperBars(root)
  // the phone home draws the name itself (site-stand-v7 D32)
  const bare = g.narrow
  const find = (id: string | null) => books.find((b) => b.id === id) ?? null
  // a deep link opens on the cover, without the cover turn (prod D41 / D42)
  const [cur, setCur] = React.useState<Open | null>(() => { const b = find(bookOfHash()) ?? find(start?.book ?? null); return b ? { b, pushed: false } : null })
  const [view, setView] = React.useState(start?.view ?? 0)
  // the start lightbox opens with the first room only
  const [full, setFull] = React.useState(cur ? start?.full : undefined)
  const [list, setList] = React.useState(false)
  const trigger = React.useRef<HTMLElement | null>(null)
  // a new set of books closes the book; an edit to the open one (a fresh object) keeps it open
  const ids = books.map((b) => b.id).join("\n")
  const [seen, setSeen] = React.useState(ids)
  if (seen !== ids) { setSeen(ids); setCur(null); setList(false) }
  const curB = cur ? find(cur.b.id) ?? cur.b : null

  const refocus = (id: string) => requestAnimationFrame(() => {
    const el = trigger.current?.isConnected ? trigger.current : [...(root.current?.querySelectorAll<HTMLElement>(`button[data-id="${id}"]`) ?? [])].find((b) => b.offsetParent)
    el?.focus({ preventScroll: true })
    trigger.current = null
  })
  const open = (b: SiteBook) => {
    trigger.current = document.activeElement as HTMLElement | null
    const url = /^#\/full\//.test(location.hash)
    if (url) history.pushState(history.state, '', hashWith(b.id))
    setList(false); setView(reduced() ? 1 : 0); setCur({ b, pushed: url, turn: true })
  }
  const shut = (id: string) => { setCur(null); setFull(undefined); refocus(id) }
  const close = () => {
    if (!cur || preview) return
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
      else if (b && b !== c?.b) { setView(0); setCur({ b, pushed: false }) }
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
    <div ref={root} className="ss" data-testid="site" data-books={books.length} data-open={cur?.b.id}>
      <div className="ss-layer" data-off={covered && !peek ? '' : undefined} inert={covered}>
        {home({ books, box, g, active: !covered, open, showAll: () => setList(true), lead: siteLead(texts) })}
      </div>
      {list && !cur && (
        <div className="ss-page ss-scroll" data-testid="site-list">
          <AllBooks books={books} g={g} onOpen={open} />
        </div>
      )}
      {curB && <ReadingRoom key={curB.id} ref={roomRef} b={curB} view={view} setView={setView} box={box} onClose={close} onPeek={setPeek} full={full} share={!preview} turn={!!cur?.turn} />}
      {!phoneRoom && !(bare && !cur) && <Head g={g} reading={!!cur} preview={preview} onHome={() => (cur ? close() : setList(false))} />}
    </div>
  )
}

/** the name left (home); right, in the reader only: "All books" */
function Head({ g, reading, preview, onHome }: { g: Grid; reading: boolean; preview?: boolean | undefined; onHome: () => void }) {
  return (
    <header className={`ss-head ${g.narrow ? 'm15' : 't16'}`} style={{ left: g.M, right: g.M, top: g.narrow ? 16 : 20 }}>
      {preview
        ? <span className="w5" style={{ lineHeight: '24px' }}>{AUTHOR}</span>
        : <button type="button" className="w5" style={{ minHeight: 24 }} onClick={onHome} aria-current={reading ? undefined : 'page'}>{AUTHOR}</button>}
      {reading && !preview && (
        <nav>
          <button type="button" className="ss-tx g" style={{ minHeight: g.narrow ? 44 : 24, marginTop: g.narrow ? -10 : 0 }} onClick={onHome} data-testid="site-all-books">All books</button>
        </nav>
      )}
    </header>
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

/* Photographer site, demo 5 v2 "Shelf" (Spec site-awards-v2 §5): one long shelf. The newest book stands face-out at the
   left (Book3D ry −8), the others spine-out at true height (spine width = thickness × 2.6), then a bookend. Hover / focus
   slides only that spine up 14 px; the caption beside the shelf changes (crossfade 160 ms); nothing else moves. A click lifts
   the book out of the row, turns its cover to the viewer and flies it to the reader, where the cover opens.
   12 books: two shelves; 1 book: a short shelf with the title at left. Phone ≤ 640: shelves fit the screen at 10 px/cm,
   up to 8 spines each; the first tap pulls a spine (the caption shows), the second opens. `?books=1|3|6|12`. */
import * as React from "react"
import { Book3D, SPINE_SHADE, thick } from "../site-demo-1/book3d"
import { EMAIL, pad2, type SiteBook } from "../site-demo-1/data"
import { BooksSwitch, clamp, countLabel, coverAt, Header, metaOf, ReaderPage, reduced, Statement, useBooks, useBox, type Box } from "../site-demo-1/v2"
import "./site.css"

const INTRO = "I make photobooks about lakes, coasts and *the people I travel with.*"
const ABOUT = "I make books of the trips I take and the people I take them with, printed and bound by hand. *Based in Tbilisi.*"
const GAP = 3, END = 10, INSET = 24
const rad = (d: number) => (d * Math.PI) / 180

type Item = { i: number; face: boolean; w: number }
type Shelf = { x: number; y: number; w: number; h: number; items: Item[] }
type L = { box: Box; k: number; s: number; shelves: Shelf[] }
const spineW = (b: SiteBook, s: number) => Math.round(thick(b, s) * 2.6)
/** the face-out slot: the Book3D box turned −8° */
const faceW = (b: SiteBook, s: number) => Math.round(b.w * s * Math.cos(rad(8)) + thick(b, s) * Math.sin(rad(8))) + 4
const itemOf = (books: SiteBook[], i: number, s: number): Item => ({ i, face: i === 0, w: i === 0 ? faceW(books[0], s) : spineW(books[i], s) })
const rowH = (books: SiteBook[], items: Item[], s: number) => Math.max(150, ...items.map((it) => books[it.i].h * s))

function layoutOf(box: Box, books: SiteBook[]): L {
  const n = books.length
  if (box.narrow) {
    // phone: greedy rows that fit the screen, ≤ 8 spines a shelf
    const s = 10, w = box.w - 40, room = w - INSET * 2 - END
    const rows: Item[][] = [[]]
    let used = 0
    books.forEach((_, i) => {
      const it = itemOf(books, i, s), row = rows[rows.length - 1]
      if (row.length && (used + it.w > room || row.filter((x) => !x.face).length >= 8)) { rows.push([]); used = 0 }
      rows[rows.length - 1].push(it); used += it.w + GAP
    })
    return { box, k: 1, s, shelves: rows.map((items) => ({ x: 20, y: 0, w, h: rowH(books, items, s), items })) }
  }
  const k = clamp(Math.min(box.w / 1440, box.h / 900), 0.6, 1.4)
  const s = (n === 1 ? 16 : n > 6 ? 9.5 : 13) * k
  if (n === 1) {
    const items = [itemOf(books, 0, s)], w = items[0].w + INSET * 2 + 64 + END
    return { box, k, s, shelves: [{ x: Math.round(Math.max(600 * k, box.w * 0.62 - w / 2)), y: Math.round(700 * k), w, h: rowH(books, items, s), items }] }
  }
  const x = Math.round(530 * k), w = box.w - 30 - x
  const all = books.map((_, i) => itemOf(books, i, s))
  const rows = n > 6 ? [all.slice(0, 1 + Math.ceil((n - 1) / 2)), all.slice(1 + Math.ceil((n - 1) / 2))] : [all]
  const ys = n > 6 ? [450, 830] : [700]
  return { box, k, s, shelves: rows.map((items, r) => ({ x, y: Math.round(ys[r] * k), w, h: rowH(books, items, s), items })) }
}

type From = { cx: number; cy: number; sx: number; ry: number }
type Open = { i: number; phase: "fly" | "read" | "back"; from: From }

export function SiteDemo5() {
  const books = useBooks()
  return <Shelf key={books.length} books={books} />
}

function Shelf({ books }: { books: SiteBook[] }) {
  const [root, box] = useBox<HTMLDivElement>()
  const opener = React.useRef<HTMLElement | null>(null), timer = React.useRef(0)
  const [open, setOpen] = React.useState<Open | null>(null)
  const [view, setView] = React.useState(0)
  const [ptr, setPtr] = React.useState(-1), [foc, setFoc] = React.useState(-1), [sel, setSel] = React.useState(-1)
  const [about, setAbout] = React.useState(false)
  const live = React.useRef({ open, view }); live.current = { open, view }
  const l = layoutOf(box, books), n = books.length
  const later = (ms: number, f: () => void) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(f, ms) }
  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  /** the pulled book: the open one, else the pointer's, else the focused one (phone: the tapped one) */
  const hov = open ? open.i : box.narrow ? sel : ptr >= 0 ? ptr : foc

  const openBook = (i: number, el: HTMLElement) => {
    if (live.current.open) return
    opener.current = el; setView(0); setSel(i)
    const R = root.current!.getBoundingClientRect(), r = el.getBoundingClientRect(), face = i === 0
    const from = { cx: r.left - R.left + r.width / 2, cy: r.top - R.top + r.height / 2 - (face ? 14 : 44), sx: face ? 1 : r.width / thick(books[i], l.s), ry: face ? -8 : 90 }
    if (reduced()) { setOpen({ i, phase: "read", from }); return }
    setOpen({ i, phase: "fly", from })
    later(680, () => setOpen((o) => o && { ...o, phase: "read" }))
  }
  // the reader is where the flown book landed: the cover opens
  React.useEffect(() => {
    if (open?.phase !== "read") return
    const r = requestAnimationFrame(() => setView((v) => (v === 0 ? 1 : v))); return () => cancelAnimationFrame(r)
  }, [open?.phase])
  /** the book closes, then flies back to its place on the shelf */
  const close = React.useCallback(() => {
    const { open: o, view: v } = live.current; if (!o || o.phase === "back") return
    const back = () => { if (reduced()) { setOpen(null); return } setOpen({ ...o, phase: "back" }); later(680, () => setOpen(null)) }
    if (o.phase === "fly") { back(); return }
    setView(0)
    later(reduced() ? 170 : v === 1 ? 1020 : v === 0 ? 0 : 260, back)
  }, [])
  React.useEffect(() => {
    if ((open === null || open.phase === "back") && opener.current) { opener.current.focus({ preventScroll: true }); opener.current = null }
  }, [open])
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && live.current.open) { e.preventDefault(); close() } }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [close])

  const pick = (i: number, el: HTMLElement) => { if (box.narrow && sel !== i) setSel(i); else openBook(i, el) }
  const openAt = (i: number) => { const el = root.current?.querySelector<HTMLElement>(`[data-testid="sd5-book"][data-id="${books[i]?.id}"]`); if (el) openBook(i, el) }
  const reading = open !== null && open.phase !== "back", ob = open ? books[open.i] : null
  const nav = [
    { label: "Shelf", href: "#/full/site-demo-5", current: !about, onClick: () => setAbout(false) },
    { label: "About", pressed: about, onClick: () => setAbout((a) => !a) },
    { label: "Contact", href: `mailto:${EMAIL}` },
  ]
  const shelves = l.shelves.map((sh, r) => (
    <ShelfRow key={r} sh={sh} books={books} s={l.s} narrow={box.narrow} hov={hov} open={open}
      onPtr={(i) => setPtr(i)} onFoc={setFoc} onPick={pick} />
  ))
  return (
    <div ref={root} className={`sv2${box.narrow ? " sv2-narrow" : ""}`} data-surface="site-demo-5" data-allow-border data-open={reading || undefined} data-testid="sd5-root">
      <div className="sv5-home">
        <div className="sv2-scroll" onClick={(e) => { if (box.narrow && !(e.target as HTMLElement).closest("button, a")) setSel(-1) }}>
          <Header items={nav} narrow={box.narrow} />
          {box.narrow ? (
            <div style={{ padding: "96px 20px 160px" }}>
              <p className="sv2-intro"><Statement s={about ? ABOUT : INTRO} /></p>
              <p className="sv2-meta" style={{ marginTop: 12 }}>{countLabel(n)} · tap a spine to pull it out</p>
              {shelves}
            </div>
          ) : (
            <>
              <p className="sv2-intro sv2-abs" style={{ left: 48, top: Math.round(150 * l.k), width: Math.min(520, l.shelves[0].x - 88) }}><Statement s={about ? ABOUT : INTRO} /></p>
              {n === 1 ? <One b={books[0]} top={Math.round(420 * l.k)} width={Math.min(380, l.shelves[0].x - 88)} onOpen={() => openAt(0)} />
                : <Caption b={hov >= 0 ? books[hov] : null} i={hov} n={n} top={Math.round(560 * l.k)} />}
              {shelves}
            </>
          )}
        </div>
        {box.narrow && sel >= 0 && !open && (
          <div className="sv5-sheet" data-testid="sd5-sheet">
            <div key={sel} className="sv2-fade">
              <div className="sv2-num">{pad2(sel + 1)} / {pad2(n)}</div>
              <div className="sv5-cap-t" style={{ fontSize: 26 }}>{books[sel].title}</div>
              <div className="sv2-meta">{metaOf(books[sel])}</div>
              <button type="button" className="sv2-link" style={{ fontSize: 15, marginTop: 10 }} onClick={() => openAt(sel)}>Open the book</button>
            </div>
          </div>
        )}
      </div>
      {open && open.phase !== "read" && <FlyBook key={open.phase} b={books[open.i]} s={l.s} from={open.from} to={coverAt(box, books[open.i])} toReader={open.phase === "fly"} />}
      {ob && open?.phase === "read" && (
        <ReaderPage n={5} b={ob} box={box} view={view} onView={setView} onClose={close} back="Back to the shelf" className="sv5-read" />
      )}
      <BooksSwitch demo={5} n={n} />
      <div className="sd-grain" aria-hidden />
    </div>
  )
}

/** rest: "6 books" / "Point at a book" / "Click to take it off the shelf"; hover: "03 / 06", the title, the meta */
function Caption({ b, i, n, top }: { b: SiteBook | null; i: number; n: number; top: number }) {
  return (
    <div className="sv5-cap sv2-abs" style={{ left: 48, top }} aria-live="polite" data-testid="sd5-caption">
      <div key={b ? b.id : "rest"} className="sv2-fade">
        <div className={b ? "sv2-num" : "sv2-meta"}>{b ? `${pad2(i + 1)} / ${pad2(n)}` : countLabel(n)}</div>
        <div className="sv5-cap-t">{b ? b.title : "Point at a book"}</div>
        <div className="sv2-meta">{b ? metaOf(b) : "Click to take it off the shelf"}</div>
      </div>
    </div>
  )
}

/** one book: the title 50, its statement, the meta and the link at left */
function One({ b, top, width, onOpen }: { b: SiteBook; top: number; width: number; onOpen: () => void }) {
  return (
    <div className="sv2-abs" style={{ left: 48, top, width }}>
      <h1 className="sv2-display" style={{ fontSize: 50 }}>{b.title}</h1>
      <p className="sv2-intro" style={{ marginTop: 18 }}><Statement s={b.statement} /></p>
      <div className="sv2-meta" style={{ marginTop: 14 }}>{metaOf(b)}</div>
      <button type="button" className="sv2-link" style={{ marginTop: 18 }} onClick={onOpen}>Open the book</button>
    </div>
  )
}

type RowProps = { sh: Shelf; books: SiteBook[]; s: number; narrow: boolean; hov: number; open: Open | null; onPtr: (i: number) => void; onFoc: (i: number) => void; onPick: (i: number, el: HTMLElement) => void }
/** A shelf: the books stand on the plank from the left, then the bookend. Only the pulled one moves. */
function ShelfRow({ sh, books, s, narrow, hov, open, onPtr, onFoc, onPick }: RowProps) {
  const held = open !== null
  return (
    <div className="sv5-row" style={narrow ? { height: sh.h } : { left: sh.x, top: sh.y - sh.h, width: sh.w, height: sh.h }} onPointerLeave={() => onPtr(-1)}>
      <div className="sv5-books" style={{ paddingLeft: INSET }}>
        {sh.items.map(({ i, face, w }) => {
          const b = books[i], on = hov === i && !held, out = open?.i === i
          const common = {
            type: "button" as const, "data-testid": "sd5-book", "data-id": b.id, "aria-label": `${b.title}, ${b.year}`, "data-on": on || undefined, "data-out": out || undefined,
            tabIndex: held ? -1 : undefined,
            onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === "mouse") onPtr(i) },
            onFocus: (e: React.FocusEvent<HTMLElement>) => onFoc(e.currentTarget.matches(":focus-visible") ? i : -1), onBlur: () => onFoc(-1),
            onClick: (e: React.MouseEvent<HTMLElement>) => onPick(i, e.currentTarget),
          }
          if (face) return (
            <button key={b.id} className="sv5-face" style={{ width: w, height: b.h * s }} {...common}>
              <Book3D b={b} s={s} pose={{ ry: -8, rx: 0 }} floor={false} className="sv5-b3" />
            </button>
          )
          return (
            <button key={b.id} className="sv5-spine" style={{ width: w, height: b.h * s, background: `${SPINE_SHADE}, ${b.spine}`, color: b.spineInk }} {...common}>
              <span className="sv5-spine-t" style={{ fontSize: Math.max(11, Math.min(13, w * 0.36)) }}>{b.title}</span>
            </button>
          )
        })}
        <span className="sv5-end" aria-hidden />
      </div>
      <div className="sv5-plank" aria-hidden />
    </div>
  )
}

/** The book between the shelf and the reader: from the lifted spine (ry 90, scaled to the flat spine) to the closed cover
   in the reader (ry 0), or back. */
function FlyBook({ b, s, from, to, toReader }: { b: SiteBook; s: number; from: From; to: { cx: number; cy: number; w: number }; toReader: boolean }) {
  const [at, setAt] = React.useState(!toReader)
  React.useEffect(() => {
    let r2 = 0
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setAt(toReader)) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [toReader])
  const W = b.w * s, H = b.h * s, k = to.w / W
  const tf = at ? `translate(${to.cx - from.cx}px, ${to.cy - from.cy}px) scale(${k})` : `scale(${from.sx}, 1)`
  return (
    <div className="sv5-fly" style={{ left: from.cx - W / 2, top: from.cy - H / 2, width: W, height: H, transform: tf }} aria-hidden data-testid="sd5-fly">
      <Book3D b={b} s={s} pose={{ ry: at ? 0 : from.ry, rx: 0 }} floor={false} />
    </div>
  )
}

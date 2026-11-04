/* Photographer site, demo 5 "Spines" (Designer Spec site-awards-5, Direction 5): a bookcase. The six books stand spine-out,
   packed tight, at their true height and thickness (Book3D s 17, ry 86). Hover or focus pulls one out (ry 26, lift 22,
   ×1.04), the neighbours lean, the page takes the book's colour and its title runs huge behind the row; ← / → walk the
   row. A click turns the book to its face and flies it to the reader (600 ms), the others slide out, the page tints to
   the book page colour (700 ms) and the cover opens. Narrow (< 768): the row scrolls (snap per book); tap pulls, tap opens. */
import * as React from "react"
import { Book3D, thick } from "../site-demo-1/book3d"
import { AUTHOR, BOOKS, EMAIL, pad2, pagesOf, type SiteBook } from "../site-demo-1/data"
import "../site-demo-1/site.css"
import { BookPage, layoutOf, pageBg, readerBox, reduced, type L5 } from "./book"
import "./site.css"

const ABOUT = "I make books of the trips I take and the people I take them with, printed and bound by hand. Based in Tbilisi."
const BASE = "#EFEDE8"
const rad = (d: number) => (d * Math.PI) / 180
/** the slot a book takes in the row at turn ry: W·cos ry + T·sin ry */
const slotW = (b: SiteBook, s: number, ry: number) => b.w * s * Math.cos(rad(ry)) + thick(b, s) * Math.sin(rad(ry))
/** the first word of the title, for the word behind the row ("Summer, family" → "Summer") */
const word = (b: SiteBook) => b.title.split(",")[0]
type Open = { i: number; phase: "fly" | "read" | "back"; fly?: string }

export function SiteDemo5() {
  const root = React.useRef<HTMLDivElement>(null), row = React.useRef<HTMLDivElement>(null)
  const opener = React.useRef<HTMLElement | null>(null)
  const timer = React.useRef(0)
  const [box, setBox] = React.useState({ w: 1440, h: 900 })
  const [open, setOpen] = React.useState<Open | null>(null)
  const [view, setView] = React.useState(0)
  const [ptr, setPtr] = React.useState(-1), [foc, setFoc] = React.useState(-1), [sel, setSel] = React.useState(-1)
  const [about, setAbout] = React.useState(false)
  const live = React.useRef({ open, view }); live.current = { open, view }
  React.useLayoutEffect(() => {
    const el = root.current; if (!el) return
    const r = () => setBox({ w: el.clientWidth, h: el.clientHeight }); r()
    const ro = new ResizeObserver(r); ro.observe(el); return () => ro.disconnect()
  }, [])
  const l = layoutOf(box.w, box.h)
  const later = (ms: number, f: () => void) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(f, ms) }
  React.useEffect(() => () => window.clearTimeout(timer.current), [])
  /** the pulled book: the open one, else the pointer's, else the focused one (narrow: the tapped one) */
  const hov = open ? open.i : l.narrow ? (foc >= 0 ? foc : sel) : ptr >= 0 ? ptr : foc
  /** the caption keeps the last book pulled, so "Pull out" stays under the pointer */
  const onPtr = (i: number) => { setPtr(i); if (i >= 0) setSel(i) }
  const onFoc = (i: number) => { setFoc(i); if (i >= 0) setSel(i) }

  /** the book turns to its face and flies to the reader's cover: the slot scales about its bottom centre */
  const openBook = (i: number, el: HTMLElement) => {
    if (live.current.open) return
    opener.current = el; setView(0); setSel(i)
    if (reduced()) { setOpen({ i, phase: "read" }); return }
    const b = BOOKS[i], rb = readerBox(l, b), R = root.current!.getBoundingClientRect(), rr = row.current!.getBoundingClientRect()
    const bx = rr.left - R.left + el.offsetLeft - row.current!.scrollLeft + el.offsetWidth / 2, by = rr.top - R.top + el.offsetTop + el.offsetHeight
    const k = (rb.w / 2 + 5) / (b.w * l.s), tx = rb.left + rb.w / 2 + 2.5, ty = rb.top + rb.h / 2
    setOpen({ i, phase: "fly", fly: `translate(${tx - bx}px, ${ty - by + (k * b.h * l.s) / 2}px) scale(${k})` })
    later(600, () => setOpen((o) => o && { ...o, phase: "read" }))
  }
  // the reader is in place of the flown book: the cover opens
  React.useEffect(() => {
    if (open?.phase !== "read") return
    const r = requestAnimationFrame(() => setView((v) => (v === 0 ? 1 : v))); return () => cancelAnimationFrame(r)
  }, [open?.phase])
  /** the book closes, then flies back into the row (600 ms) while the others slide in */
  const close = React.useCallback(() => {
    const { open: o, view: v } = live.current; if (!o || o.phase === "back") return
    const back = () => { if (reduced()) { setOpen(null); return } setOpen({ ...o, phase: "back" }); later(600, () => setOpen(null)) }
    if (o.phase === "fly") { back(); return }
    setView(0)
    later(reduced() ? 170 : v === 1 ? 1020 : v === 0 ? 0 : 260, back)
  }, [])
  // back on the shelf: the focus returns to the book that opened
  React.useEffect(() => {
    if ((open === null || open.phase === "back") && opener.current) { opener.current.focus({ preventScroll: true }); opener.current = null }
  }, [open])
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && live.current.open) { e.preventDefault(); close(); return }
      if (live.current.open || (e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.altKey || e.ctrlKey || e.metaKey) return
      const t = document.activeElement
      if (t && t !== document.body && !(t as HTMLElement).closest?.('[data-testid="sd5-book"]')) return
      const books = [...(row.current?.querySelectorAll<HTMLElement>('[data-testid="sd5-book"]') ?? [])], at = books.indexOf(t as HTMLElement)
      const from = at >= 0 ? at : hov
      const to = from < 0 ? (e.key === "ArrowRight" ? 0 : books.length - 1) : Math.max(0, Math.min(books.length - 1, from + (e.key === "ArrowRight" ? 1 : -1)))
      e.preventDefault(); books[to]?.focus(); books[to]?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduced() ? "auto" : "smooth" })
    }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  }, [close, hov])

  const reading = open !== null && open.phase !== "back"
  const ob = open ? BOOKS[open.i] : null, hb = hov >= 0 ? BOOKS[hov] : null, lb = sel >= 0 ? BOOKS[sel] : null
  const bg = ob && reading ? pageBg(ob) : hb && !reduced() ? `color-mix(in oklab, ${hb.spine} 10%, ${BASE})` : BASE
  const pull = (i: number, el: HTMLElement) => { if (l.narrow && sel !== i) { setSel(i); el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }) } else openBook(i, el) }
  const x = l.narrow ? 20 : 48, kt = l.narrow ? 1 : Math.max(0.6, Math.min(1, l.vw / 1440))
  return (
    <div ref={root} className="relative h-full overflow-hidden" style={{ backgroundColor: bg }} data-surface="site-demo-5" data-allow-border data-open={reading || undefined} data-testid="sd5-root">
      <div className="sd5-home" inert={!!open || undefined}>
        {!l.narrow && <div className="sd5-big sd5-abs" style={{ left: -14, top: l.shelf - 317 * l.k, fontSize: 300 * l.k, opacity: hb ? 1 : 0 }} aria-hidden>{hb ? word(hb) : lb ? word(lb) : ""}</div>}
        <span className="sd5-name sd5-abs" style={{ left: x, top: l.narrow ? 22 : 32, fontSize: l.narrow ? 13 : 14 }}>{l.narrow ? "A. Basov" : AUTHOR}</span>
        {!l.narrow && (
          <nav className="sd5-k sd5-abs flex" style={{ right: 48, top: 33, gap: 28 }}>
            <a className="sd5-nav sd5-link" href="#/full/site-demo-5" aria-current={about ? undefined : "page"} onClick={(e) => { e.preventDefault(); setAbout(false) }}>Shelf</a>
            <button type="button" className="sd5-nav sd5-link" aria-pressed={about} onClick={() => setAbout((a) => !a)}>About</button>
            <a className="sd5-nav sd5-link" href={`mailto:${EMAIL}`}>Contact</a>
          </nav>
        )}
        <h1 className="sd5-head sd5-abs" style={{ left: x, top: l.narrow ? 70 : 110, fontSize: l.narrow ? 40 : 72 * kt }}>Six books<br />on one shelf.</h1>
        {!l.narrow && <p className="sd5-lede sd5-abs" style={{ right: 48, top: 116, width: l.mid ? 260 : 360 }}>{about ? ABOUT : "Lakes, coasts and the people I travel with. Pull a book out to read it."}</p>}
        <div className="sd5-shelf sd5-abs" style={{ left: l.narrow ? 0 : 48, right: l.narrow ? 0 : 48, top: l.shelf }} aria-hidden />
        <Label l={l} b={lb} i={sel} onPull={() => { const el = row.current?.querySelector<HTMLElement>(`[data-id="${lb?.id}"]`); if (el && sel >= 0) openBook(sel, el) }} />
      </div>
      <Row ref={row} l={l} hov={hov} open={open} onPtr={onPtr} onFoc={onFoc} onPull={pull} />
      {ob && open?.phase === "read" && <BookPage key={ob.id} b={ob} l={l} view={view} onView={setView} onClose={close} />}
      <div className="sd-grain" aria-hidden />
    </div>
  )
}

/** "03 — Summer, family — 2025 — 12 pp — Pull out", centred under the shelf */
function Label({ l, b, i, onPull }: { l: L5; b: SiteBook | null; i: number; onPull: () => void }) {
  if (l.narrow) return (
    <div className="sd5-k sd5-abs" style={{ left: 20, top: l.shelf + 27, lineHeight: 1.6 }}>
      {b ? `${pad2(i + 1)} — ${b.title} — ${b.year}` : "Six books"}<br /><span className="sd5-muted">Swipe the shelf · tap to pull out</span>
    </div>
  )
  return (
    <div className="sd5-k sd5-abs whitespace-nowrap" style={{ left: "50%", top: l.shelf + 33, transform: "translateX(-50%)" }} aria-live="polite" data-testid="sd5-caption">
      {b ? <>{pad2(i + 1)} — {b.title} — {b.year} — {pagesOf(b)} pp — <button type="button" className="sd5-link sd5-ul" onClick={onPull}>Pull out</button></>
        : <span className="sd5-muted">Point at a spine to pull a book out · ← / → walk the shelf</span>}
    </div>
  )
}

type RowProps = { l: L5; hov: number; open: Open | null; onPtr: (i: number) => void; onFoc: (i: number) => void; onPull: (i: number, el: HTMLElement) => void }
/** The packed row: each slot is as wide as the turned book; the pulled one lifts, its neighbours lean from the bottom. */
const Row = React.forwardRef<HTMLDivElement, RowProps>(function Row({ l, hov, open, onPtr, onFoc, onPull }, ref) {
  const still = reduced()
  return (
    <div ref={ref} className={l.narrow ? "sd5-row sd5-row-narrow no-scrollbar" : "sd5-row"} style={{ top: 0, height: l.shelf }} onPointerLeave={() => onPtr(-1)} inert={(open && open.phase !== "back") || undefined}>
      {BOOKS.map((b, i) => {
        const pulled = i === hov && !still, ry = open?.i === i && open.phase !== "back" ? 0 : pulled ? 26 : 86
        const d = i - hov, lean = hov < 0 || still || d === 0 ? 0 : Math.sign(d) * (Math.abs(d) === 1 ? 3 : 1)
        const fly = open && open.phase !== "back" ? (open.i === i ? open.fly : `translateX(${Math.sign(i - open.i) * l.vw}px)`) : undefined
        const tf = fly ?? (pulled ? "translateY(-22px) scale(1.04)" : lean ? `rotate(${lean}deg)` : "none")
        return (
          <button key={b.id} type="button" className="sd5-slot" data-testid="sd5-book" data-id={b.id} aria-label={`${b.title}, ${b.year}`}
            style={{ width: slotW(b, l.s, still ? 86 : i === hov ? 26 : 86), height: b.h * l.s, transform: tf, zIndex: open?.i === i ? 5 : undefined, visibility: open?.i === i && open.phase === "read" ? "hidden" : undefined }}
            data-fly={(open?.i === i && open.phase !== "read") || undefined}
            onPointerEnter={(e) => { if (e.pointerType === "mouse") onPtr(i) }} onFocus={(e) => onFoc(e.currentTarget.matches(":focus-visible") ? i : -1)} onBlur={() => onFoc(-1)}
            onClick={(e) => onPull(i, e.currentTarget)}>
            <Book3D b={b} s={l.s} pose={{ ry: still ? 86 : ry, rx: ry === 0 ? 0 : -2 }} floor={false} perspective={7000} className="sd5-b3" />
          </button>
        )
      })}
    </div>
  )
})

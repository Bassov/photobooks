/* A chapter: one book in a sticky full-height frame whose scroll track drives it. q = 0…1 turns the closed book from
   three-quarter to face-on (Book3D); q = 1…1 + steps scrubs the reader (open the cover, turn the leaves). On the book
   page steps = every view, so the scroll reads the whole book; a click or ← / → scrolls one view. */
import * as React from "react"
import { Book3D } from "../site-demo-1/book3d"
import { BookReader } from "../site-demo-1/reader"
import { italics, pagesOf, sizeOf, viewLabel, viewsOf, type SiteBook } from "../site-demo-1/data"
import { Scroll, reducedMotion, smooth, useOnScroll } from "./scroll"

export const Statement = ({ text }: { text: string }) => (
  <>{italics(text).map((x, k) => (x.it ? <span key={k} className="sfa-muted">{x.t}</span> : <React.Fragment key={k}>{x.t}</React.Fragment>))}</>
)
export const metaOf = (b: SiteBook) => `${b.year} · ${pagesOf(b)} pages · ${sizeOf(b)}`
const ss = (t: number) => t * t * (3 - 2 * t)

export type ChapterProps = {
  b: SiteBook; s: number; vh: number; phone: boolean; stageH: number
  mode: "home" | "book"; steps: number; step: number
  onActive?: (id: string) => void; onOpen?: (id: string) => void
}

export function Chapter({ b, s, vh, phone, stageH, mode, steps, step, onActive, onOpen }: ChapterProps) {
  const ctx = React.useContext(Scroll)
  const track = React.useRef<HTMLElement>(null)
  const [q, setQ] = React.useState(0)
  const max = 1 + steps
  const top = () => { const sc = ctx!.el.current!, t = track.current!; return sc.scrollTop + t.getBoundingClientRect().top - sc.getBoundingClientRect().top }
  useOnScroll(() => {
    const sc = ctx?.el.current, t = track.current; if (!sc || !t) return
    const y = sc.scrollTop - top()
    const v = Math.max(0, Math.min(max, y / step))
    setQ((o) => (Math.abs(o - v) < 0.0005 ? o : v))
    if (y > -vh / 2 && y < t.offsetHeight - vh / 2) onActive?.(b.id)
  }, [step, max, vh, b.id])
  const to = (target: number) => { const sc = ctx?.el.current; if (sc) sc.scrollTo({ top: top() + Math.max(0, Math.min(max, target)) * step, behavior: smooth() }) }

  const reduced = typeof matchMedia !== "undefined" && reducedMotion()
  const n = viewsOf(b)
  const sc = reduced ? Math.round(Math.max(0, q - 1)) : Math.max(0, q - 1)
  const sa = Math.min(Math.floor(sc), n - 2), sf = sc - sa
  const at = q < 1 ? 0 : ss(Math.min(1, sf)) >= 0.5 ? sa + 1 : sa
  const show3d = reduced ? q < 0.5 : q < 1
  const e = reduced ? 0 : ss(Math.min(1, q))
  const RW = 2 * b.w * s, RH = b.h * s
  /** the closed book starts `grow` × larger and settles to the reader's size as it turns face-on (same factor for every
     book, so relative sizes stay true) */
  const grow = phone ? 1.8 : 1

  // book page: ← / → scroll one view
  React.useEffect(() => {
    if (mode !== "book") return
    const k = (ev: KeyboardEvent) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return
      const d = { ArrowRight: 1, ArrowLeft: -1 }[ev.key]
      if (d) { ev.preventDefault(); to(Math.round(q) + d) }
    }
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k)
  })
  const click = (ev: React.MouseEvent) => {
    if (mode === "home") { onOpen?.(b.id); return }
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
    const right = q < 1 || at === 0 || ev.clientX > r.left + r.width / 2
    to(Math.round(q) + (right ? 1 : -1))
  }

  const title = <h2 className="t-title" style={{ margin: 0, fontWeight: 400 }}>{b.title}</h2>
  const meta = <p className="t-meta">{metaOf(b)}</p>
  const where = mode === "book" ? <p className="t-meta" data-testid="sfa-where" aria-live="polite">{viewLabel(b, at)} <span>· {at + 1} / {n}</span></p> : null
  const lead = <p className="t-lead"><Statement text={b.statement} /></p>
  const link = mode === "home"
    ? <button className="sfa-link" onClick={() => onOpen?.(b.id)} data-testid="sfa-open">Open the book</button>
    : <button className="sfa-link" onClick={() => to(at >= n - 1 ? 0 : 2)}>{at >= n - 1 ? "Back to the cover" : "Open the book"}</button>

  return (
    <section ref={track} className="sfa-ch" style={{ height: vh + max * step }} data-testid="sfa-chapter" data-book={b.id} data-q={q.toFixed(2)} aria-label={b.title}>
      {mode === "book" && Array.from({ length: max + 1 }, (_, i) => <span key={i} className="sfa-snapat" style={{ top: i * step }} />)}
      <div className={`sfa-frame${reduced ? " sfa-fadey" : ""}`} style={{ height: vh, justifyContent: phone ? "center" : "flex-end" }}>
        {phone && <div className="sfa-ptop">{title}{meta}{where}</div>}
        <div className="sfa-stage" style={{ height: stageH }}>
          <div className="sfa-obj" style={{ width: RW, height: RH }}>
            <div className="sfa-l3" style={{ left: RW / 4, opacity: show3d ? 1 : 0, transform: grow > 1 ? `scale(${1 + (grow - 1) * (1 - e)})` : undefined }} aria-hidden={!show3d}>
              <Book3D b={b} s={s} pose={{ ry: 32 * (1 - e) + (reduced ? 18 : 0), rx: -3 * (1 - e), lift: 0 }} />
            </div>
            <div className="sfa-lr" style={{ opacity: show3d ? 0 : 1 }} aria-hidden={show3d}>
              <BookReader b={b} view={at} onView={() => {}} width={RW} scrub={sc} keys={false} leaf="paper" />
            </div>
            <button className="sfa-hit" onClick={click} data-testid="sfa-hit"
              aria-label={mode === "home" ? `Open ${b.title}, ${b.year}` : `${b.title}: next page`} />
          </div>
        </div>
        {phone
          ? <div className="sfa-pbot">{lead}{link}</div>
          : <div className="sfa-cap"><div className="sfa-cap-l">{title}{meta}{where}</div><div className="sfa-cap-r">{lead}{link}</div></div>}
      </div>
    </section>
  )
}

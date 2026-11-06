/* Site demo 9, the bookcase (Spec site-stand-v2 B, D8): a greige case from column 4 that grows with the collection, up to
   column 11 wide, then as many shelves as the books need (the page scrolls down the case). Per shelf: the newest book
   face-out (GL Book3D, ry 0, elev 6, leaning back 8°), the rest spines (thickness × 2.4, min 24 px) with a small jitter;
   the end book leans 6° into free space; 7 or more spines lay the two thinnest flat at the right end. The left column
   (lead + caption) is sticky. Phone: the case between the margins, the first tap raises a book, the second opens it. */
import * as React from 'react'
import { Book3D, type Pose } from '../site-book/book3d'
import { GRAIN } from '../site-book/paper'
import { pagesOf, type SiteBook } from '../site-demo-1/data'
import { LEAD, metaOf, SysSite, type HomeApi } from '../site-sys/sys'
import './site.css'

export function SiteDemo9() {
  return <SysSite n={9} home={(h) => <Home {...h} />} />
}

/** case frame (px): sides, top, shelf, plinth; the row padding inside a bay */
const SIDE = 18, TOP = 18, SHELF = 16, PLINTH = 40, PAD = 12
/** face-out at rest (ry 0, elev 6) and the GL hover pose (ry 14, elev 16, lift 8, peek 22), as CSS poses */
const REST: Pose = { ry: 0, rx: 3.5 }
const RAISED: Pose = { ry: 14, rx: -9, lift: 8, peek: 22 }

const spineW = (b: SiteBook, s: number) => Math.max(24, (0.6 + (pagesOf(b) / 2) * 0.1) * 2.4 * s)
const faceW = (b: SiteBook, s: number) => b.w * s + 8

type Item = { b: SiteBook; kind: 'face' | 'spine' | 'flat'; x: number; w: number; h: number; y: number; lean: number }
type Row ={ items: Item[]; width: number; height: number }

/** item 0 face-out, then the spines; ≥ 7 spines → the two thinnest go flat (thicker one at the bottom) */
function split(r: SiteBook[], s: number) {
  const [f, ...sp] = r
  const flat = sp.length >= 7 ? [...sp].sort((a, b) => spineW(a, s) - spineW(b, s)).slice(0, 2).reverse() : []
  return { f, up: sp.filter((b) => !flat.includes(b)), flat }
}
const widthOf = (r: SiteBook[], s: number) => {
  const { f, up, flat } = split(r, s)
  return faceW(f, s) + up.reduce((a, b) => a + spineW(b, s) + 1, 0) + (flat.length ? 24 + Math.max(...flat.map((b) => b.h * s)) : 0)
}
/** ±0.3…0.8° from a hash of the id */
const jitter = (id: string) => {
  let h = 7
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (h & 8 ? 1 : -1) * (0.3 + (h % 6) / 10)
}

/** a shelf holds a face-out and 9 more (7 upright + the 2 flat): the sample spines are thin, so width alone put 12
   books on one 1440 shelf (Done-when: 12 → ≥ 2 shelves) */
const PER_SHELF = 10

/** Rows newest first, greedy into `avail`; a book that doesn't fit starts the next shelf. */
function shelve(books: SiteBook[], s: number, avail: number): SiteBook[][] {
  const rows: SiteBook[][] = []
  for (const b of books) {
    const cur = rows.at(-1)
    if (cur && cur.length < PER_SHELF && widthOf([...cur, b], s) <= avail) cur.push(b)
    else rows.push([b])
  }
  return rows
}
/** x / lean per item; `room` = the row width free inside the case (the end book leans into what's left) */
function rowOf(r: SiteBook[], s: number, room: number): Row {
  const { f, up, flat } = split(r, s)
  const items: Item[] = [{ b: f, kind: 'face', x: 0, w: faceW(f, s), h: f.h * s, y: 0, lean: 0 }]
  let x = faceW(f, s)
  for (const b of up) {
    items.push({ b, kind: 'spine', x, w: spineW(b, s), h: b.h * s, y: 0, lean: jitter(b.id) })
    x += spineW(b, s) + 1
  }
  const width = widthOf(r, s), end = items.at(-1)
  if (!flat.length && end && end.kind === 'spine' && room - width >= end.h * Math.sin(Math.PI / 30) + 4) end.lean = 6
  let y = 0
  for (const b of flat) {
    items.push({ b, kind: 'flat', x: x + 23, w: b.h * s, h: spineW(b, s), y, lean: 0 })
    y += spineW(b, s)
  }
  return { items, width, height: Math.max(...[f, ...up].map((b) => b.h)) * s + 40 }
}

function Home({ books, box, g, open }: HomeApi) {
  const phone = box.narrow
  const k = Math.min(1, box.h / 900)
  // desktop: hover / focus; phone: the raised book (first tap), books[0] at first
  const [sel, setSel] = React.useState<SiteBook | null>(phone ? books[0] : null)
  React.useEffect(() => setSel(phone ? books[0] : null), [books, phone])
  const left = phone ? g.M : g.x(4), top = phone ? 184 : 104
  const max = phone ? box.w - 2 * g.M : g.x(12) - g.G - left
  const avail = max - 2 * SIDE - 2 * PAD
  // phone: s fits the widest face-out and two spines on a shelf
  let s = 9 * k
  if (phone) while (s > 4 && Math.max(...books.map((b) => b.w)) * s + 8 + 50 > avail) s *= 0.96
  const groups = shelve(books, s, avail)
  const caseW = phone ? max : Math.max(g.span(3), Math.min(max, Math.max(...groups.map((r) => widthOf(r, s))) + 2 * SIDE + 2 * PAD))
  const rows = groups.map((r) => rowOf(r, s, caseW - 2 * SIDE - 2 * PAD))
  const caseH = TOP + rows.reduce((a, r) => a + r.height, 0) + (rows.length - 1) * SHELF + PLINTH
  const total = Math.max(box.h, top + caseH + (phone ? 240 : 96))
  const leave = (b: SiteBook) => () => setSel((h) => (h === b ? null : h))
  const act = (b: SiteBook) => (phone ? { onClick: () => (sel === b ? open(b) : setSel(b)) } : {
    onClick: () => open(b),
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setSel(b) },
    onPointerLeave: leave(b), onFocus: () => setSel(b), onBlur: leave(b),
  })

  let y = TOP
  const bays = rows.map((r, i) => {
    const at = y
    y += r.height + SHELF
    return (
      <React.Fragment key={r.items[0].b.id}>
        <div className="ss9-bay" style={{ left: SIDE, right: SIDE, top: at, height: r.height }} data-testid="ss9-bay">
          {r.items.map((it) => <Book key={it.b.id} it={it} s={s} up={sel === it.b} {...act(it.b)} />)}
        </div>
        {i < rows.length - 1 && <div className="ss9-shelf" style={{ top: at + r.height }} />}
      </React.Fragment>
    )
  })
  const c = sel ?? books[0]
  return (
    <div className="ss-layer ss-scroll" data-testid="ss9-home">
      <div style={{ position: 'relative', height: total }}>
        {phone ? (
          <p className="ss-abs m19" style={{ left: g.M, top: 72, width: g.span(4), maxWidth: 340 }}>{LEAD}</p>
        ) : (
          <div className="ss-abs" style={{ left: g.x(0), top: 0, bottom: 0, width: g.span(4) }}>
            <div className="ss9-col">
              <p className="t24">{LEAD}</p>
              <div className="ss-abs" style={{ left: 0, right: 0, top: Math.round(560 * k) - 104 }} aria-live="polite" data-testid="ss9-caption">
                {sel ? (
                  <div key={sel.id} className="ss9-cap">
                    <div className="t44">{sel.title}</div>
                    <div className="t13 g" style={{ marginTop: 8 }}>{metaOf(sel)}</div>
                  </div>
                ) : <div className="t13 g">{books.length} books.</div>}
              </div>
            </div>
          </div>
        )}
        <div className="ss-abs ss9-case" style={{ left, top, width: caseW, height: caseH }} data-testid="ss9-case">
          {bays}
          <div className="ss9-plinth" />
        </div>
        {phone && (
          <div className="ss-abs" style={{ left: g.M, top: top + caseH + 24, width: g.span(4), paddingBottom: 64 }} data-testid="ss9-caption">
            <div key={c.id} className="ss9-cap">
              <div className="m28">{c.title}</div>
              <div className="t13 g" style={{ marginTop: 6 }}>{metaOf(c)}</div>
              <button type="button" className="m15 u" style={{ marginTop: 6, minHeight: 44 }} onClick={() => open(c)}>Open the book</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type BookProps = { it: Item; s: number; up: boolean; onClick: () => void; onPointerEnter?: (e: React.PointerEvent) => void; onPointerLeave?: () => void; onFocus?: () => void; onBlur?: () => void }

function Book({ it, s, up, ...on }: BookProps) {
  const { b, kind } = it
  const common = { type: 'button' as const, 'aria-label': `${b.title}, ${metaOf(b)}`, 'data-testid': 'ss9-book', 'data-id': b.id, 'data-kind': kind, 'data-up': up ? '' : undefined, ...on }
  if (kind === 'face')
    return (
      <button {...common} className="ss9-face" style={{ left: PAD + it.x, width: it.w, height: it.h }}>
        <span className="ss9-contact" style={{ width: b.w * s }} />
        <span className="ss9-lean"><Book3D b={b} s={s} pose={up ? RAISED : REST} floor={false} /></span>
      </button>
    )
  const style = { left: PAD + it.x, bottom: it.y, width: it.w, height: it.h, background: b.spine, color: b.spineInk, '--lean': `${it.lean}deg` } as React.CSSProperties
  return (
    <button {...common} className={kind === 'spine' ? 'ss9-spine' : 'ss9-flat'} style={style}>
      <i className="ss9-grain" style={{ backgroundImage: GRAIN }} />
      <span style={{ fontSize: Math.min(13, (kind === 'spine' ? it.w : it.h) * 0.42) }}>{b.title}</span>
      {kind === 'spine' && <em>A. Basov</em>}
    </button>
  )
}

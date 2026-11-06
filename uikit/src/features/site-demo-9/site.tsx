/* Site demo 9, the bookcase (Spec site-stand-v2 B, site-stand-v3 B2, D11–D15): a greige case centred in columns 4–11 that
   grows with the collection and scales with it (z = 1…14/9 so a short case fills the page down to 72 px above the
   bottom), then as many shelves as the books need (the page scrolls down the case). Each shelf has its own arrangement
   (`shelf.ts`): the newest book face-out (GL Book3D at rest, tipping toward you on hover), spines with the year, the two
   thinnest flat on P1 / P3, a book leaning 10–14° onto its neighbour. The left column (lead + caption) is sticky. Phone:
   the case between the margins at z = 1, the first tap raises a book, the second opens it. */
import * as React from 'react'
import { Book3D, type Pose } from '../site-book/book3d'
import { GRAIN } from '../site-book/paper'
import { type SiteBook } from '../site-demo-1/data'
import { LEAD, metaOf, SysSite, type HomeApi } from '../site-sys/sys'
import { faceW, rowOf, shelve, type Item } from './shelf'
import './site.css'

export function SiteDemo9() {
  return <SysSite n={9} home={(h) => <Home {...h} />} />
}

/** case frame (px at z = 1): sides, top, shelf, plinth; the row padding inside a bay */
const SIDE = 18, TOP = 18, SHELF = 16, PLINTH = 40, PAD = 12
/** face-out GL pose (ry 0, elev 6), also on hover: the CSS `.ss9-lean` tips the book instead (D15) */
const REST: Pose = { ry: 0, rx: 3.5 }

function Home({ books, box, g, open }: HomeApi) {
  const phone = box.narrow
  const k = Math.min(1, box.h / 900)
  // desktop: hover / focus; phone: the raised book (first tap), books[0] at first
  const [sel, setSel] = React.useState<SiteBook | null>(phone ? books[0] : null)
  React.useEffect(() => setSel(phone ? books[0] : null), [books, phone])
  const max = phone ? box.w - 2 * g.M : g.x(12) - g.G - g.x(4)
  const avail = max - 2 * SIDE - 2 * PAD
  // phone: s fits the widest face-out and two spines on a shelf
  let s0 = 9 * k
  if (phone) while (s0 > 4 && Math.max(...books.map((b) => faceW(b, s0, 1))) + 50 > avail) s0 *= 0.96
  // base pass at z = 1, then the same rows and patterns at z
  const { rows: groups, ps } = shelve(books, s0, 1, avail)
  const base = groups.map((r, i) => rowOf(r, ps[i], s0, 1, 0))
  const caseW0 = phone ? max : Math.max(g.span(3), Math.min(max, Math.max(...base.map((r) => r.width)) + 2 * SIDE + 2 * PAD))
  const caseH0 = TOP + base.reduce((a, r) => a + r.height, 0) + (base.length - 1) * SHELF + PLINTH
  const z = phone ? 1 : Math.min(Math.max(Math.min((box.h - 104 - 72) / caseH0, max / caseW0), 1), 14 / 9)
  const s = s0 * z, caseW = caseW0 * z
  const rows = groups.map((r, i) => rowOf(r, ps[i], s, z, caseW - 2 * (SIDE + PAD) * z))
  const caseH = (TOP + (rows.length - 1) * SHELF + PLINTH) * z + rows.reduce((a, r) => a + r.height, 0)
  const left = phone ? g.M : g.x(4) + (max - caseW) / 2
  const top = phone ? 184 : Math.max(104, box.h - 72 - caseH)
  const total = Math.max(box.h, top + caseH + (phone ? 240 : 72))
  const leave = (b: SiteBook) => () => setSel((h) => (h === b ? null : h))
  const act = (b: SiteBook) => (phone ? { onClick: () => (sel === b ? open(b) : setSel(b)) } : {
    onClick: () => open(b),
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setSel(b) },
    onPointerLeave: leave(b), onFocus: () => setSel(b), onBlur: leave(b),
  })

  let y = TOP * z
  const bays = rows.map((r, i) => {
    const at = y
    y += r.height + SHELF * z
    // tab order = left → right; a stack keeps its bottom book first
    const items = [...r.items].sort((a, b) => a.x - b.x)
    return (
      <React.Fragment key={r.items[0].b.id}>
        <div className="ss9-bay" style={{ left: SIDE * z, right: SIDE * z, top: at, height: r.height }} data-testid="ss9-bay" data-p={r.p}>
          {items.map((it) => <Book key={it.b.id} it={it} s={s} z={z} up={sel === it.b} {...act(it.b)} />)}
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
                ) : <div className="t13 g">{books.length} {books.length === 1 ? 'book' : 'books'}.</div>}
              </div>
            </div>
          </div>
        )}
        <div className="ss-abs ss9-case" style={{ left, top, width: caseW, height: caseH, '--z': z } as React.CSSProperties} data-testid="ss9-case">
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

type BookProps = { it: Item; s: number; z: number; up: boolean; onClick: () => void; onPointerEnter?: (e: React.PointerEvent) => void; onPointerLeave?: () => void; onFocus?: () => void; onBlur?: () => void }

function Book({ it, s, z, up, ...on }: BookProps) {
  const { b, kind } = it
  const common = { type: 'button' as const, 'aria-label': `${b.title}, ${metaOf(b)}`, 'data-testid': 'ss9-book', 'data-id': b.id, 'data-kind': kind, 'data-up': up ? '' : undefined, ...on }
  if (kind === 'face')
    return (
      <button {...common} className="ss9-face" style={{ left: PAD * z + it.x, width: it.w, height: it.h }}>
        <span className="ss9-contact" style={{ width: b.w * s }} />
        <span className="ss9-lean"><Book3D b={b} s={s} pose={REST} floor={false} /></span>
      </button>
    )
  const style = {
    left: PAD * z + it.x, bottom: it.y, width: it.w, height: it.h, background: b.spine, color: b.spineInk,
    '--lean': `${it.lean}deg`, '--o': it.origin === 'r' ? '100% 100%' : undefined, zIndex: it.lean ? 1 : undefined,
  } as React.CSSProperties
  return (
    <button {...common} className={kind === 'spine' ? 'ss9-spine' : 'ss9-flat'} style={style}>
      <i className="ss9-grain" style={{ backgroundImage: GRAIN }} />
      <span style={{ fontSize: Math.min(13 * z, (kind === 'spine' ? it.w : it.h) * 0.42) }}>{b.title}</span>
      <em>{b.year}</em>
    </button>
  )
}

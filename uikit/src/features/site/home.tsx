/* Personal site home (stand site-demo-9 af8369bb, personal-site K1), the bookcase (Spec site-stand-v2 B, site-stand-v3 B2, site-stand-v4 D17–D19,
   site-stand-v7 D30 / D32): a greige case centred on the page under the lead, span 10 (at most 1430) wide for any
   count, at one scale z = Z…14/9 (Z = clamp(h/900 · 4/3, 1, 14/9)) so one shelf fills the page down to 72 px above the
   bottom, then as many shelves as the books need (the page scrolls down the case). Each shelf has its own arrangement
   (`shelf.ts`), centred in its bay: the newest book face-out (GL Book3D at rest, coming off the shelf toward you on
   hover), spines with the year, the two thinnest flat on P1 / P3, a book leaning 10–14° onto its neighbour. Phone: the
   name, the lead and the case between the margins at z = 1; one tap opens a book. */
import * as React from 'react'
import { Book3D, type Pose } from '../site-book/book3d'
import { GRAIN } from '../site-book/paper'
import { AUTHOR, metaOf, type SiteBook } from './sample'
import { LEAD, SysSite, type HomeApi, type SiteProps } from './sys'
import { faceW, rowOf, shelve, type Item } from './shelf'
import './home.css'

export function PersonalSite(p: SiteProps) {
  return <SysSite {...p} home={(h) => <Home {...h} />} />
}

/** case frame (px at z = 1): sides, top, shelf, plinth; the row padding inside a bay */
const SIDE = 18, TOP = 18, SHELF = 16, PLINTH = 40, PAD = 12
/** desktop lead height for the fit: two t24 lines */
const LEAD_H = 62.4
/** face-out GL pose (ry 0, elev 6), also on hover: the CSS `.ss9-lean` lifts the book instead (D18) */
const REST: Pose = { ry: 0, rx: 3.5 }

function Home({ books, box, g, open }: HomeApi) {
  const phone = box.narrow
  const k = Math.min(1, box.h / 900)
  // desktop: the hovered / focused book
  const [sel, setSel] = React.useState<SiteBook | null>(null)
  React.useEffect(() => setSel(null), [books, phone])
  // desktop scale floor (D17): 12 px/cm at 900 high, 14 at ≥ 1050
  const Z = phone ? 1 : Math.min(Math.max(((box.h / 900) * 4) / 3, 1), 14 / 9)
  // the case width, for every count (D30): span 10, at most 1430; phone: between the margins
  const CW = phone ? box.w - 2 * g.M : Math.min(g.span(10), 1430)
  let s0 = 9 * k
  // desktop: one shelf (the stand's tallest book, 30 cm) fits under the lead (104 top, two t24 lines, 40 gap) and 72
  // above the bottom, never below Z: the scale does not depend on the count
  const H1 = TOP + Math.max(30, ...books.map((b) => b.h)) * s0 + 40 + PLINTH
  const z = phone ? 1 : Math.min(Math.max((box.h - 104 - LEAD_H - 40 - 72) / H1, Z), 14 / 9)
  const avail = CW / z - 2 * (SIDE + PAD)
  // phone: s fits the widest face-out and two spines on a shelf
  if (phone) while (s0 > 4 && Math.max(...books.map((b) => faceW(b, s0, 1))) + 50 > avail) s0 *= 0.96
  // rows at z = 1, then the same rows and patterns at z; desktop rows keep their natural width, centred in the bay
  const { rows: groups, ps } = shelve(books, s0, 1, avail)
  const s = s0 * z, caseW = CW, inner = CW - 2 * (SIDE + PAD) * z
  const rows = groups.map((r, i) => {
    if (phone) return rowOf(r, ps[i], s, z, inner)
    const row = rowOf(r, ps[i], s, z, 0), off = (inner - row.width) / 2
    return { ...row, items: row.items.map((it) => ({ ...it, x: it.x + off })) }
  })
  const caseH = (TOP + (rows.length - 1) * SHELF + PLINTH) * z + rows.reduce((a, r) => a + r.height, 0)
  // phone placement (the desktop case flows under the lead instead); the last plinth stays above a floating browser bar
  const top = 184
  const total = Math.max(box.h, top + caseH + 96)
  const leave = (b: SiteBook) => () => setSel((h) => (h === b ? null : h))
  // phone (D32): one tap opens the book
  const act = (b: SiteBook) => (phone ? { onClick: () => open(b) } : {
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
        <div className="ss9-bay" style={{ left: SIDE * z, right: SIDE * z, top: at, height: r.height }} data-testid="site-bay" data-p={r.p}>
          {items.map((it) => <Book key={it.b.id} it={it} s={s} z={z} up={sel === it.b} {...act(it.b)} />)}
        </div>
        {i < rows.length - 1 && <div className="ss9-shelf" style={{ top: at + r.height }} />}
      </React.Fragment>
    )
  })
  const plinth = <div className="ss9-plinth" />
  if (!phone)
    // desktop (D17): no side column, no caption; the lead on the case's left edge, the case 40 below, centred
    return (
      <div className="ss-layer ss-scroll" data-testid="site-home">
        <div style={{ minHeight: box.h, padding: '104px 0 72px', boxSizing: 'border-box' }}>
          <div style={{ width: caseW, margin: '0 auto' }}>
            <p className="t24" data-testid="site-lead" style={{ maxWidth: 640, margin: 0 }}>{LEAD}</p>
            <div className="ss9-case" style={{ position: 'relative', marginTop: 40, width: caseW, height: caseH, '--z': z } as React.CSSProperties} data-testid="site-case">
              {bays}
              {plinth}
            </div>
          </div>
        </div>
      </div>
    )
  // phone (D32): only the name (scrolling with the page), the lead and the case
  return (
    <div className="ss-layer ss-scroll" data-testid="site-home">
      <div style={{ position: 'relative', height: total }}>
        <p className="ss-abs m15 w5" style={{ left: g.M, top: 16, margin: 0, lineHeight: '24px' }} data-testid="site-name">{AUTHOR}</p>
        <p className="ss-abs m19" style={{ left: g.M, top: 72, width: g.span(4), maxWidth: 340 }}>{LEAD}</p>
        <div className="ss-abs ss9-case" style={{ left: g.M, top, width: caseW, height: caseH, '--z': z } as React.CSSProperties} data-testid="site-case">
          {bays}
          {plinth}
        </div>
      </div>
    </div>
  )
}

type BookProps = { it: Item; s: number; z: number; up: boolean; onClick: () => void; onPointerEnter?: (e: React.PointerEvent) => void; onPointerLeave?: () => void; onFocus?: () => void; onBlur?: () => void }

function Book({ it, s, z, up, ...on }: BookProps) {
  const { b, kind } = it
  const common = { type: 'button' as const, 'aria-label': `${b.title}, ${metaOf(b)}`, 'data-testid': 'ss9-book', 'data-id': b.id, 'data-kind': kind, 'data-up': up ? '' : undefined, ...on }
  // the bottom book of a stack (always two) slides out toward you instead of rising into the one above (D19)
  const under = kind === 'flat' && it.y === 0 ? '' : undefined
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
    <button {...common} className={kind === 'spine' ? 'ss9-spine' : 'ss9-flat'} style={style} data-under={under}>
      <i className="ss9-grain" style={{ backgroundImage: GRAIN }} />
      <span style={{ fontSize: Math.min(13 * z, (kind === 'spine' ? it.w : it.h) * 0.42) }}>{b.title}</span>
      <em>{b.year}</em>
    </button>
  )
}

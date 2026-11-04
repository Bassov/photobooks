/* Site demo 9, Shelf on the system (spec-sys.md "9 · Shelf (system)"): a plank #D8D1C4 12 px from column 5 to the right
   edge; the newest book face-out (Book3D), the others spine-out (thickness × 2.4), spine titles Inter Display 500 ≤ 13.
   Hover: only that spine rises 14 px with a shadow, 0.3 s. Caption at columns 0–3, y 560: t44 + meta. Phone: the shelf
   across the screen; the first tap raises a spine and shows its caption + link, the second tap opens. */
import * as React from 'react'
import { Book3D, thick } from '../site-demo-1/book3d'
import type { SiteBook } from '../site-demo-1/data'
import { LEAD, metaOf, SysSite, type HomeApi } from '../site-sys/sys'
import './site.css'

export function SiteDemo9() {
  return <SysSite n={9} home={(h) => (h.box.narrow ? <Phone {...h} /> : <Shelf {...h} />)} />
}

/** the largest px/cm ≤ `s0` at which the row fits `avail` */
const fitRow = (s0: number, avail: number, width: (s: number) => number) => {
  let s = s0
  while (s > 3 && width(s) > avail) s *= 0.96
  return s
}

function Spine({ b, s, k, up, onEnter, onLeave, onClick, tabIndex }: { b: SiteBook; s: number; k: number; up?: boolean; onEnter?: () => void; onLeave?: () => void; onClick: () => void; tabIndex?: number }) {
  const T = thick(b, s) * k, H = b.h * s
  return (
    <button type="button" className="ss9-spine" data-up={up ? '' : undefined} style={{ width: T, height: H, background: b.spine }}
      aria-label={`${b.title}, ${metaOf(b)}`} tabIndex={tabIndex}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') onEnter?.() }} onPointerLeave={onLeave} onFocus={onEnter} onBlur={onLeave}
      onClick={onClick} data-testid="ss9-book" data-id={b.id}>
      <span style={{ fontSize: Math.max(11, Math.min(13, T * 0.42)), color: b.spineInk }}>{b.title}</span>
    </button>
  )
}

function Shelf({ books, box, g, open }: HomeApi) {
  const [hov, setHov] = React.useState<SiteBook | null>(null)
  const k = Math.min(1, box.h / 900), base = Math.round((660 * box.h) / 900), x0 = g.x(5)
  const [f, ...rest] = books
  const s = fitRow(13 * k, box.w - g.M - x0, (s) => f.w * s + 24 + rest.reduce((a, b) => a + thick(b, s) * 2.4 + 3, 0))
  const leave = (b: SiteBook) => () => setHov((h) => (h === b ? null : h))
  return (
    <div className="ss-layer" data-testid="ss9-shelf">
      <p className="ss-abs t24" style={{ left: g.x(0), top: 104, width: g.span(4) }}>{LEAD}</p>
      <div className="ss-abs ss9-row" style={{ left: x0, top: base - Math.max(...books.map((b) => b.h)) * s - 24, height: Math.max(...books.map((b) => b.h)) * s + 24 }}>
        <button type="button" className="ss9-face" style={{ marginRight: 24 }} aria-label={`${f.title}, ${metaOf(f)}`}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHov(f) }} onPointerLeave={leave(f)} onFocus={() => setHov(f)} onBlur={leave(f)}
          onClick={() => open(f)} data-testid="ss9-book" data-id={f.id}>
          <Book3D b={f} s={s} floor={false} />
        </button>
        {rest.map((b) => <Spine key={b.id} b={b} s={s} k={2.4} onEnter={() => setHov(b)} onLeave={leave(b)} onClick={() => open(b)} />)}
      </div>
      <div className="ss9-plank" style={{ left: x0 - 24, right: 0, top: base }} />
      <div className="ss-abs" style={{ left: g.x(0), top: Math.round((560 * box.h) / 900), width: g.span(4) }} aria-live="polite" data-testid="ss9-caption">
        {hov ? (
          <div key={hov.id} className="ss9-cap">
            <div className="t44">{hov.title}</div>
            <div className="t13 g" style={{ marginTop: 8 }}>{metaOf(hov)}</div>
          </div>
        ) : <div className="t13 g">{books.length} books. Click a spine to take a book off the shelf.</div>}
      </div>
    </div>
  )
}

function Phone({ books, box, g, open }: HomeApi) {
  const [up, setUp] = React.useState(0)
  React.useEffect(() => setUp(0), [books])
  const base = Math.round((520 * box.h) / 844)
  const s = fitRow(9, g.span(4) - 16, (s) => books.reduce((a, b) => a + thick(b, s) * 2.2 + 3, 0))
  const c = books[up] ?? books[0]
  return (
    <div className="ss-layer ss-scroll" data-testid="ss9-phone">
      <p className="ss-abs m19" style={{ left: g.M, top: 72, width: g.span(4), maxWidth: 340 }}>{LEAD}</p>
      <div className="ss-abs ss9-row" style={{ left: g.M + 8, bottom: box.h - base, gap: 3 }}>
        {books.map((b, i) => <Spine key={b.id} b={b} s={s} k={2.2} up={i === up} onClick={() => (i === up ? open(b) : setUp(i))} />)}
      </div>
      <div className="ss9-plank" style={{ left: g.M, right: g.M, top: base }} />
      <div className="ss-abs" style={{ left: g.M, top: base + 40, width: g.span(4), paddingBottom: 64 }} data-testid="ss9-caption">
        <div key={c.id} className="ss9-cap">
          <div className="m28">{c.title}</div>
          <div className="t13 g" style={{ marginTop: 6 }}>{metaOf(c)}</div>
          <button type="button" className="m15 u" style={{ marginTop: 6, minHeight: 44 }} onClick={() => open(c)}>Open the book</button>
        </div>
      </div>
    </div>
  )
}

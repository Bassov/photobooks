/* Site demo 7, Index on the system (spec-sys.md "7 · Index (system)"): the list in columns 0–6 (number t13 grey, title t44,
   year / pages t13 grey; rows 80 high) and a sticky preview in columns 8–11 (Book3D at 13 px/cm, statement t16, meta, link).
   Hover: the other rows go to .3 over 0.2 s; the preview crossfades in 0.4 s. Phone: rows with a 56 px cover, title m28. */
import * as React from 'react'
import { Book3D } from '../site-demo-1/book3d'
import { pad2, pagesOf, src, type SiteBook } from '../site-demo-1/data'
import { LEAD, metaOf, Statement, SysSite, type Grid, type HomeApi } from '../site-sys/sys'
import './site.css'

export function SiteDemo7() {
  return <SysSite n={7} home={(h) => (h.box.narrow ? <Phone {...h} /> : <List {...h} />)} />
}

function List({ books, box, g, open }: HomeApi) {
  const [hov, setHov] = React.useState(-1)
  // the preview: the current book and the one fading out
  const [pv, setPv] = React.useState<{ cur: SiteBook; prev: SiteBook | null }>({ cur: books[0], prev: null })
  React.useEffect(() => setPv({ cur: books[0], prev: null }), [books])
  const show = (i: number) => {
    setHov(i)
    if (i >= 0 && books[i] !== pv.cur) setPv({ cur: books[i], prev: pv.cur })
  }
  const k = Math.min(1, box.h / 900), top = 260, total = Math.max(box.h, top + books.length * 80 + 96)
  return (
    <div className="ss-layer ss-scroll" data-testid="ss7-list">
      <div style={{ position: 'relative', height: total }}>
        <div className="ss7-sticky" style={{ height: box.h }}>
          {pv.prev && <Preview key={`p-${pv.prev.id}`} b={pv.prev} g={g} k={k} box={box} out open={open} />}
          <Preview key={pv.cur.id} b={pv.cur} g={g} k={k} box={box} open={open} />
        </div>
        <p className="ss-abs t24" style={{ left: g.x(0), top: 104, width: g.span(5) }}>{LEAD}</p>
        <div className="ss-abs" style={{ left: g.x(0), top, width: g.span(7) }} onPointerLeave={() => setHov(-1)}>
          {books.map((b, i) => (
            <button key={b.id} type="button" className="ss7-row" data-dim={hov >= 0 && hov !== i ? '' : undefined}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') show(i) }} onFocus={() => show(i)} onBlur={() => setHov(-1)}
              onClick={() => open(b)} data-testid="ss7-book" data-id={b.id}>
              <span className="ss-abs t13 g" style={{ left: 0, top: 14 }}>{pad2(i + 1)}</span>
              <span className="ss-abs t44" style={{ left: g.x(1) - g.M, top: 8 }}>{b.title}</span>
              <span className="ss-abs t13 g" style={{ left: g.x(6) - g.M, top: 14 }}>{b.year}<br />{pagesOf(b)} pages</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Preview({ b, g, k, box, out, open }: { b: SiteBook; g: Grid; k: number; box: { h: number }; out?: boolean; open: (b: SiteBook) => void }) {
  const s = 13 * k, W = b.w * s, H = b.h * s, base = Math.round((600 * box.h) / 900)
  return (
    <div className={`ss7-pv${out ? ' ss7-out' : ''}`} inert={out} data-testid={out ? undefined : 'ss7-preview'} data-id={b.id}>
      <div className="ss-abs" style={{ left: g.x(8) + (g.span(4) - W) / 2, top: base - H }}><Book3D b={b} s={s} /></div>
      <div className="ss-abs" style={{ left: g.x(8), top: base + 40, width: g.span(4) }}>
        <p className="t16"><Statement s={b.statement} /></p>
        <p className="t13 g" style={{ marginTop: 8 }}>{metaOf(b)}</p>
        <button type="button" className="t16 u" style={{ marginTop: 16 }} onClick={() => open(b)}>Open the book</button>
      </div>
    </div>
  )
}

function Phone({ books, g, open }: HomeApi) {
  return (
    <div className="ss-layer ss-scroll" data-testid="ss7-phone">
      <div style={{ padding: `72px ${g.M}px 64px` }}>
        <p className="m19" style={{ maxWidth: 340 }}>{LEAD}</p>
        <div style={{ marginTop: 40 }}>
          {books.map((b) => {
            const th = (56 * b.h) / b.w
            return (
              <button key={b.id} type="button" className="ss7-mrow" onClick={() => open(b)} data-testid="ss7-book" data-id={b.id}>
                <span className="ss7-thumb" style={{ height: th, backgroundImage: `url(${src(b.cover)})` }} />
                <span>
                  <span className="m28" style={{ display: 'block' }}>{b.title}</span>
                  <span className="t13 g" style={{ display: 'block', marginTop: 4 }}>{b.year} · {pagesOf(b)} pages</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

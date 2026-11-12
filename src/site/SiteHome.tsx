/*
 * The personal site home (Designer personal-site P4; port of the kit's
 * `features/site/home.tsx`): the name, the lead and the bookcase. Name, lead
 * and the case's x / width are CSS, so the prerender holds at any width; the
 * case's rows and height need the viewport, so it stays hidden until the first
 * client layout (D42). Books are links to their pages.
 */
import { Fragment, useMemo, useRef, type CSSProperties } from 'react'
import { pagesText } from '../core/pages'
import { Book3D, type CssPose } from './book/Book3D'
import { caseLayout, PAD, shelfBook, SIDE, type Item } from './shelf'
import type { SiteCatalogBook, SitePageInput } from './siteInput'
import { homeHead, homeLead } from './siteModel'
import { pageHref } from './siteUrl'
import { useViewport } from './useViewport'

type HomeInput = Extract<SitePageInput, { kind: 'catalog' }>

/** the box the server lays the case out for (it stays hidden until the client's) */
const SERVER = { vw: 1440, vh: 900 }
/** the face-out pose; hover lifts the `.ss9-lean` wrapper instead (D18) */
const REST: CssPose = { ry: 0, rx: 3.5 }

export function SiteHome({ input }: { input: HomeInput }) {
  const root = useRef<HTMLDivElement>(null)
  const viewport = useViewport(root)
  const { site, books } = input
  const lead = homeLead(site)
  return (
    <div ref={root} className="ss" data-testid="site">
      <main className="ss-home" data-testid="site-home">
        <h1 className="ss-name" data-testid="site-name">
          {homeHead(site)}
        </h1>
        <div className="ss-col">
          {lead === undefined ? null : (
            <p className="ss-lead" data-testid="site-lead">
              {lead}
            </p>
          )}
          {books.length === 0 ? (
            <p className="ss-empty g" data-testid="site-empty">
              No published books yet.
            </p>
          ) : (
            <Bookcase
              books={books}
              box={viewport ?? SERVER}
              laid={viewport !== null}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function Bookcase({
  books,
  box,
  laid,
}: {
  books: readonly SiteCatalogBook[]
  box: { vw: number; vh: number }
  laid: boolean
}) {
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])
  const shelf = useMemo(() => books.map(shelfBook), [books])
  const { z, s, height, rows } = caseLayout(shelf, box.vw, box.vh)
  return (
    <div
      className="ss9-case"
      style={{ height, '--z': z } as CSSProperties}
      data-testid="site-case"
      data-laid={laid ? '' : undefined}
    >
      {rows.map((r, i) => (
        <Fragment key={r.items[0]?.b.id ?? i}>
          <div
            className="ss9-bay"
            style={{
              left: SIDE * z,
              right: SIDE * z,
              top: r.top,
              height: r.height,
            }}
            data-testid="site-bay"
            data-p={r.p}
          >
            {/* tab order = left → right; a stack keeps its bottom book first */}
            {[...r.items]
              .sort((a, b) => a.x - b.x)
              .map((it) => {
                const b = byId.get(it.b.id)
                return b === undefined ? null : (
                  <BookLink key={b.id} it={it} b={b} s={s} z={z} />
                )
              })}
          </div>
          {i < rows.length - 1 ? (
            <div className="ss9-shelf" style={{ top: r.top + r.height }} />
          ) : null}
        </Fragment>
      ))}
      <div className="ss9-plinth" />
    </div>
  )
}

function BookLink({
  it,
  b,
  s,
  z,
}: {
  it: Item
  b: SiteCatalogBook
  s: number
  z: number
}) {
  const common = {
    href: pageHref(b.href),
    'aria-label': `${b.title}, ${String(b.year)}, ${pagesText(b.pageCount)}`,
    'data-testid': 'ss9-book',
    'data-book': b.id,
    'data-kind': it.kind,
  }
  if (it.kind === 'face') {
    return (
      <a
        {...common}
        className="ss9-face"
        style={{ left: PAD * z + it.x, width: it.w, height: it.h }}
      >
        <span className="ss9-contact" style={{ width: it.b.w * s }} />
        <span className="ss9-lean">
          <Book3D b={b} s={s} pose={REST} />
        </span>
      </a>
    )
  }
  const style = {
    left: PAD * z + it.x,
    bottom: it.y,
    width: it.w,
    height: it.h,
    background: b.spine.cloth,
    color: b.spine.ink,
    '--lean': `${String(it.lean)}deg`,
    '--o': it.origin === 'r' ? '100% 100%' : undefined,
    zIndex: it.lean === 0 ? undefined : 1,
  } as CSSProperties
  return (
    <a
      {...common}
      className={it.kind === 'spine' ? 'ss9-spine' : 'ss9-flat'}
      style={style}
      data-under={it.kind === 'flat' && it.y === 0 ? '' : undefined}
    >
      <i className="ss9-grain" />
      <span
        className="sd-it"
        style={{
          fontSize: Math.min(
            13 * z,
            (it.kind === 'spine' ? it.w : it.h) * 0.42,
          ),
        }}
      >
        {b.spine.text}
      </span>
      <em>{b.year}</em>
    </a>
  )
}

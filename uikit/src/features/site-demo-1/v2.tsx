/* site-awards v2 common parts (Spec site-awards-v2 "Common"), used by demos 2–5: the `?books=1|3|6|12` switch, the phone
   breakpoint (≤ 640), the header, the statement with its quiet part, and the reader page. */
import * as React from 'react'
import {
  AUTHOR,
  BOOKS,
  pagesOf,
  SPREAD_R,
  viewLabel,
  viewsOf,
  type SiteBook,
} from './data'
import { EXTRA } from './data-extra'
import { BookReader, type ReaderApi } from './reader'
import './site.css'
import './v2.css'

export const COUNTS = [1, 3, 6, 12]
const countOf = () => {
  const m = /[?&]books=(\d+)/.exec(location.hash),
    n = m ? +m[1] : 6
  return COUNTS.includes(n) ? n : 6
}
const onHash = (f: () => void) => {
  addEventListener('hashchange', f)
  return () => removeEventListener('hashchange', f)
}
/** the books of the demo: `?books=` on the route hash, default 6; 12 = BOOKS + EXTRA */
export function useBooks(): SiteBook[] {
  const n = React.useSyncExternalStore(onHash, countOf)
  return React.useMemo(() => [...BOOKS, ...EXTRA].slice(0, n), [n])
}
export const reduced = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches
export const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x))
const WORDS: Record<number, string> = {
  1: 'One',
  3: 'Three',
  6: 'Six',
  12: 'Twelve',
}
/** "6 books" · "Six books" (`word`) · "1 book" */
export const countLabel = (n: number, word = false) =>
  `${word ? (WORDS[n] ?? n) : n} book${n === 1 ? '' : 's'}`
export const yearsOf = (books: SiteBook[]) => {
  const ys = books.map((b) => b.year),
    a = Math.min(...ys),
    z = Math.max(...ys)
  return a === z ? `${a}` : `${a}–${z}`
}
export const metaOf = (b: SiteBook) =>
  `${b.year} · ${pagesOf(b)} pages · ${b.w} × ${b.h} cm`

export type Box = { w: number; h: number; narrow: boolean }
/** the root's size and the phone flag; the kit body's min-width 1280 is lifted while a demo is mounted */
export function useBox<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  Box,
] {
  const ref = React.useRef<T>(null)
  const [box, setBox] = React.useState({ w: innerWidth, h: innerHeight })
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    r()
    const ro = new ResizeObserver(r)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  React.useLayoutEffect(() => {
    const s = document.body.style,
      m = s.minWidth
    s.minWidth = '0'
    return () => {
      s.minWidth = m
    }
  }, [])
  return [ref, { ...box, narrow: box.w <= 640 }]
}

/** "Lakes, coasts and *the people I travel with.*" → the starred part at opacity .6 */
export function Statement({ s }: { s: string }) {
  return (
    <>
      {s.split('*').map((x, i) =>
        i % 2 ? (
          <span key={i} className="sv2-em">
            {x}
          </span>
        ) : (
          x
        ),
      )}
    </>
  )
}

export type NavItem = {
  label: string
  current?: boolean
  pressed?: boolean
  href?: string
  onClick?: () => void
}
export function Header({
  items,
  narrow,
}: {
  items: NavItem[]
  narrow: boolean
}) {
  return (
    <header className="sv2-header">
      <span className="sv2-name">{narrow ? 'A. Basov' : AUTHOR}</span>
      <nav>
        {items.map((it) =>
          it.href ? (
            <a
              key={it.label}
              className="sv2-nav"
              href={it.href}
              aria-current={it.current ? 'page' : undefined}
              onClick={
                it.onClick &&
                ((e) => {
                  e.preventDefault()
                  it.onClick!()
                })
              }
            >
              {it.label}
            </a>
          ) : (
            <button
              key={it.label}
              type="button"
              className="sv2-nav"
              aria-pressed={it.pressed}
              onClick={it.onClick}
            >
              {it.label}
            </button>
          ),
        )}
      </nav>
    </header>
  )
}

/** "Books 1 · 3 · 6 · 12", bottom-right: the demo-only switch */
export function BooksSwitch({ demo, n }: { demo: number; n: number }) {
  return (
    <div className="sv2-switch" data-testid="sv2-switch">
      <span>Books</span>
      {COUNTS.map((c, i) => (
        <React.Fragment key={c}>
          {i > 0 && <span aria-hidden>·</span>}
          <a
            href={`#/full/site-demo-${demo}?books=${c}`}
            aria-current={c === n ? 'true' : undefined}
          >
            {c}
          </a>
        </React.Fragment>
      ))}
    </div>
  )
}

/** the reader box: desktop W = min(1040, vw − 320), the bar 84 above, 104 below; phone vw − 24, centred */
export const readerBox = (box: Box, b: SiteBook) => {
  const R = SPREAD_R[b.fmt],
    top0 = box.narrow ? 64 : 84,
    foot = box.narrow ? 96 : 104
  const w = Math.max(
    200,
    Math.min(
      box.narrow ? box.w - 24 : Math.min(1040, box.w - 320),
      (box.h - top0 - foot) * R,
    ),
  )
  const h = w / R
  return {
    w,
    h,
    left: (box.w - w) / 2,
    top: top0 + (box.h - top0 - foot - h) / 2,
  }
}
/** where the closed cover sits in the reader box (centre, width): a board 5 px over the page */
export const coverAt = (box: Box, b: SiteBook) => {
  const rb = readerBox(box, b)
  return {
    cx: rb.left + rb.w / 2 + 2.5,
    cy: rb.top + rb.h / 2,
    w: rb.w / 2 + 5,
  }
}

type ReaderPageProps = {
  /** the demo: `sd<n>-reader`, `sd<n>-close` test ids */
  n: number
  b: SiteBook
  box: Box
  view: number
  onView: (v: number) => void
  onClose: () => void
  back: string
  leaf?: 'board' | 'paper'
  turnMs?: number
  dark?: boolean
  className?: string
  style?: React.CSSProperties
}
/** The book page: back link · title · "Pages 2–3 of 22", the reader in the middle, Previous / meta / Next below. */
export function ReaderPage({
  n,
  b,
  box,
  view,
  onView,
  onClose,
  back,
  leaf,
  turnMs,
  dark,
  className,
  style,
}: ReaderPageProps) {
  const api = React.useRef<ReaderApi>(null),
    host = React.useRef<HTMLDivElement>(null)
  const rb = readerBox(box, b),
    label = viewLabel(b, view),
    last = viewsOf(b) - 1
  // the reader takes the focus, so ← / → and Tab start from the book
  React.useEffect(() => {
    host.current
      ?.querySelector<HTMLElement>('[role="region"]')
      ?.focus({ preventScroll: true })
  }, [])
  return (
    <div
      ref={host}
      className={`sv2-read${className ? ` ${className}` : ''}`}
      style={style}
      data-testid={`sd${n}-page`}
    >
      <div className="sv2-read-bar">
        <button
          type="button"
          className="sv2-link justify-self-start"
          onClick={onClose}
          data-testid={`sd${n}-close`}
        >
          {back}
        </button>
        {!box.narrow ? (
          <span className="sv2-read-title">{b.title}</span>
        ) : (
          <span />
        )}
        <span
          className="sv2-meta justify-self-end"
          aria-hidden
          data-testid={`sd${n}-label`}
        >
          {label}
          {label.startsWith('Page') && ` of ${pagesOf(b)}`}
        </span>
      </div>
      <div
        className="sv2-abs"
        style={{ left: rb.left, top: rb.top, width: rb.w }}
        data-testid={`sd${n}-reader`}
        data-view={view}
      >
        <BookReader
          ref={api}
          b={b}
          view={view}
          onView={onView}
          width={rb.w}
          // demo 1 keeps its rigid leaves and 800 ms turn (the stand's paper default is Spec site-stand S4)
          leaf={leaf ?? 'board'}
          turnMs={turnMs ?? 800}
          dark={dark}
        />
      </div>
      <div
        className="sv2-read-foot"
        style={{ top: rb.top + rb.h + (box.narrow ? 28 : 36) }}
      >
        <button
          type="button"
          className="sv2-ctl"
          disabled={view <= 0}
          onClick={() => api.current?.go(-1)}
        >
          Previous
        </button>
        <span className="sv2-meta">
          {box.narrow ? `${b.title} · ${b.year}` : metaOf(b)}
        </span>
        <button
          type="button"
          className="sv2-ctl"
          disabled={view >= last}
          onClick={() => api.current?.go(1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

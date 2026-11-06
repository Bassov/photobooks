/* Book counts for the stand (Spec site-stand-v2 S, D5): `?books=1|3|6|12|30|100` on the route hash, default 6. The first
   12 are the real books (BOOKS + EXTRA); past 12 placeholders reuse the real spreads, so they open. */
import * as React from 'react'
import { BOOKS, pad2, type SiteBook } from '../site-demo-1/data'
import { EXTRA } from '../site-demo-1/data-extra'

export const COUNTS = [1, 3, 6, 12, 30, 100]

const TITLES = [
  'Quiet harbour', 'Salt marsh', 'Morning ferry', 'Stone bridge', 'High pasture', 'Old quarter', 'River bend', 'Late snow',
  'Dry season', 'Pine coast', 'Glass house', 'North wind', 'Low tide', 'Long table', 'Red cliffs', 'Mountain road',
  'Small island', 'Open field', 'Blue hour', 'Village square', 'Rain market', 'Cold spring', 'Back garden', 'White dunes',
  'Last train', 'Lighthouse keeper', 'Wild orchard', 'Copper roofs', 'Empty beach', 'Hill town', 'Fishing boats', 'Grey lagoon',
  'Summer camp', 'Night bus', 'Olive grove', 'Border crossing', 'Paper kites', 'Winter port', 'Clay houses', 'Slow river',
]
/** muted book cloth, no blue hue (kit qa v6 scans site-book/) */
const PALETTE = [
  '#2F4A2C', '#8A7F6E', '#C9B79C', '#5C4B51', '#A3B1A0', '#704F3B', '#D8CFC0', '#4A4F3A', '#7A3E3A', '#B98E5A', '#3F3D3A', '#9C8AA0',
]
const FMTS = [['portrait', 24, 30], ['landscape', 30, 24], ['square', 25, 25]] as const

/** relative luminance 0…1 of `#rrggbb` */
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** the first `n` books: the 12 real ones, then generated placeholders */
export function manyBooks(n: number): SiteBook[] {
  const real = [...BOOKS, ...EXTRA]
  const out = real.slice(0, n)
  for (let i = real.length; i < n; i++) {
    const k = i - real.length, [fmt, w, h] = FMTS[k % 3], spine = PALETTE[k % PALETTE.length]
    out.push({
      id: `book-${i + 1}`, title: TITLES[k % TITLES.length] + (k >= TITLES.length ? ' II' : ''), year: 2026 - Math.floor(i / 4),
      fmt, w, h, cover: `p${pad2((k % 21) + 1)}`, ink: '#fff', spine, spineInk: lum(spine) < 0.23 ? '#F1F3F6' : '#2E2C2D',
      statement: '', spreads: BOOKS[i % BOOKS.length].spreads,
    })
  }
  return out
}

const countOf = () => {
  const m = /[?&]books=(\d+)/.exec(location.hash), n = m ? +m[1] : 6
  return COUNTS.includes(n) ? n : 6
}
const onHash = (f: () => void) => {
  addEventListener('hashchange', f)
  return () => removeEventListener('hashchange', f)
}
/** the books of the demo from `?books=` */
export function useBooks(): SiteBook[] {
  const n = React.useSyncExternalStore(onHash, countOf)
  return React.useMemo(() => manyBooks(n), [n])
}

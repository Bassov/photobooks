/* Six more books for `?books=12` (Spec site-awards-v2 "Book count switch"). Their spreads reuse those of the six BOOKS
   of the same format, cycled to the page count. */
import { BOOKS, type SiteBook } from './sample'
import type { Fmt } from '../library'

/** `pp` pages = cover + (pp / 2 − 1) interior spreads, the last a single page; `at` = where the cycle starts */
const reuse = (fmt: Fmt, pp: number, at: number): SiteBook['spreads'] => {
  const pool = BOOKS.filter((b) => b.fmt === fmt).flatMap((b) =>
    b.spreads.filter((s) => s.template !== 'last'),
  )
  const n = pp / 2 - 1
  return [
    ...Array.from({ length: n - 1 }, (_, i) => pool[(at + i) % pool.length]),
    { template: 'last', photos: [pool[at % pool.length].photos[0]] },
  ]
}
const book = (
  id: string,
  title: string,
  year: number,
  w: number,
  h: number,
  pp: number,
  cover: string,
  spine: string,
  spineInk: string,
  statement: string,
  at: number,
  ink = '#fff',
): SiteBook => {
  const fmt: Fmt = w > h ? 'landscape' : w < h ? 'portrait' : 'square'
  return {
    id,
    title,
    year,
    fmt,
    w,
    h,
    cover,
    ink,
    spine,
    spineInk,
    statement,
    spreads: reuse(fmt, pp, at),
  }
}
export const EXTRA: SiteBook[] = [
  book(
    'harbour',
    'Harbour',
    2023,
    30,
    24,
    16,
    'p02',
    '#3E4E5C',
    '#EEF1F3',
    'One small harbour from dawn to dusk, *the boats going out and coming back.*',
    2,
  ),
  book(
    'winter-light',
    'Winter light',
    2022,
    24,
    30,
    20,
    'hi/x-tatra',
    '#E4E2DD',
    '#2E2C2D',
    'Short days in the mountains, *snow and the low sun.*',
    3,
    '#2E2C2D',
  ),
  book(
    'orchard',
    'Orchard',
    2022,
    25,
    25,
    12,
    'p07',
    '#7A6A3E',
    '#F3EEE2',
    "A year in my parents' orchard, *from blossom to the last apples.*",
    1,
  ),
  book(
    'night-trains',
    'Night trains',
    2021,
    24,
    30,
    18,
    'p11',
    '#2A2A33',
    '#E9E9EE',
    'Sleeper trains across three countries, *and the stations at night.*',
    6,
  ),
  book(
    'valley',
    'Valley',
    2021,
    30,
    24,
    14,
    'hi/x-valley',
    '#6E7F5A',
    '#F0F3EC',
    'A week walking one green valley, *village to village.*',
    5,
  ),
  book(
    'grandmothers-house',
    "Grandmother's house",
    2020,
    25,
    25,
    12,
    'p13',
    '#9A5B45',
    '#F6ECE7',
    'The house I grew up in, *before it was sold.*',
    4,
  ),
]

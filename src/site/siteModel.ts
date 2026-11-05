import type { Book } from '../core'
// Not the barrel: it would pull the zod schemas into the viewer entry.
import { getSpreadSizeMm } from '../core/geometry/spreadSize'
import { pageLabel, pagesOf, pagesText } from '../core/pages'
import {
  bookObjectWidthForHeight,
  type BookObjectFmt,
} from '../render/bookObjectLayout'

/** Viewports below this width use the narrow site layout (spec §4). */
const NARROW_BELOW = 768
/** Widest stage, and the stage width the server renders at. */
export const STAGE_MAX = 760
const STAGE_MIN = 280
const CATALOG_MAX = 1100
const BOOK_OBJECT_MAX_H = 200
/**
 * Book page height around the stage: header + top pad + title block + stage
 * margin + pager margin + pager + bottom pad (wide 94.85 title block; narrow
 * adds Share under the meta).
 */
const WIDE_CHROME_H = 64 + 16 + 94.85 + 32 + 24 + 36 + 32
const NARROW_CHROME_H = 56 + 8 + 138.85 + 20 + 16 + 36 + 20

/** Slides of a book with `n` spreads: the cover, then every spread. */
export function slideCount(n: number): number {
  return n + 1
}

/** Pager text: `Cover`, then `Page 1 · 1 / n`, `Pages 2–3 · 2 / n` … */
export function slideLabel(slide: number, n: number): string {
  if (slide === 0) return 'Cover'
  const label = pageLabel(slide - 1, n)
  const pages = label.includes('–') ? `Pages ${label}` : `Page ${label}`
  return `${pages} · ${String(slide)} / ${String(n)}`
}

/**
 * A single first / last page sits on its own side of the spread box (the
 * cover, spread index -1, counts as two pages).
 */
export function slideSide(
  book: Book,
  slide: number,
): 'left' | 'right' | undefined {
  if (getSpreadSizeMm(book, slide - 1).pageCount === 2) {
    return undefined
  }
  return slide === 1 ? 'right' : 'left'
}

/** `#p{first page}` of slide `slide`; the cover (and out of range) has none. */
export function hashForSlide(slide: number, n: number): string {
  if (slide < 1 || slide > n) return ''
  const spread = slide - 1
  return `#p${String(spread === 0 ? 1 : spread * 2)}`
}

/** The slide holding page N of `#pN`; anything else opens the cover. */
export function slideForHash(hash: string, n: number): number {
  const match = /^#p([1-9]\d{0,5})$/.exec(hash)
  if (match === null) return 0
  const page = Number(match[1])
  if (page > pagesOf(n)) return 0
  // Page 1 → spread 0, pages 2–3 → spread 1, …
  return Math.floor(page / 2) + 1
}

export function isNarrow(vw: number): boolean {
  return vw < NARROW_BELOW
}

function sidePad(vw: number): number {
  return isNarrow(vw) ? 20 : 32
}

/** Catalog columns by content width (spec §3). */
export function catalogColumns(contentW: number): 2 | 3 | 4 {
  if (contentW >= 940) return 4
  if (contentW >= 680) return 3
  return 2
}

/** Catalog column width at viewport width `vw`. */
export function catalogColumnWidth(vw: number): number {
  const content = Math.min(CATALOG_MAX, vw) - 2 * sidePad(vw)
  const cols = catalogColumns(content)
  const gap = isNarrow(vw) ? 20 : 32
  return Math.max(0, (content - gap * (cols - 1)) / cols)
}

/** Book object height: as tall as fits the column, at most 200. */
export function bookObjectHeight(colW: number, fmt: BookObjectFmt): number {
  return Math.min(BOOK_OBJECT_MAX_H, colW / bookObjectWidthForHeight(1, fmt))
}

/**
 * Stage width: at most 760, the content width and the height left for the
 * spread; at least 280 unless the content is narrower.
 */
export function stageWidth({
  vw,
  vh,
  ratio,
}: {
  vw: number
  vh: number
  ratio: number
}): number {
  const content = Math.max(0, vw - 2 * sidePad(vw))
  const availH = vh - (isNarrow(vw) ? NARROW_CHROME_H : WIDE_CHROME_H)
  const fit = Math.min(STAGE_MAX, availH * ratio)
  return Math.min(content, Math.max(STAGE_MIN, fit))
}

/** Spread width / height: two trim pages side by side. */
export function spreadRatio(trim: {
  widthMm: number
  heightMm: number
}): number {
  return (2 * trim.widthMm) / trim.heightMm
}

/** `sizes` of a photo spanning `share` of the spread width. */
export function frameSizes(share: number): string {
  const s = String(Math.round(share * 10_000) / 10_000)
  const wide = Math.round(STAGE_MAX * Number(s))
  return `(max-width: ${String(NARROW_BELOW - 1)}px) calc((100vw - 40px) * ${s}), min(${String(wide)}px, calc((100vw - 64px) * ${s}))`
}

export function siteTitle(title: string): string {
  return title.trim() === '' ? 'Photobooks' : title
}

/** Catalog meta line under "Books". */
export function catalogMeta(author: string | undefined, books: number): string {
  if (books === 0) return 'No published books yet.'
  const count = `${String(books)} photobook${books === 1 ? '' : 's'}`
  return author === undefined || author === '' ? count : `${author} · ${count}`
}

/** Book meta line under the title. */
export function bookMeta(author: string | undefined, pages: number): string {
  const count = pagesText(pages)
  return author === undefined || author === ''
    ? count
    : `by ${author} · ${count}`
}

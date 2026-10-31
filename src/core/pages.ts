import type { Book } from './schema'

/** Kit v7.tsx:27 printable page range; pages come in spreads of 2. */
export const PAGE_MIN = 20
export const PAGE_MAX = 120
export const PAGE_STEP = 2

/** Kit `pagesOf` (v7.tsx:29): every spread counts two pages. */
export function pagesOf(spreads: number): number {
  return spreads * 2
}

/** A typed page count: nearest even number inside 20–120; NaN stays NaN. */
export function clampPageCount(pages: number): number {
  const even = Math.round(pages / PAGE_STEP) * PAGE_STEP
  return Math.min(PAGE_MAX, Math.max(PAGE_MIN, even))
}

/** Hardcover boards + hinge: the spine of an empty block. */
const SPINE_BOARD_MM = 8
/** One page of ~200 gsm photo paper (0.4 mm per sheet). */
const SPINE_MM_PER_PAGE = 0.2

/**
 * Spine width of the printed block (docs/design.md "Spine width"): 8 mm +
 * 0.2 mm per page, 12 mm at the 20-page minimum (kit "12 mm"), 32 mm at 120.
 * Short books print padded to 20 pages, so the count is clamped first.
 */
export function spineWidthForPages(pages: number): number {
  const printed = Math.min(PAGE_MAX, Math.max(PAGE_MIN, pages))
  return Math.round((SPINE_BOARD_MM + printed * SPINE_MM_PER_PAGE) * 10) / 10
}

/** The spine the canvas, inspector and cover card draw (stored width is ignored). */
export function bookSpineWidthMm(book: Pick<Book, 'spreads'>): number {
  return spineWidthForPages(pagesOf(book.spreads.length))
}

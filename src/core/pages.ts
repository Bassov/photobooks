import {
  bookCoverGeometry,
  type CoverGeometryBook,
} from './print/coverGeometry'

/** Kit v7.tsx:27 printable page range; pages come in spreads of 2. */
export const PAGE_MIN = 20
export const PAGE_MAX = 120
export const PAGE_STEP = 2

/**
 * Printed pages of a book with `spreads` spreads, the pages the list shows:
 * a single page 1, two per inner spread and a single last page (the sum of
 * `getSpreadPageCount`). The kit's `pagesOf(n) = 2n` (v7.tsx:29) counts its
 * spreads plus a separate last-page row, so it agrees for n + 1 spreads here.
 */
export function pagesOf(spreads: number): number {
  return spreads <= 1 ? Math.max(0, spreads) : 2 * (spreads - 1)
}

/** Count text of the top bar, library caption and site meta: `1 page`, `N pages`. */
export function pagesText(pages: number): string {
  return `${String(pages)} ${pages === 1 ? 'page' : 'pages'}`
}

/** Spreads that print `pages` pages (inverse of `pagesOf` on even counts ≥ 2). */
export function spreadsForPages(pages: number): number {
  return pages / PAGE_STEP + 1
}

/**
 * Kit list label of spread `i`: `1`, then `2–3`, `4–5`…; with the book's
 * `spreadCount`, a single last page reads its own number (`8`, not `8–9`).
 */
export function pageLabel(
  i: number,
  spreadCount = Number.POSITIVE_INFINITY,
): string {
  if (i === 0) return '1'
  if (i === spreadCount - 1) return String(i * 2)
  return `${String(i * 2)}–${String(i * 2 + 1)}`
}

/** A typed page count: nearest even number inside 20–120; NaN stays NaN. */
export function clampPageCount(pages: number): number {
  const even = Math.round(pages / PAGE_STEP) * PAGE_STEP
  return Math.min(PAGE_MAX, Math.max(PAGE_MIN, even))
}

/**
 * The spine the canvas, inspector and cover card draw: the print profile's
 * rule at the page count (generic 8 + 0.2 mm/page, docs/design.md "Spine
 * width"), or the stored width for a manual spine the profile allows.
 */
export function bookSpineWidthMm(book: CoverGeometryBook): number {
  return bookCoverGeometry(book).spine
}

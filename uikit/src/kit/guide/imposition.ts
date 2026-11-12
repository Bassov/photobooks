/** One printed sheet of a saddle-stitched booklet: [left, right] page numbers on each side. */
export type Sheet = { front: [number, number]; back: [number, number] }

/** Pages rounded up to whole sheets (4 pages per sheet). Pages past `pages` print blank, at the end of the book. */
export const paddedPages = (pages: number) => Math.ceil(pages / 4) * 4

/**
 * Saddle-stitch order: sheet 0 is the outside, the last sheet the middle. Sheet i front [N − 2i, 1 + 2i],
 * back [2 + 2i, N − 1 − 2i], N = pages padded to a multiple of 4. `booklet-imposition` in prod uses the same order.
 */
export function saddleSheets(pages: number): Sheet[] {
  const n = paddedPages(pages)
  return Array.from({ length: n / 4 }, (_, i) => ({ front: [n - 2 * i, 1 + 2 * i], back: [2 + 2 * i, n - 1 - 2 * i] }))
}

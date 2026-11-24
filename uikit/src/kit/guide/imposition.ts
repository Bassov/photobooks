// Copy of src/core/print/imposition.ts (the kit cannot import prod); e2e/kit-guide.spec.ts compares them.

/** `2up`: saddle-stitch, two pages a side; `4up`: two saddle sheets a side, cut across. */
export type ImpositionLayout = '2up' | '4up'

/** A 1-based page number, or `null` for blank paper. */
export type ImposedSlot = number | null

/** One piece of paper, printed on both sides. */
export interface ImposedSheet {
  /** Slots left to right, then top to bottom, as seen on that side. */
  front: ImposedSlot[]
  /** The back as seen after flipping the sheet left to right (duplex). */
  back: ImposedSlot[]
}

export interface Imposition {
  columns: number
  rows: number
  /** Blank pages added; they sit just before the last page (the back cover). */
  blanks: number
  sheets: ImposedSheet[]
}

const ROWS: Record<ImpositionLayout, number> = { '2up': 1, '4up': 2 }

/** Pages on both sides of one sheet: 4 for 2-up, 8 for 4-up. */
function pagesPerSheet(layout: ImpositionLayout): number {
  return 4 * ROWS[layout]
}

/** Sheets of paper (front and back count as one) for `pages` pages. */
export function sheetCount(pages: number, layout: ImpositionLayout): number {
  return Math.ceil(pages / pagesPerSheet(layout))
}

/**
 * Sheet order for a booklet of `pages` pages. The page count is padded to
 * a whole number of sheets; the last page stays last (the back cover) and
 * the blanks go just before it. Saddle sheet `s` of `P` padded pages holds
 * `[P−2s, 1+2s]` on the front and `[2+2s, P−1−2s]` on the back; stacked in
 * order and folded, the pages read 1..`pages`. 4-up puts saddle sheets
 * `2k` (top) and `2k+1` (bottom) on sheet `k`: cut across, stack the top
 * half on the bottom half, fold.
 */
export function imposition(
  pages: number,
  layout: ImpositionLayout,
): Imposition {
  const rows = ROWS[layout]
  const sheets = sheetCount(pages, layout)
  const padded = sheets * pagesPerSheet(layout)
  const body = pages > 1 ? pages - 1 : pages
  const at = (position: number): ImposedSlot => {
    if (position <= body) return position
    return position === padded && pages > body ? pages : null
  }
  const saddle = (s: number) => ({
    front: [at(padded - 2 * s), at(1 + 2 * s)],
    back: [at(2 + 2 * s), at(padded - 1 - 2 * s)],
  })
  return {
    columns: 2,
    rows,
    blanks: padded - pages,
    sheets: Array.from({ length: sheets }, (_, k) => {
      const halves = Array.from({ length: rows }, (_, row) =>
        saddle(k * rows + row),
      )
      return {
        front: halves.flatMap((half) => half.front),
        back: halves.flatMap((half) => half.back),
      }
    }),
  }
}

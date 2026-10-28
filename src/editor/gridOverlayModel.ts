import {
  effectiveGrid,
  getSpreadPageCount,
  type Book,
  type GridValues,
  type RectMm,
} from '../core'

export interface PageGridRects {
  /** Page box on the spread. */
  page: RectMm
  /** Margins applied: the content box. */
  content: RectMm
  columns: RectMm[]
  rows: RectMm[]
}

/** Equal bands of `count` separated by `gutter`, clamped so they never go negative. */
function bands(
  start: number,
  length: number,
  count: number,
  gutter: number,
): { start: number; size: number }[] {
  const size = Math.max(0, (length - (count - 1) * gutter) / count)
  return Array.from({ length: count }, (_, i) => ({
    start: start + i * (size + gutter),
    size,
  }))
}

/**
 * Per-page grid rects of one spread. Facing pages mirror: `inside` is the
 * spine side, so it is the right edge of a left-hand page and the left edge of
 * a right-hand page. A lone first / only page is right-hand, a lone last page
 * left-hand.
 */
export function pageGridRects(
  book: Book,
  spreadIndex: number,
  values: GridValues = effectiveGrid(book, book.spreads[spreadIndex]).values,
): PageGridRects[] {
  const { widthMm, heightMm } = book.settings.trim
  const count = getSpreadPageCount(spreadIndex, book.spreads.length)
  return Array.from({ length: count }, (_, p) => {
    // A lone page past the cover is the last (left-hand) one.
    const leftHand = count === 2 ? p === 0 : spreadIndex > 0
    const marginLeft = leftHand ? values.outside : values.inside
    const marginRight = leftHand ? values.inside : values.outside
    const x = p * widthMm
    const content: RectMm = {
      x: x + marginLeft,
      y: values.top,
      width: Math.max(0, widthMm - marginLeft - marginRight),
      height: Math.max(0, heightMm - values.top - values.bottom),
    }
    return {
      page: { x, y: 0, width: widthMm, height: heightMm },
      content,
      columns: bands(
        content.x,
        content.width,
        values.columns,
        values.columnGutterMm,
      ).map((b) => ({
        x: b.start,
        y: content.y,
        width: b.size,
        height: content.height,
      })),
      rows: bands(
        content.y,
        content.height,
        values.rows,
        values.rowGutterMm,
      ).map((b) => ({
        x: content.x,
        y: b.start,
        width: content.width,
        height: b.size,
      })),
    }
  })
}

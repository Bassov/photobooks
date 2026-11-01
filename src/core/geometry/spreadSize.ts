import type { Book } from '../schema'
import type { PageCut } from './types'

export function getSpreadPageCount(
  spreadIndex: number,
  spreadCount: number,
): 1 | 2 {
  if (spreadCount <= 1) {
    return 1
  }
  if (spreadIndex === 0 || spreadIndex === spreadCount - 1) {
    return 1
  }
  return 2
}

/**
 * Half of a spread-wide slot that a single page sits on (kit `#/demo`): page 1
 * on the right, a single last page on the left. Two-page spreads and the only
 * spread of a one-spread book have no side.
 */
export function getSinglePageSide(
  spreadIndex: number,
  spreadCount: number,
): 'left' | 'right' | null {
  if (spreadCount <= 1) {
    return null
  }
  if (spreadIndex === 0) {
    return 'right'
  }
  return spreadIndex === spreadCount - 1 ? 'left' : null
}

/** Pages a spread's slot spans: a single page on its side keeps a spread-wide slot. */
export function getSpreadSlotPageCount(
  spreadIndex: number,
  spreadCount: number,
): 1 | 2 {
  return getSinglePageSide(spreadIndex, spreadCount) === null
    ? getSpreadPageCount(spreadIndex, spreadCount)
    : 2
}

export function getSpreadSizeMm(
  book: Book,
  spreadIndex: number,
): { widthMm: number; heightMm: number; pageCount: 1 | 2 } {
  const pageCount = getSpreadPageCount(spreadIndex, book.spreads.length)
  const { widthMm, heightMm } = book.settings.trim
  return {
    widthMm: pageCount === 1 ? widthMm : widthMm * 2,
    heightMm,
    pageCount,
  }
}

export function getPageCuts(book: Book, spreadIndex: number): PageCut[] {
  const { pageCount } = getSpreadSizeMm(book, spreadIndex)
  if (pageCount === 1) {
    return []
  }
  return [{ orientation: 'vertical', offsetMm: book.settings.trim.widthMm }]
}

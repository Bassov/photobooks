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

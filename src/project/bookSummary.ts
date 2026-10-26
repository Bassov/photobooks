import type { Book } from '../core'
import type { BookSummary } from './types'

/** Build a list summary from a parsed book document. */
export function bookSummaryFromBook(book: Book): BookSummary {
  return {
    id: book.id,
    title: book.title ?? '',
    spreadCount: book.spreads.length,
    pageWidthMm: book.settings.trim.widthMm,
    pageHeightMm: book.settings.trim.heightMm,
  }
}

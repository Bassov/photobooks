import type { Book } from '../core'
import type { BookSummary } from './types'

/** Build a list summary from a parsed book document. */
export function bookSummaryFromBook(
  book: Book,
  options?: { editedAtMs?: number },
): BookSummary {
  const summary: BookSummary = {
    id: book.id,
    title: book.title ?? '',
    spreadCount: book.spreads.length,
    pageWidthMm: book.settings.trim.widthMm,
    pageHeightMm: book.settings.trim.heightMm,
  }
  if (options?.editedAtMs !== undefined) {
    summary.editedAtMs = options.editedAtMs
  }
  return summary
}

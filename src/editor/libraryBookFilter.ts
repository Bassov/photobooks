import { displayBookTitle, type BookSummary } from '../project'
import { bookFormatFromTrim, type BookObjectFmt } from './bookObjectLayout'

export type LibrarySortKey = 'edited' | 'title' | 'created'

export interface LibraryGridBook {
  id: string
  title: string
  displayTitle: string
  fmt: BookObjectFmt
  spreads: number
  editedAtMs?: number
  coverCacheKey?: string
  /** CSS object-position of the cover photo, e.g. `30% 40%`. */
  coverPos?: string
}

export function toLibraryGridBook(summary: BookSummary): LibraryGridBook {
  const width = summary.pageWidthMm ?? 300
  const height = summary.pageHeightMm ?? 300
  const book: LibraryGridBook = {
    id: summary.id,
    title: summary.title,
    displayTitle: displayBookTitle(summary.title),
    fmt: bookFormatFromTrim(width, height),
    spreads: summary.spreadCount ?? 0,
  }
  if (summary.editedAtMs !== undefined) {
    book.editedAtMs = summary.editedAtMs
  }
  if (summary.coverCacheKey !== undefined) {
    book.coverCacheKey = summary.coverCacheKey
    if (summary.coverCenter !== undefined) {
      book.coverPos = `${String(summary.coverCenter.x * 100)}% ${String(summary.coverCenter.y * 100)}%`
    }
  }
  return book
}

/** Filter by title and sort for the library grid. */
export function filterAndSortLibraryBooks(
  books: readonly LibraryGridBook[],
  query: string,
  sort: LibrarySortKey,
): LibraryGridBook[] {
  const q = query.trim().toLocaleLowerCase()
  const list = books.filter(
    (b) => !q || b.displayTitle.toLocaleLowerCase().includes(q),
  )
  if (sort === 'title') {
    return [...list].sort((a, b) =>
      a.displayTitle.localeCompare(b.displayTitle),
    )
  }
  if (sort === 'created') {
    return [...list].reverse()
  }
  return [...list].sort((a, b) => (b.editedAtMs ?? 0) - (a.editedAtMs ?? 0))
}

import type { ReactNode } from 'react'
import {
  bookCoverStageHeight,
  bookFloorBackground,
  bookObjectDisplayHeight,
  bookObjectWidthForHeight,
} from './bookObjectLayout'
import { BookObject } from './BookObject'
import type { LibraryGridBook } from './libraryBookFilter'
import { formatLibraryBookMeta } from './libraryEditedLabel'

const DEFAULT_H = 236

/** Library book card: cover object + caption + optional menu. */
export function BookTile({
  book,
  H = DEFAULT_H,
  onOpen,
  menu,
  title,
  nowMs,
}: {
  book: LibraryGridBook
  H?: number
  onOpen?: () => void
  menu?: ReactNode
  title?: ReactNode
  nowMs?: number
}) {
  const objectH = bookObjectDisplayHeight(H, book.fmt)
  const captionW = bookObjectWidthForHeight(objectH, book.fmt)
  const pageCount = book.spreads * 2
  const meta = formatLibraryBookMeta(pageCount, book.editedAtMs, nowMs)
  return (
    <div className="group pt-8" data-testid="book-card">
      <button
        type="button"
        onClick={onOpen}
        className="pb-lib-book block w-full cursor-pointer"
        aria-label={`Open ${book.displayTitle}, ${String(pageCount)} pages`}
        data-testid={`library-book-${book.id}`}
      >
        <div
          className="relative flex items-end justify-center"
          style={{ height: bookCoverStageHeight(H) }}
          data-testid="book-cover-stage"
          data-stage-height={String(bookCoverStageHeight(H))}
        >
          <div
            className="pb-lib-floor pointer-events-none absolute bottom-[-6px] left-1/2 h-6 w-[70%] -translate-x-1/2 rounded-[50%]"
            data-testid="book-floor"
            style={{ background: bookFloorBackground() }}
          />
          <div className="pb-lib-obj relative">
            <BookObject title={book.displayTitle} fmt={book.fmt} h={objectH} />
          </div>
        </div>
      </button>
      <div
        className="relative mx-auto mt-5"
        style={{ width: captionW }}
        data-testid="book-caption"
        data-caption-width={String(captionW)}
      >
        <div
          className={menu ? 'min-w-0 pr-8' : 'min-w-0'}
          data-testid="book-title-row"
        >
          {title ?? (
            <div className="truncate text-left text-base font-medium text-foreground">
              {book.displayTitle}
            </div>
          )}
        </div>
        <div
          className="mt-0.5 text-left text-xs tabular-nums text-muted-foreground"
          data-testid="book-meta"
        >
          {meta}
        </div>
        {menu ? (
          <div className="absolute right-0 top-0" data-testid="book-menu-slot">
            {menu}
          </div>
        ) : null}
      </div>
    </div>
  )
}

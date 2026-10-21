import { getBookStoreSnapshot } from './bookStore'

/** True when the session book has gallery photos or any placed frame. */
export function editorHasContent(): boolean {
  const book = getBookStoreSnapshot().book
  if (book.gallery.length > 0) {
    return true
  }
  return book.spreads.some((spread) =>
    spread.frames.some((frame) => frame.assetId !== undefined),
  )
}

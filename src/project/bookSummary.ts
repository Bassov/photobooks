import { tryCacheKeyFromAsset } from '../assets/cacheKey'
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
  const { assetId, crop } = book.cover.front
  const coverAsset = assetId === undefined ? undefined : book.assets[assetId]
  const coverCacheKey =
    coverAsset === undefined ? undefined : tryCacheKeyFromAsset(coverAsset)
  if (coverCacheKey !== undefined) {
    summary.coverCacheKey = coverCacheKey
    if (crop !== undefined) {
      summary.coverCenter = { x: crop.center.x, y: crop.center.y }
    }
  }
  return summary
}

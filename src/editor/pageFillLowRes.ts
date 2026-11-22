import {
  bookDpiThresholds,
  frameDpi,
  lowDpi,
  sourceCropRect,
  type DpiThresholds,
} from '../core'
import {
  getAssetPixelSizeSnapshot,
  getBookPrintProfiles,
  getBookStoreSnapshot,
} from './bookStore'

/**
 * Filmstrip "Low-res" rule (Designer r15 M85): the canvas low-res badge
 * threshold, checked for the photo filling one page of the book (fill crop,
 * no zoom). Reads pixel dimensions only, so it never decodes.
 */
export function pageFillLowRes(
  trim: { widthMm: number; heightMm: number },
  size: { widthPx: number; heightPx: number },
  thresholds: DpiThresholds,
): boolean {
  const pageMm = { x: 0, y: 0, width: trim.widthMm, height: trim.heightMm }
  const crop = sourceCropRect(pageMm, undefined, size.widthPx / size.heightPx)
  const dpi = frameDpi(pageMm, crop, 0, size.widthPx, size.heightPx)
  return lowDpi(dpi, thresholds) !== undefined
}

function assetLowRes(
  id: string,
  trim: { widthMm: number; heightMm: number },
  thresholds: DpiThresholds,
): boolean {
  const size = getAssetPixelSizeSnapshot(id)
  return size !== undefined && pageFillLowRes(trim, size, thresholds)
}

/**
 * The filmstrip Low-res chip predicate: stored or decoded pixel size against
 * the current trim and print profile; unknown size → false.
 */
export function isAssetLowRes(id: string): boolean {
  const { book } = getBookStoreSnapshot()
  return assetLowRes(
    id,
    book.settings.trim,
    bookDpiThresholds(book, getBookPrintProfiles()),
  )
}

let countCache:
  | { deps: readonly unknown[]; ids: readonly string[]; count: number }
  | undefined

/**
 * Photos header "· N low-res" (Designer P11): how many of `ids` carry the
 * chip. Memoized on the inputs the predicate reads, so frame edits that leave
 * assets, trim, print profile and session sizes alone do not recount.
 */
export function countLowResAssets(ids: readonly string[]): number {
  const { book, sessionMeta } = getBookStoreSnapshot()
  const profiles = getBookPrintProfiles()
  const deps = [
    book.assets,
    book.settings.trim,
    book.printProfile,
    sessionMeta,
    profiles,
  ]
  if (
    countCache?.ids === ids &&
    countCache.deps.every((dep, index) => dep === deps[index])
  ) {
    return countCache.count
  }
  const trim = book.settings.trim
  const thresholds = bookDpiThresholds(book, profiles)
  const count = ids.filter((id) => assetLowRes(id, trim, thresholds)).length
  countCache = { deps, ids, count }
  return count
}

import type { Book, Frame } from '../schema'
import { applyCustomLayout, applyTemplate } from '../templates/apply'
import { photoAspectClass, type AspectClass } from '../templates/aspect'
import { bestLayout } from '../templates/best'
import type { SavedTemplate } from '../templates/custom'
import { findSpreadFrame, updateFrame, updateSpread } from '../update'
import { takesPhoto, withPlacedAsset } from './place'
import { addSpread, nextSpreadId } from './spreads'

type Asset = Book['assets'][string]

interface UsableAsset {
  id: string
  asset: Asset
}

/** Gallery assets only, first occurrence wins, caller order kept. */
function usableAssets(book: Book, assetIds: readonly string[]): UsableAsset[] {
  const seen = new Set<string>()
  const usable: UsableAsset[] = []
  for (const id of assetIds) {
    const asset = book.assets[id]
    if (asset === undefined || seen.has(id) || !book.gallery.includes(id)) {
      continue
    }
    seen.add(id)
    usable.push({ id, asset })
  }
  return usable
}

function withAsset(frame: Frame, assetId: string): Frame {
  if (frame.assetId === assetId) {
    return frame
  }
  return withPlacedAsset(frame, assetId)
}

function fillFrames(
  book: Book,
  spreadId: string,
  firstFrameId: string | undefined,
  assetIds: readonly string[],
): Book {
  return updateSpread(book, spreadId, (spread) => {
    const first = spread.frames.findIndex((frame) => frame.id === firstFrameId)
    const order: number[] = first < 0 ? [] : [first]
    spread.frames.forEach((frame, index) => {
      // A locked or text frame never takes a photo.
      if (index !== first && frame.assetId === undefined && takesPhoto(frame)) {
        order.push(index)
      }
    })
    const frames = spread.frames.map((frame, index) => {
      const assetId = assetIds[order.indexOf(index)]
      return assetId === undefined ? frame : withAsset(frame, assetId)
    })
    return { ...spread, frames }
  })
}

/**
 * Place photos in order: the target frame first (replaced if filled), then the
 * remaining empty unlocked frames in frame order. Extra photos are ignored; a
 * locked target leaves the book as is.
 */
export function fillSpread(
  book: Book,
  spreadId: string,
  frameId: string,
  assetIds: readonly string[],
): Book {
  const spread = book.spreads.find((candidate) => candidate.id === spreadId)
  const target =
    spread === undefined ? spread : findSpreadFrame(spread, frameId)
  if (target === undefined || !takesPhoto(target)) {
    return book
  }
  const usable = usableAssets(book, assetIds)
  const [first, ...rest] = usable.map(({ id }) => id)
  if (first === undefined) {
    return book
  }
  if (spread?.frames.includes(target) !== true) {
    // A local copy of a parent item takes the first photo, own frames the rest.
    const placed = updateFrame(book, spreadId, frameId, (frame) =>
      withAsset(frame, first),
    )
    return fillFrames(placed, spreadId, undefined, rest)
  }
  return fillFrames(book, spreadId, frameId, [first, ...rest])
}

function assetAspectClass({ asset }: UsableAsset): AspectClass {
  const { widthPx, heightPx } = asset
  return widthPx === undefined || heightPx === undefined
    ? 'square'
    : photoAspectClass(widthPx, heightPx)
}

/**
 * Insert a spread at `index` with the best-fit template (a builtin or one of
 * the user's `saved` layouts) and place photos in order.
 */
export function insertSpreadWithAssets(
  book: Book,
  index: number,
  assetIds: readonly string[],
  saved: readonly SavedTemplate[],
): Book {
  const usable = usableAssets(book, assetIds)
  if (usable.length === 0) {
    return book
  }
  const spreadId = nextSpreadId(book)
  const added = addSpread(book, { index, id: spreadId })
  const at = Math.max(0, Math.min(index, book.spreads.length))
  const layout = bestLayout(added, at, usable.map(assetAspectClass), saved)
  const templated =
    typeof layout === 'string'
      ? applyTemplate(added, spreadId, layout)
      : applyCustomLayout(
          added,
          spreadId,
          layout.id,
          layout.slots,
          layout.pages,
        )
  return fillFrames(
    templated,
    spreadId,
    undefined,
    usable.map(({ id }) => id),
  )
}

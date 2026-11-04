import type { Book } from '../schema'
import { clearRemovedCoverAssets } from '../cover'
import { spreadFrames, updateSpread, withChangedCopies } from '../update'
import { withoutPlacement } from './place'

export function addToGallery(book: Book, assetIds: readonly string[]): Book {
  if (assetIds.length === 0) {
    return book
  }
  let assets = book.assets
  let gallery = book.gallery
  let changed = false
  for (const assetId of assetIds) {
    if (gallery.includes(assetId)) {
      continue
    }
    if (assets[assetId] === undefined) {
      assets = { ...assets, [assetId]: {} }
    }
    gallery = [...gallery, assetId]
    changed = true
  }
  if (!changed) {
    return book
  }
  return { ...book, assets, gallery }
}

export function removeFromGallery(book: Book, assetId: string): Book {
  return removeManyFromGallery(book, [assetId])
}

/** Drop many gallery assets in one pass (placements cascade). */
export function removeManyFromGallery(
  book: Book,
  assetIds: readonly string[],
): Book {
  const remove = new Set(assetIds)
  let anyPresent = false
  for (const assetId of remove) {
    if (assetId in book.assets || book.gallery.includes(assetId)) {
      anyPresent = true
      break
    }
  }
  if (!anyPresent) {
    return book
  }

  const gallery = book.gallery.filter((id) => !remove.has(id))
  const assets = Object.fromEntries(
    Object.entries(book.assets).filter(([id]) => !remove.has(id)),
  )

  let next: Book = clearRemovedCoverAssets({ ...book, assets, gallery }, remove)
  for (const spread of book.spreads) {
    next = updateSpread(next, spread.id, (current) => {
      const unplaced = new Map(
        spreadFrames(current)
          .filter(({ assetId }) => assetId !== undefined && remove.has(assetId))
          .map((frame) => [frame.id, withoutPlacement(frame)]),
      )
      if (unplaced.size === 0) {
        return current
      }
      const frames = current.frames.map(
        (frame) => unplaced.get(frame.id) ?? frame,
      )
      return withChangedCopies({ ...current, frames }, unplaced)
    })
  }
  return next
}

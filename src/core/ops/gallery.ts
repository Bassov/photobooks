import type { Book, Frame } from '../schema'
import { updateSpread } from '../update'

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

  let next: Book = { ...book, assets, gallery }
  for (const spread of book.spreads) {
    next = updateSpread(next, spread.id, (current) => {
      const frames = current.frames.map((frame) => {
        if (frame.assetId !== undefined && remove.has(frame.assetId)) {
          return clearAsset(frame)
        }
        return frame
      })
      if (frames.every((frame, index) => frame === current.frames[index])) {
        return current
      }
      return { ...current, frames }
    })
  }
  return next
}

function clearAsset(frame: Frame): Frame {
  return {
    id: frame.id,
    rect: frame.rect,
    z: frame.z,
  }
}

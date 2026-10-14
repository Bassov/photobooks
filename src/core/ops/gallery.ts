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
  if (!(assetId in book.assets) && !book.gallery.includes(assetId)) {
    return book
  }

  const gallery = book.gallery.filter((id) => id !== assetId)
  const assets = Object.fromEntries(
    Object.entries(book.assets).filter(([id]) => id !== assetId),
  )

  let next: Book = { ...book, assets, gallery }
  for (const spread of book.spreads) {
    const hasPlacement = spread.frames.some(
      (frame) => frame.assetId === assetId,
    )
    if (!hasPlacement) {
      continue
    }
    next = updateSpread(next, spread.id, (current) => {
      const frames = current.frames.map((frame) => clearAsset(frame, assetId))
      if (frames.every((frame, index) => frame === current.frames[index])) {
        return current
      }
      return { ...current, frames }
    })
  }
  return next
}

function clearAsset(frame: Frame, assetId: string): Frame {
  if (frame.assetId !== assetId) {
    return frame
  }
  return {
    id: frame.id,
    rect: frame.rect,
    z: frame.z,
  }
}

import type { Book } from '../schema'

export function placementCountByAsset(book: Book): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const spread of book.spreads) {
    for (const frame of spread.frames) {
      if (frame.assetId === undefined) {
        continue
      }
      counts.set(frame.assetId, (counts.get(frame.assetId) ?? 0) + 1)
    }
  }
  return counts
}

/** True when any frame in the book has a placed asset. */
export function bookHasAnyPlacement(book: Book): boolean {
  return book.spreads.some((spread) =>
    spread.frames.some((frame) => frame.assetId !== undefined),
  )
}

export function unplacedAssetIds(book: Book): string[] {
  const counts = placementCountByAsset(book)
  return book.gallery.filter((assetId) => (counts.get(assetId) ?? 0) === 0)
}

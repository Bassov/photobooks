import type { Book, Frame } from '../schema'
import { spreadFrames } from '../update'

/** One place an asset sits in the book. */
export type Place =
  | { kind: 'cover'; panel: 'front' | 'spine' | 'back' }
  | { kind: 'endpaper'; side: 'front' | 'back' }
  | { kind: 'frame'; spreadId: string; frameId: string }

const COVER_PANELS = ['front', 'spine', 'back'] as const

const byZ = (frames: readonly Frame[]): Frame[] =>
  [...frames].sort((a, b) => a.z - b.z)

/**
 * Every placed asset in spread-list order: cover front / spine / back, front
 * endpaper, each spread in paint order — local copies first (by z, painted
 * beneath as part of the parent layer), then own frames (by z) — back endpaper.
 */
function* bookPlacements(book: Book): Generator<readonly [string, Place]> {
  for (const panel of COVER_PANELS) {
    const { assetId } = book.cover[panel]
    if (assetId !== undefined) {
      yield [assetId, { kind: 'cover', panel }]
    }
  }
  if (book.endpapers.front.assetId !== undefined) {
    yield [book.endpapers.front.assetId, { kind: 'endpaper', side: 'front' }]
  }
  for (const spread of book.spreads) {
    const frames = [
      ...byZ(spread.parentOverrides?.frames ?? []),
      ...byZ(spread.frames),
    ]
    for (const frame of frames) {
      if (frame.assetId !== undefined) {
        yield [
          frame.assetId,
          { kind: 'frame', spreadId: spread.id, frameId: frame.id },
        ]
      }
    }
  }
  if (book.endpapers.back.assetId !== undefined) {
    yield [book.endpapers.back.assetId, { kind: 'endpaper', side: 'back' }]
  }
}

/** Placements per asset: spread frames and local copies plus cover panels and endpapers. */
export function placementCountByAsset(book: Book): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const [assetId] of bookPlacements(book)) {
    counts.set(assetId, (counts.get(assetId) ?? 0) + 1)
  }
  return counts
}

/** Where `assetId` sits, in spread-list order (the places `placementCountByAsset` counts). */
export function placementsOfAsset(book: Book, assetId: string): Place[] {
  const places: Place[] = []
  for (const [placed, place] of bookPlacements(book)) {
    if (placed === assetId) {
      places.push(place)
    }
  }
  return places
}

/** True when any frame in the book has a placed asset. */
export function bookHasAnyPlacement(book: Book): boolean {
  return book.spreads.some((spread) =>
    spreadFrames(spread).some((frame) => frame.assetId !== undefined),
  )
}

export function unplacedAssetIds(book: Book): string[] {
  const counts = placementCountByAsset(book)
  return book.gallery.filter((assetId) => (counts.get(assetId) ?? 0) === 0)
}

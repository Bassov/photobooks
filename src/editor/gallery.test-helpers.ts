import {
  getBookStoreSnapshot,
  resetBookStore,
  type AssetSessionMeta,
} from './bookStore'

/** Seed the in-memory gallery immediately (no rAF flush). */
export function seedGallery(count: number): readonly string[] {
  resetBookStore()
  const ids = Array.from(
    { length: count },
    (_, index) => `seed-${String(index)}`,
  )
  const snap = getBookStoreSnapshot()
  const assets: Record<string, Record<string, never>> = {}
  const sessionMeta = new Map<string, AssetSessionMeta>()
  for (const id of ids) {
    assets[id] = {}
    sessionMeta.set(id, {
      name: id,
      correctedWidth: 144,
      correctedHeight: 96,
      orientation: 1,
      aspect: 1.5,
    })
  }
  resetBookStore({
    book: { ...snap.book, assets, gallery: ids },
    sessionMeta,
    importRunning: false,
    importExpectedCount: 0,
  })
  return ids
}

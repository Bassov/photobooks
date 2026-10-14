import {
  getBookStoreSnapshot,
  resetBookStore,
  type AssetSessionMeta,
} from './bookStore'

/** Seed the in-memory gallery immediately (no rAF flush). */
export function seedGallery(count: number, aspect = 1.5): readonly string[] {
  resetBookStore()
  const ids = Array.from(
    { length: count },
    (_, index) => `seed-${String(index)}`,
  )
  const snap = getBookStoreSnapshot()
  const assets: Record<string, Record<string, never>> = {}
  const sessionMeta = new Map<string, AssetSessionMeta>()
  const height = 100
  const width = Math.max(1, Math.round(height * aspect))
  for (const id of ids) {
    assets[id] = {}
    sessionMeta.set(id, {
      name: id,
      correctedWidth: width,
      correctedHeight: height,
      orientation: 1,
      aspect,
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

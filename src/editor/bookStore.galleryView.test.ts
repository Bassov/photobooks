import { afterEach, describe, expect, it } from 'vitest'
import { placeAsset } from '../core'
import {
  getAssetTimeMs,
  getBookStoreSnapshot,
  getPlacedAssetIdsSnapshot,
  patchAssetRecord,
  removeAssetFromGallery,
  resetBookStore,
} from './bookStore'
import { seedGallery } from './gallery.test-helpers'

function place(assetId: string): void {
  const snap = getBookStoreSnapshot()
  const spread = snap.book.spreads[0]
  const frameId = spread?.frames[0]?.id
  if (spread === undefined || frameId === undefined) {
    throw new Error('expected a frame')
  }
  resetBookStore({
    book: placeAsset(snap.book, spread.id, frameId, assetId),
    sessionMeta: snap.sessionMeta,
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('getPlacedAssetIdsSnapshot', () => {
  afterEach(() => {
    resetBookStore()
  })

  it('lists placed asset ids and is cached per book', () => {
    const ids = seedGallery(3)
    expect([...getPlacedAssetIdsSnapshot()]).toEqual([])
    place(ids[1] ?? '')
    const placed = getPlacedAssetIdsSnapshot()
    expect([...placed]).toEqual([ids[1]])
    expect(getPlacedAssetIdsSnapshot()).toBe(placed)
  })

  it('keeps the same set when the book changes without placement changes', () => {
    const ids = seedGallery(2)
    place(ids[0] ?? '')
    const placed = getPlacedAssetIdsSnapshot()
    patchAssetRecord(ids[1] ?? '', { capturedAt: '2024-01-01T00:00:00.000Z' })
    expect(getPlacedAssetIdsSnapshot()).toBe(placed)
  })

  it('returns a new set when a different asset takes the placement', () => {
    const ids = seedGallery(2)
    place(ids[0] ?? '')
    const before = getPlacedAssetIdsSnapshot()
    seedGallery(2)
    place(ids[1] ?? '')
    const after = getPlacedAssetIdsSnapshot()
    expect(after).not.toBe(before)
    expect([...after]).toEqual([ids[1]])
  })
})

describe('getAssetTimeMs', () => {
  afterEach(() => {
    resetBookStore()
  })

  it('prefers capturedAt, falls back to mtime, else null', () => {
    const ids = seedGallery(3)
    patchAssetRecord(ids[0] ?? '', {
      capturedAt: '2024-05-01T10:00:00.000Z',
      mtimeMs: 5,
    })
    patchAssetRecord(ids[1] ?? '', { mtimeMs: 1234 })
    expect(getAssetTimeMs(ids[0] ?? '')).toBe(
      Date.parse('2024-05-01T10:00:00.000Z'),
    )
    expect(getAssetTimeMs(ids[1] ?? '')).toBe(1234)
    expect(getAssetTimeMs(ids[2] ?? '')).toBeNull()
    expect(getAssetTimeMs('missing')).toBeNull()
  })

  it('falls back to mtime when capturedAt is unparsable', () => {
    const ids = seedGallery(1)
    patchAssetRecord(ids[0] ?? '', { capturedAt: 'garbage', mtimeMs: 99 })
    expect(getAssetTimeMs(ids[0] ?? '')).toBe(99)
  })
})

describe('removeAssetFromGallery', () => {
  afterEach(() => {
    resetBookStore()
  })

  it('removes the asset and empties frames that used it', () => {
    const ids = seedGallery(2)
    place(ids[0] ?? '')
    removeAssetFromGallery(ids[0] ?? '')
    const { book } = getBookStoreSnapshot()
    expect(book.gallery).toEqual([ids[1]])
    expect(book.assets[ids[0] ?? '']).toBeUndefined()
    expect(book.spreads[0]?.frames[0]?.assetId).toBeUndefined()
  })
})

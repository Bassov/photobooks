import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAssetSource, resetAssetSources } from '../photo/assetSources'
import { PAINTER_ASSET_IDS } from '../core/testing/painterFixture'
import {
  enqueueGalleryAssets,
  loadPainterFixture,
  getAssetAspectSnapshot,
  getAssetDisplayName,
  getPlacementCountSnapshot,
  getBookStoreSnapshot,
  getGalleryAspectsSnapshot,
  getGalleryDisplayNamesSnapshot,
  getGalleryIdsSnapshot,
  getSpacerCountSnapshot,
  mintAssetId,
  resetBookStore,
  setAssetSessionMeta,
  setImportRunning,
  subscribeBookStore,
  subscribeGallery,
  type AssetSessionMeta,
} from './bookStore'

function sessionFile(name: string, aspect = 1.5): AssetSessionMeta {
  return {
    name,
    correctedWidth: 30,
    correctedHeight: 20,
    orientation: 1,
    aspect,
  }
}

describe('bookStore', () => {
  afterEach(() => {
    resetBookStore()
    resetAssetSources()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('updates placement counts when the book changes', () => {
    expect(getPlacementCountSnapshot('painter-b')).toBe(0)

    loadPainterFixture()

    expect(getPlacementCountSnapshot('painter-b')).toBeGreaterThan(0)
    expect(getPlacementCountSnapshot('missing')).toBe(0)
  })

  it('retains a session file for each painter fixture asset', () => {
    loadPainterFixture()

    for (const assetId of PAINTER_ASSET_IDS) {
      expect(getAssetSource(assetId)?.type).toBe('image/png')
    }
    expect(getBookStoreSnapshot().book.id).toBe('painter-fixture')
  })

  it('mints unique asset ids with sanitized names', () => {
    expect(mintAssetId('a.jpg')).not.toBe(mintAssetId('a.jpg'))
    expect(mintAssetId('weird name!!.png')).toMatch(
      /^asset-\d+-weird_name_+\.png$/,
    )
  })

  it('appends gallery ids and session meta on rAF flush', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const listener = vi.fn()
    const unsubscribe = subscribeBookStore(listener)
    enqueueGalleryAssets([
      {
        assetId: 'a1',
        meta: {
          name: 'a.jpg',
          correctedWidth: 30,
          correctedHeight: 20,
          orientation: 1,
          aspect: 1.5,
        },
      },
    ])
    expect(getBookStoreSnapshot().book.gallery).toContain('a1')
    expect(getBookStoreSnapshot().sessionMeta.get('a1')?.aspect).toBe(1.5)
    expect(listener).toHaveBeenCalled()
    setAssetSessionMeta('a1', {
      name: 'a.jpg',
      correctedWidth: 40,
      correctedHeight: 20,
      orientation: 1,
      aspect: 2,
    })
    expect(getBookStoreSnapshot().sessionMeta.get('a1')?.aspect).toBe(2)
    unsubscribe()
  })

  it('uses placeholder meta when enqueue omits meta', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([{ assetId: 'plain' }])
    expect(getBookStoreSnapshot().sessionMeta.get('plain')).toEqual({
      name: 'plain',
      correctedWidth: 1,
      correctedHeight: 1,
      orientation: 1,
      aspect: 1,
    })
  })

  it('flushes gallery in chunks across animation frames', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    const ids = Array.from({ length: 10 }, (_, i) => `id-${String(i)}`)
    enqueueGalleryAssets(ids.map((assetId) => ({ assetId })))
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(0)

    callbacks[0]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(4)
    callbacks[1]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(8)
    callbacks[2]?.(0)
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(10)
  })

  it('exposes flushed gallery ids while import is running', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([{ assetId: 'before' }])
    expect(getGalleryIdsSnapshot()).toEqual(['before'])

    const galleryListener = vi.fn()
    subscribeGallery(galleryListener)
    setImportRunning(true, 5)
    expect(getSpacerCountSnapshot()).toBe(5)
    expect(getBookStoreSnapshot().importRunning).toBe(true)
    expect(galleryListener).toHaveBeenCalled()

    enqueueGalleryAssets([{ assetId: 'during' }])
    expect(getGalleryIdsSnapshot()).toEqual(['before', 'during'])
    expect(getBookStoreSnapshot().book.gallery).toEqual(['before', 'during'])

    setImportRunning(false)
    expect(getGalleryIdsSnapshot()).toEqual(['before', 'during'])
    expect(getSpacerCountSnapshot()).toBe(2)
    expect(getBookStoreSnapshot().importExpectedCount).toBe(0)
  })

  it('ignores redundant setImportRunning calls', () => {
    const galleryListener = vi.fn()
    subscribeGallery(galleryListener)
    setImportRunning(true, 3)
    galleryListener.mockClear()
    setImportRunning(true, 3)
    expect(galleryListener).not.toHaveBeenCalled()
  })

  it('notifies gallery subscribers only when gallery identity changes', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      {
        assetId: 'a1',
        meta: {
          name: 'a.jpg',
          correctedWidth: 10,
          correctedHeight: 10,
          orientation: 1,
          aspect: 1,
        },
      },
    ])
    const galleryListener = vi.fn()
    const storeListener = vi.fn()
    subscribeGallery(galleryListener)
    subscribeBookStore(storeListener)

    setAssetSessionMeta('a1', {
      name: 'a.jpg',
      correctedWidth: 20,
      correctedHeight: 10,
      orientation: 1,
      aspect: 2,
    })
    expect(storeListener).toHaveBeenCalled()
    expect(galleryListener).not.toHaveBeenCalled()
  })

  it('exposes stable gallery aspects that update with session meta', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      {
        assetId: 'a1',
        meta: {
          name: 'a.jpg',
          correctedWidth: 30,
          correctedHeight: 20,
          orientation: 1,
          aspect: 1.5,
        },
      },
    ])
    expect(getAssetAspectSnapshot('a1')).toBe(1.5)
    expect(getAssetAspectSnapshot('missing')).toBe(1)
    const first = getGalleryAspectsSnapshot()
    expect(first).toEqual([1.5])
    expect(getGalleryAspectsSnapshot()).toBe(first)

    setAssetSessionMeta('a1', {
      name: 'a.jpg',
      correctedWidth: 20,
      correctedHeight: 40,
      orientation: 1,
      aspect: 0.5,
    })
    const second = getGalleryAspectsSnapshot()
    expect(second).toEqual([0.5])
    expect(second).not.toBe(first)
  })

  it('keeps gallery display names stable until the session file name changes', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      { assetId: 'a1', meta: sessionFile('фото отпуск 01.jpg') },
    ])

    expect(getAssetDisplayName('a1')).toBe('фото отпуск 01.jpg')
    expect(getAssetDisplayName('missing')).toBe('missing')
    const first = getGalleryDisplayNamesSnapshot()
    expect(first).toEqual(['фото отпуск 01.jpg'])
    expect(getGalleryDisplayNamesSnapshot()).toBe(first)

    setAssetSessionMeta('a1', sessionFile('later.jpg'))

    const second = getGalleryDisplayNamesSnapshot()
    expect(second).toEqual(['later.jpg'])
    expect(second).not.toBe(first)
    expect(getGalleryIdsSnapshot()).toEqual(['a1'])
  })

  it('falls back to the asset id when the session file name is blank', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([{ assetId: 'a1', meta: sessionFile('') }])

    expect(getAssetDisplayName('a1')).toBe('a1')
    expect(getGalleryDisplayNamesSnapshot()).toEqual(['a1'])
  })
})

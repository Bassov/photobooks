import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueGalleryAssets,
  getBookStoreSnapshot,
  mintAssetId,
  resetBookStore,
  setAssetSessionMeta,
  subscribeBookStore,
} from './bookStore'

describe('bookStore', () => {
  afterEach(() => {
    resetBookStore()
    vi.restoreAllMocks()
  })

  it('mints unique asset ids', () => {
    expect(mintAssetId('a.jpg')).not.toBe(mintAssetId('a.jpg'))
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
})

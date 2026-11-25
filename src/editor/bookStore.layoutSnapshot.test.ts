import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  dispatchBookOp,
  enqueueGalleryAssets,
  getBookStoreSnapshot,
  getLayoutBookSnapshot,
  patchAssetRecord,
  resetBookStore,
} from './bookStore'

function flushRafImmediately(): void {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    cb(0)
    return 1
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  resetBookStore()
})

describe('getLayoutBookSnapshot', () => {
  it('keeps its identity while an import only grows gallery and assets', () => {
    // Arrange
    resetBookStore()
    flushRafImmediately()
    const before = getLayoutBookSnapshot()

    // Act
    enqueueGalleryAssets([
      { assetId: 'a1', asset: { sourceRootId: 'r', relativePath: 'a.jpg' } },
      { assetId: 'a2', asset: { sourceRootId: 'r', relativePath: 'b.jpg' } },
    ])
    patchAssetRecord('a1', { widthPx: 6000, heightPx: 4000 })

    // Assert
    const live = getBookStoreSnapshot().book
    expect(live.gallery).toEqual(['a1', 'a2'])
    expect(live).not.toBe(before)
    expect(getLayoutBookSnapshot()).toBe(before)
  })

  it('follows the live book once a layout field changes', () => {
    // Arrange
    resetBookStore()
    flushRafImmediately()
    enqueueGalleryAssets([{ assetId: 'a1' }])
    const before = getLayoutBookSnapshot()

    // Act
    dispatchBookOp({ type: 'addSpread' })

    // Assert
    const live = getBookStoreSnapshot().book
    expect(getLayoutBookSnapshot()).toBe(live)
    expect(live.spreads).toHaveLength(before.spreads.length + 1)
    expect(getLayoutBookSnapshot().gallery).toEqual(['a1'])
  })
})

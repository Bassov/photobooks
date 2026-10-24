import { describe, expect, it, vi } from 'vitest'

import {
  enqueueGalleryAssets,
  getGalleryRelativePathIndex,
  resetBookStore,
} from './bookStore'

describe('getGalleryRelativePathIndex', () => {
  it('includes still-pending enqueue relative paths before flush', () => {
    resetBookStore()
    // Do not stub rAF — leave records pending.
    vi.stubGlobal('requestAnimationFrame', (): number => 1)
    enqueueGalleryAssets([
      {
        assetId: 'pending-1',
        asset: {
          sourceRootId: 'r',
          relativePath: 'pending/a.jpg',
          byteSize: 1,
          mtimeMs: 1,
        },
      },
      {
        assetId: 'pending-empty',
        asset: { sourceRootId: 'r', relativePath: '' },
      },
    ])
    const index = getGalleryRelativePathIndex()
    expect(index.get('pending/a.jpg')).toBe('pending-1')
    expect(index.has('')).toBe(false)
  })
})

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAssetSources, retainAssetSource } from '../photo/assetSources'
import {
  enqueueGalleryAssets,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import {
  attachMemoryLibraryForTests,
  getRegisteredAssetSource,
  isLibraryBacked,
  resetProjectSessionForTests,
} from './projectSession'
import { resetPendingHashesForTests } from './pendingHashes'

const SAMPLE_HASH =
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

vi.mock('../assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../assets')>()
  return {
    ...actual,
    hashContent: vi.fn(() => Promise.resolve(SAMPLE_HASH)),
  }
})

describe('upgradeSessionAssetsForLibrary via adopt', () => {
  beforeEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
    resetAssetSources()
    resetPendingHashesForTests()
  })

  afterEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
    resetAssetSources()
    resetPendingHashesForTests()
    vi.clearAllMocks()
  })

  it('writes identity and contentHash for session Files on adopt', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'shot.jpg', {
      type: 'image/jpeg',
    })
    retainAssetSource('asset-session', file)
    enqueueGalleryAssets([
      {
        assetId: 'asset-session',
        meta: {
          name: 'shot.jpg',
          correctedWidth: 10,
          correctedHeight: 5,
          orientation: 1,
          aspect: 2,
        },
      },
    ])
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery).toContain('asset-session')
    })

    expect(
      getBookStoreSnapshot().book.assets['asset-session']?.sourceRootId,
    ).toBeUndefined()

    await attachMemoryLibraryForTests()
    expect(isLibraryBacked()).toBe(true)

    await vi.waitFor(() => {
      const asset = getBookStoreSnapshot().book.assets['asset-session']
      expect(asset?.sourceRootId).toBeDefined()
      expect(asset?.relativePath).toBe('shot.jpg')
      expect(asset?.byteSize).toBe(3)
      expect(asset?.contentHash).toBe(SAMPLE_HASH)
    })

    const rootId =
      getBookStoreSnapshot().book.assets['asset-session']?.sourceRootId
    expect(rootId).toBeDefined()
    assert(rootId !== undefined)
    expect(getRegisteredAssetSource(rootId)).toBeDefined()
  })

  it('skips assets that already have complete identity', async () => {
    const file = new File([new Uint8Array([9])], 'kept.jpg', {
      type: 'image/jpeg',
    })
    retainAssetSource('asset-kept', file)
    enqueueGalleryAssets([
      {
        assetId: 'asset-kept',
        meta: {
          name: 'kept.jpg',
          correctedWidth: 4,
          correctedHeight: 4,
          orientation: 1,
          aspect: 1,
        },
        asset: {
          sourceRootId: 'root-existing',
          relativePath: 'kept.jpg',
          byteSize: 1,
          mtimeMs: 1,
          contentHash: SAMPLE_HASH,
        },
      },
    ])
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery).toContain('asset-kept')
    })

    await attachMemoryLibraryForTests()
    await vi.waitFor(() => {
      expect(isLibraryBacked()).toBe(true)
    })
    expect(getBookStoreSnapshot().book.assets['asset-kept']?.sourceRootId).toBe(
      'root-existing',
    )
    expect(getRegisteredAssetSource('root-existing')).toBeUndefined()
  })

  it('skips gallery ids without a retained File', async () => {
    enqueueGalleryAssets([
      {
        assetId: 'asset-nofile',
        meta: {
          name: 'gone.jpg',
          correctedWidth: 1,
          correctedHeight: 1,
          orientation: 1,
          aspect: 1,
        },
      },
    ])
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery).toContain('asset-nofile')
    })
    await attachMemoryLibraryForTests()
    expect(
      getBookStoreSnapshot().book.assets['asset-nofile']?.sourceRootId,
    ).toBeUndefined()
  })
})

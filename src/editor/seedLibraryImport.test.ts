import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryAssetSource } from '../assets'
import {
  enqueueGalleryAssets,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import {
  getRegisteredAssetSource,
  registerAssetSource,
  resetProjectSessionForTests,
} from './projectSession'
import { memorySourceForRoot, seedAndHashEntry } from './seedLibraryImport'
import { resetPendingHashesForTests } from './pendingHashes'

const SAMPLE_HASH =
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'

const putCachedThumbForHash = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const putCachedTierForHash = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('../assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../assets')>()
  return {
    ...actual,
    hashContent: vi.fn(() => Promise.resolve(SAMPLE_HASH)),
  }
})

vi.mock('./thumbCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./thumbCache')>()
  return {
    ...actual,
    putCachedThumbForHash: (
      ...args: Parameters<typeof putCachedThumbForHash>
    ) => putCachedThumbForHash(...args),
  }
})

vi.mock('../photo/tierCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../photo/tierCache')>()
  return {
    ...actual,
    putCachedTierForHash: (...args: Parameters<typeof putCachedTierForHash>) =>
      putCachedTierForHash(...args),
  }
})

describe('seedLibraryImport', () => {
  beforeEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
    resetPendingHashesForTests()
    putCachedThumbForHash.mockClear()
    putCachedTierForHash.mockClear()
  })

  afterEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
    resetPendingHashesForTests()
    vi.unstubAllGlobals()
  })

  it('memorySourceForRoot reuses a registered MemoryAssetSource', () => {
    const first = memorySourceForRoot('root-reuse')
    const second = memorySourceForRoot('root-reuse')
    expect(second).toBe(first)
    expect(getRegisteredAssetSource('root-reuse')).toBe(first)
  })

  it('memorySourceForRoot replaces a non-seedable registered source', () => {
    registerAssetSource('root-plain', {
      scanRoot: () => Promise.resolve({ ok: true as const, value: [] }),
      readForHash: () =>
        Promise.resolve({ ok: false as const, code: 'not-found' as const }),
    })
    const created = memorySourceForRoot('root-plain')
    expect(typeof created.seedFile).toBe('function')
    expect(getRegisteredAssetSource('root-plain')).toBe(created)
  })

  it('seedAndHashEntry seeds bytes and patches contentHash when Worker exists', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    vi.stubGlobal(
      'Worker',
      class {
        terminate(): void {
          /* no-op */
        }
      },
    )
    enqueueGalleryAssets([
      {
        assetId: 'asset-seed',
        meta: {
          name: 's.jpg',
          correctedWidth: 1,
          correctedHeight: 1,
          orientation: 1,
          aspect: 1,
        },
      },
    ])
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery).toContain('asset-seed')
    })
    const source = createMemoryAssetSource()
    const seedSpy = vi.spyOn(source, 'seedFile')
    const file = new File([new Uint8Array([1, 2, 3])], 's.jpg', {
      type: 'image/jpeg',
    })
    await seedAndHashEntry({
      assetId: 'asset-seed',
      file,
      relativePath: 's.jpg',
      sourceRootId: 'root-seed',
      memorySource: source,
    })
    expect(seedSpy).toHaveBeenCalledWith(
      'root-seed',
      's.jpg',
      expect.any(ArrayBuffer),
      file.lastModified,
    )
    await vi.waitFor(() => {
      expect(
        getBookStoreSnapshot().book.assets['asset-seed']?.contentHash,
      ).toBe(SAMPLE_HASH)
    })
    expect(putCachedThumbForHash).toHaveBeenCalledWith(
      'asset-seed',
      SAMPLE_HASH,
    )
    expect(putCachedTierForHash).toHaveBeenCalledWith('asset-seed', SAMPLE_HASH)
  })

  it('seedAndHashEntry seeds without hashing when Worker is undefined', async () => {
    vi.stubGlobal('Worker', undefined)
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      {
        assetId: 'asset-nw',
        meta: {
          name: 'n.jpg',
          correctedWidth: 1,
          correctedHeight: 1,
          orientation: 1,
          aspect: 1,
        },
      },
    ])
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery).toContain('asset-nw')
    })
    const { hashContent } = await import('../assets')
    const hashSpy = vi.mocked(hashContent)
    hashSpy.mockClear()
    const source = createMemoryAssetSource()
    const seedSpy = vi.spyOn(source, 'seedFile')
    const file = new File([new Uint8Array([9])], 'n.jpg', {
      type: 'image/jpeg',
    })
    await seedAndHashEntry({
      assetId: 'asset-nw',
      file,
      relativePath: 'n.jpg',
      sourceRootId: 'root-no-worker',
      memorySource: source,
    })
    expect(seedSpy).toHaveBeenCalledOnce()
    expect(hashSpy).not.toHaveBeenCalled()
    expect(getBookStoreSnapshot().book.assets['asset-nw']?.contentHash).toBe(
      undefined,
    )
  })
})

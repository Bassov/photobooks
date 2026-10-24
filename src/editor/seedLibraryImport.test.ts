import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryAssetSource } from '../assets'
import { cacheKeyFromIdentity } from '../assets/cacheKey'
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
import { resetPendingHashesForTests, awaitPendingHashes } from './pendingHashes'

const putCachedThumbForHash = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const putCachedTierForHash = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('../assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../assets')>()
  return {
    ...actual,
    hashContent: vi.fn(() =>
      Promise.reject(new Error('hashContent must not run on seed path')),
    ),
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

  it('memorySourceForRoot does not overwrite a non-seedable registered source', () => {
    const fsaLike = {
      scanRoot: () => Promise.resolve({ ok: true as const, value: [] }),
      readForHash: () =>
        Promise.resolve({ ok: false as const, code: 'not-found' as const }),
    }
    registerAssetSource('root-plain', fsaLike)
    const created = memorySourceForRoot('root-plain')
    expect(typeof created.seedFile).toBe('function')
    expect(getRegisteredAssetSource('root-plain')).toBe(fsaLike)
  })

  it('seedAndHashEntry seeds bytes and puts caches under identity key', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const file = new File([new Uint8Array([1, 2, 3])], 's.jpg', {
      type: 'image/jpeg',
    })
    const expectedKey = cacheKeyFromIdentity({
      sourceRootId: 'root-seed',
      relativePath: 's.jpg',
      byteSize: file.size,
      mtimeMs: file.lastModified,
    })
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
        asset: {
          sourceRootId: 'root-seed',
          relativePath: 's.jpg',
          byteSize: file.size,
          mtimeMs: file.lastModified,
        },
      },
    ])
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery).toContain('asset-seed')
    })
    const source = createMemoryAssetSource()
    const seedSpy = vi.spyOn(source, 'seedFile')
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
    await awaitPendingHashes()
    expect(putCachedThumbForHash).toHaveBeenCalledWith(
      'asset-seed',
      expectedKey,
    )
    expect(putCachedTierForHash).toHaveBeenCalledWith('asset-seed', expectedKey)
    expect(
      getBookStoreSnapshot().book.assets['asset-seed']?.contentHash,
    ).toBeUndefined()
    const { hashContent } = await import('../assets')
    expect(hashContent).not.toHaveBeenCalled()
  })

  it('seedAndHashEntry uses preloaded bytes without a second body read', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const bytes = new Uint8Array([7, 8, 9]).buffer
    const file = new File([bytes], 'k.jpg', { type: 'image/jpeg' })
    enqueueGalleryAssets([
      {
        assetId: 'asset-known',
        meta: {
          name: 'k.jpg',
          correctedWidth: 1,
          correctedHeight: 1,
          orientation: 1,
          aspect: 1,
        },
        asset: {
          sourceRootId: 'root-known',
          relativePath: 'k.jpg',
          byteSize: file.size,
          mtimeMs: file.lastModified,
        },
      },
    ])
    await vi.waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery).toContain('asset-known')
    })
    const source = createMemoryAssetSource()
    const seedSpy = vi.spyOn(source, 'seedFile')
    const arrayBufferSpy = vi.spyOn(file, 'arrayBuffer')
    await seedAndHashEntry({
      assetId: 'asset-known',
      file,
      relativePath: 'k.jpg',
      sourceRootId: 'root-known',
      memorySource: source,
      bytes,
    })
    expect(arrayBufferSpy).not.toHaveBeenCalled()
    expect(seedSpy).toHaveBeenCalledWith(
      'root-known',
      'k.jpg',
      bytes,
      file.lastModified,
    )
    await awaitPendingHashes()
    expect(putCachedThumbForHash).toHaveBeenCalledOnce()
    const { hashContent } = await import('../assets')
    expect(hashContent).not.toHaveBeenCalled()
  })
})

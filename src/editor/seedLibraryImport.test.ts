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
import { memorySourceForRoot, seedLibraryEntry } from './seedLibraryImport'

describe('seedLibraryImport', () => {
  beforeEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
  })

  afterEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
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

  it('seedLibraryEntry seeds bytes and identity without contentHash', async () => {
    const memory = createMemoryAssetSource()
    registerAssetSource('root-seed', memory)
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    enqueueGalleryAssets([
      {
        assetId: 'asset-1',
        asset: { sourceRootId: 'root-seed', relativePath: 'a.jpg' },
      },
    ])
    expect(getBookStoreSnapshot().book.gallery).toContain('asset-1')
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', {
      type: 'image/jpeg',
      lastModified: 42,
    })
    await seedLibraryEntry({
      assetId: 'asset-1',
      file,
      relativePath: 'a.jpg',
      sourceRootId: 'root-seed',
      memorySource: memory,
    })
    const asset = getBookStoreSnapshot().book.assets['asset-1']
    expect(asset?.byteSize).toBe(3)
    expect(asset?.mtimeMs).toBe(42)
    expect(asset?.relativePath).toBe('a.jpg')
    expect(asset?.contentHash).toBeUndefined()
    await expect(memory.readForHash('root-seed', 'a.jpg')).resolves.toEqual({
      ok: true,
      value: expect.any(ArrayBuffer),
    })
  })
})

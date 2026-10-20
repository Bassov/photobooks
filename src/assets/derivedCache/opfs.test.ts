import { afterEach, describe, expect, it, vi } from 'vitest'
import { runDerivedCacheContract } from '../derivedCache.contract.test-helpers'
import { createOpfsDerivedCache } from './opfs'
import { createFakeOpfsDirectory } from './opfsDirectory.test-helpers'

const SAMPLE_HASH =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

runDerivedCacheContract(async () => {
  const root = createFakeOpfsDirectory()
  const cache = await createOpfsDerivedCache({ root })
  return {
    cache,
    seedCorrupted: async (assetHash, presetId) => {
      await cache.seedCorrupted(assetHash, presetId)
    },
    recreate: async () => createOpfsDerivedCache({ root }),
  }
})

describe('createOpfsDerivedCache specifics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses navigator.storage.getDirectory with default and custom rootName', async () => {
    const base = createFakeOpfsDirectory()
    const getDirectoryHandle = vi.spyOn(base, 'getDirectoryHandle')
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: vi.fn().mockResolvedValue(base),
      },
    })

    const defCache = await createOpfsDerivedCache()
    expect(getDirectoryHandle).toHaveBeenCalledWith('photobooks-derived', {
      create: true,
    })
    await defCache.put(SAMPLE_HASH, 'thumb', {
      bytes: new Uint8Array([1]).buffer,
      mimeType: 'image/png',
    })
    expect((await defCache.get(SAMPLE_HASH, 'thumb')).ok).toBe(true)

    await createOpfsDerivedCache({ rootName: 'custom-root' })
    expect(getDirectoryHandle).toHaveBeenCalledWith('custom-root', {
      create: true,
    })
  })

  it('throws when OPFS is unavailable and no root is passed', async () => {
    vi.stubGlobal('navigator', { storage: {} })
    await expect(createOpfsDerivedCache()).rejects.toThrow(
      'OPFS is not available',
    )
  })

  it('dedupes concurrent and repeated puts for the same key until delete or clear', async () => {
    const root = createFakeOpfsDirectory()
    const getFileHandle = vi.spyOn(root, 'getFileHandle')
    const cache = await createOpfsDerivedCache({ root })
    const entry = {
      bytes: new Uint8Array([7, 8]).buffer,
      mimeType: 'image/png',
    }

    const [a, b] = await Promise.all([
      cache.put(SAMPLE_HASH, 'thumb', entry),
      cache.put(SAMPLE_HASH, 'thumb', entry),
    ])
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(getFileHandle).toHaveBeenCalledTimes(1)

    // Subsequent put for already-written key skips OPFS openFile entirely.
    await cache.put(SAMPLE_HASH, 'thumb', entry)
    expect(getFileHandle).toHaveBeenCalledTimes(1)

    // After delete, put writes again.
    await cache.delete(SAMPLE_HASH, 'thumb')
    await cache.put(SAMPLE_HASH, 'thumb', entry)
    expect(getFileHandle).toHaveBeenCalledTimes(2)

    // After clear, put writes again.
    await cache.clear()
    await cache.put(SAMPLE_HASH, 'thumb', entry)
    expect(getFileHandle).toHaveBeenCalledTimes(3)
  })

  it('does not share a put across preset ids for the same hash', async () => {
    const root = createFakeOpfsDirectory()
    const getFileHandle = vi.spyOn(root, 'getFileHandle')
    const cache = await createOpfsDerivedCache({ root })
    const entry = {
      bytes: new Uint8Array([1]).buffer,
      mimeType: 'image/png',
    }

    expect(await cache.put(SAMPLE_HASH, 'thumb', entry)).toEqual({
      ok: true,
      value: undefined,
    })
    expect(await cache.put(SAMPLE_HASH, 'preview', entry)).toEqual({
      ok: true,
      value: undefined,
    })
    expect(getFileHandle).toHaveBeenCalledTimes(2)
  })

  it('retries put after a failed write instead of caching the miss', async () => {
    const root = createFakeOpfsDirectory()
    const getFileHandle = vi
      .spyOn(root, 'getFileHandle')
      .mockRejectedValueOnce(new Error('disk io'))
    const cache = await createOpfsDerivedCache({ root })
    const entry = {
      bytes: new Uint8Array([1]).buffer,
      mimeType: 'image/png',
    }

    expect(await cache.put(SAMPLE_HASH, 'thumb', entry)).toEqual({
      ok: false,
      code: 'corrupted',
    })
    expect(await cache.put(SAMPLE_HASH, 'thumb', entry)).toEqual({
      ok: true,
      value: undefined,
    })
    expect(getFileHandle).toHaveBeenCalledTimes(2)
  })

  it('returns corrupted when get/put/delete/clear encounter unexpected storage errors', async () => {
    const badRoot = {
      getFileHandle: vi.fn().mockRejectedValue(new Error('disk io')),
      removeEntry: vi.fn().mockRejectedValue(new Error('disk io')),
      values: () => ({
        next: () => Promise.reject(new Error('disk io')),
        [Symbol.asyncIterator]() {
          return this
        },
      }),
    } as unknown as FileSystemDirectoryHandle

    const cache = await createOpfsDerivedCache({ root: badRoot })
    expect(await cache.get(SAMPLE_HASH, 'thumb')).toEqual({
      ok: false,
      code: 'corrupted',
    })
    expect(
      await cache.put(SAMPLE_HASH, 'thumb', {
        bytes: new Uint8Array([1]).buffer,
        mimeType: 'image/png',
      }),
    ).toEqual({
      ok: false,
      code: 'corrupted',
    })
    expect(await cache.delete(SAMPLE_HASH, 'thumb')).toEqual({
      ok: false,
      code: 'corrupted',
    })
    expect(await cache.clear()).toEqual({
      ok: false,
      code: 'corrupted',
    })
  })

  it('delete treats NotFoundError from removeEntry as success', async () => {
    const root = createFakeOpfsDirectory()
    vi.spyOn(root, 'removeEntry').mockRejectedValueOnce(
      new DOMException('missing', 'NotFoundError'),
    )
    const cache = await createOpfsDerivedCache({ root })
    expect(await cache.delete(SAMPLE_HASH, 'thumb')).toEqual({
      ok: true,
      value: undefined,
    })
  })
})

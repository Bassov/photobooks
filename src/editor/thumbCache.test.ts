import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDerivedCache, setDerivedCacheForTests } from '../assets'
import { getAssetAspectSnapshot, resetBookStore } from './bookStore'
import { awaitPendingHashes, resetPendingHashesForTests } from './pendingHashes'
import {
  ensureThumb,
  getThumbPublishGeneration,
  getThumbUrl,
  putCachedThumbForHash,
  resetThumbCache,
  setThumbUrl,
  subscribeThumb,
  subscribeThumbPublishes,
} from './thumbCache'

const SAMPLE_HASH =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

/** Minimal JPEG with SOF0 width=200 height=100. */
function jpegLandscape200x100(): ArrayBuffer {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
  ]).buffer
}

describe('thumbCache', () => {
  beforeEach(() => {
    resetBookStore()
  })

  afterEach(() => {
    resetThumbCache()
    resetPendingHashesForTests()
    resetBookStore()
    setDerivedCacheForTests(undefined)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('notifies publish subscribers and bumps generation', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pub')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const listener = vi.fn()
    const unsubscribe = subscribeThumbPublishes(listener)
    const before = getThumbPublishGeneration()
    setThumbUrl('a1', new Uint8Array([1]).buffer, 'image/jpeg')
    expect(getThumbPublishGeneration()).toBe(before + 1)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setThumbUrl('a1', new Uint8Array([2]).buffer, 'image/jpeg')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stores thumb urls immediately and notifies subscribers', () => {
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    let created = 0
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      created += 1
      return `blob:thumb-${String(created)}`
    })

    const listener = vi.fn()
    const unsubscribe = subscribeThumb('a1', listener)

    setThumbUrl('a1', new Uint8Array([1, 2, 3]).buffer, 'image/jpeg')
    expect(create).toHaveBeenCalledOnce()
    expect(getThumbUrl('a1')).toBe('blob:thumb-1')
    expect(listener).toHaveBeenCalled()

    unsubscribe()
    setThumbUrl('a1', new Uint8Array([4]).buffer, 'image/png')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getThumbUrl('a1')).toBe('blob:thumb-2')
    expect(revoke).toHaveBeenCalledWith('blob:thumb-1')
  })

  it('publishes each setThumbUrl without waiting for rAF', () => {
    let n = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      n += 1
      return `blob:t-${String(n)}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    setThumbUrl('a', new Uint8Array([1]).buffer, 'image/jpeg')
    setThumbUrl('b', new Uint8Array([2]).buffer, 'image/jpeg')
    setThumbUrl('c', new Uint8Array([3]).buffer, 'image/jpeg')

    expect(getThumbUrl('a')).toBe('blob:t-1')
    expect(getThumbUrl('b')).toBe('blob:t-2')
    expect(getThumbUrl('c')).toBe('blob:t-3')
  })

  it('resetThumbCache clears urls and notifies listeners', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const listener = vi.fn()
    subscribeThumb('a1', listener)

    setThumbUrl('a1', new Uint8Array([1]).buffer, 'image/jpeg')
    expect(getThumbUrl('a1')).toBe('blob:x')

    resetThumbCache()
    expect(getThumbUrl('a1')).toBeUndefined()
    expect(listener).toHaveBeenCalled()
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })

  it('puts into DerivedCache when setThumbUrl receives a contentHash', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)

    setThumbUrl('a1', new Uint8Array([1, 2]).buffer, 'image/jpeg', SAMPLE_HASH)
    await awaitPendingHashes()
    const got = await cache.get(SAMPLE_HASH, 'thumb')
    expect(got.ok).toBe(true)
    if (got.ok) {
      expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array([1, 2]))
    }
  })

  it('awaits encode-after-hash put so Save cannot race reload hydrate', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:race-thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const inner = createMemoryDerivedCache()
    let releasePut: (() => void) | undefined
    const putGate = new Promise<void>((resolve) => {
      releasePut = resolve
    })
    setDerivedCacheForTests({
      get: (hash, preset) => inner.get(hash, preset),
      put: async (hash, preset, entry) => {
        await putGate
        return inner.put(hash, preset, entry)
      },
      delete: (hash, preset) => inner.delete(hash, preset),
      clear: () => inner.clear(),
    })

    // Hash finished first — putCachedThumbForHash no-ops without lastThumb.
    await putCachedThumbForHash('late-asset', SAMPLE_HASH)
    expect((await inner.get(SAMPLE_HASH, 'thumb')).ok).toBe(false)

    setThumbUrl(
      'late-asset',
      new Uint8Array([9, 9, 9]).buffer,
      'image/jpeg',
      SAMPLE_HASH,
    )

    let hashesSettled = false
    const waiting = awaitPendingHashes().then(() => {
      hashesSettled = true
    })
    await Promise.resolve()
    expect(hashesSettled).toBe(false)

    releasePut?.()
    await waiting
    expect(hashesSettled).toBe(true)
    const got = await inner.get(SAMPLE_HASH, 'thumb')
    expect(got.ok).toBe(true)
  })

  it('does not put into DerivedCache without a contentHash', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)

    setThumbUrl('a1', new Uint8Array([1]).buffer, 'image/jpeg')
    await Promise.resolve()
    expect(put).not.toHaveBeenCalled()
  })

  it('ensureThumb hydrates from DerivedCache when hashed', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:hydrated-thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    await cache.put(SAMPLE_HASH, 'thumb', {
      bytes: new Uint8Array([3, 4, 5]).buffer,
      mimeType: 'image/png',
    })

    ensureThumb('a1', SAMPLE_HASH)
    for (let step = 0; step < 5; step += 1) {
      await Promise.resolve()
    }
    expect(getThumbUrl('a1')).toBe('blob:hydrated-thumb')
  })

  it('ensureThumb restores landscape aspect from hydrated JPEG', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'requestAnimationFrame'] })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:aspect-thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    await cache.put(SAMPLE_HASH, 'thumb', {
      bytes: jpegLandscape200x100(),
      mimeType: 'image/jpeg',
    })

    ensureThumb('a1', SAMPLE_HASH)
    await vi.runAllTimersAsync()
    expect(getThumbUrl('a1')).toBe('blob:aspect-thumb')
    expect(getAssetAspectSnapshot('a1')).toBe(2)
    vi.useRealTimers()
  })

  it('putCachedThumbForHash no-ops without a prior thumb or with empty hash', async () => {
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)
    await putCachedThumbForHash('missing', SAMPLE_HASH)
    await putCachedThumbForHash('a1', '')
    expect(put).not.toHaveBeenCalled()
  })

  it('putCachedThumbForHash writes buffer encoded before hash arrived', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:early')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)

    setThumbUrl('a1', new Uint8Array([9, 8]).buffer, 'image/jpeg')
    await putCachedThumbForHash('a1', SAMPLE_HASH)
    const got = await cache.get(SAMPLE_HASH, 'thumb')
    expect(got.ok).toBe(true)
    if (got.ok) {
      expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array([9, 8]))
    }
  })

  it('ensureThumb is a no-op without contentHash', async () => {
    const cache = createMemoryDerivedCache()
    const get = vi.spyOn(cache, 'get')
    setDerivedCacheForTests(cache)
    ensureThumb('a1')
    await Promise.resolve()
    expect(get).not.toHaveBeenCalled()
  })
})

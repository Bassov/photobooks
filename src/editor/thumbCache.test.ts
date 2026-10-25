import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDerivedCache, setDerivedCacheForTests } from '../assets'
import {
  isDecodeScrollQuiet,
  resetDecodeScrollQuietForTests,
} from '../photo/decodeScrollQuiet'
import { getAssetAspectSnapshot, resetBookStore } from './bookStore'
import { awaitPendingHashes, resetPendingHashesForTests } from './pendingHashes'
import { resetFilmstripScrollQuietForTests } from './filmstripScrollQuiet'
import {
  dropHotThumbUrlForTests,
  ensureThumb,
  getThumbPublishGeneration,
  getThumbUrl,
  hasThumbData,
  noteFilmstripScroll,
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
    // Default: flush paced publishes immediately so unit tests stay sync.
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
  })

  afterEach(() => {
    resetThumbCache()
    resetFilmstripScrollQuietForTests()
    resetPendingHashesForTests()
    resetBookStore()
    setDerivedCacheForTests(undefined)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('hasThumbData is true for LRU urls and pending lastThumb copies', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    expect(hasThumbData('missing')).toBe(false)
    setThumbUrl('pending', new Uint8Array([1]).buffer, 'image/jpeg')
    expect(hasThumbData('pending')).toBe(true)
    dropHotThumbUrlForTests('pending')
    expect(hasThumbData('pending')).toBe(true)
  })

  it('getThumbUrl is referentially stable when unchanged', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stable')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    setThumbUrl('a1', new Uint8Array([1]).buffer, 'image/jpeg')
    const first = getThumbUrl('a1')
    const second = getThumbUrl('a1')
    expect(Object.is(first, second)).toBe(true)
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

  it('noteFilmstripScroll opens decode scroll quiet for background drains', () => {
    resetDecodeScrollQuietForTests()
    expect(isDecodeScrollQuiet()).toBe(false)
    noteFilmstripScroll()
    expect(isDecodeScrollQuiet()).toBe(true)
  })

  it('defers React publishes while noteFilmstripScroll quiet is active', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let now = 10_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    let n = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      n += 1
      return `blob:quiet-${String(n)}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    setThumbUrl('q1', new Uint8Array([1]).buffer, 'image/jpeg')
    noteFilmstripScroll()
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(getThumbUrl('q1')).toBeUndefined()
    expect(hasThumbData('q1')).toBe(true)
    const quietDelay = setTimeoutSpy.mock.calls
      .map((call) => call[1])
      .find((delay) => typeof delay === 'number' && delay > 32)
    expect(quietDelay).toBe(200)

    now = 10_200
    vi.advanceTimersByTime(200)
    expect(getThumbUrl('q1')).toBe('blob:quiet-1')
    vi.useRealTimers()
  })

  it('coalesces setThumbUrl publishes onto rAF (max 1 per frame)', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    let n = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      n += 1
      return `blob:t-${String(n)}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    setThumbUrl('a', new Uint8Array([1]).buffer, 'image/jpeg')
    setThumbUrl('b', new Uint8Array([2]).buffer, 'image/jpeg')
    setThumbUrl('c', new Uint8Array([3]).buffer, 'image/jpeg')

    expect(getThumbUrl('a')).toBeUndefined()
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(getThumbUrl('a')).toBe('blob:t-1')
    expect(getThumbUrl('b')).toBeUndefined()
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(getThumbUrl('b')).toBe('blob:t-2')
    expect(getThumbUrl('c')).toBeUndefined()
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(getThumbUrl('c')).toBe('blob:t-3')
  })

  it('flushes pending thumbs via the setTimeout watchdog when rAF never runs', () => {
    vi.stubGlobal('requestAnimationFrame', (): number => 1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let n = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      n += 1
      return `blob:w-${String(n)}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    setThumbUrl('w1', new Uint8Array([1]).buffer, 'image/jpeg')
    expect(getThumbUrl('w1')).toBeUndefined()
    vi.advanceTimersByTime(32)
    expect(getThumbUrl('w1')).toBe('blob:w-1')
    vi.useRealTimers()
  })

  it('rAF flush clears the watchdog so a late timer cannot republish', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    let n = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      n += 1
      return `blob:once-${String(n)}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    setThumbUrl('once', new Uint8Array([1]).buffer, 'image/jpeg')
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(getThumbUrl('once')).toBe('blob:once-1')
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockClear()
    vi.advanceTimersByTime(32)
    expect(n).toBe(1)
    vi.useRealTimers()
  })

  it('replaces a pending thumb for the same asset without an extra flush frame', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    let n = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      n += 1
      return `blob:upd-${String(n)}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    setThumbUrl('a', new Uint8Array([1]).buffer, 'image/jpeg')
    setThumbUrl('b', new Uint8Array([2]).buffer, 'image/jpeg')
    setThumbUrl('c', new Uint8Array([3]).buffer, 'image/jpeg')
    setThumbUrl('a', new Uint8Array([9]).buffer, 'image/png')
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    // One publish per frame; pending `a` was replaced before flush.
    expect(n).toBe(1)
    expect(getThumbUrl('a')).toBe('blob:upd-1')
    expect(getThumbUrl('b')).toBeUndefined()
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(n).toBe(2)
    expect(getThumbUrl('b')).toBe('blob:upd-2')
    expect(getThumbUrl('c')).toBeUndefined()
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(n).toBe(3)
    expect(getThumbUrl('c')).toBe('blob:upd-3')
    expect(rafQueue).toHaveLength(0)
  })

  it('resetThumbCache drops a pending publish so a late rAF cannot resurrect it', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    setThumbUrl('gone', new Uint8Array([1]).buffer, 'image/jpeg')
    expect(rafQueue).toHaveLength(1)
    resetThumbCache()
    expect(clearTimeoutSpy).toHaveBeenCalled()
    expect(getThumbUrl('gone')).toBeUndefined()
    rafQueue.shift()?.(0)
    expect(getThumbUrl('gone')).toBeUndefined()
  })

  it('resetThumbCache clears pending map so a later setThumbUrl can publish again', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    let n = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      n += 1
      return `blob:re-${String(n)}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    setThumbUrl('re', new Uint8Array([1]).buffer, 'image/jpeg')
    resetThumbCache()
    rafQueue.length = 0
    setThumbUrl('re', new Uint8Array([2]).buffer, 'image/jpeg')
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(getThumbUrl('re')).toBe('blob:re-1')
    expect(n).toBe(1)
  })

  it('copies thumb bytes so mutating the source buffer after setThumbUrl is safe', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:retained')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    const source = new Uint8Array([1, 2, 3])
    setThumbUrl('keep', source.buffer, 'image/jpeg', SAMPLE_HASH)
    source.fill(0)
    await awaitPendingHashes()
    const got = await cache.get(SAMPLE_HASH, 'thumb')
    expect(got.ok).toBe(true)
    assert.equal(got.ok, true)
    expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('resetThumbCache clears lastThumb so putCachedThumbForHash cannot resurrect', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:last')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    setThumbUrl('x', new Uint8Array([7]).buffer, 'image/jpeg')
    resetThumbCache()
    await putCachedThumbForHash('x', SAMPLE_HASH)
    expect((await cache.get(SAMPLE_HASH, 'thumb')).ok).toBe(false)
  })

  it('resetThumbCache clears urls and notifies listeners', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const assetListener = vi.fn()
    const publishListener = vi.fn()
    subscribeThumb('a1', assetListener)
    subscribeThumbPublishes(publishListener)

    setThumbUrl('a1', new Uint8Array([1]).buffer, 'image/jpeg')
    expect(getThumbUrl('a1')).toBe('blob:x')
    expect(assetListener).toHaveBeenCalled()
    expect(publishListener).toHaveBeenCalled()
    assetListener.mockClear()
    publishListener.mockClear()

    resetThumbCache()
    expect(getThumbUrl('a1')).toBeUndefined()
    expect(assetListener).toHaveBeenCalledTimes(1)
    expect(publishListener).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })

  it('puts into DerivedCache when setThumbUrl receives a cache key', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)

    setThumbUrl('a1', new Uint8Array([1, 2]).buffer, 'image/jpeg', SAMPLE_HASH)
    await awaitPendingHashes()
    const got = await cache.get(SAMPLE_HASH, 'thumb')
    expect(got.ok).toBe(true)
    assert.equal(got.ok, true)
    expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array([1, 2]))
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('dedupes DerivedCache thumb puts by cache key', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dedupe')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)

    setThumbUrl('a1', new Uint8Array([1]).buffer, 'image/jpeg', SAMPLE_HASH)
    await awaitPendingHashes()
    await putCachedThumbForHash('a1', SAMPLE_HASH)
    setThumbUrl('a2', new Uint8Array([2]).buffer, 'image/jpeg', SAMPLE_HASH)
    await awaitPendingHashes()

    expect(put).toHaveBeenCalledTimes(1)
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

  it('does not put into DerivedCache without a cache key', async () => {
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
    assert.equal(got.ok, true)
    expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array([9, 8]))
  })

  it('ensureThumb is a no-op without cache key or lastThumb', async () => {
    const cache = createMemoryDerivedCache()
    const get = vi.spyOn(cache, 'get')
    setDerivedCacheForTests(cache)
    ensureThumb('a1')
    await Promise.resolve()
    expect(get).not.toHaveBeenCalled()
  })

  it('ensureThumb republishes lastThumb after LRU eviction without cache key', () => {
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:republish')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    const get = vi.spyOn(cache, 'get')
    setDerivedCacheForTests(cache)

    setThumbUrl('a1', new Uint8Array([1, 2, 3]).buffer, 'image/jpeg')
    expect(getThumbUrl('a1')).toBe('blob:first')

    dropHotThumbUrlForTests('a1')
    expect(getThumbUrl('a1')).toBeUndefined()

    ensureThumb('a1')
    expect(get).not.toHaveBeenCalled()
    expect(getThumbUrl('a1')).toBe('blob:republish')
  })
})

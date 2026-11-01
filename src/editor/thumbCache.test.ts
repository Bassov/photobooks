import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDerivedCache, setDerivedCacheForTests } from '../assets'
import {
  isDecodeScrollQuiet,
  resetDecodeScrollQuietForTests,
} from '../photo/decodeScrollQuiet'
import { makeBook } from '../core/testing/fixtures'
import {
  getAssetAspectSnapshot,
  getAssetCacheKey,
  patchAssetRecord,
  removeFailedImportAsset,
  resetBookStore,
} from './bookStore'
import { awaitPendingHashes, resetPendingHashesForTests } from './pendingHashes'
import { resetFilmstripScrollQuietForTests } from './filmstripScrollQuiet'
import {
  ensureThumb,
  getThumbBulkHydrateStatsForTests,
  getThumbCacheStatsForTests,
  getThumbPublishGeneration,
  getThumbUrl,
  hasThumbData,
  hydrateGalleryThumbs,
  noteFilmstripScroll,
  putCachedThumbForHash,
  resetThumbCache,
  setThumbCacheByteBudgetForTests,
  setThumbUrl,
  setThumbViewportProvider,
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

/** rAF callbacks stay queued until the test runs them. */
function queueRaf(): FrameRequestCallback[] {
  const rafQueue: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  })
  return rafQueue
}

/** Numbered `blob:<prefix>-N` URLs; returns the revoke spy. */
function mockObjectUrls(prefix: string) {
  let n = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    n += 1
    return `blob:${prefix}-${String(n)}`
  })
  return vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
}

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer
}

describe('thumbCache', () => {
  const cleanups: (() => void)[] = []

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
    for (const cleanup of cleanups.splice(0)) {
      cleanup()
    }
    resetThumbCache()
    setThumbCacheByteBudgetForTests()
    resetFilmstripScrollQuietForTests()
    resetPendingHashesForTests()
    resetBookStore()
    setDerivedCacheForTests(undefined)
    // Restore spies first: a `setTimeout` spy taken under fake timers would
    // otherwise put the fake timer back after `useRealTimers`.
    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function listen(assetId: string) {
    const listener = vi.fn()
    cleanups.push(subscribeThumb(assetId, listener))
    return listener
  }

  function viewport(ids: readonly string[]): void {
    cleanups.push(setThumbViewportProvider(() => ids))
  }

  it('creates the object URL as soon as bytes arrive, before any notify', () => {
    const rafQueue = queueRaf()
    mockObjectUrls('early')
    expect(hasThumbData('missing')).toBe(false)
    listen('a1')
    setThumbUrl('a1', bytes(1), 'image/jpeg')
    expect(rafQueue).toHaveLength(1)
    expect(getThumbUrl('a1')).toBe('blob:early-1')
    expect(hasThumbData('a1')).toBe(true)
  })

  it('getThumbUrl is referentially stable when unchanged', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stable')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    setThumbUrl('a1', bytes(1), 'image/jpeg')
    const first = getThumbUrl('a1')
    const second = getThumbUrl('a1')
    expect(Object.is(first, second)).toBe(true)
  })

  it('notifies publish subscribers and bumps generation for mounted ids', () => {
    mockObjectUrls('pub')
    listen('a1')
    const listener = vi.fn()
    const unsubscribe = subscribeThumbPublishes(listener)
    const before = getThumbPublishGeneration()
    setThumbUrl('a1', bytes(1), 'image/jpeg')
    expect(getThumbPublishGeneration()).toBe(before + 1)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setThumbUrl('a1', bytes(2), 'image/jpeg')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stores thumb urls immediately and notifies subscribers', () => {
    const revoke = mockObjectUrls('thumb')
    const listener = vi.fn()
    const unsubscribe = subscribeThumb('a1', listener)

    setThumbUrl('a1', bytes(1, 2, 3), 'image/jpeg')
    expect(getThumbUrl('a1')).toBe('blob:thumb-1')
    expect(listener).toHaveBeenCalled()

    unsubscribe()
    setThumbUrl('a1', bytes(4), 'image/png')
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

  it('defers off-screen notifies while scroll quiet is open', () => {
    const rafQueue = queueRaf()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let now = 10_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    mockObjectUrls('quiet')
    const listener = listen('q1')

    setThumbUrl('q1', bytes(1), 'image/jpeg')
    noteFilmstripScroll()
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(listener).not.toHaveBeenCalled()
    // A remount reads the URL without waiting for the notify.
    expect(getThumbUrl('q1')).toBe('blob:quiet-1')
    const quietDelay = setTimeoutSpy.mock.calls
      .map((call) => call[1])
      .find((delay) => typeof delay === 'number' && delay > 32)
    expect(quietDelay).toBe(200)

    now = 10_200
    vi.advanceTimersByTime(200)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('publishes scrollport ids while scroll quiet is open', () => {
    const rafQueue = queueRaf()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let now = 10_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    mockObjectUrls('view')
    viewport(['v1'])
    const offscreen = listen('o1')
    const visible = listen('v1')

    setThumbUrl('o1', bytes(1), 'image/jpeg')
    setThumbUrl('v1', bytes(2), 'image/jpeg')
    noteFilmstripScroll()
    rafQueue.shift()?.(0)
    expect(visible).toHaveBeenCalledTimes(1)
    expect(offscreen).not.toHaveBeenCalled()
    expect(rafQueue).toHaveLength(0)

    now = 10_200
    vi.advanceTimersByTime(200)
    expect(offscreen).toHaveBeenCalledTimes(1)
  })

  it('notifies at most 8 mounted ids per frame, scrollport first', () => {
    const rafQueue = queueRaf()
    mockObjectUrls('budget')
    const ids = Array.from({ length: 10 }, (_, i) => `id${String(i)}`)
    const listeners = ids.map((id) => listen(id))
    viewport(['id9'])
    for (const id of ids) {
      setThumbUrl(id, bytes(1), 'image/jpeg')
    }
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    const notified = (): string[] =>
      ids.filter((_, i) => (listeners[i]?.mock.calls.length ?? 0) > 0)
    expect(notified()).toEqual([
      'id0',
      'id1',
      'id2',
      'id3',
      'id4',
      'id5',
      'id6',
      'id9',
    ])
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(notified()).toEqual(ids)
    expect(rafQueue).toHaveLength(0)
  })

  it('ends a flush frame once 3 ms are spent', () => {
    const rafQueue = queueRaf()
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => {
      clock += 2
      return clock
    })
    mockObjectUrls('ms')
    const first = listen('m1')
    const second = listen('m2')
    setThumbUrl('m1', bytes(1), 'image/jpeg')
    setThumbUrl('m2', bytes(2), 'image/jpeg')
    rafQueue.shift()?.(0)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    rafQueue.shift()?.(0)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('drops the notify of an id unmounted before the flush; bytes stay', () => {
    const rafQueue = queueRaf()
    mockObjectUrls('gone')
    const unsubscribe = subscribeThumb('u1', vi.fn())
    setThumbUrl('u1', bytes(1), 'image/jpeg')
    unsubscribe()
    const before = getThumbPublishGeneration()
    rafQueue.shift()?.(0)
    expect(getThumbPublishGeneration()).toBe(before)
    expect(getThumbCacheStatsForTests().pending).toBe(0)
    expect(rafQueue).toHaveLength(0)
    expect(getThumbUrl('u1')).toBe('blob:gone-1')
  })

  it('flushes pending notifies via the setTimeout watchdog when rAF never runs', () => {
    vi.stubGlobal('requestAnimationFrame', (): number => 1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mockObjectUrls('w')
    const listener = listen('w1')
    setThumbUrl('w1', bytes(1), 'image/jpeg')
    expect(listener).not.toHaveBeenCalled()
    vi.advanceTimersByTime(32)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('rAF flush clears the watchdog so a late timer cannot renotify', () => {
    const rafQueue = queueRaf()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mockObjectUrls('once')
    const listener = listen('once')
    setThumbUrl('once', bytes(1), 'image/jpeg')
    rafQueue.shift()?.(0)
    expect(listener).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(32)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('replacing a thumb revokes the old URL and notifies once', () => {
    const rafQueue = queueRaf()
    const revoke = mockObjectUrls('upd')
    const listener = listen('a')
    setThumbUrl('a', bytes(1), 'image/jpeg')
    setThumbUrl('a', bytes(9, 9), 'image/png')
    expect(revoke).toHaveBeenCalledWith('blob:upd-1')
    expect(getThumbCacheStatsForTests()).toMatchObject({
      entries: 1,
      bytes: 2,
    })
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getThumbUrl('a')).toBe('blob:upd-2')
    expect(rafQueue).toHaveLength(0)
  })

  it('resetThumbCache drops a pending notify so a late rAF cannot resurrect it', () => {
    const rafQueue = queueRaf()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    mockObjectUrls('pending')
    const listener = listen('gone')
    setThumbUrl('gone', bytes(1), 'image/jpeg')
    expect(rafQueue).toHaveLength(1)
    resetThumbCache()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(clearTimeoutSpy).toHaveBeenCalled()
    expect(getThumbUrl('gone')).toBeUndefined()
    rafQueue.shift()?.(0)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getThumbUrl('gone')).toBeUndefined()
  })

  it('resetThumbCache clears pending notifies so a later setThumbUrl can notify again', () => {
    const rafQueue = queueRaf()
    mockObjectUrls('re')
    const listener = listen('re')
    setThumbUrl('re', bytes(1), 'image/jpeg')
    resetThumbCache()
    rafQueue.length = 0
    listener.mockClear()
    setThumbUrl('re', bytes(2), 'image/jpeg')
    expect(rafQueue).toHaveLength(1)
    rafQueue.shift()?.(0)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getThumbUrl('re')).toBe('blob:re-2')
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

  it('resetThumbCache clears hot bytes so putCachedThumbForHash cannot resurrect', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:last')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    setThumbUrl('x', bytes(7), 'image/jpeg')
    resetThumbCache()
    await putCachedThumbForHash('x', SAMPLE_HASH)
    expect((await cache.get(SAMPLE_HASH, 'thumb')).ok).toBe(false)
  })

  it('resetThumbCache clears urls and notifies listeners', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const assetListener = listen('a1')
    const publishListener = vi.fn()
    cleanups.push(subscribeThumbPublishes(publishListener))

    setThumbUrl('a1', bytes(1), 'image/jpeg')
    expect(getThumbUrl('a1')).toBe('blob:x')
    expect(assetListener).toHaveBeenCalled()
    expect(publishListener).toHaveBeenCalled()
    assetListener.mockClear()
    publishListener.mockClear()

    resetThumbCache()
    expect(getThumbUrl('a1')).toBeUndefined()
    expect(getThumbCacheStatsForTests()).toEqual({
      entries: 0,
      bytes: 0,
      pending: 0,
    })
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

    setThumbUrl('a1', bytes(1, 2), 'image/jpeg', SAMPLE_HASH)
    await awaitPendingHashes()
    const got = await cache.get(SAMPLE_HASH, 'thumb')
    expect(got.ok).toBe(true)
    assert.equal(got.ok, true)
    expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array([1, 2]))
    expect(got.value.mimeType).toBe('image/jpeg')
    expect(put).toHaveBeenCalledTimes(1)
  })

  it('dedupes DerivedCache thumb puts by cache key', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dedupe')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)

    setThumbUrl('a1', bytes(1), 'image/jpeg', SAMPLE_HASH)
    await awaitPendingHashes()
    await putCachedThumbForHash('a1', SAMPLE_HASH)
    setThumbUrl('a2', bytes(2), 'image/jpeg', SAMPLE_HASH)
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
      has: (hash, preset) => inner.has(hash, preset),
      put: async (hash, preset, entry) => {
        await putGate
        return inner.put(hash, preset, entry)
      },
      delete: (hash, preset) => inner.delete(hash, preset),
      clear: () => inner.clear(),
    })

    // Hash finished first — putCachedThumbForHash no-ops without hot bytes.
    await putCachedThumbForHash('late-asset', SAMPLE_HASH)
    expect((await inner.get(SAMPLE_HASH, 'thumb')).ok).toBe(false)

    setThumbUrl('late-asset', bytes(9, 9, 9), 'image/jpeg', SAMPLE_HASH)

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

    setThumbUrl('a1', bytes(1), 'image/jpeg')
    await Promise.resolve()
    expect(put).not.toHaveBeenCalled()
  })

  it('ensureThumb hydrates from DerivedCache when hashed', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:hydrated-thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    await cache.put(SAMPLE_HASH, 'thumb', {
      bytes: bytes(3, 4, 5),
      mimeType: 'image/png',
    })

    ensureThumb('a1', SAMPLE_HASH)
    await vi.waitFor(() => {
      expect(getThumbUrl('a1')).toBe('blob:hydrated-thumb')
    })
    expect(getThumbCacheStatsForTests()).toEqual({
      entries: 1,
      bytes: 3,
      pending: 0,
    })
  })

  it('ensureThumb drops a DerivedCache read that lands after reset', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stale')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const realGet = cache.get.bind(cache)
    const get = vi.spyOn(cache, 'get').mockImplementation(async (...args) => {
      await gate
      return realGet(...args)
    })
    await cache.put(SAMPLE_HASH, 'thumb', {
      bytes: bytes(3, 4, 5),
      mimeType: 'image/png',
    })

    ensureThumb('a1', SAMPLE_HASH)
    await vi.waitFor(() => {
      expect(get).toHaveBeenCalledTimes(1)
    })
    resetThumbCache()
    release?.()
    for (let step = 0; step < 10; step += 1) {
      await Promise.resolve()
    }
    expect(getThumbUrl('a1')).toBeUndefined()
    expect(hasThumbData('a1')).toBe(false)
  })

  it('ensureThumb skips the DerivedCache read when reset lands before the cache opens', async () => {
    mockObjectUrls('blob:early-reset')
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)
    await cache.put(SAMPLE_HASH, 'thumb', {
      bytes: bytes(3, 4, 5),
      mimeType: 'image/png',
    })
    const get = vi.spyOn(cache, 'get')

    ensureThumb('a1', SAMPLE_HASH)
    resetThumbCache()
    for (let step = 0; step < 10; step += 1) {
      await Promise.resolve()
    }

    expect(get).not.toHaveBeenCalled()
    expect(hasThumbData('a1')).toBe(false)
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
  })

  it('putCachedThumbForHash no-ops without a prior thumb or with empty hash', async () => {
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)
    await putCachedThumbForHash('missing', SAMPLE_HASH)
    await putCachedThumbForHash('a1', '')
    expect(put).not.toHaveBeenCalled()
  })

  it('putCachedThumbForHash writes the blob encoded before hash arrived', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:early')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)

    setThumbUrl('a1', bytes(9, 8), 'image/jpeg')
    await putCachedThumbForHash('a1', SAMPLE_HASH)
    const got = await cache.get(SAMPLE_HASH, 'thumb')
    expect(got.ok).toBe(true)
    assert.equal(got.ok, true)
    expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array([9, 8]))
  })

  it('ensureThumb is a no-op without cache key or hot bytes', async () => {
    const cache = createMemoryDerivedCache()
    const get = vi.spyOn(cache, 'get')
    setDerivedCacheForTests(cache)
    ensureThumb('a1')
    await Promise.resolve()
    expect(get).not.toHaveBeenCalled()
    expect(getThumbCacheStatsForTests().pending).toBe(0)
  })

  it('ensureThumb on a hot thumb reads nothing and keeps its URL', async () => {
    mockObjectUrls('hot')
    const cache = createMemoryDerivedCache()
    const get = vi.spyOn(cache, 'get')
    setDerivedCacheForTests(cache)
    setThumbUrl('a1', bytes(1), 'image/jpeg')
    ensureThumb('a1', SAMPLE_HASH)
    await Promise.resolve()
    expect(get).not.toHaveBeenCalled()
    expect(getThumbUrl('a1')).toBe('blob:hot-1')
  })

  it('evicts least-recently-mounted thumbs past the byte budget and revokes them', () => {
    const revoke = mockObjectUrls('lru')
    setThumbCacheByteBudgetForTests(4)
    setThumbUrl('a', bytes(1, 1), 'image/jpeg')
    setThumbUrl('b', bytes(2, 2), 'image/jpeg')
    // Mount touches `a`, so `b` is now the least recently used.
    ensureThumb('a')
    setThumbUrl('c', bytes(3, 3), 'image/jpeg')
    expect(getThumbUrl('a')).toBe('blob:lru-1')
    expect(getThumbUrl('b')).toBeUndefined()
    expect(getThumbUrl('c')).toBe('blob:lru-3')
    expect(revoke).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:lru-2')
    expect(getThumbCacheStatsForTests()).toMatchObject({
      entries: 2,
      bytes: 4,
    })
  })

  it('keeps mounted thumbs past the byte budget', () => {
    const revoke = mockObjectUrls('mounted')
    listen('a')
    listen('b')
    setThumbCacheByteBudgetForTests(2)
    setThumbUrl('a', bytes(1, 1), 'image/jpeg')
    setThumbUrl('b', bytes(2, 2), 'image/jpeg')
    setThumbUrl('c', bytes(3, 3), 'image/jpeg')
    expect(getThumbUrl('a')).toBe('blob:mounted-1')
    expect(getThumbUrl('b')).toBe('blob:mounted-2')
    expect(getThumbUrl('c')).toBeUndefined()
    expect(revoke).toHaveBeenCalledWith('blob:mounted-3')
    expect(getThumbCacheStatsForTests().bytes).toBe(4)
  })

  it('shrinking the budget evicts at once', () => {
    mockObjectUrls('shrink')
    setThumbUrl('a', bytes(1, 1), 'image/jpeg')
    setThumbUrl('b', bytes(2, 2), 'image/jpeg')
    setThumbCacheByteBudgetForTests(2)
    expect(getThumbUrl('a')).toBeUndefined()
    expect(getThumbUrl('b')).toBe('blob:shrink-2')
  })

  it('asset removal revokes the URL and notifies the mounted tile', () => {
    const rafQueue = queueRaf()
    const revoke = mockObjectUrls('rm')
    const listener = listen('a')
    setThumbUrl('a', bytes(1), 'image/jpeg')
    setThumbUrl('keep', bytes(2), 'image/jpeg')
    rafQueue.shift()?.(0)
    listener.mockClear()

    removeFailedImportAsset('a')
    expect(getThumbUrl('a')).toBeUndefined()
    expect(revoke).toHaveBeenCalledWith('blob:rm-1')
    expect(getThumbUrl('keep')).toBe('blob:rm-2')
    rafQueue.shift()?.(0)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  describe('DerivedCache hydrate queue', () => {
    function keyFor(index: number): string {
      return `${SAMPLE_HASH.slice(0, -2)}${String(index).padStart(2, '0')}`
    }

    function gatedCache() {
      const cache = createMemoryDerivedCache()
      setDerivedCacheForTests(cache)
      const gates: (() => void)[] = []
      const realGet = cache.get.bind(cache)
      const get = vi.spyOn(cache, 'get').mockImplementation(async (...args) => {
        await new Promise<void>((resolve) => {
          gates.push(resolve)
        })
        return realGet(...args)
      })
      return { cache, gates, get }
    }

    it('reads scrollport tiles first, 4 at a time', async () => {
      mockObjectUrls('hq')
      const { cache, gates, get } = gatedCache()
      const ids = Array.from({ length: 6 }, (_, i) => `h${String(i)}`)
      for (const [i, id] of ids.entries()) {
        listen(id)
        await cache.put(keyFor(i), 'thumb', {
          bytes: bytes(i),
          mimeType: 'image/png',
        })
      }
      viewport(['h5'])
      for (const [i, id] of ids.entries()) {
        ensureThumb(id, keyFor(i))
      }
      await vi.waitFor(() => {
        expect(get).toHaveBeenCalledTimes(4)
      })
      expect(get.mock.calls.map((call) => call[0])).toEqual([
        keyFor(0),
        keyFor(1),
        keyFor(2),
        keyFor(3),
      ])
      // h4 and h5 wait; a freed slot serves the scrollport tile first.
      gates.shift()?.()
      await vi.waitFor(() => {
        expect(get).toHaveBeenCalledTimes(5)
      })
      expect(get.mock.calls[4]?.[0]).toBe(keyFor(5))
      for (const release of gates.splice(0)) {
        release()
      }
      await vi.waitFor(() => {
        expect(get).toHaveBeenCalledTimes(6)
      })
      for (const release of gates.splice(0)) {
        release()
      }
      await vi.waitFor(() => {
        expect(getThumbCacheStatsForTests()).toMatchObject({
          entries: 6,
          pending: 0,
        })
      })
    })

    it('drops a queued read once its tile unmounts before the read starts', async () => {
      mockObjectUrls('drop')
      const { gates, get } = gatedCache()
      const ids = Array.from({ length: 5 }, (_, i) => `d${String(i)}`)
      const unsubscribes = ids.map((id) => subscribeThumb(id, vi.fn()))
      cleanups.push(...unsubscribes)
      for (const [i, id] of ids.entries()) {
        ensureThumb(id, keyFor(i))
      }
      await vi.waitFor(() => {
        expect(get).toHaveBeenCalledTimes(4)
      })
      unsubscribes[4]?.()
      for (const release of gates.splice(0)) {
        release()
      }
      await vi.waitFor(() => {
        expect(getThumbCacheStatsForTests().pending).toBe(0)
      })
      expect(get).toHaveBeenCalledTimes(4)
      expect(get.mock.calls.map((call) => call[0])).not.toContain(keyFor(4))
    })

    it('asset removal drops its running and queued reads', async () => {
      mockObjectUrls('gone')
      const { cache, gates, get } = gatedCache()
      const ids = Array.from({ length: 5 }, (_, i) => `g${String(i)}`)
      for (const [i, id] of ids.entries()) {
        listen(id)
        await cache.put(keyFor(i), 'thumb', {
          bytes: bytes(i),
          mimeType: 'image/png',
        })
      }
      for (const [i, id] of ids.entries()) {
        ensureThumb(id, keyFor(i))
      }
      await vi.waitFor(() => {
        expect(get).toHaveBeenCalledTimes(4)
      })

      // g0 is reading, g4 still queued; both tiles stay subscribed.
      removeFailedImportAsset('g0')
      removeFailedImportAsset('g4')
      for (const release of gates.splice(0)) {
        release()
      }
      await vi.waitFor(() => {
        expect(getThumbCacheStatsForTests()).toMatchObject({
          entries: 3,
          pending: 0,
        })
      })

      expect(hasThumbData('g0')).toBe(false)
      expect(hasThumbData('g4')).toBe(false)
      expect(get.mock.calls.map((call) => call[0])).not.toContain(keyFor(4))
    })
  })

  describe('restore bulk hydrate', () => {
    /** DerivedCache reads the pass keeps in flight. */
    const IN_FLIGHT = 24

    /**
     * Gallery `b0…b{count-1}` with identity records; `cached` ids get a
     * `size`-byte thumb in a memory DerivedCache; `failing` ids reject the
     * read. `get` maps reads to ids.
     */
    async function cachedGallery(
      count: number,
      options: {
        gated?: boolean
        size?: number
        uncached?: string[]
        failing?: string[]
      } = {},
    ) {
      const ids = Array.from({ length: count }, (_, i) => `b${String(i)}`)
      resetBookStore({
        book: makeBook({
          gallery: ids,
          assets: Object.fromEntries(
            ids.map((id, i) => [
              id,
              {
                sourceRootId: 'root',
                relativePath: `${id}.png`,
                byteSize: 10,
                mtimeMs: i,
              },
            ]),
          ),
        }),
        sessionMeta: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
      const cache = createMemoryDerivedCache()
      setDerivedCacheForTests(cache)
      const idByKey = new Map<string, string>()
      for (const id of ids) {
        const key = getAssetCacheKey(id)
        assert(key !== undefined)
        idByKey.set(key, id)
        if (!(options.uncached ?? []).includes(id)) {
          await cache.put(key, 'thumb', {
            bytes: new ArrayBuffer(options.size ?? 1),
            mimeType: 'image/png',
          })
        }
      }
      const gates: (() => void)[] = []
      const realGet = cache.get.bind(cache)
      const get = vi.spyOn(cache, 'get').mockImplementation(async (...args) => {
        if (options.gated === true) {
          await new Promise<void>((resolve) => {
            gates.push(resolve)
          })
        }
        if ((options.failing ?? []).includes(idByKey.get(args[0]) ?? '')) {
          throw new Error('idb closed')
        }
        return realGet(...args)
      })
      const readIds = (): (string | undefined)[] =>
        get.mock.calls.map((call) => idByKey.get(call[0]))
      return { ids, gates, readIds }
    }

    /** Release every gated read, a few rounds, so refills finish too. */
    async function releaseAll(gates: (() => void)[]): Promise<void> {
      for (let round = 0; round < 3; round += 1) {
        for (const release of gates.splice(0)) {
          release()
        }
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    it('keeps 24 reads in flight outward from the filmstrip window; each finished read starts the next', async () => {
      const create = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:bulk')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
      const { ids, gates, readIds } = await cachedGallery(30, { gated: true })
      viewport(['b15'])

      const pass = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(IN_FLIGHT)
      })
      expect(getThumbBulkHydrateStatsForTests().state).toBe('running')
      // b15, then right / left outward: b16 b14 b17 b13 … b27.
      const outward = Array.from({ length: 12 }, (_, i) => [
        `b${String(16 + i)}`,
        `b${String(14 - i)}`,
      ]).flat()
      expect(readIds()).toEqual(['b15', ...outward.slice(0, IN_FLIGHT - 1)])
      // One finished read starts the next; the other 23 are still out.
      gates.shift()?.()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(IN_FLIGHT + 1)
      })
      expect(readIds().at(-1)).toBe('b3')
      await releaseAll(gates)
      await pass

      expect(readIds().slice(IN_FLIGHT + 1)).toEqual([
        'b28',
        'b2',
        'b29',
        'b1',
        'b0',
      ])
      expect(ids.every((id) => getThumbUrl(id) !== undefined)).toBe(true)
      const blob = create.mock.calls[0]?.[0]
      expect(blob).toBeInstanceOf(Blob)
      expect((blob as Blob).type).toBe('image/png')
      expect(getThumbBulkHydrateStatsForTests()).toMatchObject({
        state: 'done',
        hydrated: 30,
        missed: 0,
      })
    })

    it('reads a window wider than 24 before going outward', async () => {
      mockObjectUrls('wide')
      const { ids, gates, readIds } = await cachedGallery(30, { gated: true })
      const window = ids.slice(2, 28)
      viewport(window)

      const pass = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(IN_FLIGHT)
      })
      expect(readIds()).toEqual(window.slice(0, IN_FLIGHT))
      await releaseAll(gates)
      await pass

      expect(readIds().slice(IN_FLIGHT)).toEqual([
        'b26',
        'b27',
        'b28',
        'b1',
        'b29',
        'b0',
      ])
    })

    it('starts at the gallery head and widens the window when several tiles show', async () => {
      mockObjectUrls('head')
      const head = await cachedGallery(3)
      await hydrateGalleryThumbs()
      expect(head.readIds()).toEqual(['b0', 'b1', 'b2'])

      resetThumbCache()
      const wide = await cachedGallery(10)
      viewport(['b6', 'b4'])
      await hydrateGalleryThumbs()
      expect(wide.readIds()).toEqual([
        'b4',
        'b5',
        'b6',
        'b7',
        'b3',
        'b8',
        'b2',
        'b9',
        'b1',
        'b0',
      ])
    })

    it('skips hot and keyless ids and counts misses without storing them', async () => {
      mockObjectUrls('skip')
      const { readIds } = await cachedGallery(4, { uncached: ['b3'] })
      setThumbUrl('b1', bytes(1), 'image/png')
      patchAssetRecord('b2', { mtimeMs: Number.NaN })
      // Pass start at 1000; every later clock read (scroll check, end) 1250.
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValue(1250)

      await hydrateGalleryThumbs()

      expect(readIds()).toEqual(['b0', 'b3'])
      expect(hasThumbData('b0')).toBe(true)
      expect(hasThumbData('b3')).toBe(false)
      expect(getThumbBulkHydrateStatsForTests()).toEqual({
        state: 'done',
        hydrated: 1,
        missed: 1,
        ms: 250,
      })
    })

    it('reads an id whose queued mount read was dropped by an unmount', async () => {
      mockObjectUrls('dropped')
      const { gates, readIds } = await cachedGallery(5, { gated: true })
      const unsubscribes = ['b0', 'b1', 'b2', 'b3', 'b4'].map((id) =>
        subscribeThumb(id, vi.fn()),
      )
      cleanups.push(...unsubscribes)
      for (const id of ['b0', 'b1', 'b2', 'b3', 'b4']) {
        ensureThumb(id, getAssetCacheKey(id))
      }
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(4)
      })
      // b4 waits in the mount queue; its tile leaves before a slot frees.
      unsubscribes[4]?.()

      const pass = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(5)
      })
      expect(readIds()[4]).toBe('b4')
      for (let round = 0; round < 3; round += 1) {
        for (const release of gates.splice(0)) {
          release()
        }
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      await pass

      expect(hasThumbData('b4')).toBe(true)
      expect(getThumbBulkHydrateStatsForTests().hydrated).toBe(1)
    })

    it('keeps the mount path thumb that landed during the read', async () => {
      mockObjectUrls('race')
      const { gates, readIds } = await cachedGallery(3, { gated: true })

      const pass = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(3)
      })
      setThumbUrl('b1', bytes(9, 9), 'image/png')
      const mounted = getThumbUrl('b1')
      for (const release of gates.splice(0)) {
        release()
      }
      await pass

      expect(getThumbUrl('b1')).toBe(mounted)
      expect(getThumbCacheStatsForTests().bytes).toBe(4)
      expect(getThumbBulkHydrateStatsForTests().hydrated).toBe(2)
    })

    it('stops at the byte budget without evicting hot thumbs', async () => {
      const revoke = mockObjectUrls('budget')
      const { readIds } = await cachedGallery(3 * IN_FLIGHT, { size: 4 })
      setThumbUrl('older', bytes(1, 2, 3, 4), 'image/png')
      setThumbCacheByteBudgetForTests(12)

      await hydrateGalleryThumbs()

      // Reads in flight at the budget finish; none start after it.
      expect(readIds().length).toBeLessThan(3 * IN_FLIGHT)
      expect(hasThumbData('older')).toBe(true)
      expect(revoke).not.toHaveBeenCalled()
      expect(['b0', 'b1', 'b2'].map((id) => hasThumbData(id))).toEqual([
        true,
        true,
        false,
      ])
      expect(getThumbCacheStatsForTests().bytes).toBe(12)
      expect(getThumbBulkHydrateStatsForTests()).toMatchObject({
        state: 'done',
        hydrated: 2,
      })
    })

    it('reset mid-read cancels the pass and stores nothing', async () => {
      mockObjectUrls('cancel')
      const { gates, readIds } = await cachedGallery(30, { gated: true })

      const pass = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(IN_FLIGHT)
      })
      resetThumbCache()
      for (const release of gates.splice(0)) {
        release()
      }
      await pass

      // Finished reads start no further read.
      expect(readIds()).toHaveLength(IN_FLIGHT)
      expect(getThumbCacheStatsForTests().entries).toBe(0)
      expect(getThumbBulkHydrateStatsForTests().state).toBe('idle')
    })

    it('a new pass supersedes a running one', async () => {
      mockObjectUrls('again')
      const { gates, readIds } = await cachedGallery(30, { gated: true })

      const first = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(IN_FLIGHT)
      })
      const second = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(2 * IN_FLIGHT)
      })
      for (const release of gates.splice(0, IN_FLIGHT)) {
        release()
      }
      await first
      expect(getThumbCacheStatsForTests().entries).toBe(0)

      for (let round = 0; round < 3; round += 1) {
        for (const release of gates.splice(0)) {
          release()
        }
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      await second
      expect(getThumbCacheStatsForTests().entries).toBe(30)
      expect(getThumbBulkHydrateStatsForTests()).toMatchObject({
        state: 'done',
        hydrated: 30,
      })
    })

    it('a pass cancelled by reset stays cancelled when the next pass starts', async () => {
      mockObjectUrls('reset-again')
      const { gates, readIds } = await cachedGallery(30, { gated: true })

      const first = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(IN_FLIGHT)
      })
      resetThumbCache()
      const second = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(2 * IN_FLIGHT)
      })
      for (const release of gates.splice(0, IN_FLIGHT)) {
        release()
      }
      await first

      expect(getThumbCacheStatsForTests().entries).toBe(0)
      resetThumbCache()
      for (const release of gates.splice(0)) {
        release()
      }
      await second
    })

    /** Memory-cache reads settle on microtasks: spin until `done()`. */
    async function settle(done: () => boolean): Promise<void> {
      for (let i = 0; i < 100 && !done(); i += 1) {
        await Promise.resolve()
      }
    }

    it('while the filmstrip scrolls, finished reads store at the next frame', async () => {
      mockObjectUrls('paced')
      const { readIds } = await cachedGallery(10)
      // A still clock keeps the scroll-quiet window open.
      vi.useFakeTimers({ toFake: ['performance'] })
      vi.advanceTimersByTime(1000)
      const rafQueue = queueRaf()
      noteFilmstripScroll()

      const pass = hydrateGalleryThumbs()
      await settle(() => rafQueue.length === 1)
      expect(rafQueue).toHaveLength(1)
      expect(readIds()).toHaveLength(10)
      expect(getThumbBulkHydrateStatsForTests().hydrated).toBe(0)
      rafQueue.shift()?.(0)
      // Within the 3 ms slice one frame stores them all.
      await settle(() => getThumbBulkHydrateStatsForTests().state === 'done')
      expect(rafQueue).toHaveLength(0)
      await pass

      expect(getThumbBulkHydrateStatsForTests()).toMatchObject({
        state: 'done',
        hydrated: 10,
      })
    })

    it('reset during the scroll frame wait stores nothing and starts no read', async () => {
      mockObjectUrls('reset-frame')
      const { gates, readIds } = await cachedGallery(30, { gated: true })
      vi.useFakeTimers({ toFake: ['performance'] })
      const rafQueue = queueRaf()
      noteFilmstripScroll()

      const pass = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(IN_FLIGHT)
      })
      gates.shift()?.()
      await settle(() => rafQueue.length === 1)
      expect(rafQueue).toHaveLength(1)
      expect(readIds()).toHaveLength(IN_FLIGHT + 1)
      resetThumbCache()
      await releaseAll(gates)
      rafQueue.shift()?.(0)
      await pass

      expect(readIds()).toHaveLength(IN_FLIGHT + 1)
      expect(getThumbCacheStatsForTests().entries).toBe(0)
      expect(getThumbBulkHydrateStatsForTests().state).toBe('idle')
    })

    /**
     * 60 gated reads, the strip scrolling at b40 (still clock): the first 24
     * reads are b29…b52. `advance` finishes `count` reads, runs the queued
     * frames, and returns the ids picked in their place, one per read.
     */
    async function scrollingPassAtB40() {
      mockObjectUrls('ahead')
      const { gates, readIds } = await cachedGallery(60, { gated: true })
      vi.useFakeTimers({ toFake: ['performance'] })
      const rafQueue = queueRaf()
      noteFilmstripScroll()
      viewport(['b40'])
      // `vi.waitFor` would advance the still clock past the scroll.
      const pass = hydrateGalleryThumbs()
      await drainTasks()
      expect(readIds()).toHaveLength(IN_FLIGHT)
      const advance = async (count: number) => {
        const before = readIds().length
        for (const release of gates.splice(0, count)) {
          release()
        }
        await drainTasks()
        expect(readIds()).toHaveLength(before + count)
        // Store what finished, so waiting results never pause the reads.
        for (const frame of rafQueue.splice(0)) {
          frame(0)
        }
        await drainTasks()
        return readIds().slice(before)
      }
      const finish = async (): Promise<void> => {
        resetThumbCache()
        await releaseAll(gates)
        for (const frame of rafQueue.splice(0)) {
          frame(0)
        }
        await pass
      }
      return { advance, finish }
    }

    it('while the filmstrip scrolls right, reads ahead of it before the trail side', async () => {
      const { advance, finish } = await scrollingPassAtB40()
      viewport(['b42'])

      // Outward from b42 the trail side would come in at b28.
      expect(await advance(6)).toEqual([
        'b53',
        'b54',
        'b55',
        'b56',
        'b57',
        'b58',
      ])
      await finish()
    })

    it('while the filmstrip scrolls left, reads ahead of it down to the gallery head', async () => {
      const { advance, finish } = await scrollingPassAtB40()
      viewport(['b38', 'b39'])

      // Outward from b38…b39 the trail side would come in at b53.
      expect(await advance(6)).toEqual([
        'b28',
        'b27',
        'b26',
        'b25',
        'b24',
        'b23',
      ])
      expect((await advance(23)).at(-1)).toBe('b0')
      expect(await advance(1)).toEqual(['b53'])
      await finish()
    })

    it('once the filmstrip stops, reads both sides again', async () => {
      const { advance, finish } = await scrollingPassAtB40()
      viewport(['b42'])
      expect(await advance(2)).toEqual(['b53', 'b54'])

      // Past the scroll-quiet window: outward from b42 again.
      vi.advanceTimersByTime(1000)
      expect(await advance(4)).toEqual(['b55', 'b56', 'b28', 'b57'])
      await finish()
    })

    /** Lets every pending memory-cache read and refill settle. */
    async function drainTasks(): Promise<void> {
      for (let round = 0; round < 3; round += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    it('while stores wait for a frame, reads pause at 24 waiting results and resume as they store', async () => {
      mockObjectUrls('capped')
      const { readIds } = await cachedGallery(60)
      vi.useFakeTimers({ toFake: ['performance'] })
      const rafQueue = queueRaf()
      noteFilmstripScroll()

      const pass = hydrateGalleryThumbs()
      await drainTasks()
      // The first 23 finished reads each start one more; then 24 wait.
      expect(readIds()).toHaveLength(2 * IN_FLIGHT - 1)
      expect(getThumbBulkHydrateStatsForTests().hydrated).toBe(0)
      for (let frame = 0; frame < 5 && rafQueue.length > 0; frame += 1) {
        rafQueue.shift()?.(0)
        await drainTasks()
      }
      await pass

      expect(readIds()).toHaveLength(60)
      expect(getThumbBulkHydrateStatsForTests()).toMatchObject({
        state: 'done',
        hydrated: 60,
      })
    })

    it('a read failing mid-pass ends it at once; finished reads start none', async () => {
      mockObjectUrls('fail-mid')
      const { gates, readIds } = await cachedGallery(30, {
        gated: true,
        failing: ['b0'],
      })

      const pass = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(IN_FLIGHT)
      })
      gates.shift()?.()
      await settle(() => getThumbBulkHydrateStatsForTests().state === 'done')
      expect(getThumbBulkHydrateStatsForTests().state).toBe('done')
      await releaseAll(gates)
      await pass

      expect(readIds()).toHaveLength(IN_FLIGHT)
      expect(getThumbCacheStatsForTests().entries).toBe(0)
    })

    it('reads that finish after the byte-budget stop start none', async () => {
      mockObjectUrls('budget-late')
      const { gates, readIds } = await cachedGallery(30, {
        gated: true,
        size: 4,
      })
      setThumbCacheByteBudgetForTests(8)

      const pass = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(IN_FLIGHT)
      })
      for (const release of gates.splice(0, 3)) {
        release()
      }
      await vi.waitFor(() => {
        expect(getThumbBulkHydrateStatsForTests().state).toBe('done')
      })
      await releaseAll(gates)
      await pass

      expect(readIds()).toHaveLength(IN_FLIGHT + 3)
      expect(getThumbCacheStatsForTests().entries).toBe(2)
    })

    it('while the filmstrip scrolls a store slice past FLUSH_MAX_MS waits a frame', async () => {
      mockObjectUrls('frame-sliced')
      await cachedGallery(8)
      const rafQueue = queueRaf()
      // Every clock read costs 1 ms: the stores outrun the 3 ms slice, and
      // the 200 ms scroll-quiet window outlasts them.
      let clock = 0
      vi.spyOn(performance, 'now').mockImplementation(() => (clock += 1))
      noteFilmstripScroll()

      const pass = hydrateGalleryThumbs()
      await settle(() => rafQueue.length === 1)
      expect(getThumbBulkHydrateStatsForTests().hydrated).toBe(0)
      rafQueue.shift()?.(0)
      await settle(() => rafQueue.length === 1)
      expect(rafQueue).toHaveLength(1)
      const { hydrated } = getThumbBulkHydrateStatsForTests()
      expect(hydrated).toBeGreaterThan(0)
      expect(hydrated).toBeLessThan(8)
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        cb(0)
        return 0
      })
      rafQueue.shift()?.(0)
      await pass

      expect(getThumbBulkHydrateStatsForTests()).toMatchObject({
        state: 'done',
        hydrated: 8,
      })
    })

    it('yields a task once a batch store passes the frame slice', async () => {
      mockObjectUrls('sliced')
      await cachedGallery(8)
      vi.useFakeTimers({ toFake: ['setTimeout'] })
      // Every clock read costs 1 ms, so a batch outruns the 3 ms slice.
      let clock = 0
      vi.spyOn(performance, 'now').mockImplementation(() => (clock += 1))

      const pass = hydrateGalleryThumbs()
      // The first timer is the pass's yield.
      await settle(() => vi.getTimerCount() > 0)
      expect(vi.getTimerCount()).toBe(1)
      const { hydrated } = getThumbBulkHydrateStatsForTests()
      expect(hydrated).toBeGreaterThan(0)
      expect(hydrated).toBeLessThan(8)
      await vi.runAllTimersAsync()
      await pass

      expect(getThumbBulkHydrateStatsForTests()).toMatchObject({
        state: 'done',
        hydrated: 8,
      })
    })

    it('a failing DerivedCache read ends the pass instead of rejecting', async () => {
      await cachedGallery(3)
      const broken = createMemoryDerivedCache()
      vi.spyOn(broken, 'get').mockRejectedValue(new Error('idb closed'))
      setDerivedCacheForTests(broken)

      await expect(hydrateGalleryThumbs()).resolves.toBeUndefined()

      expect(getThumbBulkHydrateStatsForTests()).toMatchObject({
        state: 'done',
        hydrated: 0,
      })
      expect(getThumbCacheStatsForTests().entries).toBe(0)
    })

    it('drops a thumb whose asset is removed mid-read', async () => {
      mockObjectUrls('removed')
      const { gates, readIds } = await cachedGallery(3, { gated: true })

      const pass = hydrateGalleryThumbs()
      await vi.waitFor(() => {
        expect(readIds()).toHaveLength(3)
      })
      removeFailedImportAsset('b1')
      for (const release of gates.splice(0)) {
        release()
      }
      await pass

      expect(hasThumbData('b0')).toBe(true)
      expect(hasThumbData('b1')).toBe(false)
      expect(hasThumbData('b2')).toBe(true)
    })
  })
})

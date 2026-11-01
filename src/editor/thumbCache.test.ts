import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDerivedCache, setDerivedCacheForTests } from '../assets'
import {
  isDecodeScrollQuiet,
  resetDecodeScrollQuietForTests,
} from '../photo/decodeScrollQuiet'
import {
  getAssetAspectSnapshot,
  removeFailedImportAsset,
  resetBookStore,
} from './bookStore'
import { awaitPendingHashes, resetPendingHashesForTests } from './pendingHashes'
import { resetFilmstripScrollQuietForTests } from './filmstripScrollQuiet'
import {
  ensureThumb,
  getThumbCacheStatsForTests,
  getThumbPublishGeneration,
  getThumbUrl,
  hasThumbData,
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
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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
})

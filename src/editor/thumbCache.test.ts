import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryDerivedCache, setDerivedCacheForTests } from '../assets'
import {
  ensureThumb,
  getThumbUrl,
  resetThumbCache,
  setThumbUrl,
  subscribeThumb,
} from './thumbCache'

const SAMPLE_HASH =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('thumbCache', () => {
  afterEach(() => {
    resetThumbCache()
    setDerivedCacheForTests(undefined)
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stores thumb urls after rAF flush and notifies subscribers', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
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
    expect(getThumbUrl('a1')).toBeUndefined()
    expect(callbacks).toHaveLength(1)

    callbacks[0]?.(0)
    expect(create).toHaveBeenCalledOnce()
    expect(getThumbUrl('a1')).toBe('blob:thumb-1')
    expect(listener).toHaveBeenCalled()

    unsubscribe()
    setThumbUrl('a1', new Uint8Array([4]).buffer, 'image/png')
    callbacks[1]?.(0)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getThumbUrl('a1')).toBe('blob:thumb-2')
    expect(revoke).toHaveBeenCalledWith('blob:thumb-1')
  })

  it('flushes pending thumbs across multiple animation frames', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    let n = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      n += 1
      return `blob:t-${String(n)}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    setThumbUrl('a', new Uint8Array([1]).buffer, 'image/jpeg')
    setThumbUrl('b', new Uint8Array([2]).buffer, 'image/jpeg')
    setThumbUrl('c', new Uint8Array([3]).buffer, 'image/jpeg')

    callbacks[0]?.(0)
    expect(getThumbUrl('a')).toBe('blob:t-1')
    expect(getThumbUrl('b')).toBeUndefined()
    expect(getThumbUrl('c')).toBeUndefined()

    callbacks[1]?.(0)
    expect(getThumbUrl('b')).toBe('blob:t-2')
    expect(getThumbUrl('c')).toBeUndefined()

    callbacks[2]?.(0)
    expect(getThumbUrl('c')).toBe('blob:t-3')
  })

  it('resetThumbCache clears urls, notifies listeners, and drops pending', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    const listener = vi.fn()
    subscribeThumb('a1', listener)

    setThumbUrl('a1', new Uint8Array([1]).buffer, 'image/jpeg')
    callbacks[0]?.(0)
    expect(getThumbUrl('a1')).toBe('blob:x')

    setThumbUrl('pending', new Uint8Array([2]).buffer, 'image/jpeg')
    resetThumbCache()
    expect(getThumbUrl('a1')).toBeUndefined()
    expect(listener).toHaveBeenCalled()
    expect(revoke).toHaveBeenCalledWith('blob:x')

    callbacks[1]?.(0)
    expect(getThumbUrl('pending')).toBeUndefined()
  })

  it('puts into DerivedCache when setThumbUrl receives a contentHash', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    setDerivedCacheForTests(cache)

    setThumbUrl('a1', new Uint8Array([1, 2]).buffer, 'image/jpeg', SAMPLE_HASH)
    callbacks[0]?.(0)
    await Promise.resolve()
    const got = await cache.get(SAMPLE_HASH, 'thumb')
    expect(got.ok).toBe(true)
    if (got.ok) {
      expect(new Uint8Array(got.value.bytes)).toEqual(new Uint8Array([1, 2]))
    }
  })

  it('does not put into DerivedCache without a contentHash', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const cache = createMemoryDerivedCache()
    const put = vi.spyOn(cache, 'put')
    setDerivedCacheForTests(cache)

    setThumbUrl('a1', new Uint8Array([1]).buffer, 'image/jpeg')
    callbacks[0]?.(0)
    await Promise.resolve()
    expect(put).not.toHaveBeenCalled()
  })

  it('ensureThumb hydrates from DerivedCache when hashed', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
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
      const queued = callbacks.splice(0)
      for (const callback of queued) {
        callback(0)
      }
    }
    expect(getThumbUrl('a1')).toBe('blob:hydrated-thumb')
  })

  it('ensureThumb is a no-op without contentHash', async () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        callbacks.push(cb)
        return callbacks.length
      },
    )
    const cache = createMemoryDerivedCache()
    const get = vi.spyOn(cache, 'get')
    setDerivedCacheForTests(cache)
    ensureThumb('a1')
    await Promise.resolve()
    expect(get).not.toHaveBeenCalled()
    expect(callbacks).toHaveLength(0)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getThumbUrl,
  resetThumbCache,
  setThumbUrl,
  subscribeThumb,
} from './thumbCache'

describe('thumbCache', () => {
  afterEach(() => {
    resetThumbCache()
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
    expect(getThumbUrl('b')).toBe('blob:t-2')
    expect(getThumbUrl('c')).toBeUndefined()

    callbacks[1]?.(0)
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
})

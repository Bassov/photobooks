import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clampThumbHeight,
  FILMSTRIP_THUMB_MAX,
  FILMSTRIP_THUMB_MIN,
  getFilmstripThumbHeight,
  readStored,
  resetFilmstripThumbHeightForTests,
  setFilmstripThumbHeight,
  subscribeFilmstripThumbHeight,
} from './filmstripSize'
import { thumbSlotSize, thumbStride, thumbWidthMax } from './thumbSlotSize'

afterEach(() => {
  resetFilmstripThumbHeightForTests()
})

describe('filmstrip thumb height', () => {
  it('clamps to the allowed range and rejects non-finite values', () => {
    expect(clampThumbHeight(10)).toBe(FILMSTRIP_THUMB_MIN)
    expect(clampThumbHeight(999)).toBe(FILMSTRIP_THUMB_MAX)
    expect(clampThumbHeight(Number.NaN)).toBe(96)
  })

  it('persists, notifies once and ignores unchanged values', () => {
    const listener = vi.fn()
    const off = subscribeFilmstripThumbHeight(listener)
    setFilmstripThumbHeight(128)
    setFilmstripThumbHeight(128)
    off()
    expect(getFilmstripThumbHeight()).toBe(128)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(
      window.localStorage.getItem('photobooks.filmstrip.thumbHeight'),
    ).toBe('128')
  })
})

describe('stored thumb height', () => {
  it('reads a clamped stored value, defaults when absent or unreadable', () => {
    expect(readStored()).toBe(96)
    window.localStorage.setItem('photobooks.filmstrip.thumbHeight', '500')
    expect(readStored()).toBe(FILMSTRIP_THUMB_MAX)
    vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('denied')
    })
    expect(readStored()).toBe(96)
  })

  it('reset restores the default, clears storage and notifies', () => {
    setFilmstripThumbHeight(160)
    const listener = vi.fn()
    const off = subscribeFilmstripThumbHeight(listener)
    resetFilmstripThumbHeightForTests()
    off()
    expect(getFilmstripThumbHeight()).toBe(96)
    expect(
      window.localStorage.getItem('photobooks.filmstrip.thumbHeight'),
    ).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('unsubscribed listeners are not called', () => {
    const listener = vi.fn()
    subscribeFilmstripThumbHeight(listener)()
    setFilmstripThumbHeight(120)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('thumb slot sizing by height', () => {
  it('stride adds the gap to the slot width', () => {
    expect(thumbStride(1.5)).toBe(152)
    expect(thumbStride(1.5, 192)).toBe(296)
  })

  it('keeps defaults at 96 and scales width clamps with height', () => {
    expect(thumbSlotSize(1.5)).toEqual({ width: 144, height: 96 })
    expect(thumbSlotSize(1.5, 192)).toEqual({ width: 288, height: 192 })
    expect(thumbSlotSize(10, 192).width).toBe(thumbWidthMax(192))
    expect(thumbSlotSize(0.1, 192).width).toBe(96)
  })
})

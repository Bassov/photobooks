import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clampThumb,
  readThumb,
  resetFilmstripThumb,
  setFilmstripThumb,
  THUMB_MIN,
  THUMB_STORAGE_KEY,
  thumbAuto,
  thumbDragPx,
  thumbForKey,
  thumbMax,
  thumbPx,
  useFilmstripThumbHeight,
  useFilmstripThumbMax,
  writeThumb,
} from './filmstripSize'

const startHeight = window.innerHeight

function setInnerHeight(px: number): void {
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: px,
  })
}

beforeEach(() => {
  localStorage.clear()
  resetFilmstripThumb()
})

afterEach(() => {
  setInnerHeight(startHeight)
  vi.restoreAllMocks()
})

describe('thumb height maths', () => {
  it('auto follows the window height: 900/1080/1440/2160 → 76/91/122/160', () => {
    expect([900, 1080, 1440, 2160].map(thumbAuto)).toEqual([76, 91, 122, 160])
    expect(thumbAuto(600)).toBe(76)
    expect(thumbAuto(4000)).toBe(160)
  })

  it('manual max = min(240, floor((h − 48) / 2) − 64), never below 56', () => {
    expect(thumbMax(900)).toBe(240)
    expect(thumbMax(656)).toBe(240)
    expect(thumbMax(655)).toBe(303 - 64)
    expect(thumbMax(601)).toBe(276 - 64)
    expect(thumbMax(200)).toBe(THUMB_MIN)
  })

  it('clamps a manual pick into 56 .. max; auto ignores the clamp range', () => {
    expect(clampThumb(20, 900)).toBe(56)
    expect(clampThumb(300, 900)).toBe(240)
    expect(clampThumb(128, 900)).toBe(128)
    expect(thumbPx(300, 600)).toBe(212)
    expect(thumbPx('auto', 1440)).toBe(122)
  })

  it('drags in 4 px steps from the press height, clamped', () => {
    expect(thumbDragPx(76, 52, 900)).toBe(128)
    expect(thumbDragPx(76, 49, 900)).toBe(124)
    expect(thumbDragPx(76, 50, 900)).toBe(128)
    expect(thumbDragPx(76, -100, 900)).toBe(56)
    expect(thumbDragPx(76, 400, 900)).toBe(240)
  })

  it('maps separator keys: ↑/↓ ±8, Home, End, Enter; others null', () => {
    expect(thumbForKey('ArrowUp', 76, 900)).toBe(84)
    expect(thumbForKey('ArrowDown', 76, 900)).toBe(68)
    expect(thumbForKey('ArrowDown', 60, 900)).toBe(56)
    expect(thumbForKey('ArrowUp', 236, 900)).toBe(240)
    expect(thumbForKey('Home', 128, 900)).toBe(56)
    expect(thumbForKey('End', 128, 600)).toBe(212)
    expect(thumbForKey('Enter', 128, 900)).toBe('auto')
    expect(thumbForKey('a', 128, 900)).toBeNull()
  })
})

describe('thumb height storage', () => {
  it('reads a stored number or auto from the v2 key', () => {
    expect(readThumb()).toBe('auto')
    localStorage.setItem(THUMB_STORAGE_KEY, '128')
    expect(readThumb()).toBe(128)
    localStorage.setItem(THUMB_STORAGE_KEY, 'auto')
    expect(readThumb()).toBe('auto')
    localStorage.setItem(THUMB_STORAGE_KEY, 'tall')
    expect(readThumb()).toBe('auto')
    localStorage.setItem(THUMB_STORAGE_KEY, '')
    expect(readThumb()).toBe('auto')
  })

  it('ignores the old thumbHeight key', () => {
    localStorage.setItem('photobooks.filmstrip.thumbHeight', '96')
    expect(readThumb()).toBe('auto')
  })

  it('writes numbers and auto as strings', () => {
    writeThumb(128)
    expect(localStorage.getItem(THUMB_STORAGE_KEY)).toBe('128')
    writeThumb('auto')
    expect(localStorage.getItem(THUMB_STORAGE_KEY)).toBe('auto')
  })

  it('falls back to auto and keeps going when storage throws', () => {
    localStorage.setItem(THUMB_STORAGE_KEY, '128')
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readThumb()).toBe('auto')
    expect(() => {
      writeThumb(100)
    }).not.toThrow()
  })
})

describe('thumb height store', () => {
  it('starts from storage and persists only when asked', () => {
    localStorage.setItem(THUMB_STORAGE_KEY, '100')
    setInnerHeight(900)
    const { result } = renderHook(() => useFilmstripThumbHeight())
    expect(result.current).toBe(100)
    act(() => {
      setFilmstripThumb(132, false)
    })
    expect(result.current).toBe(132)
    expect(localStorage.getItem(THUMB_STORAGE_KEY)).toBe('100')
    act(() => {
      setFilmstripThumb('auto')
    })
    expect(result.current).toBe(76)
    expect(localStorage.getItem(THUMB_STORAGE_KEY)).toBe('auto')
  })

  it('re-clamps on window resize without writing storage', () => {
    setInnerHeight(900)
    act(() => {
      setFilmstripThumb(240)
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const height = renderHook(() => useFilmstripThumbHeight())
    const max = renderHook(() => useFilmstripThumbMax())
    expect([height.result.current, max.result.current]).toEqual([240, 240])
    act(() => {
      setInnerHeight(600)
      window.dispatchEvent(new Event('resize'))
    })
    expect([height.result.current, max.result.current]).toEqual([212, 212])
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(THUMB_STORAGE_KEY)).toBe('240')
    height.unmount()
    max.unmount()
  })
})

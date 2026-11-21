import { act, renderHook } from '@testing-library/react'
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appInnerHeight,
  applyUiScale,
  effectiveDpr,
  effectiveUiScale,
  readUiScaleChoice,
  setUiScaleChoice,
  subscribeUiScale,
  UI_SCALE_KEY,
  UI_SCALES,
  uiScale,
  useUiScale,
} from './uiScale'

const start = { w: window.innerWidth, h: window.innerHeight }

function setWindow(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h })
}

/** Captures rAF callbacks so a resize settles only when the test says so. */
function captureFrames(): { run: () => void; count: () => number } {
  const callbacks: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    callbacks.push(cb)
    return callbacks.length
  })
  return {
    run: () => {
      for (const cb of callbacks.splice(0)) {
        cb(0)
      }
    },
    count: () => callbacks.length,
  }
}

/** Private mode / quota: every storage call throws. */
function blockStorage(): void {
  const blocked = (): never => {
    throw new Error('blocked')
  }
  vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
    getItem: blocked,
    setItem: blocked,
  } as unknown as Storage)
}

function rootScale(): { css: string; data: string | undefined } {
  const root = document.documentElement
  return {
    css: root.style.getPropertyValue('--ui-scale'),
    data: root.dataset.uiScale,
  }
}

let dispose: (() => void) | null = null

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  dispose?.()
  dispose = null
  setWindow(start.w, start.h)
  localStorage.clear()
})

describe('readUiScaleChoice', () => {
  it('maps "100" | "125" | "150" and treats anything else as 1', () => {
    expect(readUiScaleChoice()).toBe(1)
    for (const [raw, s] of [
      ['100', 1],
      ['125', 1.25],
      ['150', 1.5],
      ['200', 1],
      ['1.5', 1],
      ['', 1],
      ['toString', 1],
    ] as const) {
      localStorage.setItem(UI_SCALE_KEY, raw)
      expect(readUiScaleChoice()).toBe(s)
    }
  })

  it('reads 1 when storage throws', () => {
    localStorage.setItem(UI_SCALE_KEY, '150')
    blockStorage()
    expect(readUiScaleChoice()).toBe(1)
  })
})

describe('effectiveUiScale (D4)', () => {
  it('matches the spec examples', () => {
    expect(UI_SCALES).toEqual([1, 1.25, 1.5])
    expect(effectiveUiScale(1.5, 3840, 2030)).toBe(1.5)
    expect(effectiveUiScale(1.5, 1920, 970)).toBe(1.25)
    expect(effectiveUiScale(1.25, 1440, 900)).toBe(1)
    expect(effectiveUiScale(1, 3840, 2160)).toBe(1)
    expect(effectiveUiScale(1.25, 3840, 2160)).toBe(1.25)
  })

  it('allows an app of exactly 1280×720', () => {
    expect(effectiveUiScale(1.5, 1920, 1080)).toBe(1.5)
    expect(effectiveUiScale(1.5, 1919, 1080)).toBe(1.25)
    expect(effectiveUiScale(1.5, 1920, 1079)).toBe(1.25)
    expect(effectiveUiScale(1.25, 1600, 900)).toBe(1.25)
    expect(effectiveUiScale(1.25, 1599, 900)).toBe(1)
    expect(effectiveUiScale(1.25, 1600, 899)).toBe(1)
    expect(effectiveUiScale(1.5, 1000, 600)).toBe(1)
  })

  it('PBT: the largest step ≤ choice that leaves a 1280×720 app, else 1', () => {
    const fits = (s: number, w: number, h: number) =>
      w / s >= 1280 && h / s >= 720
    fc.assert(
      fc.property(
        fc.constantFrom(...UI_SCALES),
        fc.integer({ min: 0, max: 8000 }),
        fc.integer({ min: 0, max: 5000 }),
        (choice, w, h) => {
          const s = effectiveUiScale(choice, w, h)
          expect(UI_SCALES).toContain(s)
          expect(s).toBeLessThanOrEqual(choice)
          expect(s === 1 || fits(s, w, h)).toBe(true)
          for (const bigger of UI_SCALES) {
            if (bigger > s && bigger <= choice) {
              expect(fits(bigger, w, h)).toBe(false)
            }
          }
        },
      ),
    )
  })
})

describe('applyUiScale', () => {
  it('writes the effective scale on <html> and exposes it', () => {
    setWindow(3840, 2160)
    localStorage.setItem(UI_SCALE_KEY, '150')
    dispose = applyUiScale()
    expect(rootScale()).toEqual({ css: '1.5', data: '150' })
    expect(uiScale()).toBe(1.5)
    expect(appInnerHeight()).toBe(1440)
    expect(effectiveDpr()).toBe((window.devicePixelRatio || 1) * 1.5)
  })

  it('is 1 with no stored choice', () => {
    setWindow(3840, 2160)
    dispose = applyUiScale()
    expect(rootScale()).toEqual({ css: '1', data: '100' })
    expect(appInnerHeight()).toBe(2160)
  })

  it('re-clamps on resize once per frame and never writes the choice back', () => {
    setWindow(3840, 2160)
    localStorage.setItem(UI_SCALE_KEY, '150')
    dispose = applyUiScale()
    const frames = captureFrames()
    const listener = vi.fn()
    const off = subscribeUiScale(listener)

    setWindow(1920, 970)
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('resize'))
    expect(frames.count()).toBe(1)
    expect(uiScale()).toBe(1.5)
    frames.run()
    expect(uiScale()).toBe(1.25)
    expect(rootScale()).toEqual({ css: '1.25', data: '125' })
    expect(listener).toHaveBeenCalledOnce()
    expect(localStorage.getItem(UI_SCALE_KEY)).toBe('150')

    // Same scale after the next resize: no notification.
    setWindow(1900, 970)
    window.dispatchEvent(new Event('resize'))
    frames.run()
    expect(listener).toHaveBeenCalledOnce()

    // Widening restores the choice.
    setWindow(3840, 2160)
    window.dispatchEvent(new Event('resize'))
    frames.run()
    expect(uiScale()).toBe(1.5)
    expect(listener).toHaveBeenCalledTimes(2)
    off()
  })

  it('follows the stored choice from another tab', () => {
    setWindow(3840, 2160)
    dispose = applyUiScale()
    localStorage.setItem(UI_SCALE_KEY, '125')
    window.dispatchEvent(new StorageEvent('storage', { key: 'other' }))
    expect(uiScale()).toBe(1)
    window.dispatchEvent(new StorageEvent('storage', { key: UI_SCALE_KEY }))
    expect(uiScale()).toBe(1.25)
    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(uiScale()).toBe(1)
  })

  it('stops listening after dispose', () => {
    setWindow(3840, 2160)
    localStorage.setItem(UI_SCALE_KEY, '150')
    const off = applyUiScale()
    const frames = captureFrames()
    off()
    setWindow(1440, 900)
    window.dispatchEvent(new Event('resize'))
    localStorage.setItem(UI_SCALE_KEY, '125')
    window.dispatchEvent(new StorageEvent('storage', { key: UI_SCALE_KEY }))
    expect(frames.count()).toBe(0)
    expect(uiScale()).toBe(1.5)
  })
})

describe('setUiScaleChoice + useUiScale', () => {
  it('saves the choice and re-renders with { choice, effective }', () => {
    setWindow(1920, 970)
    dispose = applyUiScale()
    const { result } = renderHook(() => useUiScale())
    expect(result.current).toEqual({ choice: 1, effective: 1 })

    act(() => {
      setUiScaleChoice(1.5)
    })
    expect(localStorage.getItem(UI_SCALE_KEY)).toBe('150')
    expect(result.current).toEqual({ choice: 1.5, effective: 1.25 })
    expect(rootScale()).toEqual({ css: '1.25', data: '125' })

    const before = result.current
    act(() => {
      setUiScaleChoice(1.5)
    })
    expect(result.current).toBe(before)

    act(() => {
      setUiScaleChoice(1)
    })
    expect(localStorage.getItem(UI_SCALE_KEY)).toBe('100')
    expect(result.current).toEqual({ choice: 1, effective: 1 })
  })

  it('keeps the stored choice when storage is blocked', () => {
    setWindow(3840, 2160)
    dispose = applyUiScale()
    blockStorage()
    expect(() => {
      setUiScaleChoice(1.5)
    }).not.toThrow()
    expect(uiScale()).toBe(1)
  })
})

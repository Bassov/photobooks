import { describe, expect, it, vi } from 'vitest'
import {
  beginDelayedFitFollow,
  createDelayedFitFollow,
  fitSpreadZoomFor,
  fitViewportSize,
  resolveDelayedFitFrame,
  scheduleDelayedFitDoubleRaf,
  shouldApplyDelayedFitZoom,
  shouldHoldCameraScroll,
  stopDelayedFitFollow,
} from './pasteboardCameraFit'

describe('fitViewportSize', () => {
  it('subtracts the kit side pads and top/bottom bands', () => {
    expect(fitViewportSize(500, 400)).toEqual({
      viewportWidth: 500 - 80,
      viewportHeight: 400 - 56 - 48,
    })
  })

  it('clamps each axis to at least 1px', () => {
    expect(fitViewportSize(10, 10)).toEqual({
      viewportWidth: 1,
      viewportHeight: 1,
    })
  })
})

describe('fitSpreadZoomFor', () => {
  // Port 928 × 732 → fit band 848 × 628 (kit pads 40 / 56 / 48).
  const port = { clientWidth: 928, clientHeight: 732 }

  it('contains the widest spread by width when it is the tighter axis', () => {
    // 30 × 30 cm pages: the two-page spread is 600 × 300 at 1 px/mm.
    expect(
      fitSpreadZoomFor({
        widestSpreadWidthPx: 600,
        spreadHeightPx: 300,
        ...port,
      }),
    ).toBeCloseTo(848 / 600, 10)
  })

  it('contains the widest spread by height when it is the tighter axis', () => {
    expect(
      fitSpreadZoomFor({
        widestSpreadWidthPx: 380,
        spreadHeightPx: 400,
        ...port,
      }),
    ).toBeCloseTo(628 / 400, 10)
  })

  it('fits a single page at the two-page zoom, not its own', () => {
    const book = {
      widestSpreadWidthPx: 600,
      spreadHeightPx: 300,
      ...port,
    }
    const zoom = fitSpreadZoomFor(book)
    // The single page (300 wide) would fit taller on its own; Fit keeps the
    // book-wide zoom so the two-page spreads still fit.
    expect(zoom).toBeLessThan(
      fitSpreadZoomFor({ ...book, widestSpreadWidthPx: 300 }),
    )
    expect(600 * zoom).toBeLessThanOrEqual(848)
    expect(300 * zoom).toBeLessThanOrEqual(628)
  })

  it('subtracts the fit band before containing', () => {
    expect(
      fitSpreadZoomFor({
        widestSpreadWidthPx: 100,
        spreadHeightPx: 1000,
        clientWidth: 2000,
        clientHeight: 1104,
      }),
    ).toBeCloseTo(1, 10)
  })
})

describe('shouldHoldCameraScroll', () => {
  it('is true only while the hold flag is set', () => {
    expect(shouldHoldCameraScroll(undefined)).toBe(false)
    expect(shouldHoldCameraScroll(null)).toBe(false)
    expect(shouldHoldCameraScroll({ current: false })).toBe(false)
    expect(shouldHoldCameraScroll({ current: true })).toBe(true)
  })
})

describe('shouldApplyDelayedFitZoom', () => {
  it('applies only while following and next zoom is strictly smaller', () => {
    expect(shouldApplyDelayedFitZoom(true, 0.5, 0.6)).toBe(true)
    expect(shouldApplyDelayedFitZoom(true, 0.6, 0.6)).toBe(false)
    expect(shouldApplyDelayedFitZoom(true, 0.7, 0.6)).toBe(false)
    expect(shouldApplyDelayedFitZoom(false, 0.5, 0.6)).toBe(false)
    expect(shouldApplyDelayedFitZoom(true, null, 0.6)).toBe(false)
  })
})

describe('delayed fit follow schedule', () => {
  it('begin/stop toggles following and cancels a pending raf', () => {
    const state = createDelayedFitFollow()
    const cancel = vi.fn()
    beginDelayedFitFollow(state)
    expect(state.following).toBe(true)
    state.rafId = 7
    stopDelayedFitFollow(state, cancel)
    expect(state.following).toBe(false)
    expect(state.rafId).toBe(0)
    expect(cancel).toHaveBeenCalledWith(7)
  })

  it('stop is a no-op cancel when no raf is scheduled', () => {
    const state = createDelayedFitFollow()
    const cancel = vi.fn()
    beginDelayedFitFollow(state)
    stopDelayedFitFollow(state, cancel)
    expect(cancel).not.toHaveBeenCalled()
  })

  it('schedules double-rAF and cancels a prior id', () => {
    const state = createDelayedFitFollow()
    beginDelayedFitFollow(state)
    const queued: FrameRequestCallback[] = []
    const schedule = vi.fn((cb: FrameRequestCallback) => {
      queued.push(cb)
      return queued.length
    })
    const cancel = vi.fn()
    state.rafId = 99
    const onSecond = vi.fn()
    scheduleDelayedFitDoubleRaf(state, schedule, cancel, onSecond)
    expect(cancel).toHaveBeenCalledWith(99)
    expect(schedule).toHaveBeenCalledTimes(1)
    queued[0]?.(0)
    expect(schedule).toHaveBeenCalledTimes(2)
    queued[1]?.(1)
    expect(onSecond).toHaveBeenCalledTimes(1)
    expect(state.rafId).toBe(0)
  })

  it('resolveDelayedFitFrame applies zoom-out then clears following', () => {
    const state = createDelayedFitFollow()
    beginDelayedFitFollow(state)
    expect(resolveDelayedFitFrame(state, 0.4, 0.5)).toEqual({
      apply: true,
      zoom: 0.4,
    })
    expect(state.following).toBe(false)
    beginDelayedFitFollow(state)
    expect(resolveDelayedFitFrame(state, 0.6, 0.5)).toEqual({
      apply: false,
      zoom: null,
    })
    beginDelayedFitFollow(state)
    expect(resolveDelayedFitFrame(state, null, 0.5)).toEqual({
      apply: false,
      zoom: null,
    })
  })

  it('skips apply when following was cancelled mid-flight', () => {
    const state = createDelayedFitFollow()
    beginDelayedFitFollow(state)
    state.following = false
    expect(resolveDelayedFitFrame(state, 0.3, 0.5)).toEqual({
      apply: false,
      zoom: null,
    })
  })

  it('rejects delayed fit when next zoom equals committed within epsilon', () => {
    expect(shouldApplyDelayedFitZoom(true, 0.5, 0.5)).toBe(false)
    expect(shouldApplyDelayedFitZoom(true, 0.5 - 1e-10, 0.5)).toBe(false)
    expect(shouldApplyDelayedFitZoom(true, 0.5 - 1e-8, 0.5)).toBe(true)
  })

  it('scheduleDelayedFitDoubleRaf skips cancel when rafId is already 0', () => {
    const state = createDelayedFitFollow()
    beginDelayedFitFollow(state)
    const schedule = vi.fn((cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    const cancel = vi.fn()
    scheduleDelayedFitDoubleRaf(state, schedule, cancel, () => {
      /* no-op */
    })
    expect(cancel).not.toHaveBeenCalled()
  })
})

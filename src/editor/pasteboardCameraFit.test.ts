import { describe, expect, it, vi } from 'vitest'
import {
  FIT_VIEWPORT_INSET_PX,
  beginDelayedFitFollow,
  createDelayedFitFollow,
  fitViewportSize,
  resolveDelayedFitFrame,
  scheduleDelayedFitDoubleRaf,
  shouldApplyDelayedFitZoom,
  shouldHoldCameraScroll,
  stopDelayedFitFollow,
} from './pasteboardCameraFit'

describe('fitViewportSize', () => {
  it('subtracts the fit inset from both axes', () => {
    expect(fitViewportSize(500, 400)).toEqual({
      viewportWidth: 500 - FIT_VIEWPORT_INSET_PX,
      viewportHeight: 400 - FIT_VIEWPORT_INSET_PX,
    })
  })

  it('clamps each axis to at least 1px', () => {
    expect(fitViewportSize(10, 10, 24)).toEqual({
      viewportWidth: 1,
      viewportHeight: 1,
    })
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

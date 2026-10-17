import { describe, expect, it } from 'vitest'
import {
  FIT_VIEWPORT_INSET_PX,
  fitViewportSize,
  shouldApplyDelayedFitZoom,
  shouldHoldCameraScroll,
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
  })
})

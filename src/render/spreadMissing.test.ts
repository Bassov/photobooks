import { describe, expect, it, vi } from 'vitest'

import {
  frameShowsMissing,
  missingPlaceholderClass,
  missingPlaceholderTestId,
  previewUrlUnlessMissing,
  tierUnlessMissing,
} from './spreadMissing'

describe('spreadMissing', () => {
  it('frameShowsMissing requires asset id and true predicate', () => {
    expect(frameShowsMissing(undefined, () => true)).toBe(false)
    expect(frameShowsMissing('a', undefined)).toBe(false)
    expect(frameShowsMissing('a', () => false)).toBe(false)
    expect(frameShowsMissing('a', () => true)).toBe(true)
    const isMissing = vi.fn((id: string) => id === 'a')
    expect(frameShowsMissing('a', isMissing)).toBe(true)
    expect(isMissing).toHaveBeenCalledWith('a')
  })

  it('previewUrlUnlessMissing hides preview for missing or empty frames', () => {
    const preview = vi.fn(() => 'blob:x')
    expect(previewUrlUnlessMissing(true, 'a', preview)).toBeUndefined()
    expect(preview).not.toHaveBeenCalled()
    expect(previewUrlUnlessMissing(false, undefined, preview)).toBeUndefined()
    expect(previewUrlUnlessMissing(false, 'a', preview)).toBe('blob:x')
    expect(preview).toHaveBeenCalledWith('a')
  })

  it('tierUnlessMissing hides tier for missing or empty frames', () => {
    const tierFor = vi.fn(() => 2)
    expect(tierUnlessMissing(true, 'a', tierFor)).toBeUndefined()
    expect(tierFor).not.toHaveBeenCalled()
    expect(tierUnlessMissing(false, undefined, tierFor)).toBeUndefined()
    expect(tierUnlessMissing(false, 'a', undefined)).toBeUndefined()
    expect(tierUnlessMissing(false, 'a', tierFor)).toBe(2)
  })

  it('placeholder class and test id flip with missing', () => {
    expect(missingPlaceholderClass(true)).toBe(
      'spread-frame-placeholder spread-frame-missing',
    )
    expect(missingPlaceholderClass(false)).toBe('spread-frame-placeholder')
    expect(missingPlaceholderTestId(true)).toBe('spread-frame-missing')
    expect(missingPlaceholderTestId(false)).toBe('spread-frame-placeholder')
  })
})

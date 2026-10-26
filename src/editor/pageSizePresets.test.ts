import { describe, expect, it } from 'vitest'
import {
  clampCustomCm,
  cmToMm,
  fmtCm,
  presetLabel,
  resolvePageTrimMm,
  shouldSwapOrientation,
} from './pageSizePresets'

describe('pageSizePresets', () => {
  it('formats and clamps custom cm', () => {
    expect(fmtCm(14.85)).toBe('14.9')
    expect(clampCustomCm(9)).toBe(10)
    expect(clampCustomCm(50)).toBe(42)
    expect(clampCustomCm(18.24)).toBe(18.2)
  })

  it('converts cm to mm', () => {
    expect(cmToMm(14.8)).toBe(148)
    expect(cmToMm(21)).toBe(210)
  })

  it('labels presets with orientation', () => {
    const a5 = { name: 'A5', wCm: 14.8, hCm: 21 }
    expect(presetLabel(a5)).toBe('A5 · 14.8 × 21 cm')
    expect(presetLabel(a5, false)).toBe('A5 · 14.8 × 21 cm')
    expect(presetLabel(a5, true)).toBe('A5 · 21 × 14.8 cm')
    expect(presetLabel({ name: 'Square 20×20', wCm: 20, hCm: 20 }, true)).toBe(
      'Square 20×20 · 20 × 20 cm',
    )
    expect(presetLabel({ name: 'Square 20×20', wCm: 20, hCm: 20 }, false)).toBe(
      'Square 20×20 · 20 × 20 cm',
    )
  })

  it('resolves A5 portrait and landscape to trim mm', () => {
    expect(
      resolvePageTrimMm({
        presetId: 'A5',
        orientation: 'portrait',
        customWCm: 18,
        customHCm: 24,
      }),
    ).toEqual({ widthMm: 148, heightMm: 210 })
    expect(
      resolvePageTrimMm({
        presetId: 'A5',
        orientation: 'landscape',
        customWCm: 18,
        customHCm: 24,
      }),
    ).toEqual({ widthMm: 210, heightMm: 148 })
  })

  it('resolves custom and unknown preset fallback', () => {
    expect(
      resolvePageTrimMm({
        presetId: 'custom',
        orientation: 'portrait',
        customWCm: 18,
        customHCm: 24,
      }),
    ).toEqual({ widthMm: 180, heightMm: 240 })
    expect(
      resolvePageTrimMm({
        presetId: 'nope' as 'A5',
        orientation: 'portrait',
        customWCm: 18,
        customHCm: 24,
      }),
    ).toEqual({ widthMm: 148, heightMm: 210 })
  })

  it('ignores landscape for square presets', () => {
    expect(
      resolvePageTrimMm({
        presetId: 'sq20',
        orientation: 'landscape',
        customWCm: 18,
        customHCm: 24,
      }),
    ).toEqual({ widthMm: 200, heightMm: 200 })
  })

  it('shouldSwapOrientation requires landscape and non-square', () => {
    expect(shouldSwapOrientation(true, 14.8, 21)).toBe(true)
    expect(shouldSwapOrientation(false, 14.8, 21)).toBe(false)
    expect(shouldSwapOrientation(true, 20, 20)).toBe(false)
    expect(shouldSwapOrientation(false, 20, 20)).toBe(false)
  })
})

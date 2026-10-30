import { describe, expect, it } from 'vitest'
import {
  COVER_SPINE_MM,
  COVER_WRAP_MM,
  coverLayout,
  coverPanelPpi,
} from './coverLayout'

describe('cover wrap guide', () => {
  it('insets the wrap guide by 15 mm of the cover size', () => {
    const layout = coverLayout(300, 300)
    expect(COVER_WRAP_MM).toBe(15)
    expect(layout.wrapInsetYPct).toBeCloseTo(5, 9)
    expect(layout.wrapInsetXPct).toBeCloseTo((15 / 612) * 100, 9)
  })
})

describe('coverPanelPpi', () => {
  it('uses the tighter axis and divides by the crop zoom', () => {
    const photo = { widthPx: 2400, heightPx: 1800 }
    const panel = { widthMm: 300, heightMm: 300 }
    expect(coverPanelPpi(photo, panel, 1)).toBe(152)
    expect(coverPanelPpi(photo, panel, 2)).toBe(76)
    expect(coverPanelPpi({ widthPx: 1800, heightPx: 2400 }, panel, 1)).toBe(152)
  })
})

describe('coverLayout', () => {
  it('is two pages plus the display spine', () => {
    const layout = coverLayout(300, 300)
    expect(COVER_SPINE_MM).toBe(12)
    expect(layout.aspectRatio).toBe('612 / 300')
    expect(layout.fitWidth).toBe('min(100cqw, 100cqh * 2.04)')
    expect(layout.pagePct).toBeCloseTo(49.0196, 3)
    expect(layout.spinePct).toBeCloseTo(1.9608, 3)
    expect(2 * layout.pagePct + layout.spinePct).toBeCloseTo(100, 9)
  })

  it('follows a portrait page', () => {
    const layout = coverLayout(100, 200)
    expect(layout.aspectRatio).toBe('212 / 200')
    expect(layout.fitWidth).toBe('min(100cqw, 100cqh * 1.06)')
  })
})

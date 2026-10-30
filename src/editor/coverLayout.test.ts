import { describe, expect, it } from 'vitest'
import { COVER_SPINE_MM, coverLayout } from './coverLayout'

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

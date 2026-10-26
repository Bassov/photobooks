import { describe, expect, it } from 'vitest'
import {
  bookCoverStageHeight,
  bookFloorBackground,
  bookFormatFromTrim,
  bookObjectDisplayHeight,
  bookObjectLayout,
  bookObjectWidthForHeight,
} from './bookObjectLayout'

describe('bookObjectLayout', () => {
  it('sizes portrait from height and ratio', () => {
    const layout = bookObjectLayout(440, 'portrait')
    expect(layout.width).toBe(440 * (4 / 5))
    expect(layout.height).toBe(440)
    expect(layout.scale).toBe(440 / 540)
    expect(layout.pageBlock.top).toBe(6 * layout.scale + 2)
    expect(layout.pageBlock.bottom).toBe(6 * layout.scale + 2)
    expect(layout.pageBlock.left).toBe(10 * layout.scale)
    expect(layout.pageBlock.right).toBe(-Math.max(4, 7 * layout.scale))
    expect(layout.spineWidth).toBe(Math.max(8, 18 * layout.scale))
    expect(layout.titleSize).toBe(
      Math.round(Math.min(layout.width, 440) * 0.14),
    )
    expect(layout.subSize).toBe(Math.max(8, Math.round(440 * 0.022)))
    expect(layout.pageBlock.boxShadow).toBe(
      `0 ${String(40 * layout.scale)}px ${String(60 * layout.scale)}px -${String(36 * layout.scale)}px rgb(35 34 35/.55)`,
    )
    expect(layout.coverShadow).toBe(
      `0 1px 2px rgb(35 34 35/.25), 0 ${String(30 * layout.scale)}px ${String(60 * layout.scale)}px -${String(30 * layout.scale)}px rgb(35 34 35/.6)`,
    )
  })

  it.each([
    ['landscape', 5 / 4],
    ['square', 1],
  ] as const)('applies %s ratio', (fmt, ratio) => {
    const layout = bookObjectLayout(200, fmt)
    expect(layout.width).toBe(200 * ratio)
  })

  it.each([
    [200, 200, 'square'],
    [250, 200, 'landscape'],
    [148, 210, 'portrait'],
  ] as const)('maps trim %s×%s to %s', (w, h, fmt) => {
    expect(bookFormatFromTrim(w, h)).toBe(fmt)
  })

  it('scales display height and width by format', () => {
    expect(bookObjectDisplayHeight(236, 'portrait')).toBe(236)
    expect(bookObjectDisplayHeight(236, 'square')).toBe(236 * 0.86)
    expect(bookObjectDisplayHeight(236, 'landscape')).toBe(236 * 0.74)
    expect(bookObjectWidthForHeight(100, 'portrait')).toBe(80)
  })

  it('exposes cover stage height and floor gradient', () => {
    expect(bookCoverStageHeight(236)).toBe(248)
    expect(bookFloorBackground()).toMatch(/radial-gradient/)
  })
})

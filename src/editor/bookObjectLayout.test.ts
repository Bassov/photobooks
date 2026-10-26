import { describe, expect, it } from 'vitest'
import { bookObjectLayout } from './bookObjectLayout'

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
})

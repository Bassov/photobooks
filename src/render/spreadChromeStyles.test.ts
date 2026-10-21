import { describe, expect, it } from 'vitest'
import {
  spreadFrameControlStyle,
  spreadFrameSelectedStyle,
} from './spreadChromeStyles'

describe('spreadChromeStyles', () => {
  it('uses select token for pressed frames and leaves layout alone otherwise', () => {
    expect(spreadFrameSelectedStyle.outline).toContain('var(--select)')
    const layout = { left: 1, top: 2, width: 3, height: 4, zIndex: 5 }
    expect(spreadFrameControlStyle(layout, false)).toEqual(layout)
    expect(spreadFrameControlStyle(layout, true).outline).toContain(
      'var(--select)',
    )
    expect(spreadFrameControlStyle(layout, true).left).toBe(1)
  })
})

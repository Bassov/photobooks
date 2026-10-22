import { describe, expect, it } from 'vitest'
import {
  spreadFrameControlStyle,
  spreadFrameSelectedStyle,
} from './spreadChromeStyles'

describe('spreadChromeStyles', () => {
  it('leaves layout alone; pressed ring is CSS ::after not inline outline', () => {
    expect(spreadFrameSelectedStyle.outline).toBeUndefined()
    const layout = { left: 1, top: 2, width: 3, height: 4, zIndex: 5 }
    expect(spreadFrameControlStyle(layout, false)).toEqual(layout)
    expect(spreadFrameControlStyle(layout, true)).toEqual(layout)
    expect(spreadFrameControlStyle(layout, true).outline).toBeUndefined()
  })
})

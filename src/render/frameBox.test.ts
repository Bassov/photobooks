import { describe, expect, it } from 'vitest'
import {
  frameBox,
  imageCropBox,
  pageCutLine,
  SPREAD_PX_PER_MM,
} from './frameBox'

describe('frameBox', () => {
  it('scales a millimeter rect by the fixed pixels-per-millimeter', () => {
    expect(frameBox({ x: 10, y: 20, width: 30, height: 40 })).toEqual({
      left: 10 * SPREAD_PX_PER_MM,
      top: 20 * SPREAD_PX_PER_MM,
      width: 30 * SPREAD_PX_PER_MM,
      height: 40 * SPREAD_PX_PER_MM,
    })
  })

  it.each([
    ['vertical', 300, 150],
    ['horizontal', 20, 10],
  ] as const)(
    'places a %s page cut at offset times scale',
    (orientation, offsetMm, offsetPx) => {
      expect(pageCutLine({ orientation, offsetMm })).toEqual({
        orientation,
        offsetPx,
      })
    },
  )

  it('maps a source crop window onto percentages of the frame', () => {
    expect(imageCropBox({ x: 0.25, y: 0.1, width: 0.5, height: 0.5 })).toEqual({
      width: '200%',
      height: '200%',
      left: '-50%',
      top: '-20%',
    })
  })
})

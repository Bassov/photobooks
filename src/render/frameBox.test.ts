import { describe, expect, it } from 'vitest'
import {
  drawnWidthMm,
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

  const rect = { x: 0, y: 0, width: 100, height: 150 }

  it.each([
    ['unturned: frame width over the window width', 0, 0.5, 200],
    ['half turn: still the frame width', 2, 0.5, 200],
    ['quarter turn: frame height over the window width', 1, 0.5, 300],
    ['three quarter turns: frame height', 3, 0.25, 600],
    ['an empty window counts as the whole source', 0, 0, 100],
  ] as const)('draws the image %s', (_, turns, windowWidth, expected) => {
    const crop = { x: 0, y: 0, width: windowWidth, height: 1 }
    expect(drawnWidthMm(rect, crop, turns)).toBe(expected)
  })
})

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { COVER_CROP, shownCropRect, type Frame } from '../core'
import {
  cropWheelFactor,
  fitCoverZoom,
  panCrop,
  scaleCrop,
  zoomCrop,
  type PhotoCorner,
} from './cropMath'

const RECT = { x: 0, y: 0, width: 100, height: 100 }
const PX = { width: 200, height: 200 }

describe('panCrop', () => {
  it('cover on a square image cannot pan', () => {
    expect(panCrop(RECT, COVER_CROP, 1, PX, 50, 50)).toEqual(COVER_CROP)
  })

  it('dragging right reveals the left part of a zoomed photo', () => {
    const zoomed = { zoom: 2, center: { x: 0.5, y: 0.5 } }
    const next = panCrop(RECT, zoomed, 1, PX, 100, 0)
    // window width 0.5, 100 of 200 px => center moves left by 0.25
    expect(next.center.x).toBeCloseTo(0.25)
    expect(next.center.y).toBeCloseTo(0.5)
  })

  it('stops at the image edge', () => {
    const zoomed = { zoom: 2, center: { x: 0.5, y: 0.5 } }
    expect(panCrop(RECT, zoomed, 1, PX, 9999, -9999).center).toEqual({
      x: 0.25,
      y: 0.75,
    })
  })

  it('pans a wide photo in a square frame along x at zoom 1', () => {
    const next = panCrop(RECT, COVER_CROP, 2, PX, -100, 0)
    expect(next.center.x).toBeGreaterThan(0.5)
    expect(next.center.y).toBe(0.5)
  })
})

describe('zoomCrop', () => {
  it('never goes below cover', () => {
    expect(zoomCrop(RECT, COVER_CROP, 1, 0.1)).toEqual(COVER_CROP)
  })

  it('multiplies zoom and keeps the center in bounds', () => {
    const next = zoomCrop(RECT, { zoom: 1, center: { x: 0.5, y: 0.5 } }, 1, 2)
    expect(next).toEqual({ zoom: 2, center: { x: 0.5, y: 0.5 } })
  })
})

describe('cropWheelFactor', () => {
  it('zooms in on negative delta and out on positive', () => {
    expect(cropWheelFactor(-100)).toBeGreaterThan(1)
    expect(cropWheelFactor(100)).toBeLessThan(1)
    expect(cropWheelFactor(0)).toBe(1)
  })
})

describe('panCrop on a turned or straightened photo', () => {
  it('moves the center in the turned image, not the source', () => {
    const turned = { zoom: 2, center: { x: 0.5, y: 0.5 }, quarterTurns: 1 }
    const next = panCrop(RECT, turned, 1, PX, 100, 0)
    expect(next.center.x).toBeCloseTo(0.25)
    expect(next.quarterTurns).toBe(1)
  })

  it('follows the photo tilt: a screen drag is rotated into photo axes', () => {
    const tilted = {
      zoom: 3,
      center: { x: 0.5, y: 0.5 },
      straightenDeg: 90 as number,
    }
    // 90° is outside the product range but the math is exact: a screen drag
    // to the right moves the photo's own y axis.
    const next = panCrop(RECT, { ...tilted, straightenDeg: 45 }, 1, PX, 10, 0)
    expect(next.center.x).toBeLessThan(0.5)
    expect(next.center.y).toBeGreaterThan(0.5 - 1e-9)
    expect(next.straightenDeg).toBe(45)
  })
})

type Crop = NonNullable<Frame['crop']>

/** The photo's box in frame-local mm, as the painter lays it out. */
function photoBox(crop: Crop, aspect: number, fit?: Frame['fit']) {
  const window = shownCropRect(RECT, crop, aspect, fit)
  const width = RECT.width / window.width
  const height = RECT.height / window.height
  return { x: -window.x * width, y: -window.y * height, width, height }
}

describe('scaleCrop', () => {
  it('grows the photo about the opposite corner', () => {
    const next = scaleCrop(
      RECT,
      COVER_CROP,
      1,
      undefined,
      'se',
      { x: 150, y: 150 },
      false,
    )
    expect(next.fit).toBe('fill')
    expect(next.crop.zoom).toBeCloseTo(1.5)
    const box = photoBox(next.crop, 1)
    expect(box.x).toBeCloseTo(0)
    expect(box.y).toBeCloseTo(0)
    expect(box.width).toBeCloseTo(150)
  })

  it('grows about the centre with Alt', () => {
    const next = scaleCrop(
      RECT,
      COVER_CROP,
      1,
      'fill',
      'nw',
      { x: -25, y: -25 },
      true,
    )
    expect(next.crop.zoom).toBeCloseTo(1.5)
    expect(next.crop.center.x).toBeCloseTo(0.5)
    expect(next.crop.center.y).toBeCloseTo(0.5)
  })

  it('never goes below cover in Fill, even past the anchor', () => {
    for (const point of [
      { x: 50, y: 50 },
      { x: -50, y: -50 },
    ]) {
      expect(
        scaleCrop(RECT, COVER_CROP, 1, 'fill', 'se', point, false),
      ).toEqual({ fit: 'fill', crop: COVER_CROP })
    }
  })

  it('keeps a panned photo at cover still when a corner drags inward (M125)', () => {
    // A 2:1 photo covers the square frame 200 wide, panned to x −10.
    const crop = { zoom: 1, center: { x: 0.3, y: 0.5 } }
    expect(photoBox(crop, 2).x).toBeCloseTo(-10)
    for (const corner of ['se', 'nw', 'ne', 'sw'] as const) {
      const at = {
        x: corner.endsWith('e') ? 140 : 40,
        y: corner.startsWith('s') ? 60 : 40,
      }
      const next = scaleCrop(RECT, crop, 2, 'fill', corner, at, false)
      expect(next.fit).toBe('fill')
      expect(next.crop.zoom).toBe(1)
      expect(next.crop.center.x).toBeCloseTo(0.3, 9)
      expect(next.crop.center.y).toBeCloseTo(0.5, 9)
    }
  })

  it('stops at 8× with the anchor corner in place', () => {
    const crop = { zoom: 4, center: { x: 0.5, y: 0.5 } }
    const before = photoBox(crop, 1)
    const next = scaleCrop(
      RECT,
      crop,
      1,
      'fill',
      'se',
      { x: 2000, y: 2000 },
      false,
    )
    expect(next.crop.zoom).toBe(8)
    const after = photoBox(next.crop, 1)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    expect(after.width).toBeCloseTo(800)
  })

  it('stops at 8× when Fit grows into Fill', () => {
    // Fit cover ratio 2 for a 2:1 photo: Fit zoom 16 = Fill 8.
    const next = scaleCrop(
      RECT,
      COVER_CROP,
      2,
      'fit',
      'se',
      { x: 5000, y: 2500 },
      false,
    )
    expect(next.fit).toBe('fill')
    expect(next.crop.zoom).toBe(8)
    expect(photoBox(next.crop, 2).x).toBeCloseTo(0)
  })

  it('stays Fit exactly at cover', () => {
    const next = scaleCrop(
      RECT,
      COVER_CROP,
      2,
      'fit',
      'se',
      { x: 200, y: 125 },
      false,
    )
    expect(next.fit).toBe('fit')
    expect(next.crop.zoom).toBeCloseTo(2)
  })

  it('keeps Fit below cover and stops at fit', () => {
    // A 2:1 photo fits a square frame at 100 × 50, top 25.
    const grown = scaleCrop(
      RECT,
      COVER_CROP,
      2,
      'fit',
      'se',
      { x: 150, y: 100 },
      false,
    )
    expect(grown.fit).toBe('fit')
    expect(grown.crop.zoom).toBeCloseTo(1.5)
    const shrunk = scaleCrop(
      RECT,
      grown.crop,
      2,
      'fit',
      'se',
      { x: 10, y: 30 },
      false,
    )
    expect(shrunk).toEqual({ fit: 'fit', crop: { ...shrunk.crop, zoom: 1 } })
  })

  it('switches Fit to Fill past cover with the same photo size', () => {
    expect(fitCoverZoom(RECT, COVER_CROP, 2)).toBeCloseTo(2)
    const next = scaleCrop(
      RECT,
      COVER_CROP,
      2,
      'fit',
      'se',
      { x: 300, y: 175 },
      false,
    )
    expect(next.fit).toBe('fill')
    expect(next.crop.zoom).toBeCloseTo(1.5)
    expect(photoBox(next.crop, 2).width).toBeCloseTo(300)
    expect(photoBox(next.crop, 2).x).toBeCloseTo(0)
  })

  it('keeps the anchor corner on the page while the clamp is inactive', () => {
    const corners: PhotoCorner[] = ['nw', 'ne', 'sw', 'se']
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 2, noNaN: true }),
        fc.double({ min: 1, max: 4, noNaN: true }),
        fc.constantFrom(...corners),
        fc.double({ min: 1, max: 2, noNaN: true }),
        (aspect, zoom, corner, scale) => {
          const crop = { zoom, center: { x: 0.5, y: 0.5 } }
          const before = photoBox(crop, aspect)
          const cx = corner.endsWith('e') ? 1 : 0
          const cy = corner.startsWith('s') ? 1 : 0
          const anchor = {
            x: before.x + (1 - cx) * before.width,
            y: before.y + (1 - cy) * before.height,
          }
          const point = {
            x: anchor.x + (cx - (1 - cx)) * before.width * scale,
            y: anchor.y + (cy - (1 - cy)) * before.height * scale,
          }
          const next = scaleCrop(
            RECT,
            crop,
            aspect,
            'fill',
            corner,
            point,
            false,
          )
          const after = photoBox(next.crop, aspect)
          expect(after.width).toBeCloseTo(before.width * scale, 6)
          expect(after.x + (1 - cx) * after.width).toBeCloseTo(anchor.x, 6)
          expect(after.y + (1 - cy) * after.height).toBeCloseTo(anchor.y, 6)
        },
      ),
    )
  })
})

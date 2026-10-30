import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { clampCrop, shownCropRect, sourceCropRect } from '../index'

const RECT = { x: 0, y: 0, width: 100, height: 60 }
const CENTER = { x: 0.5, y: 0.5 }

/** Image-space corners (mm, image centered at 0,0) of the rotated frame. */
function rotatedCornersInside(
  rect: { width: number; height: number },
  window: { x: number; y: number; width: number; height: number },
  aspect: number,
  deg: number,
  eps = 1e-9,
): boolean {
  // mm per normalized unit: the frame spans window.width normalized columns.
  const mmPerX = rect.width / window.width
  const mmPerY = rect.height / window.height
  const cx = window.x + window.width / 2
  const cy = window.y + window.height / 2
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  expect(mmPerX / mmPerY).toBeCloseTo(aspect, 6)
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const px = (sx * rect.width) / 2
    const py = (sy * rect.height) / 2
    // Frame corner in photo space (the photo is turned by +deg on screen).
    const ix = px * cos + py * sin
    const iy = -px * sin + py * cos
    const u = cx + ix / mmPerX
    const v = cy + iy / mmPerY
    if (u < -eps || u > 1 + eps || v < -eps || v > 1 + eps) {
      return false
    }
  }
  return true
}

describe('shownCropRect with straighten', () => {
  it('is the plain cover window at 0°', () => {
    const plain = shownCropRect(RECT, { zoom: 1, center: CENTER }, 1.5)
    const zero = shownCropRect(
      RECT,
      { zoom: 1, center: CENTER, straightenDeg: 0 },
      1.5,
    )
    expect(zero).toEqual(plain)
  })

  it('shrinks the window as the angle grows (photo scales up)', () => {
    const at = (straightenDeg: number) =>
      shownCropRect(RECT, { zoom: 1, center: CENTER, straightenDeg }, 100 / 60)
    expect(at(10).width).toBeLessThan(at(0).width)
    expect(at(30).width).toBeLessThan(at(10).width)
  })

  it('is symmetric in the sign of the angle', () => {
    const crop = { zoom: 1.5, center: { x: 0.4, y: 0.6 } }
    expect(shownCropRect(RECT, { ...crop, straightenDeg: 7 }, 1.3)).toEqual(
      shownCropRect(RECT, { ...crop, straightenDeg: -7 }, 1.3),
    )
  })

  it('does not inflate in fit mode', () => {
    const crop = { zoom: 1, center: CENTER }
    expect(
      shownCropRect(RECT, { ...crop, straightenDeg: 20 }, 1.5, 'fit'),
    ).toEqual(shownCropRect(RECT, crop, 1.5, 'fit'))
  })

  test.prop(
    [
      fc.double({ min: -45, max: 45, noNaN: true }),
      fc.double({ min: 0.4, max: 3, noNaN: true }),
      fc.double({ min: 1, max: 4, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.integer({ min: 0, max: 3 }),
    ],
    { numRuns: 200, seed: 20261030 },
  )(
    'any clamped crop keeps the rotated frame inside the photo',
    (deg, aspect, zoom, cx, cy, quarterTurns) => {
      const clamped = clampCrop(
        RECT,
        { zoom, center: { x: cx, y: cy }, straightenDeg: deg, quarterTurns },
        aspect,
      )
      const shownAspect = quarterTurns % 2 === 1 ? 1 / aspect : aspect
      const window = shownCropRect(RECT, clamped, aspect)
      expect(rotatedCornersInside(RECT, window, shownAspect, deg, 1e-6)).toBe(
        true,
      )
    },
  )
})

describe('quarter turns', () => {
  it('maps the shown window back to source space', () => {
    const source = sourceCropRect(
      RECT,
      { zoom: 1, center: CENTER, quarterTurns: 1 },
      1.5,
    )
    const shown = shownCropRect(
      RECT,
      { zoom: 1, center: CENTER, quarterTurns: 1 },
      1.5,
    )
    expect(source.width).toBeCloseTo(shown.height)
    expect(source.height).toBeCloseTo(shown.width)
  })
})

describe('clampCrop keeps rotation', () => {
  it('carries quarterTurns and straightenDeg through', () => {
    const next = clampCrop(
      RECT,
      { zoom: 2, center: CENTER, quarterTurns: 3, straightenDeg: -4 },
      1.5,
    )
    expect(next.quarterTurns).toBe(3)
    expect(next.straightenDeg).toBe(-4)
  })
})

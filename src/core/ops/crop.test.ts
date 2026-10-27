import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  applyBookOp,
  clampCrop,
  MAX_CROP_ZOOM,
  resetCrop,
  setCrop,
  sourceCropRect,
} from '../index'
import { makeBookWithAsset } from '../testing/fixtures'

const RECT = { x: 0, y: 0, width: 100, height: 100 }

function cropOf(book: ReturnType<typeof makeBookWithAsset>) {
  return book.spreads[0]?.frames[0]?.crop
}

describe('setCrop / resetCrop', () => {
  it('sets crop on a filled frame', () => {
    const book = makeBookWithAsset()
    const next = setCrop(book, 'spread-1', 'frame-1', {
      zoom: 2,
      center: { x: 0.3, y: 0.6 },
    })
    expect(cropOf(next)).toEqual({ zoom: 2, center: { x: 0.3, y: 0.6 } })
  })

  it('clamps zoom to [1, max] and center to [0, 1]', () => {
    const book = makeBookWithAsset()
    const high = setCrop(book, 'spread-1', 'frame-1', {
      zoom: 99,
      center: { x: -1, y: 2 },
    })
    expect(cropOf(high)).toEqual({
      zoom: MAX_CROP_ZOOM,
      center: { x: 0, y: 1 },
    })
    const low = setCrop(book, 'spread-1', 'frame-1', {
      zoom: 0.2,
      center: { x: 0.5, y: 0.5 },
    })
    expect(cropOf(low)?.zoom).toBe(1)
  })

  it('ignores empty frames and unchanged crops', () => {
    const empty = makeBookWithAsset('a', { place: false })
    expect(
      setCrop(empty, 'spread-1', 'frame-1', {
        zoom: 2,
        center: { x: 0.5, y: 0.5 },
      }),
    ).toBe(empty)
    const book = makeBookWithAsset()
    expect(
      setCrop(book, 'spread-1', 'frame-1', {
        zoom: 1,
        center: { x: 0.5, y: 0.5 },
      }),
    ).toBe(book)
  })

  it('resetCrop restores cover and is routed by applyBookOp', () => {
    const zoomed = applyBookOp(makeBookWithAsset(), {
      type: 'setCrop',
      spreadId: 'spread-1',
      frameId: 'frame-1',
      crop: { zoom: 3, center: { x: 0.2, y: 0.2 } },
    })
    expect(cropOf(zoomed)?.zoom).toBe(3)
    const reset = applyBookOp(zoomed, {
      type: 'resetCrop',
      spreadId: 'spread-1',
      frameId: 'frame-1',
    })
    expect(cropOf(reset)).toEqual({ zoom: 1, center: { x: 0.5, y: 0.5 } })
    expect(resetCrop(reset, 'spread-1', 'frame-1')).toBe(reset)
  })
})

describe('clampCrop', () => {
  it('moves the center so the window stays inside the image', () => {
    const crop = clampCrop(RECT, { zoom: 2, center: { x: 0, y: 1 } }, 1)
    expect(crop).toEqual({ zoom: 2, center: { x: 0.25, y: 0.75 } })
  })

  it('never goes below cover', () => {
    expect(
      clampCrop(RECT, { zoom: 1, center: { x: 0.9, y: 0.1 } }, 1).center,
    ).toEqual({ x: 0.5, y: 0.5 })
  })

  test.prop([
    fc.double({ min: 0.5, max: 20, noNaN: true }),
    fc.double({ min: -1, max: 2, noNaN: true }),
    fc.double({ min: -1, max: 2, noNaN: true }),
    fc.double({ min: 0.3, max: 3, noNaN: true }),
  ])('window stays inside [0,1] and is stable', (zoom, x, y, aspect) => {
    const rect = { x: 0, y: 0, width: 80, height: 60 }
    const crop = clampCrop(rect, { zoom, center: { x, y } }, aspect)
    const window = sourceCropRect(rect, crop, aspect)
    expect(window.x).toBeGreaterThanOrEqual(-1e-9)
    expect(window.y).toBeGreaterThanOrEqual(-1e-9)
    expect(window.x + window.width).toBeLessThanOrEqual(1 + 1e-9)
    expect(window.y + window.height).toBeLessThanOrEqual(1 + 1e-9)
    const again = clampCrop(rect, crop, aspect)
    expect(again.center.x).toBeCloseTo(crop.center.x, 9)
    expect(again.center.y).toBeCloseTo(crop.center.y, 9)
  })
})

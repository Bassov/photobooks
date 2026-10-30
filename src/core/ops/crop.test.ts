import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  applyBookOp,
  clampCrop,
  MAX_CROP_ZOOM,
  resetCrop,
  setCrop,
  setFit,
  sourceCropRect,
} from '../index'
import {
  makeBook,
  makeBookWithAsset,
  makeFrame,
  makeSpread,
} from '../testing/fixtures'

const RECT = { x: 0, y: 0, width: 100, height: 100 }

function cropOf(book: ReturnType<typeof makeBookWithAsset>) {
  return book.spreads[0]?.frames[0]?.crop
}

describe('setFit', () => {
  const frameOf = (book: ReturnType<typeof makeBookWithAsset>) =>
    book.spreads[0]?.frames[0]

  it('sets fit and drops crop; fill removes the field', () => {
    const zoomed = setCrop(makeBookWithAsset(), 'spread-1', 'frame-1', {
      zoom: 2,
      center: { x: 0.3, y: 0.6 },
    })
    const fit = applyBookOp(zoomed, {
      type: 'setFit',
      spreadId: 'spread-1',
      frameId: 'frame-1',
      fit: 'fit',
    })
    expect(frameOf(fit)?.fit).toBe('fit')
    expect(frameOf(fit)?.crop).toBeUndefined()
    const fill = setFit(fit, 'spread-1', 'frame-1', 'fill')
    expect(frameOf(fill)).not.toHaveProperty('fit')
  })

  it('is a no-op when nothing changes or the frame is empty', () => {
    const book = makeBook({
      assets: { a: {} },
      gallery: ['a'],
      spreads: [
        makeSpread({ id: 's', frames: [makeFrame({ id: 'f', assetId: 'a' })] }),
      ],
    })
    expect(setFit(book, 's', 'f', 'fill')).toBe(book)
    const zoomed = setCrop(book, 's', 'f', {
      zoom: 2,
      center: { x: 0.5, y: 0.5 },
    })
    expect(zoomed.spreads[0]?.frames[0]?.crop?.zoom).toBe(2)
    const reset = setFit(zoomed, 's', 'f', 'fill')
    expect(reset.spreads[0]?.frames[0]?.crop).toBeUndefined()
    const empty = makeBook({
      spreads: [makeSpread({ id: 's', frames: [makeFrame({ id: 'f' })] })],
    })
    expect(setFit(empty, 's', 'f', 'fit')).toBe(empty)
  })
})

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

describe('photo rotation in crop ops', () => {
  const frameOf = (book: ReturnType<typeof makeBookWithAsset>) =>
    book.spreads[0]?.frames[0]

  it('setCrop stores quarter turns and angle, normalized; zero is absent', () => {
    const turned = setCrop(makeBookWithAsset(), 'spread-1', 'frame-1', {
      zoom: 1,
      center: { x: 0.5, y: 0.5 },
      quarterTurns: 5,
      straightenDeg: 99,
    })
    expect(frameOf(turned)?.crop).toEqual({
      zoom: 1,
      center: { x: 0.5, y: 0.5 },
      quarterTurns: 1,
      straightenDeg: 45,
    })
    const zero = setCrop(turned, 'spread-1', 'frame-1', {
      zoom: 1,
      center: { x: 0.5, y: 0.5 },
      quarterTurns: 0,
      straightenDeg: 0,
    })
    expect(frameOf(zero)?.crop).toEqual({ zoom: 1, center: { x: 0.5, y: 0.5 } })
  })

  it('a rotation-only change is a real change; the same crop is a no-op', () => {
    const base = setCrop(makeBookWithAsset(), 'spread-1', 'frame-1', {
      zoom: 1,
      center: { x: 0.5, y: 0.5 },
      straightenDeg: 3,
    })
    expect(
      setCrop(base, 'spread-1', 'frame-1', {
        zoom: 1,
        center: { x: 0.5, y: 0.5 },
        straightenDeg: 3,
      }),
    ).toBe(base)
    expect(
      setCrop(base, 'spread-1', 'frame-1', {
        zoom: 1,
        center: { x: 0.5, y: 0.5 },
        quarterTurns: 2,
        straightenDeg: 3,
      }),
    ).not.toBe(base)
  })

  it('resetCrop and setFit keep the rotation, reset zoom and pan', () => {
    const rotated = setCrop(makeBookWithAsset(), 'spread-1', 'frame-1', {
      zoom: 2,
      center: { x: 0.3, y: 0.6 },
      quarterTurns: 1,
      straightenDeg: -5,
    })
    expect(frameOf(resetCrop(rotated, 'spread-1', 'frame-1'))?.crop).toEqual({
      zoom: 1,
      center: { x: 0.5, y: 0.5 },
      quarterTurns: 1,
      straightenDeg: -5,
    })
    const fit = setFit(rotated, 'spread-1', 'frame-1', 'fit')
    expect(frameOf(fit)?.fit).toBe('fit')
    expect(frameOf(fit)?.crop).toEqual({
      zoom: 1,
      center: { x: 0.5, y: 0.5 },
      quarterTurns: 1,
      straightenDeg: -5,
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  percentStyle,
  thumbAspect,
  thumbColumns,
  thumbPaperBox,
  thumbSlots,
} from './layoutThumb'

const FULL = { left: 0, top: 0, width: 100, height: 100 }

// Owner 2026-11-02: the thumb box follows the trim, clamped to 2:3–2:1.
describe('thumbAspect', () => {
  it('is the trim aspect inside the clamp', () => {
    expect(thumbAspect(200, 200)).toBe(1)
    expect(thumbAspect(300, 200)).toBe(1.5)
    expect(thumbAspect(400, 200)).toBe(2)
    expect(thumbAspect(200, 300)).toBe(200 / 300)
  })

  it('clamps a tall page to 2:3 and a wide spread to 2:1', () => {
    expect(thumbAspect(150, 300)).toBe(2 / 3)
    expect(thumbAspect(400, 100)).toBe(2)
  })
})

describe('thumbColumns', () => {
  it('lays single pages narrower than 1.2:1 out in 3 columns', () => {
    expect(thumbColumns(200, 200)).toBe(3)
    expect(thumbColumns(150, 300)).toBe(3)
    expect(thumbColumns(239, 200)).toBe(3)
  })

  it('keeps 2 columns from 1.2:1 up (landscape pages, spreads)', () => {
    expect(thumbColumns(240, 200)).toBe(2)
    expect(thumbColumns(300, 200)).toBe(2)
    expect(thumbColumns(400, 200)).toBe(2)
  })
})

describe('thumbPaperBox (box in the clamped trim aspect)', () => {
  it('fills the box for a cover square, a landscape page and a 2:1 spread', () => {
    expect(thumbPaperBox(200, 200)).toEqual(FULL)
    expect(thumbPaperBox(300, 200)).toEqual(FULL)
    expect(thumbPaperBox(400, 200)).toEqual(FULL)
    expect(thumbPaperBox(200, 300)).toEqual(FULL)
  })

  it('letterboxes a spread wider than 2:1 top and bottom', () => {
    expect(thumbPaperBox(400, 100)).toEqual({
      left: 0,
      top: 25,
      width: 100,
      height: 50,
    })
  })

  it('pillarboxes a page taller than 2:3 left and right', () => {
    const box = thumbPaperBox(150, 300)
    expect(box.top).toBe(0)
    expect(box.height).toBe(100)
    expect(box.width).toBeCloseTo(75, 9)
    expect(box.left).toBeCloseTo(12.5, 9)
  })
})

describe('thumbSlots', () => {
  it('maps a slot inside the trim to paper percentages', () => {
    expect(
      thumbSlots(200, 100, [{ x: 20, y: 10, width: 100, height: 50 }]),
    ).toEqual([{ left: 10, top: 10, width: 50, height: 50 }])
  })

  it('clips a bleed slot to the paper edges (Full bleed)', () => {
    expect(
      thumbSlots(200, 100, [{ x: -3, y: -3, width: 206, height: 106 }]),
    ).toEqual([{ left: 0, top: 0, width: 100, height: 100 }])
  })

  it('clips only the overflowing sides', () => {
    expect(
      thumbSlots(200, 100, [{ x: 100, y: 50, width: 150, height: 80 }]),
    ).toEqual([{ left: 50, top: 50, width: 50, height: 50 }])
  })

  it('drops slots wholly outside the trim or with no area', () => {
    expect(
      thumbSlots(200, 100, [
        { x: 200, y: 0, width: 10, height: 10 },
        { x: 0, y: 100, width: 10, height: 10 },
        { x: -10, y: 0, width: 10, height: 10 },
        { x: 0, y: -10, width: 10, height: 10 },
        { x: 10, y: 10, width: 0, height: 10 },
      ]),
    ).toEqual([])
  })
})

describe('percentStyle', () => {
  it('formats a box as CSS percentages', () => {
    expect(percentStyle({ left: 1.5, top: 0, width: 50, height: 100 })).toEqual(
      { left: '1.5%', top: '0%', width: '50%', height: '100%' },
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  pointerAngleDeg,
  resizeRectByHandle,
  rotatedDeg,
} from './frameHandleMath'

const RECT = { x: 100, y: 100, width: 40, height: 20 }
const FREE = { keepRatio: false, fromCenter: false }

describe('resizeRectByHandle', () => {
  it('moves the east edge and keeps the west edge', () => {
    expect(resizeRectByHandle(RECT, 0, 'e', 10, 99, FREE)).toEqual({
      x: 100,
      y: 100,
      width: 50,
      height: 20,
    })
  })

  it('moves the north-west corner and keeps the south-east one', () => {
    expect(resizeRectByHandle(RECT, 0, 'nw', -10, -5, FREE)).toEqual({
      x: 90,
      y: 95,
      width: 50,
      height: 25,
    })
  })

  it('stops at the 5 mm minimum on both edges', () => {
    const out = resizeRectByHandle(RECT, 0, 'se', -200, -200, FREE)
    expect(out).toEqual({ x: 100, y: 100, width: 5, height: 5 })
  })

  it('grows from the centre with Alt', () => {
    const out = resizeRectByHandle(RECT, 0, 'e', 10, 0, {
      ...FREE,
      fromCenter: true,
    })
    expect(out).toEqual({ x: 90, y: 100, width: 60, height: 20 })
  })

  it('keeps proportions with Shift and never goes below the minimum', () => {
    const grown = resizeRectByHandle(RECT, 0, 'se', 40, 0, {
      ...FREE,
      keepRatio: true,
    })
    expect(grown.width / grown.height).toBeCloseTo(2)
    const shrunk = resizeRectByHandle(RECT, 0, 'se', -500, -500, {
      ...FREE,
      keepRatio: true,
    })
    expect(Math.min(shrunk.width, shrunk.height)).toBeCloseTo(5)
    expect(shrunk.width / shrunk.height).toBeCloseTo(2)
  })

  it('resizes along the frame axes when rotated and pins the far edge', () => {
    // 90° clockwise: local +x points down the spread.
    const out = resizeRectByHandle(RECT, 90, 'e', 0, 10, FREE)
    expect(out.width).toBeCloseTo(50)
    // Centre moved 5 mm down: the west edge (local) stays put.
    expect(out.x + out.width / 2).toBeCloseTo(120)
    expect(out.y + out.height / 2).toBeCloseTo(115)
  })
})

describe('rotation helpers', () => {
  it('measures the angle clockwise from +x', () => {
    expect(pointerAngleDeg(0, 0, 1, 0)).toBe(0)
    expect(pointerAngleDeg(0, 0, 0, 1)).toBe(90)
  })

  it('adds the pointer sweep and snaps to 15° with Shift', () => {
    expect(rotatedDeg(10, 0, 20, false)).toBe(30)
    expect(rotatedDeg(10, 0, 20, true)).toBe(30)
    expect(rotatedDeg(0, 0, 21, true)).toBe(15)
    expect(rotatedDeg(0, 0, 23, true)).toBe(30)
  })
})

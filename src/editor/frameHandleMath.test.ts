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

describe('resizeRectByHandle per handle', () => {
  it.each([
    ['w', -10, 0, { x: 90, y: 100, width: 50, height: 20 }],
    ['n', 0, -10, { x: 100, y: 90, width: 40, height: 30 }],
    ['s', 0, 10, { x: 100, y: 100, width: 40, height: 30 }],
    ['ne', 10, -5, { x: 100, y: 95, width: 50, height: 25 }],
    ['sw', -10, 5, { x: 90, y: 100, width: 50, height: 25 }],
    ['se', 10, 5, { x: 100, y: 100, width: 50, height: 25 }],
  ] as const)('%s handle', (handle, dx, dy, expected) => {
    expect(resizeRectByHandle(RECT, 0, handle, dx, dy, FREE)).toEqual(expected)
  })

  it('ignores the off-axis travel of an edge handle', () => {
    expect(resizeRectByHandle(RECT, 0, 'n', 30, -10, FREE)).toEqual({
      x: 100,
      y: 90,
      width: 40,
      height: 30,
    })
    expect(resizeRectByHandle(RECT, 0, 'w', -10, 30, FREE)).toEqual({
      x: 90,
      y: 100,
      width: 50,
      height: 20,
    })
  })

  it('clamps each axis to the minimum on its own', () => {
    expect(resizeRectByHandle(RECT, 0, 'e', -100, 0, FREE)).toEqual({
      x: 100,
      y: 100,
      width: 5,
      height: 20,
    })
    expect(resizeRectByHandle(RECT, 0, 'n', 0, 100, FREE)).toEqual({
      x: 100,
      y: 115,
      width: 40,
      height: 5,
    })
  })

  it('lets an edge handle drive both sides with Shift', () => {
    expect(
      resizeRectByHandle(RECT, 0, 'e', 20, 0, { ...FREE, keepRatio: true }),
    ).toEqual({ x: 100, y: 95, width: 60, height: 30 })
    expect(
      resizeRectByHandle(RECT, 0, 'n', 0, -10, { ...FREE, keepRatio: true }),
    ).toEqual({ x: 90, y: 90, width: 60, height: 30 })
  })

  it('follows the larger edge of a corner with Shift', () => {
    expect(
      resizeRectByHandle(RECT, 0, 'se', 0, 20, { ...FREE, keepRatio: true }),
    ).toEqual({ x: 100, y: 100, width: 80, height: 40 })
  })

  it('combines Alt and Shift around the centre', () => {
    expect(
      resizeRectByHandle(RECT, 0, 'se', 20, 0, {
        keepRatio: true,
        fromCenter: true,
      }),
    ).toEqual({ x: 80, y: 90, width: 80, height: 40 })
  })

  it('resizes a half-turned frame from the other side', () => {
    const out = resizeRectByHandle(RECT, 180, 'e', 10, 0, FREE)
    expect(out.x).toBeCloseTo(110)
    expect(out.y).toBeCloseTo(100)
    expect(out.width).toBeCloseTo(30)
    expect(out.height).toBeCloseTo(20)
  })

  it('moves the local south edge of a quarter-turned frame', () => {
    const out = resizeRectByHandle(RECT, 90, 's', -10, 0, FREE)
    expect(out.x).toBeCloseTo(95)
    expect(out.y).toBeCloseTo(95)
    expect(out.width).toBeCloseTo(40)
    expect(out.height).toBeCloseTo(30)
  })
})

describe('rotation helpers', () => {
  it('measures the angle clockwise from +x', () => {
    expect(pointerAngleDeg(0, 0, 1, 0)).toBe(0)
    expect(pointerAngleDeg(0, 0, 0, 1)).toBe(90)
    expect(pointerAngleDeg(0, 0, -1, 0)).toBe(180)
    expect(pointerAngleDeg(0, 0, 1, 1)).toBeCloseTo(45)
  })

  it('measures from the given centre', () => {
    expect(pointerAngleDeg(10, 20, 10, 30)).toBe(90)
    expect(pointerAngleDeg(10, 20, 20, 20)).toBe(0)
  })

  it('offsets by both start angles and snaps half-steps up', () => {
    expect(rotatedDeg(10, 5, 25, false)).toBe(30)
    expect(rotatedDeg(0, 0, 7.5, true)).toBe(15)
    expect(rotatedDeg(0, 0, 7.4, true)).toBe(0)
    expect(rotatedDeg(0, 0, -23, true)).toBe(-30)
  })

  it('adds the pointer sweep and snaps to 15° with Shift', () => {
    expect(rotatedDeg(10, 0, 20, false)).toBe(30)
    expect(rotatedDeg(10, 0, 20, true)).toBe(30)
    expect(rotatedDeg(0, 0, 21, true)).toBe(15)
    expect(rotatedDeg(0, 0, 23, true)).toBe(30)
  })
})

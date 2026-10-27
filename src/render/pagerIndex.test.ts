import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { halfDelta, stepIndex, swipeDelta } from './pagerIndex'

describe('stepIndex', () => {
  it('does nothing past the last spread', () => {
    expect(stepIndex(2, 1, 3)).toBe(2)
  })

  it('does nothing before the first spread', () => {
    expect(stepIndex(0, -1, 3)).toBe(0)
  })

  it('returns 0 for an empty book', () => {
    expect(stepIndex(0, 1, 0)).toBe(0)
  })
})

test.prop([
  fc.integer({ min: 0, max: 99 }),
  fc.integer({ min: -3, max: 3 }),
  fc.integer({ min: 1, max: 100 }),
])('stepIndex stays in range', (index, delta, count) => {
  const next = stepIndex(Math.min(index, count - 1), delta, count)
  expect(next).toBeGreaterThanOrEqual(0)
  expect(next).toBeLessThanOrEqual(count - 1)
})

describe('halfDelta', () => {
  it('maps halves to directions', () => {
    expect(halfDelta(75, 0, 100)).toBe(1)
    expect(halfDelta(25, 0, 100)).toBe(-1)
    expect(halfDelta(150, 100, 100)).toBe(-1)
  })
})

describe('swipeDelta', () => {
  it('ignores short moves', () => {
    expect(swipeDelta(100, 60)).toBe(0)
    expect(swipeDelta(100, 140)).toBe(0)
    expect(swipeDelta(100, 160)).toBe(0)
    expect(swipeDelta(100, 40)).toBe(0)
  })

  it('swipe left is forward, right is back', () => {
    expect(swipeDelta(200, 100)).toBe(1)
    expect(swipeDelta(100, 200)).toBe(-1)
  })
})

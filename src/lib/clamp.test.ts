import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { clamp } from './clamp'

describe('clamp', () => {
  it('returns value when inside range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to min', () => {
    expect(clamp(-1, 0, 10)).toBe(0)
  })

  it('clamps to max', () => {
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it('allows min equal to max', () => {
    expect(clamp(3, 5, 5)).toBe(5)
  })

  it('throws when min > max', () => {
    expect(() => clamp(1, 5, 2)).toThrow(new RangeError('min must be <= max'))
  })
})

test.prop(
  [
    fc.double({ noNaN: true }),
    fc.double({ noNaN: true }),
    fc.double({ noNaN: true }),
  ],
  { numRuns: Number(process.env.FC_NUM_RUNS ?? 100) },
)('result is always within [min, max] when min <= max', (value, a, b) => {
  const min = Math.min(a, b)
  const max = Math.max(a, b)
  const result = clamp(value, min, max)
  expect(result).toBeGreaterThanOrEqual(min)
  expect(result).toBeLessThanOrEqual(max)
})

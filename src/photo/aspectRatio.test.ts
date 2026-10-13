import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { aspectRatio } from './aspectRatio'

describe('aspectRatio', () => {
  it('reduces 6000x4000 to 3:2', () => {
    expect(aspectRatio(6000, 4000)).toBe('3:2')
  })

  it('reduces 1920x1080 to 16:9', () => {
    expect(aspectRatio(1920, 1080)).toBe('16:9')
  })

  it('keeps primes', () => {
    expect(aspectRatio(7, 5)).toBe('7:5')
  })

  it('throws on non-positive, non-finite, and zero', () => {
    expect(() => aspectRatio(-1, 10)).toThrow(
      new RangeError('width and height must be positive finite numbers'),
    )
    expect(() => aspectRatio(10, 0)).toThrow(RangeError)
    expect(() => aspectRatio(0, 10)).toThrow(RangeError)
    expect(() => aspectRatio(Number.POSITIVE_INFINITY, 10)).toThrow(RangeError)
    expect(() => aspectRatio(10, Number.NaN)).toThrow(RangeError)
  })
})

test.prop(
  [
    fc.integer({ min: 1, max: 2000 }),
    fc.integer({ min: 1, max: 2000 }),
    fc.integer({ min: 1, max: 20 }),
  ],
  { numRuns: Number(process.env.FC_NUM_RUNS ?? 100) },
)('label is scale-invariant and positive', (w, h, scale) => {
  const base = aspectRatio(w, h)
  const scaled = aspectRatio(w * scale, h * scale)
  expect(scaled).toBe(base)
  const [a, b] = base.split(':').map(Number)
  expect(a).toBeGreaterThan(0)
  expect(b).toBeGreaterThan(0)
})

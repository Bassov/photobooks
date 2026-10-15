import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { IMAGE_TIERS, selectImageTier } from './imageTiers'

describe('selectImageTier', () => {
  it('picks 640 when the covered size is just above 320', () => {
    expect(selectImageTier(321, 1)).toBe(640)
  })

  it('picks 320 when the covered size is exactly 320', () => {
    expect(selectImageTier(320, 1)).toBe(320)
  })

  it('picks 2560 when nothing on the ladder covers', () => {
    expect(selectImageTier(3000, 1)).toBe(2560)
  })

  it('treats a non-positive dpr as 1', () => {
    expect(selectImageTier(100, 0)).toBe(320)
    expect(selectImageTier(100, Number.NaN)).toBe(320)
  })

  it('treats a non-positive edge as the smallest tier', () => {
    expect(selectImageTier(-10, 2)).toBe(320)
    expect(selectImageTier(Number.POSITIVE_INFINITY, 1)).toBe(320)
  })
})

test.prop(
  [
    fc.double({ min: 0, max: 8000, noNaN: true }),
    fc.double({ min: 0.5, max: 4, noNaN: true }),
  ],
  { numRuns: 100 },
)('selectImageTier is the smallest covering step', (edge, dpr) => {
  const tier = selectImageTier(edge, dpr)
  const need = edge * dpr
  const covers = IMAGE_TIERS.filter((candidate) => candidate >= need)
  const expected = covers[0] ?? 2560

  expect(tier).toBe(expected)
})

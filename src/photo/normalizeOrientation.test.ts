import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { normalizeOrientation } from './normalizeOrientation'
import type { ExifOrientation } from './types'

const ORIENTATIONS: ExifOrientation[] = [1, 2, 3, 4, 5, 6, 7, 8]

describe('normalizeOrientation', () => {
  it.each([
    [
      1,
      6000,
      4000,
      {
        rotation: 0,
        flipX: false,
        flipY: false,
        correctedW: 6000,
        correctedH: 4000,
      },
    ],
    [
      2,
      6000,
      4000,
      {
        rotation: 0,
        flipX: true,
        flipY: false,
        correctedW: 6000,
        correctedH: 4000,
      },
    ],
    [
      3,
      6000,
      4000,
      {
        rotation: 180,
        flipX: false,
        flipY: false,
        correctedW: 6000,
        correctedH: 4000,
      },
    ],
    [
      4,
      6000,
      4000,
      {
        rotation: 0,
        flipX: false,
        flipY: true,
        correctedW: 6000,
        correctedH: 4000,
      },
    ],
    [
      5,
      6000,
      4000,
      {
        rotation: 90,
        flipX: true,
        flipY: false,
        correctedW: 4000,
        correctedH: 6000,
      },
    ],
    [
      6,
      6000,
      4000,
      {
        rotation: 90,
        flipX: false,
        flipY: false,
        correctedW: 4000,
        correctedH: 6000,
      },
    ],
    [
      7,
      6000,
      4000,
      {
        rotation: 270,
        flipX: true,
        flipY: false,
        correctedW: 4000,
        correctedH: 6000,
      },
    ],
    [
      8,
      6000,
      4000,
      {
        rotation: 270,
        flipX: false,
        flipY: false,
        correctedW: 4000,
        correctedH: 6000,
      },
    ],
  ] as const)('maps orientation %i', (orientation, w, h, expected) => {
    expect(normalizeOrientation(orientation, w, h)).toEqual(expected)
  })

  it('throws on non-positive or non-finite dimensions', () => {
    expect(() => normalizeOrientation(1, 0, 10)).toThrow(
      new RangeError('width and height must be positive finite numbers'),
    )
    expect(() => normalizeOrientation(1, 10, 0)).toThrow(RangeError)
    expect(() => normalizeOrientation(1, Number.POSITIVE_INFINITY, 10)).toThrow(
      RangeError,
    )
    expect(() => normalizeOrientation(1, 10, Number.NaN)).toThrow(RangeError)
  })
})

test.prop(
  [
    fc.constantFrom(...ORIENTATIONS),
    fc.integer({ min: 1, max: 10_000 }),
    fc.integer({ min: 1, max: 10_000 }),
  ],
  { numRuns: Number(process.env.FC_NUM_RUNS ?? 100) },
)(
  'corrected size matches orientation swap rule',
  (orientation, width, height) => {
    const result = normalizeOrientation(orientation, width, height)
    if (orientation >= 5) {
      expect(result.correctedW).toBe(height)
      expect(result.correctedH).toBe(width)
    } else {
      expect(result.correctedW).toBe(width)
      expect(result.correctedH).toBe(height)
    }
  },
)

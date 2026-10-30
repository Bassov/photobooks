import { describe, expect, it } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import { guideDropOutcome, guideInRange, guideOffsetMm } from './guidesMath'

describe('guideOffsetMm', () => {
  it('converts a client coordinate to 0.1 mm steps from the spread origin', () => {
    expect(guideOffsetMm(150, 100, 2)).toBe(25)
    expect(guideOffsetMm(100.3, 100, 3)).toBe(0.1)
    expect(guideOffsetMm(50, 100, 2)).toBe(-25)
  })

  test.prop([
    fc.double({ min: -2000, max: 2000, noNaN: true }),
    fc.double({ min: -500, max: 500, noNaN: true }),
    fc.double({ min: 0.5, max: 20, noNaN: true }),
  ])('is within 0.05 mm of the exact value', (px, origin, scale) => {
    const exact = (px - origin) / scale
    expect(Math.abs(guideOffsetMm(px, origin, scale) - exact)).toBeLessThan(
      0.0500001,
    )
  })
})

describe('guideInRange', () => {
  it('allows a 20 mm margin around the spread, exclusive', () => {
    expect(guideInRange(-19.9, 300)).toBe(true)
    expect(guideInRange(-20, 300)).toBe(false)
    expect(guideInRange(319.9, 300)).toBe(true)
    expect(guideInRange(320, 300)).toBe(false)
  })
})

describe('guideDropOutcome', () => {
  const base = { offsetMm: 100, extentMm: 300 }
  it('commits a guide dropped on the spread', () => {
    expect(
      guideDropOutcome({ ...base, overRuler: false, existing: false }),
    ).toBe('commit')
    expect(
      guideDropOutcome({ ...base, overRuler: false, existing: true }),
    ).toBe('commit')
  })

  it('removes a placed guide dropped on its ruler or off the spread', () => {
    expect(guideDropOutcome({ ...base, overRuler: true, existing: true })).toBe(
      'remove',
    )
    expect(
      guideDropOutcome({
        offsetMm: 400,
        extentMm: 300,
        overRuler: false,
        existing: true,
      }),
    ).toBe('remove')
  })

  it('abandons a new guide dropped on the ruler or off the spread', () => {
    expect(
      guideDropOutcome({ ...base, overRuler: true, existing: false }),
    ).toBe('cancel')
    expect(
      guideDropOutcome({
        offsetMm: -30,
        extentMm: 300,
        overRuler: false,
        existing: false,
      }),
    ).toBe('cancel')
  })
})

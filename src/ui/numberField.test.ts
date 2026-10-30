import { describe, expect, it } from 'vitest'
import {
  clampNumber,
  decimalsOf,
  formatNumber,
  parseNumberText,
  stepNumber,
} from './numberField'

describe('numberField helpers', () => {
  it('clamps to the range', () => {
    expect(clampNumber(-1, 0, 20)).toBe(0)
    expect(clampNumber(25, 0, 20)).toBe(20)
    expect(clampNumber(7, 0, 20)).toBe(7)
  })

  it('parses plain, comma and padded numbers; rejects junk', () => {
    expect(parseNumberText(' 12.5 ')).toBe(12.5)
    expect(parseNumberText('12,5')).toBe(12.5)
    expect(parseNumberText('-3')).toBe(-3)
    expect(parseNumberText('.5')).toBe(0.5)
    expect(parseNumberText('')).toBeNull()
    expect(parseNumberText('1e3')).toBeNull()
    expect(parseNumberText('abc')).toBeNull()
  })

  it('counts decimals and formats', () => {
    expect(decimalsOf(1)).toBe(0)
    expect(decimalsOf(0.25)).toBe(2)
    expect(formatNumber(5, 1)).toBe('5.0')
  })

  it('handles non-finite input, long fractions and multi-digit fractions', () => {
    expect(decimalsOf(Infinity)).toBe(0)
    expect(decimalsOf(NaN)).toBe(0)
    expect(decimalsOf(1.123456789)).toBe(6)
    expect(parseNumberText('.55')).toBe(0.55)
    expect(parseNumberText('+.25')).toBe(0.25)
    expect(parseNumberText('.')).toBeNull()
    expect(parseNumberText('1.5.2')).toBeNull()
  })

  it('steps without float drift and clamps at the ends', () => {
    const base = { min: 0, max: 1, step: 0.1, shiftStep: 0.5 } as const
    expect(
      stepNumber({ ...base, value: 0.2, direction: 1, shift: false }),
    ).toBe(0.3)
    expect(stepNumber({ ...base, value: 0.7, direction: 1, shift: true })).toBe(
      1,
    )
    expect(
      stepNumber({ ...base, value: 0.2, direction: -1, shift: true }),
    ).toBe(0)
  })
})

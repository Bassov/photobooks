import { describe, expect, it } from 'vitest'
import { progressFillTransform } from './progressFill'

describe('progressFillTransform', () => {
  it('maps percentage to a leftward translate', () => {
    expect(progressFillTransform(0)).toBe('translateX(-100%)')
    expect(progressFillTransform(40)).toBe('translateX(-60%)')
    expect(progressFillTransform(100)).toBe('translateX(-0%)')
  })

  it('treats undefined percentage as 0', () => {
    expect(progressFillTransform(undefined)).toBe('translateX(-100%)')
  })
})

import { describe, expect, it } from 'vitest'
import { acceptPositiveCm, createBookFormDefaults } from './createBookForm'

describe('createBookForm', () => {
  it('acceptPositiveCm keeps current for non-positive', () => {
    expect(acceptPositiveCm('18', 10)).toBe(18)
    expect(acceptPositiveCm('0', 10)).toBe(10)
    expect(acceptPositiveCm('-1', 10)).toBe(10)
    expect(acceptPositiveCm('abc', 10)).toBe(10)
    expect(acceptPositiveCm('', 10)).toBe(10)
  })

  it('defaults match kit A5 create form', () => {
    expect(createBookFormDefaults()).toEqual({
      title: '',
      presetId: 'A5',
      orientation: 'portrait',
      customWCm: 18,
      customHCm: 24,
    })
  })
})

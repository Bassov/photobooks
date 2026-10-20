import { describe, expect, it } from 'vitest'
import { isSpecimenQuery } from './specimenQuery'

describe('isSpecimenQuery', () => {
  it('is true when specimen is present', () => {
    expect(isSpecimenQuery('?specimen')).toBe(true)
    expect(isSpecimenQuery('?specimen=1&x=2')).toBe(true)
  })

  it('is false otherwise', () => {
    expect(isSpecimenQuery('')).toBe(false)
    expect(isSpecimenQuery('?fixture=painter')).toBe(false)
  })
})

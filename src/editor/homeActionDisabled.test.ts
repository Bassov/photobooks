import { describe, expect, it } from 'vitest'
import { homeActionDisabled } from './homeActionDisabled'

describe('homeActionDisabled', () => {
  it('disables when not interactive and enables when interactive', () => {
    expect(homeActionDisabled(false)).toBe(true)
    expect(homeActionDisabled(true)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { alertConfirmVariant } from './alertConfirm'

describe('alertConfirmVariant', () => {
  it('maps tone to Button variant', () => {
    expect(alertConfirmVariant('destructive')).toBe('destructive')
    expect(alertConfirmVariant('neutral')).toBe('default')
  })
})

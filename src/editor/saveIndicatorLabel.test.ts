import { describe, expect, it } from 'vitest'
import { saveIndicatorLabel } from './saveIndicatorLabel'

describe('saveIndicatorLabel', () => {
  it('maps each save phase and dirty flag', () => {
    expect(saveIndicatorLabel('saving', false)).toBe('Saving…')
    expect(saveIndicatorLabel('error', false)).toBe('Save failed')
    expect(saveIndicatorLabel('pending', false)).toBe('Unsaved')
    expect(saveIndicatorLabel('idle', true)).toBe('Unsaved')
    expect(saveIndicatorLabel('idle', false)).toBe('Saved')
  })
})

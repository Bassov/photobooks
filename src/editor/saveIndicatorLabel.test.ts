import { describe, expect, it } from 'vitest'
import {
  saveIndicatorBadgeColor,
  saveIndicatorLabel,
} from './saveIndicatorLabel'

describe('saveIndicatorLabel', () => {
  it('maps each save phase and dirty flag', () => {
    expect(saveIndicatorLabel('saving', false)).toBe('Saving…')
    expect(saveIndicatorLabel('error', false)).toBe('Save failed')
    expect(saveIndicatorLabel('pending', false)).toBe('Unsaved')
    expect(saveIndicatorLabel('idle', true)).toBe('Unsaved')
    expect(saveIndicatorLabel('idle', false)).toBe('Saved')
  })

  it('maps badge colors to status roles', () => {
    expect(saveIndicatorBadgeColor('error', false)).toBe('error')
    expect(saveIndicatorBadgeColor('saving', false)).toBe('warning')
    expect(saveIndicatorBadgeColor('pending', false)).toBe('warning')
    expect(saveIndicatorBadgeColor('idle', true)).toBe('warning')
    expect(saveIndicatorBadgeColor('idle', false)).toBe('success')
  })
})

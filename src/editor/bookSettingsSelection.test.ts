import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isBookSettingsSelected,
  setBookSettingsSelected,
  subscribeBookSettingsSelection,
} from './bookSettingsSelection'
import { setCoverSelected } from './coverSelection'

describe('bookSettingsSelection', () => {
  afterEach(() => {
    setBookSettingsSelected(false)
  })

  it('starts closed', () => {
    expect(isBookSettingsSelected()).toBe(false)
  })

  it('notifies once per change and stops after unsubscribe', () => {
    const listener = vi.fn()
    const off = subscribeBookSettingsSelection(listener)
    setBookSettingsSelected(true)
    setBookSettingsSelected(true)
    expect(isBookSettingsSelected()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    setBookSettingsSelected(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('is left when another item (cover, spread, frame) is picked', () => {
    setBookSettingsSelected(true)
    setCoverSelected(false)
    expect(isBookSettingsSelected()).toBe(false)
  })
})

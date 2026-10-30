import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getGuidesVisible,
  setGuidesVisible,
  subscribeGuidesVisible,
  toggleGuidesVisible,
} from './guidesView'

describe('guidesView', () => {
  afterEach(() => {
    setGuidesVisible(true)
  })

  it('is on by default and toggles', () => {
    expect(getGuidesVisible()).toBe(true)
    toggleGuidesVisible()
    expect(getGuidesVisible()).toBe(false)
  })

  it('notifies subscribers only on change and stops after unsubscribe', () => {
    const listener = vi.fn()
    const off = subscribeGuidesVisible(listener)
    setGuidesVisible(true)
    expect(listener).not.toHaveBeenCalled()
    setGuidesVisible(false)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    setGuidesVisible(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

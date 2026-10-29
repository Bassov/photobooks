import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRulersVisible,
  setRulersVisible,
  subscribeRulersVisible,
  toggleRulersVisible,
} from './rulersView'

describe('rulersView', () => {
  afterEach(() => {
    setRulersVisible(false)
  })

  it('is off by default and toggles', () => {
    expect(getRulersVisible()).toBe(false)
    toggleRulersVisible()
    expect(getRulersVisible()).toBe(true)
  })

  it('notifies subscribers only on change and stops after unsubscribe', () => {
    const listener = vi.fn()
    const off = subscribeRulersVisible(listener)
    setRulersVisible(false)
    expect(listener).not.toHaveBeenCalled()
    setRulersVisible(true)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    setRulersVisible(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getDpiView,
  setDpiView,
  subscribeDpiView,
  toggleDpiView,
} from './dpiView'

describe('dpiView', () => {
  afterEach(() => {
    setDpiView(false)
  })

  it('is off by default and toggles', () => {
    expect(getDpiView()).toBe(false)
    toggleDpiView()
    expect(getDpiView()).toBe(true)
    toggleDpiView()
    expect(getDpiView()).toBe(false)
  })

  it('notifies subscribers only on change and stops after unsubscribe', () => {
    const listener = vi.fn()
    const off = subscribeDpiView(listener)
    setDpiView(false)
    expect(listener).not.toHaveBeenCalled()
    setDpiView(true)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    setDpiView(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

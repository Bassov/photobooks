import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getGridVisible,
  setGridVisible,
  subscribeGridVisible,
  toggleGridVisible,
} from './gridView'

describe('gridView', () => {
  afterEach(() => {
    setGridVisible(false)
  })

  it('is hidden by default and toggles', () => {
    expect(getGridVisible()).toBe(false)
    toggleGridVisible()
    expect(getGridVisible()).toBe(true)
    toggleGridVisible()
    expect(getGridVisible()).toBe(false)
  })

  it('notifies only on change and stops after unsubscribe', () => {
    const listener = vi.fn()
    const stop = subscribeGridVisible(listener)
    setGridVisible(false)
    expect(listener).not.toHaveBeenCalled()
    setGridVisible(true)
    setGridVisible(true)
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    setGridVisible(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getSnapHint,
  getSnapHintSpread,
  setSnapHint,
  subscribeSnapHint,
} from './snapHint'

describe('snapHint', () => {
  afterEach(() => {
    setSnapHint(null)
  })

  it('holds the label and notifies only on change', () => {
    const listener = vi.fn()
    const stop = subscribeSnapHint(listener)
    setSnapHint(null)
    expect(listener).not.toHaveBeenCalled()
    setSnapHint('snap · row 2')
    setSnapHint('snap · row 2')
    expect(getSnapHint()).toBe('snap · row 2')
    expect(listener).toHaveBeenCalledTimes(1)
    setSnapHint(null)
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
  })

  it('keeps the spread the hint belongs to and notifies when it changes', () => {
    const listener = vi.fn()
    const stop = subscribeSnapHint(listener)
    setSnapHint('snap · row 2', 's1')
    expect(getSnapHintSpread()).toBe('s1')
    setSnapHint('snap · row 2', 's2')
    expect(getSnapHintSpread()).toBe('s2')
    expect(listener).toHaveBeenCalledTimes(2)
    setSnapHint(null)
    expect(getSnapHintSpread()).toBeUndefined()
    stop()
  })

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    subscribeSnapHint(listener)()
    setSnapHint('snap · column 1')
    expect(listener).not.toHaveBeenCalled()
  })
})

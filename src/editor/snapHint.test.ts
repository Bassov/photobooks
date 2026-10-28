import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSnapHint, setSnapHint, subscribeSnapHint } from './snapHint'

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

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn()
    subscribeSnapHint(listener)()
    setSnapHint('snap · column 1')
    expect(listener).not.toHaveBeenCalled()
  })
})

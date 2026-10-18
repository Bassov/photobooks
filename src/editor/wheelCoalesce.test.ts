import { describe, expect, it } from 'vitest'
import { mergePendingWheel, type PendingWheel } from './wheelCoalesce'

describe('mergePendingWheel', () => {
  it('creates a pending record from the first event', () => {
    expect(
      mergePendingWheel(null, { deltaY: -40, clientX: 10, clientY: 20 }),
    ).toEqual({ deltaY: -40, clientX: 10, clientY: 20 })
  })

  it('sums deltaY and keeps the latest pointer on later events', () => {
    const pending: PendingWheel = {
      deltaY: -40,
      clientX: 10,
      clientY: 20,
    }
    const merged = mergePendingWheel(pending, {
      deltaY: -60,
      clientX: 30,
      clientY: 40,
    })
    expect(merged).toBe(pending)
    expect(merged).toEqual({ deltaY: -100, clientX: 30, clientY: 40 })
  })

  it('clears independently when the caller resets to null', () => {
    const pending = mergePendingWheel(null, {
      deltaY: 12,
      clientX: 1,
      clientY: 2,
    })
    expect(
      mergePendingWheel(null, { deltaY: 3, clientX: 4, clientY: 5 }),
    ).toEqual({
      deltaY: 3,
      clientX: 4,
      clientY: 5,
    })
    expect(pending.deltaY).toBe(12)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { yieldForPaint } from './yieldForPaint'

describe('yieldForPaint', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves after a macrotask tick', async () => {
    vi.useFakeTimers()
    let resolved = false
    const pending = yieldForPaint().then(() => {
      resolved = true
    })
    expect(resolved).toBe(false)
    await vi.runAllTimersAsync()
    await pending
    expect(resolved).toBe(true)
  })
})

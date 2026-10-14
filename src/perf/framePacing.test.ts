import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertFramePacingWithinBudget,
  clearFramePacingSamples,
  getFramePacingStats,
  isFramePacingSampling,
  startFramePacingSampler,
  stopFramePacingSampler,
} from './framePacing'

describe('framePacing', () => {
  afterEach(() => {
    stopFramePacingSampler()
    clearFramePacingSamples()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false when requestAnimationFrame is missing', () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    expect(startFramePacingSampler()).toBe(false)
  })

  it('samples deltas and asserts within budget', () => {
    const callbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb)
      return callbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      // no-op
    })

    expect(startFramePacingSampler()).toBe(true)
    expect(isFramePacingSampling()).toBe(true)

    const first = callbacks[0]
    expect(first).toBeDefined()
    first?.(0)
    const second = callbacks[1]
    expect(second).toBeDefined()
    second?.(16)
    const third = callbacks[2]
    expect(third).toBeDefined()
    third?.(32)

    const stats = getFramePacingStats()
    expect(stats.sampleCount).toBe(2)
    expect(stats.p95Ms).toBe(16)
    assertFramePacingWithinBudget()
  })

  it('throws when no samples', () => {
    expect(() => {
      assertFramePacingWithinBudget()
    }).toThrow(/No frame-pacing samples/)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertFlingLoafBudget,
  browserLoafBlockingMs,
  judgeFlingLoaf,
} from '../e2e/perf/flingLoafGate.ts'
import { worstBlockingMs } from './perf-lane.mjs'

function messageOf(blockingMs) {
  try {
    judgeFlingLoaf(blockingMs)
  } catch (error) {
    return error.message
  }
  return null
}

describe('judgeFlingLoaf (thumb fling LoAF gate)', () => {
  it.each([
    [[]],
    [[0, 0]],
    [[1, 2.5, 4.9, 5, 5, 3, 5]],
    [[5.1]],
    [[0, 5, 20, 4]],
  ])('passes %j: only ≤5 ms plus at most one 5–20 ms entry', (ms) => {
    expect(messageOf(ms)).toBeNull()
  })

  it('fails a series of entries over 5 ms but within 20 ms', () => {
    expect(messageOf([2, 5.1, 3, 6])).toBe(
      'LoAF entries 2 exceed max 1 (fling, repeated spikes >5ms, worst blockingDuration 6ms, 2 ignored ≤5ms)',
    )
    expect(messageOf([12, 15, 19.9])).toMatch(/^LoAF entries 3 exceed max 1 /)
  })

  it.each([[[20.1]], [[1, 2, 120]], [[150, 6]]])(
    'fails %j: any entry over 20 ms',
    (ms) => {
      expect(messageOf(ms)).toMatch(/^LoAF entries 1 exceed max 0 \(fling, /)
    },
  )

  it('reports the worst entry so the perf lane still hard-fails runs over 50 ms', () => {
    const message = messageOf([3, 72.4])
    expect(message).toBe(
      'LoAF entries 1 exceed max 0 (fling, worst blockingDuration 72.4ms, 1 ignored ≤5ms)',
    )
    expect(worstBlockingMs(message)).toBe(72.4)
  })
})

describe('browserLoafBlockingMs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns blockingDuration of every entry in the window', () => {
    vi.stubGlobal('window', {
      __photobooksPerf: {
        isLoafObserving: () => true,
        getLoafEntries: () => [
          { startTime: 1, duration: 60, blockingDuration: 0 },
          { startTime: 9, duration: 70, blockingDuration: 4.5 },
        ],
      },
    })
    expect(browserLoafBlockingMs()).toEqual([0, 4.5])
  })

  it('throws when the perf hooks or the observer are missing', () => {
    vi.stubGlobal('window', {})
    expect(() => browserLoafBlockingMs()).toThrow(
      'window.__photobooksPerf is not available',
    )
    vi.stubGlobal('window', {
      __photobooksPerf: { isLoafObserving: () => false },
    })
    expect(() => browserLoafBlockingMs()).toThrow(
      'LoAF observer is not active; cannot assert LoAF budget',
    )
  })
})

describe('assertFlingLoafBudget', () => {
  const pageWith = (blockingMs) => ({
    evaluate: vi.fn(() => Promise.resolve(blockingMs)),
  })

  it('judges the entries read from the page', async () => {
    const page = pageWith([1, 4])
    await expect(assertFlingLoafBudget(page)).resolves.toBeUndefined()
    expect(page.evaluate).toHaveBeenCalledWith(browserLoafBlockingMs)
    await expect(assertFlingLoafBudget(pageWith([8, 9]))).rejects.toThrow(
      /^LoAF entries 2 exceed max 1 /,
    )
  })
})

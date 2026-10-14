import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertInpWithinBudget,
  clearEventTimingEntries,
  getInpMs,
  isEventTimingObserving,
  startEventTimingObserver,
  stopEventTimingObserver,
} from './eventTiming'

describe('eventTiming', () => {
  afterEach(() => {
    stopEventTimingObserver()
    clearEventTimingEntries()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false when PerformanceObserver is missing', () => {
    vi.stubGlobal('PerformanceObserver', undefined)
    expect(startEventTimingObserver()).toBe(false)
  })

  it('records entries and asserts INP', () => {
    interface List {
      getEntries: () => PerformanceEntry[]
    }
    const captured: { callback: ((list: List) => void) | null } = {
      callback: null,
    }

    class MockPerformanceObserver {
      constructor(cb: (list: List) => void) {
        captured.callback = cb
      }

      observe(): void {
        // no-op
      }

      disconnect(): void {
        // no-op
      }
    }

    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)
    expect(startEventTimingObserver()).toBe(true)
    expect(isEventTimingObserving()).toBe(true)

    captured.callback?.({
      getEntries: () => [
        {
          name: 'click',
          startTime: 0,
          duration: 12,
          processingStart: 1,
          processingEnd: 5,
        } as PerformanceEntry & {
          processingStart: number
          processingEnd: number
        },
      ],
    })

    expect(getInpMs()).toBe(12)
    assertInpWithinBudget()
  })

  it('throws when no entries', () => {
    class MockPerformanceObserver {
      observe(): void {
        // no-op
      }

      disconnect(): void {
        // no-op
      }
    }
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)
    startEventTimingObserver()
    expect(() => {
      assertInpWithinBudget()
    }).toThrow(/No Event Timing entries/)
  })
})

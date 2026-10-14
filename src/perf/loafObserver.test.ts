import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertNoLoafEntries,
  clearLoafEntries,
  getLoafEntries,
  isLoafObserving,
  startLoafObserver,
  stopLoafObserver,
} from './loafObserver'

describe('loafObserver', () => {
  afterEach(() => {
    stopLoafObserver()
    clearLoafEntries()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns false when PerformanceObserver is missing', () => {
    vi.stubGlobal('PerformanceObserver', undefined)
    expect(startLoafObserver()).toBe(false)
    expect(isLoafObserving()).toBe(false)
  })

  it('starts observer and records entries', () => {
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

    expect(startLoafObserver()).toBe(true)
    expect(isLoafObserving()).toBe(true)
    expect(startLoafObserver()).toBe(true)

    captured.callback?.({
      getEntries: () => [
        {
          startTime: 1,
          duration: 50,
          blockingDuration: 30,
        } as PerformanceEntry & { blockingDuration: number },
        {
          startTime: 2,
          duration: 40,
        } as PerformanceEntry,
      ],
    })

    expect(getLoafEntries()).toEqual([
      { startTime: 1, duration: 50, blockingDuration: 30 },
      { startTime: 2, duration: 40, blockingDuration: 40 },
    ])

    clearLoafEntries()
    expect(getLoafEntries()).toEqual([])
    assertNoLoafEntries()

    stopLoafObserver()
    expect(isLoafObserving()).toBe(false)
  })

  it('returns false when observe throws', () => {
    class ThrowingObserver {
      observe(): void {
        throw new Error('unsupported')
      }

      disconnect(): void {
        // no-op
      }
    }

    vi.stubGlobal('PerformanceObserver', ThrowingObserver)
    expect(startLoafObserver()).toBe(false)
    expect(isLoafObserving()).toBe(false)
  })

  it('throws when asserting without an active observer', () => {
    expect(() => {
      assertNoLoafEntries()
    }).toThrow(/LoAF observer is not active/)
  })

  it('throws when any LoAF entry is recorded', () => {
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
    startLoafObserver()
    captured.callback?.({
      getEntries: () => [
        {
          startTime: performance.now() + 1,
          duration: 60,
          blockingDuration: 40,
        } as PerformanceEntry & { blockingDuration: number },
      ],
    })

    expect(() => {
      assertNoLoafEntries()
    }).toThrow(/exceed max/)
  })
})

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
    const captured: {
      callback: ((list: List) => void) | null
      buffered: PerformanceEntry[]
    } = {
      callback: null,
      buffered: [],
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

      takeRecords(): PerformanceEntry[] {
        const drained = captured.buffered
        captured.buffered = []
        return drained
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

  it('clearLoafEntries drains takeRecords then drops them from the window', () => {
    interface List {
      getEntries: () => PerformanceEntry[]
    }
    const captured: {
      callback: ((list: List) => void) | null
      buffered: PerformanceEntry[]
    } = {
      callback: null,
      buffered: [],
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

      takeRecords(): PerformanceEntry[] {
        const drained = captured.buffered
        captured.buffered = []
        return drained
      }
    }

    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)
    startLoafObserver()
    captured.buffered = [
      {
        startTime: performance.now() - 10,
        duration: 60,
        blockingDuration: 0,
      } as PerformanceEntry & { blockingDuration: number },
    ]

    clearLoafEntries()
    expect(getLoafEntries()).toEqual([])
    expect(captured.buffered).toEqual([])
    assertNoLoafEntries()
  })

  it('assertNoLoafEntries flushes takeRecords before counting', () => {
    interface List {
      getEntries: () => PerformanceEntry[]
    }
    const captured: {
      callback: ((list: List) => void) | null
      buffered: PerformanceEntry[]
    } = {
      callback: null,
      buffered: [],
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

      takeRecords(): PerformanceEntry[] {
        const drained = captured.buffered
        captured.buffered = []
        return drained
      }
    }

    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)
    startLoafObserver()
    clearLoafEntries()
    captured.buffered = [
      {
        startTime: performance.now() + 1,
        duration: 60,
        blockingDuration: 12,
      } as PerformanceEntry & { blockingDuration: number },
    ]

    expect(() => {
      assertNoLoafEntries()
    }).toThrow(/exceed max/)
  })

  it('ignores entries that started before the clear watermark', () => {
    interface List {
      getEntries: () => PerformanceEntry[]
    }
    const captured: {
      callback: ((list: List) => void) | null
      buffered: PerformanceEntry[]
    } = {
      callback: null,
      buffered: [],
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

      takeRecords(): PerformanceEntry[] {
        const drained = captured.buffered
        captured.buffered = []
        return drained
      }
    }

    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver)
    vi.spyOn(performance, 'now').mockReturnValue(1_000)
    startLoafObserver()
    clearLoafEntries()

    captured.callback?.({
      getEntries: () => [
        {
          startTime: 999,
          duration: 80,
          blockingDuration: 0,
        } as PerformanceEntry & { blockingDuration: number },
        {
          startTime: 1_000,
          duration: 70,
          blockingDuration: 5,
        } as PerformanceEntry & { blockingDuration: number },
        {
          startTime: 1_001,
          duration: 60,
          blockingDuration: 8,
        } as PerformanceEntry & { blockingDuration: number },
      ],
    })

    expect(getLoafEntries()).toEqual([
      { startTime: 1_000, duration: 70, blockingDuration: 5 },
      { startTime: 1_001, duration: 60, blockingDuration: 8 },
    ])
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

  it('throws when any input-blocking LoAF entry is recorded', () => {
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
    }).toThrow(/Input-blocking LoAF entries .* exceed max/)
  })

  it('ignores LoAF entries with blockingDuration 0 under the entry budget', () => {
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
    clearLoafEntries()
    captured.callback?.({
      getEntries: () => [
        {
          startTime: performance.now() + 1,
          duration: 80,
          blockingDuration: 0,
        } as PerformanceEntry & { blockingDuration: number },
      ],
    })

    expect(getLoafEntries()).toEqual([])
    assertNoLoafEntries()
  })
})

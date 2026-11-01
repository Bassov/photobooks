import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  noteFilmstripScrollActivity,
  resetFilmstripScrollQuietForTests,
} from './filmstripScrollQuiet'
import {
  extendWindowIds,
  resetFilmstripVisibleSyncForTests,
  scheduleFilmstripVisibleSync,
} from './filmstripVisibleSync'
import {
  getFilmstripWindow,
  resetFilmstripWindowForTests,
} from './filmstripWindow'

const ORDER = Array.from({ length: 40 }, (_, i) => `a${String(i)}`)

function windowAt(start: number, size = 5): string[] {
  return ORDER.slice(start, start + size)
}

describe('scheduleFilmstripVisibleSync', () => {
  let now = 0

  beforeEach(() => {
    resetFilmstripVisibleSyncForTests()
    resetFilmstripWindowForTests()
  })

  afterEach(() => {
    resetFilmstripScrollQuietForTests()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function fakeClock(start: number): void {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    now = start
    vi.spyOn(performance, 'now').mockImplementation(() => now)
  }

  function tick(ms: number): void {
    now += ms
    vi.advanceTimersByTime(ms)
  }

  it('publishes immediately when the filmstrip is not scroll-quiet', () => {
    const setVisible = vi.fn()
    const cleanup = scheduleFilmstripVisibleSync(['a', 'b'], setVisible)
    expect(setVisible).toHaveBeenCalledWith(['a', 'b'])
    cleanup()
  })

  it('defers publish until scroll quiet ends and cleanup cancels the timer', () => {
    fakeClock(1_000)
    noteFilmstripScrollActivity()
    const setVisible = vi.fn()
    const cleanup = scheduleFilmstripVisibleSync(['x'], setVisible)
    expect(setVisible).not.toHaveBeenCalled()
    cleanup()
    tick(200)
    expect(setVisible).not.toHaveBeenCalled()
  })

  it('publishes after the quiet delay when not cleaned up', () => {
    fakeClock(2_000)
    noteFilmstripScrollActivity()
    const setVisible = vi.fn()
    scheduleFilmstripVisibleSync(['y'], setVisible)
    tick(200)
    expect(setVisible).toHaveBeenLastCalledWith(['y'])
  })

  it('publishes every ~100 ms during a running scroll, extended ahead by velocity', () => {
    fakeClock(5_000)
    const setVisible = vi.fn()
    let cleanup = (): void => undefined
    // One window step (1 item) every 20 ms → 0.05 items/ms → 10 ahead, capped at 5.
    for (let step = 0; step < 10; step += 1) {
      noteFilmstripScrollActivity()
      cleanup()
      cleanup = scheduleFilmstripVisibleSync(windowAt(step), setVisible, {
        order: ORDER,
        start: step,
      })
      tick(20)
    }
    // Leading publish, then one per 100 ms while scrolling (no quiet end yet).
    expect(setVisible).toHaveBeenCalledTimes(2)
    expect(setVisible).toHaveBeenNthCalledWith(1, windowAt(0))
    expect(setVisible).toHaveBeenNthCalledWith(2, windowAt(5, 10))
    expect(getFilmstripWindow()).toEqual({
      order: ORDER,
      start: 9,
      end: 14,
      direction: 1,
    })

    // Scroll stops: one more throttle slot, then the exact window.
    tick(200)
    expect(setVisible).toHaveBeenNthCalledWith(3, windowAt(9, 10))
    expect(setVisible).toHaveBeenLastCalledWith(windowAt(9))
    expect(setVisible).toHaveBeenCalledTimes(4)
    cleanup()
  })

  it('extends backwards when scrolling toward the start', () => {
    fakeClock(9_000)
    const setVisible = vi.fn()
    noteFilmstripScrollActivity()
    scheduleFilmstripVisibleSync(windowAt(20), setVisible, {
      order: ORDER,
      start: 20,
    })()
    tick(50)
    noteFilmstripScrollActivity()
    scheduleFilmstripVisibleSync(windowAt(18), setVisible, {
      order: ORDER,
      start: 18,
    })
    tick(60)
    // -2 items / 50 ms → 8 ahead, capped at the window length.
    expect(setVisible).toHaveBeenLastCalledWith([
      ...windowAt(13, 5),
      ...windowAt(18),
    ])
    expect(getFilmstripWindow().direction).toBe(-1)
  })

  it('skips the extended publish when the exact window lands first', () => {
    fakeClock(12_000)
    const setVisible = vi.fn()
    scheduleFilmstripVisibleSync(windowAt(0), setVisible, {
      order: ORDER,
      start: 0,
    })
    tick(30)
    noteFilmstripScrollActivity()
    // Quiet ends in 200 ms; throttle would allow 70 ms → extended first.
    scheduleFilmstripVisibleSync(windowAt(3), setVisible, {
      order: ORDER,
      start: 3,
    })
    tick(70)
    expect(setVisible).toHaveBeenLastCalledWith(windowAt(3, 5 + 5))
    setVisible.mockClear()
    // A second frame whose quiet ends before the next throttle slot.
    now += 40
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    noteFilmstripScrollActivity()
    resetFilmstripScrollQuietForTests()
    scheduleFilmstripVisibleSync(windowAt(4), setVisible, {
      order: ORDER,
      start: 4,
    })
    expect(setVisible).toHaveBeenCalledWith(windowAt(4))
  })

  it('waits for quiet end alone when it comes before the next throttle slot', () => {
    fakeClock(20_000)
    noteFilmstripScrollActivity()
    const setVisible = vi.fn()
    tick(120)
    // Throttle slot open (no publish yet): lands on the next tick.
    const first = scheduleFilmstripVisibleSync(['b'], setVisible)
    tick(0)
    expect(setVisible).toHaveBeenCalledWith(['b'])
    first()
    tick(10)
    // Quiet ends in 70 ms, the next throttle slot in 90 ms.
    const stale = scheduleFilmstripVisibleSync(['c'], setVisible)
    stale()
    scheduleFilmstripVisibleSync(['d'], setVisible)
    tick(69)
    expect(setVisible).toHaveBeenCalledTimes(1)
    tick(200)
    expect(setVisible).toHaveBeenCalledTimes(2)
    expect(setVisible).toHaveBeenLastCalledWith(['d'])
  })

  it('keeps the last direction when the window holds still', () => {
    fakeClock(15_000)
    const setVisible = vi.fn()
    scheduleFilmstripVisibleSync(windowAt(2), setVisible, {
      order: ORDER,
      start: 2,
    })
    tick(16)
    scheduleFilmstripVisibleSync(windowAt(1), setVisible, {
      order: ORDER,
      start: 1,
    })
    tick(16)
    scheduleFilmstripVisibleSync(windowAt(1), setVisible, {
      order: ORDER,
      start: 1,
    })
    expect(getFilmstripWindow().direction).toBe(-1)
    // A new order (gallery change) restarts the velocity sample.
    const other = [...ORDER]
    tick(16)
    scheduleFilmstripVisibleSync(windowAt(4), setVisible, {
      order: other,
      start: 4,
    })
    expect(getFilmstripWindow()).toMatchObject({ order: other, direction: -1 })
  })
})

describe('extendWindowIds', () => {
  const frame = { order: ORDER, start: 10 }

  it('returns the window unchanged at rest', () => {
    const ids = windowAt(10)
    expect(extendWindowIds(ids, frame, 0)).toBe(ids)
  })

  it('adds velocity × 200 ms items ahead, at most one window', () => {
    expect(extendWindowIds(windowAt(10), frame, 0.01)).toEqual(windowAt(10, 7))
    expect(extendWindowIds(windowAt(10), frame, 1)).toEqual(windowAt(10, 10))
    expect(extendWindowIds(windowAt(10), frame, -0.01)).toEqual(windowAt(8, 7))
  })

  it('clamps at the order bounds', () => {
    expect(
      extendWindowIds(windowAt(0), { order: ORDER, start: 0 }, -1),
    ).toEqual(windowAt(0))
    expect(
      extendWindowIds(windowAt(37, 3), { order: ORDER, start: 37 }, 1),
    ).toEqual(windowAt(37, 3))
  })
})

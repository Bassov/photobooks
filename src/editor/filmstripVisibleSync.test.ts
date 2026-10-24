import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  noteFilmstripScrollActivity,
  resetFilmstripScrollQuietForTests,
} from './filmstripScrollQuiet'
import { scheduleFilmstripVisibleSync } from './filmstripVisibleSync'

describe('scheduleFilmstripVisibleSync', () => {
  afterEach(() => {
    resetFilmstripScrollQuietForTests()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('publishes immediately when the filmstrip is not scroll-quiet', () => {
    const setVisible = vi.fn()
    const cleanup = scheduleFilmstripVisibleSync(['a', 'b'], setVisible)
    expect(setVisible).toHaveBeenCalledWith(['a', 'b'])
    cleanup()
  })

  it('defers publish until scroll quiet ends and cleanup cancels the timer', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    noteFilmstripScrollActivity()
    const setVisible = vi.fn()
    const cleanup = scheduleFilmstripVisibleSync(['x'], setVisible)
    expect(setVisible).not.toHaveBeenCalled()
    cleanup()
    now = 1_200
    vi.advanceTimersByTime(200)
    expect(setVisible).not.toHaveBeenCalled()
  })

  it('publishes after the quiet delay when not cleaned up', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let now = 2_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    noteFilmstripScrollActivity()
    const setVisible = vi.fn()
    scheduleFilmstripVisibleSync(['y'], setVisible)
    now = 2_200
    vi.advanceTimersByTime(200)
    expect(setVisible).toHaveBeenCalledWith(['y'])
  })
})

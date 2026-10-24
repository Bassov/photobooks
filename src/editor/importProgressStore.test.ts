import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  noteFilmstripScrollActivity,
  resetFilmstripScrollQuietForTests,
} from './filmstripScrollQuiet'
import {
  getImportProgress,
  resetImportProgressForTests,
  setImportProgress,
  subscribeImportProgress,
} from './importProgressStore'

describe('importProgressStore', () => {
  afterEach(() => {
    resetImportProgressForTests()
    resetFilmstripScrollQuietForTests()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('notifies subscribers when progress changes and no-ops on same ref', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeImportProgress(listener)
    const state = {
      total: 2,
      completed: 1,
      errors: [],
      running: true,
    }
    setImportProgress(state)
    expect(getImportProgress()).toBe(state)
    expect(listener).toHaveBeenCalledTimes(1)
    setImportProgress(state)
    expect(listener).toHaveBeenCalledTimes(1)
    setImportProgress(null)
    expect(getImportProgress()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('defers subscriber notifies while the filmstrip scroll quiet window is open', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let now = 2_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const listener = vi.fn()
    const unsubscribe = subscribeImportProgress(listener)
    noteFilmstripScrollActivity()
    const state = {
      total: 4,
      completed: 1,
      errors: [],
      running: true,
    }
    setImportProgress(state)
    expect(getImportProgress()).toBe(state)
    expect(listener).not.toHaveBeenCalled()
    now = 2_200
    vi.advanceTimersByTime(200)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('schedules the quiet emit with the remaining scroll quiet delay', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const now = 3_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    noteFilmstripScrollActivity()
    setImportProgress({
      total: 2,
      completed: 0,
      errors: [],
      running: true,
    })
    expect(setTimeoutSpy).toHaveBeenCalled()
    const delay = setTimeoutSpy.mock.calls.at(-1)?.[1]
    expect(delay).toBe(200)
  })

  it('re-defers emit when scroll quiet is extended before the timer fires', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let now = 4_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const listener = vi.fn()
    subscribeImportProgress(listener)
    noteFilmstripScrollActivity()
    setImportProgress({
      total: 3,
      completed: 1,
      errors: [],
      running: true,
    })
    // Extend quiet without a new progress write so the original timer must
    // re-check isFilmstripScrollQuiet and reschedule.
    now = 4_100
    noteFilmstripScrollActivity()
    now = 4_200
    vi.advanceTimersByTime(200)
    expect(listener).not.toHaveBeenCalled()
    now = 4_300
    vi.advanceTimersByTime(100)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reset clears a pending quiet emit timer without a late notify', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let now = 6_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const listener = vi.fn()
    subscribeImportProgress(listener)
    noteFilmstripScrollActivity()
    setImportProgress({
      total: 2,
      completed: 0,
      errors: [],
      running: true,
    })
    listener.mockClear()
    resetImportProgressForTests()
    expect(getImportProgress()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    now = 6_500
    vi.advanceTimersByTime(500)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('emits immediately after quiet ends when a later update arrives', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let now = 5_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const listener = vi.fn()
    subscribeImportProgress(listener)
    noteFilmstripScrollActivity()
    setImportProgress({
      total: 1,
      completed: 0,
      errors: [],
      running: true,
    })
    now = 5_200
    vi.advanceTimersByTime(200)
    listener.mockClear()
    setImportProgress({
      total: 1,
      completed: 1,
      errors: [],
      running: false,
    })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

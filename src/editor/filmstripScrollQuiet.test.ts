import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  filmstripScrollQuietRemainingMs,
  isFilmstripScrollQuiet,
  noteFilmstripScrollActivity,
  resetFilmstripScrollQuietForTests,
} from './filmstripScrollQuiet'

describe('filmstripScrollQuiet', () => {
  afterEach(() => {
    resetFilmstripScrollQuietForTests()
    vi.restoreAllMocks()
  })

  it('is quiet only within the scroll quiet window', () => {
    let now = 1_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    expect(isFilmstripScrollQuiet()).toBe(false)
    expect(filmstripScrollQuietRemainingMs()).toBe(0)

    noteFilmstripScrollActivity()
    expect(isFilmstripScrollQuiet()).toBe(true)
    expect(filmstripScrollQuietRemainingMs()).toBe(200)

    now = 1_000 + 199
    expect(isFilmstripScrollQuiet()).toBe(true)
    expect(filmstripScrollQuietRemainingMs()).toBe(1)

    now = 1_000 + 200
    expect(isFilmstripScrollQuiet()).toBe(false)
    expect(filmstripScrollQuietRemainingMs()).toBe(0)
  })

  it('extends the quiet window on repeated scroll activity', () => {
    let now = 5_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    noteFilmstripScrollActivity()
    now = 5_100
    noteFilmstripScrollActivity()
    now = 5_250
    expect(isFilmstripScrollQuiet()).toBe(true)
    now = 5_300
    expect(isFilmstripScrollQuiet()).toBe(false)
  })

  it('reset clears an active quiet window', () => {
    const now = 7_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    noteFilmstripScrollActivity()
    expect(isFilmstripScrollQuiet()).toBe(true)
    resetFilmstripScrollQuietForTests()
    expect(isFilmstripScrollQuiet()).toBe(false)
    expect(filmstripScrollQuietRemainingMs()).toBe(0)
  })
})

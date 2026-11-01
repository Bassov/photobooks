import { describe, expect, it } from 'vitest'
import {
  filmstripScrollDirection,
  shouldCommitFilmstripScroll,
} from './filmstripScrollCommit'

describe('shouldCommitFilmstripScroll', () => {
  it('is false when the window range is unchanged', () => {
    expect(
      shouldCommitFilmstripScroll({ start: 2, end: 9 }, { start: 2, end: 9 }),
    ).toBe(false)
  })

  it('is true when either window edge moves', () => {
    expect(
      shouldCommitFilmstripScroll({ start: 3, end: 9 }, { start: 2, end: 9 }),
    ).toBe(true)
    expect(
      shouldCommitFilmstripScroll({ start: 2, end: 10 }, { start: 2, end: 9 }),
    ).toBe(true)
  })
})

describe('filmstripScrollDirection', () => {
  it('follows the sign of the scroll step', () => {
    expect(filmstripScrollDirection(10, 5, -1)).toBe(1)
    expect(filmstripScrollDirection(5, 10, 1)).toBe(-1)
  })

  it('keeps the previous direction when the offset is unchanged', () => {
    expect(filmstripScrollDirection(5, 5, -1)).toBe(-1)
    expect(filmstripScrollDirection(5, 5, 1)).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'
import { applyBookOp, checkBookInvariants, setPageCount } from './index'
import {
  bookSpineWidthMm,
  clampPageCount,
  PAGE_MAX,
  PAGE_MIN,
  PAGE_STEP,
  pagesOf,
  spineWidthForPages,
} from './pages'
import { makeBook, makeFrame, makeSpread } from './testing/fixtures'

function bookWith(spreads: number) {
  return makeBook({
    spreads: Array.from({ length: spreads }, (_, i) =>
      makeSpread({ id: `s${String(i + 1)}` }),
    ),
  })
}

describe('page count', () => {
  it('counts two pages per spread inside the kit 20–120 range', () => {
    expect([PAGE_MIN, PAGE_MAX, PAGE_STEP]).toEqual([20, 120, 2])
    expect(pagesOf(0)).toBe(0)
    expect(pagesOf(7)).toBe(14)
  })

  it('clamps a typed count to 20–120 and rounds it to the nearest even', () => {
    expect(clampPageCount(10)).toBe(20)
    expect(clampPageCount(19)).toBe(20)
    expect(clampPageCount(20)).toBe(20)
    expect(clampPageCount(33)).toBe(34)
    expect(clampPageCount(34.9)).toBe(34)
    expect(clampPageCount(35)).toBe(36)
    expect(clampPageCount(120)).toBe(120)
    expect(clampPageCount(121)).toBe(120)
    expect(clampPageCount(200)).toBe(120)
    expect(clampPageCount(Number.NaN)).toBeNaN()
  })
})

describe('spine width', () => {
  it('is 8 mm of boards plus 0.2 mm per page, padded to the 20-page block', () => {
    expect(spineWidthForPages(0)).toBe(12)
    expect(spineWidthForPages(20)).toBe(12)
    expect(spineWidthForPages(22)).toBe(12.4)
    expect(spineWidthForPages(42)).toBe(16.4)
    expect(spineWidthForPages(120)).toBe(32)
    expect(spineWidthForPages(140)).toBe(32)
  })

  it('follows the spread count and ignores the stored cover width', () => {
    const book = bookWith(15)
    expect(book.cover.style.spineWidthMm).toBe(12)
    expect(bookSpineWidthMm(book)).toBe(14)
  })
})

describe('setPageCount', () => {
  it('appends empty spreads up to the clamped count', () => {
    const book = bookWith(3)
    const next = setPageCount(book, 10)
    expect(next.spreads).toHaveLength(10)
    expect(next.spreads.slice(0, 3).map((s) => s.id)).toEqual([
      's1',
      's2',
      's3',
    ])
    expect(checkBookInvariants(next)).toEqual({ ok: true })
  })

  it('removes spreads from the end down to the count', () => {
    const book = makeBook({
      spreads: Array.from({ length: 30 }, (_, i) =>
        makeSpread({
          id: `s${String(i + 1)}`,
          frames: [makeFrame({ id: `f${String(i + 1)}` })],
        }),
      ),
    })
    const next = applyBookOp(book, { type: 'setPageCount', pages: 41 })
    expect(next.spreads.map((s) => s.id)).toEqual(
      book.spreads.slice(0, 21).map((s) => s.id),
    )
    expect(checkBookInvariants(next)).toEqual({ ok: true })
  })

  it('returns the same book when the count already matches or is not a number', () => {
    const book = bookWith(12)
    expect(setPageCount(book, 24)).toBe(book)
    expect(setPageCount(book, 23.5)).toBe(book)
    expect(setPageCount(book, Number.NaN)).toBe(book)
  })
})

import { describe, expect, it } from 'vitest'
import { applyBookOp, checkBookInvariants, setPageCount } from './index'
import {
  bookSpineWidthMm,
  clampPageCount,
  PAGE_MAX,
  PAGE_MIN,
  PAGE_STEP,
  pageLabel,
  pagesOf,
  spreadsForPages,
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
  it('counts the listed pages: single page 1, two per inner spread, single last page', () => {
    expect([PAGE_MIN, PAGE_MAX, PAGE_STEP]).toEqual([20, 120, 2])
    expect(pagesOf(0)).toBe(0)
    // One spread is page 1 alone; two are page 1 and a single last page.
    expect(pagesOf(1)).toBe(1)
    expect(pagesOf(2)).toBe(2)
    // 1 + 2 + 1: the list reads 1, 2–3, 4.
    expect(pagesOf(3)).toBe(4)
    expect(pagesOf(7)).toBe(12)
    expect(pagesOf(11)).toBe(PAGE_MIN)
  })

  it('agrees with the last page label of the list', () => {
    for (const spreads of [2, 3, 4, 11, 61]) {
      expect(pageLabel(spreads - 1, spreads)).toBe(String(pagesOf(spreads)))
    }
  })

  it('inverts to the spreads that print an even page count', () => {
    expect(spreadsForPages(2)).toBe(2)
    expect(spreadsForPages(4)).toBe(3)
    expect(spreadsForPages(PAGE_MIN)).toBe(11)
    expect(spreadsForPages(PAGE_MAX)).toBe(61)
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

describe('pageLabel', () => {
  it('labels a 6-page and an 8-page book like the kit list (M46)', () => {
    expect([0, 1, 2, 3].map((i) => pageLabel(i, 4))).toEqual([
      '1',
      '2–3',
      '4–5',
      '6',
    ])
    expect([0, 1, 2, 3, 4].map((i) => pageLabel(i, 5))).toEqual([
      '1',
      '2–3',
      '4–5',
      '6–7',
      '8',
    ])
    // A one-spread book is page 1 only.
    expect(pageLabel(0, 1)).toBe('1')
  })

  it('pairs pages when the spread count is unknown', () => {
    expect(pageLabel(0)).toBe('1')
    expect(pageLabel(1)).toBe('2–3')
    expect(pageLabel(2)).toBe('4–5')
  })
})

describe('spine width', () => {
  it('is the generic profile: 8 mm of boards plus 0.2 mm per page, padded to the 20-page block', () => {
    // Spreads → pages: 1 → 1, 11 → 20, 12 → 22, 22 → 42, 61 → 120, 71 → 140.
    expect(
      [1, 11, 12, 22, 61, 71].map((n) => bookSpineWidthMm(bookWith(n))),
    ).toEqual([12, 12, 12.4, 16.4, 32, 32])
  })

  it('follows the page count and ignores the stored cover width', () => {
    // 15 spreads print 28 pages: 8 + 28 × 0.2 mm.
    const book = bookWith(15)
    expect(book.cover.style.spineWidthMm).toBe(12)
    expect(bookSpineWidthMm(book)).toBe(13.6)
  })
})

describe('setPageCount', () => {
  it('appends empty spreads up to the clamped count', () => {
    const book = bookWith(3)
    const next = setPageCount(book, 10)
    // 20 pages: page 1, nine inner spreads, a single last page.
    expect(next.spreads).toHaveLength(11)
    expect(pagesOf(next.spreads.length)).toBe(20)
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
      book.spreads.slice(0, 22).map((s) => s.id),
    )
    expect(checkBookInvariants(next)).toEqual({ ok: true })
  })

  it('returns the same book when the count already matches or is not a number', () => {
    const book = bookWith(12)
    expect(setPageCount(book, 22)).toBe(book)
    expect(setPageCount(book, 21.5)).toBe(book)
    expect(setPageCount(book, Number.NaN)).toBe(book)
  })
})

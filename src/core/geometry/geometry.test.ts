import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import {
  getPageCuts,
  getSpreadPageCount,
  getSpreadSizeMm,
  moveSpread,
  removeSpread,
  resolveSpread,
  sourceCropRect,
} from '../index'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

describe('spread size and page cuts', () => {
  it('treats a single spread as one page', () => {
    expect(getSpreadPageCount(0, 1)).toBe(1)
  })

  it('treats first and last of many as one page and middle as two', () => {
    expect(getSpreadPageCount(0, 3)).toBe(1)
    expect(getSpreadPageCount(1, 3)).toBe(2)
    expect(getSpreadPageCount(2, 3)).toBe(1)
  })

  it('sizes interior spreads to twice trim width', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b' }),
        makeSpread({ id: 'c' }),
      ],
    })
    const middle = getSpreadSizeMm(book, 1)
    expect(middle.widthMm).toBe(book.settings.trim.widthMm * 2)
    expect(getPageCuts(book, 1)).toEqual([
      { orientation: 'vertical', offsetMm: book.settings.trim.widthMm },
    ])
    expect(getPageCuts(book, 0)).toEqual([])
  })
})

describe('sourceCropRect', () => {
  it('returns full cover window at zoom 1 for square into square', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { zoom: 1, center: { x: 0.5, y: 0.5 } },
      1,
    )
    expect(rect).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('shrinks the window when zoomed', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { zoom: 2, center: { x: 0.5, y: 0.5 } },
      1,
    )
    expect(rect.width).toBeCloseTo(0.5)
    expect(rect.height).toBeCloseTo(0.5)
    expect(rect.x).toBeCloseTo(0.25)
    expect(rect.y).toBeCloseTo(0.25)
  })

  it('uses default crop when crop is omitted', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      undefined,
      1,
    )
    expect(rect).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('crops sides for a wide image in a square frame', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { zoom: 1, center: { x: 0.5, y: 0.5 } },
      2,
    )
    expect(rect.height).toBeCloseTo(1)
    expect(rect.width).toBeCloseTo(0.5)
    expect(rect.x).toBeCloseTo(0.25)
  })

  it('crops top and bottom for a tall image in a wide frame', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 200, height: 100 },
      { zoom: 1, center: { x: 0.5, y: 0.5 } },
      0.5,
    )
    expect(rect.width).toBeCloseTo(1)
    expect(rect.height).toBeCloseTo(0.25)
    expect(rect.y).toBeCloseTo(0.375)
  })

  it('clamps center so the crop stays in bounds', () => {
    const rect = sourceCropRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { zoom: 2, center: { x: 0, y: 1 } },
      1,
    )
    expect(rect.x).toBe(0)
    expect(rect.y + rect.height).toBeCloseTo(1)
  })
})

describe('resolveSpread', () => {
  it('returns undefined for unknown spread', () => {
    expect(resolveSpread(makeBook(), 'missing')).toBeUndefined()
  })

  it('exposes a center cut on an interior spread', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b', frames: [makeFrame({ id: 'f' })] }),
        makeSpread({ id: 'c' }),
      ],
    })
    const resolved = resolveSpread(book, 'b')
    expect(resolved?.pageCuts).toEqual([
      { orientation: 'vertical', offsetMm: book.settings.trim.widthMm },
    ])
  })

  it('omits source crop for empty frames', () => {
    const book = makeBook({
      spreads: [makeSpread({ frames: [makeFrame({ id: 'empty' })] })],
    })
    const resolved = resolveSpread(book, 'spread-1')
    expect(resolved?.items[0]?.sourceCropRect).toBeUndefined()
  })

  it('recomputes source crops when aspect lookup changes', () => {
    const book = makeBook({
      assets: { a1: {} },
      gallery: ['a1'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              id: 'f1',
              assetId: 'a1',
              crop: { zoom: 1, center: { x: 0.5, y: 0.5 } },
              rect: { x: 0, y: 0, width: 200, height: 100 },
            }),
          ],
        }),
      ],
    })
    const first = resolveSpread(book, 'spread-1', {
      getAspectRatio: () => 1,
    })
    const second = resolveSpread(book, 'spread-1', {
      getAspectRatio: () => 2,
    })
    expect(first?.items[0]?.rectMm).toEqual(second?.items[0]?.rectMm)
    expect(first?.items[0]?.sourceCropRect).not.toEqual(
      second?.items[0]?.sourceCropRect,
    )
  })

  it('invalidates page size after moveSpread changes index role', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b', frames: [makeFrame({ id: 'f' })] }),
        makeSpread({ id: 'c' }),
      ],
    })
    const before = resolveSpread(book, 'b')
    expect(before?.pageCuts).toHaveLength(1)
    expect(before?.spreadWidthMm).toBe(book.settings.trim.widthMm * 2)

    const moved = moveSpread(book, 'b', 0)
    const after = resolveSpread(moved, 'b')
    expect(after?.pageCuts).toEqual([])
    expect(after?.spreadWidthMm).toBe(book.settings.trim.widthMm)
  })

  it('invalidates page size after removeSpread changes neighbor roles', () => {
    const book = makeBook({
      spreads: [
        makeSpread({ id: 'a' }),
        makeSpread({ id: 'b', frames: [makeFrame({ id: 'f' })] }),
        makeSpread({ id: 'c' }),
      ],
    })
    expect(resolveSpread(book, 'b')?.pageCuts).toHaveLength(1)
    const trimmed = removeSpread(book, 'c')
    expect(resolveSpread(trimmed, 'b')?.pageCuts).toEqual([])
    expect(resolveSpread(trimmed, 'b')?.spreadWidthMm).toBe(
      book.settings.trim.widthMm,
    )
  })
})

test.prop(
  [
    fc.double({ min: 1, max: 4, noNaN: true }),
    fc.double({ min: 0.2, max: 0.8, noNaN: true }),
    fc.double({ min: 0.2, max: 0.8, noNaN: true }),
    fc.double({ min: 0.5, max: 3, noNaN: true }),
  ],
  { numRuns: 50 },
)('source crop stays inside the unit square', (zoom, cx, cy, aspect) => {
  const rect = sourceCropRect(
    { x: 0, y: 0, width: 120, height: 80 },
    { zoom, center: { x: cx, y: cy } },
    aspect,
  )
  expect(rect.x).toBeGreaterThanOrEqual(0)
  expect(rect.y).toBeGreaterThanOrEqual(0)
  expect(rect.x + rect.width).toBeLessThanOrEqual(1 + 1e-9)
  expect(rect.y + rect.height).toBeLessThanOrEqual(1 + 1e-9)
})

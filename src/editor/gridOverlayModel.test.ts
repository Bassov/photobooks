import { describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { pageGridRects } from './gridOverlayModel'

const middle = makeBook({
  layoutGrid: {
    columns: 3,
    rows: 2,
    columnGutterMm: 6,
    rowGutterMm: 4,
    margins: { top: 10, bottom: 20, inside: 30, outside: 12 },
  },
  spreads: [
    makeSpread({ id: 'cover' }),
    makeSpread({ id: 'mid' }),
    makeSpread({ id: 'back' }),
  ],
})

describe('pageGridRects', () => {
  it('mirrors inside (= spine side) across facing pages', () => {
    const [left, right] = pageGridRects(middle, 1)
    // inside = margins.left = 30 on the spine side, outside = 12.
    expect(left?.content.x).toBe(12)
    expect(left && left.content.x + left.content.width).toBe(300 - 30)
    expect(right?.content.x).toBe(300 + 30)
    expect(right && right.content.x + right.content.width).toBe(600 - 12)
  })

  it('treats a lone cover as right-hand and a lone last page as left-hand', () => {
    const [cover] = pageGridRects(middle, 0)
    expect(cover?.content.x).toBe(30)
    const [back] = pageGridRects(middle, 2)
    expect(back?.content.x).toBe(12)
  })

  it('tiles the content box with columns and rows incl. gutters', () => {
    const [page] = pageGridRects(middle, 0)
    expect(page?.columns).toHaveLength(3)
    expect(page?.rows).toHaveLength(2)
    const cols = page?.columns ?? []
    const total = cols.reduce((sum, c) => sum + c.width, 0) + 2 * 6
    expect(total).toBeCloseTo(page?.content.width ?? 0)
    const rows = page?.rows ?? []
    expect(rows.reduce((sum, r) => sum + r.height, 0) + 4).toBeCloseTo(
      page?.content.height ?? 0,
    )
  })

  it('computes exact page, content, column and row rects', () => {
    const [cover] = pageGridRects(middle, 0)
    expect(cover?.page).toEqual({ x: 0, y: 0, width: 300, height: 300 })
    expect(cover?.content).toEqual({ x: 30, y: 10, width: 258, height: 270 })
    expect(cover?.columns.map((c) => [c.x, c.y, c.width, c.height])).toEqual([
      [30, 10, 82, 270],
      [118, 10, 82, 270],
      [206, 10, 82, 270],
    ])
    expect(cover?.rows.map((r) => [r.x, r.y, r.width, r.height])).toEqual([
      [30, 10, 258, 133],
      [30, 147, 258, 133],
    ])
  })

  it('a single-spread book is one right-hand page', () => {
    const one = makeBook({
      layoutGrid: { margins: { top: 10, bottom: 20, inside: 30, outside: 12 } },
      spreads: [makeSpread({ id: 'only' })],
    })
    expect(pageGridRects(one, 0)[0]?.content.x).toBe(30)
  })

  it('offsets the right page of a facing spread by the trim width', () => {
    const pages = pageGridRects(middle, 1)
    expect(pages.map((p) => p.page.x)).toEqual([0, 300])
    expect(pages[1]?.columns[0]?.x).toBe(330)
  })

  it('never produces negative sizes for oversized gutters', () => {
    const [page] = pageGridRects(
      makeBook({ layoutGrid: { columns: 12, columnGutterMm: 200 } }),
      0,
    )
    expect(page?.columns.every((c) => c.width >= 0)).toBe(true)
  })

  it('uses the spread override values', () => {
    const book = makeBook({
      spreads: [makeSpread({ id: 's', layoutGrid: { columns: 5 } })],
    })
    expect(pageGridRects(book, 0)[0]?.columns).toHaveLength(5)
  })
})

import { describe, expect, it } from 'vitest'
import {
  type Book,
  type ParentSpread,
  resolveLayoutGrid,
  resolveParentGuides,
  resolveSpread,
} from './index'
import { makeBook, makeFrame, makeSpread } from './testing/fixtures'

// master-spread-both-pages: a two-page master (trim 300 mm) with a grid, a
// frame and a guide on each page, used by the first, an interior and the last
// spread.
const TRIM = 300

const master: ParentSpread = {
  id: 'master',
  name: 'Master A',
  layoutGrid: { columns: 3 },
  frames: [
    makeFrame({ id: 'm-left', rect: { x: 20, y: 20, width: 100, height: 80 } }),
    makeFrame({
      id: 'm-right',
      z: 1,
      rect: { x: TRIM + 20, y: 20, width: 100, height: 80 },
    }),
  ],
  guides: [
    { id: 'g-left', orientation: 'vertical', offsetMm: 50 },
    { id: 'g-right', orientation: 'vertical', offsetMm: TRIM + 50 },
  ],
}

function book(): Book {
  return makeBook({
    parents: [master],
    spreads: ['first', 'inner', 'last'].map((id) =>
      makeSpread({ id, parentId: 'master', frames: [] }),
    ),
  })
}

const parentIds = (b: Book, spreadId: string) =>
  resolveSpread(b, spreadId)
    ?.items.filter((item) => item.parent === true)
    .map((item) => item.frameId)

const guideIds = (b: Book, index: number) =>
  b.spreads
    .slice(index, index + 1)
    .flatMap((spread) => resolveParentGuides(b, spread))
    .map(({ guide }) => guide.id)

describe('a master on a two-page spread', () => {
  it('resolves its grid on both pages', () => {
    const { pages, values } = resolveLayoutGrid(book(), 1)

    expect(values.columns).toBe(3)
    expect(pages).toHaveLength(2)
    expect(pages.map((page) => page.columns.length)).toEqual([3, 3])
    expect(pages[1]?.page.x).toBe(TRIM)
    for (const column of pages[1]?.columns ?? []) {
      expect(column.x).toBeGreaterThanOrEqual(TRIM)
      expect(column.x + column.width).toBeLessThanOrEqual(2 * TRIM)
    }
  })

  it('resolves its frames and guides on both pages', () => {
    const b = book()
    const resolved = resolveSpread(b, 'inner')

    expect(resolved?.spreadWidthMm).toBe(2 * TRIM)
    expect(parentIds(b, 'inner')).toEqual(['m-left', 'm-right'])
    expect(guideIds(b, 1)).toEqual(['g-left', 'g-right'])
  })
})

describe.each([
  ['first', 0],
  ['last', 2],
])('a master on the single %s page', (spreadId, index) => {
  it('resolves its grid on the one page, no phantom page', () => {
    const { pages } = resolveLayoutGrid(book(), index)

    expect(pages).toHaveLength(1)
    expect(pages[0].page).toEqual({ x: 0, y: 0, width: TRIM, height: TRIM })
    expect(pages[0].columns).toHaveLength(3)
    for (const column of pages[0].columns) {
      expect(column.x + column.width).toBeLessThanOrEqual(TRIM)
    }
  })

  it('resolves its items on a one-page-wide spread', () => {
    const b = book()
    const resolved = resolveSpread(b, spreadId)

    expect(resolved?.spreadWidthMm).toBe(TRIM)
    expect(resolved?.pageCuts).toEqual([])
    expect(parentIds(b, spreadId)).toContain('m-left')
    expect(guideIds(b, index)).toContain('g-left')
  })
})

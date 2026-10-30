import { fc } from '@fast-check/vitest'
import { assert, describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../testing/fixtures'
import {
  GRID_FIELDS,
  clampGridValue,
  effectiveGrid,
  patchGridOverride,
  mergeLayoutGrid,
  resolveLayoutGrid,
} from './layoutGrid'

describe('clampGridValue non-finite input', () => {
  it.each([
    ['columns', 1],
    ['rows', 1],
    ['top', 0],
    ['inside', 0],
    ['columnGutterMm', 0],
  ] as const)('%s falls back to %s', (field, expected) => {
    expect(clampGridValue(field, Number.NaN)).toBe(expected)
    expect(clampGridValue(field, Number.POSITIVE_INFINITY)).toBe(expected)
  })
})

describe('mergeLayoutGrid', () => {
  it('returns the book grid itself without an override', () => {
    const book = makeBook()
    expect(mergeLayoutGrid(book, book.spreads[0])).toBe(book.layoutGrid)
  })

  it('applies every overridden field and inherits the rest', () => {
    const spread = makeSpread({
      layoutGrid: {
        columns: 7,
        rows: 6,
        columnGutterMm: 1,
        rowGutterMm: 2,
        margins: { top: 3, bottom: 4, inside: 5, outside: 6 },
      },
    })
    const book = makeBook({ spreads: [spread] })
    expect(mergeLayoutGrid(book, spread)).toEqual(spread.layoutGrid)
    const partial = makeSpread({ layoutGrid: { rowGutterMm: 9 } })
    expect(mergeLayoutGrid(book, partial)).toEqual({
      ...book.layoutGrid,
      rowGutterMm: 9,
    })
  })

  it('reads inside / outside from the page-scoped margins', () => {
    const book = makeBook({
      layoutGrid: { margins: { top: 1, bottom: 1, inside: 11, outside: 22 } },
    })
    const { values } = effectiveGrid(book)
    expect(values.inside).toBe(11)
    expect(values.outside).toBe(22)
  })
})

const threeSpreads = [
  makeSpread({ id: 'a' }),
  makeSpread({ id: 'b' }),
  makeSpread({ id: 'c' }),
]

describe('resolveLayoutGrid', () => {
  it('memoizes by spread reference and recomputes when the grid changes', () => {
    const book = makeBook({ spreads: threeSpreads })
    const first = resolveLayoutGrid(book, 1)
    expect(resolveLayoutGrid(book, 1)).toBe(first)
    const next = makeBook({
      spreads: threeSpreads,
      layoutGrid: { columns: 4 },
    })
    expect(resolveLayoutGrid(next, 1)).not.toBe(first)
    expect(resolveLayoutGrid(next, 1).pages[0].columns).toHaveLength(4)
  })

  it('recomputes for the same spread when trim, spread count or index change', () => {
    const [a, b, c] = threeSpreads
    assert(a && b && c)
    const book = makeBook({ spreads: [a, b, c] })
    const first = resolveLayoutGrid(book, 1)
    expect(first.pages.map((p) => p.page)).toEqual([
      { x: 0, y: 0, width: 300, height: 300 },
      { x: 300, y: 0, width: 300, height: 300 },
    ])

    const narrow = makeBook({
      spreads: [a, b, c],
      settings: { trim: { widthMm: 200, heightMm: 300 } },
    })
    expect(resolveLayoutGrid(narrow, 1).pages[0].page.width).toBe(200)

    const shorter = makeBook({ spreads: [a, b] })
    expect(resolveLayoutGrid(shorter, 1).pages).toHaveLength(1)

    const moved = makeBook({ spreads: [b, a, c] })
    expect(resolveLayoutGrid(moved, 0).pages).toHaveLength(1)
  })

  it('falls back to the book grid for an index without a spread', () => {
    const book = makeBook({ spreads: threeSpreads, layoutGrid: { columns: 5 } })
    expect(resolveLayoutGrid(book, 9).values.columns).toBe(5)
    expect(resolveLayoutGrid(book, 9).source.columns).toBe('book')
  })

  it('resolves a candidate spread that is not stored yet', () => {
    const book = makeBook({ spreads: threeSpreads })
    const candidate = makeSpread({ id: 'a', layoutGrid: { columns: 3 } })
    expect(resolveLayoutGrid(book, 0, candidate).pages[0].columns).toHaveLength(
      3,
    )
  })

  it('mirrors inside across a facing spread and splits single pages', () => {
    const book = makeBook({
      layoutGrid: { margins: { top: 10, bottom: 20, inside: 30, outside: 12 } },
      spreads: threeSpreads,
    })
    const pages = resolveLayoutGrid(book, 1).pages
    assert(pages.length === 2)
    const [left, right] = pages
    expect(left.content.x).toBe(12)
    expect(left.content.x + left.content.width).toBe(270)
    expect(right.content.x).toBe(330)
    expect(right.content.x + right.content.width).toBe(588)
    expect(resolveLayoutGrid(book, 0).pages[0].content.x).toBe(30)
    expect(resolveLayoutGrid(book, 2).pages[0].content.x).toBe(12)
  })
})

const mm = fc.integer({ min: 0, max: 40 })

describe('resolveLayoutGrid properties', () => {
  const arbBook = fc.record({
    top: mm,
    bottom: mm,
    inside: mm,
    outside: mm,
    columns: fc.integer({ min: 1, max: 12 }),
    rows: fc.integer({ min: 1, max: 12 }),
    cg: fc.integer({ min: 0, max: 5 }),
    rg: fc.integer({ min: 0, max: 5 }),
    spreads: fc.integer({ min: 1, max: 5 }),
    index: fc.nat(),
  })

  function build(a: typeof arbBook extends fc.Arbitrary<infer T> ? T : never) {
    const book = makeBook({
      layoutGrid: {
        columns: a.columns,
        rows: a.rows,
        columnGutterMm: a.cg,
        rowGutterMm: a.rg,
        margins: {
          top: a.top,
          bottom: a.bottom,
          inside: a.inside,
          outside: a.outside,
        },
      },
      spreads: Array.from({ length: a.spreads }, (_, i) =>
        makeSpread({ id: `s${String(i)}` }),
      ),
    })
    return { book, index: a.index % a.spreads }
  }

  it('cells tile the content box', () => {
    fc.assert(
      fc.property(arbBook, (a) => {
        const { book, index } = build(a)
        for (const page of resolveLayoutGrid(book, index).pages) {
          const { content, columns, rows } = page
          const colSum =
            columns.reduce((s, c) => s + c.width, 0) + (a.columns - 1) * a.cg
          const rowSum =
            rows.reduce((s, r) => s + r.height, 0) + (a.rows - 1) * a.rg
          expect(colSum).toBeCloseTo(content.width, 6)
          expect(rowSum).toBeCloseTo(content.height, 6)
          expect(columns[0]?.x).toBeCloseTo(content.x, 6)
          const lastCol = columns[columns.length - 1]
          expect((lastCol?.x ?? 0) + (lastCol?.width ?? 0)).toBeCloseTo(
            content.x + content.width,
            6,
          )
          const lastRow = rows[rows.length - 1]
          expect((lastRow?.y ?? 0) + (lastRow?.height ?? 0)).toBeCloseTo(
            content.y + content.height,
            6,
          )
        }
      }),
    )
  })

  it('facing pages mirror about the spine', () => {
    fc.assert(
      fc.property(arbBook, (a) => {
        const count = Math.max(3, a.spreads)
        const { book } = build({ ...a, spreads: count })
        const mid = 1 + (a.index % (count - 2))
        const pages = resolveLayoutGrid(book, mid).pages
        assert(pages.length === 2)
        const [left, right] = pages
        const w = book.settings.trim.widthMm
        expect(right.content.x - w).toBeCloseTo(
          w - (left.content.x + left.content.width),
          6,
        )
        expect(right.content.width).toBeCloseTo(left.content.width, 6)
      }),
    )
  })
})

describe('patchGridOverride', () => {
  it('keeps earlier overrides and margins when patching another field', () => {
    const first = patchGridOverride(undefined, { columns: 4, inside: 20 })
    const second = patchGridOverride(first, { rows: 3, outside: 8 })
    expect(second).toEqual({
      columns: 4,
      rows: 3,
      margins: { inside: 20, outside: 8 },
    })
  })

  it('writes no margins key for non-margin patches', () => {
    expect(patchGridOverride(undefined, { columns: 5 })).toEqual({ columns: 5 })
  })

  it('clamps patched values', () => {
    expect(patchGridOverride(undefined, { columns: 99, top: -1 })).toEqual({
      columns: 12,
      margins: { top: 0 },
    })
  })
})

describe('GRID_FIELDS', () => {
  it('lists the eight inspector fields', () => {
    expect(GRID_FIELDS).toHaveLength(8)
  })
})

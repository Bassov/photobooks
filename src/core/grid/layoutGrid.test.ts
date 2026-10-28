import { describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../testing/fixtures'
import {
  GRID_FIELDS,
  clampGridValue,
  effectiveGrid,
  patchGridOverride,
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

describe('resolveLayoutGrid', () => {
  it('returns the book grid itself without an override', () => {
    const book = makeBook()
    expect(resolveLayoutGrid(book, book.spreads[0])).toBe(book.layoutGrid)
  })

  it('applies every overridden field and inherits the rest', () => {
    const spread = makeSpread({
      layoutGrid: {
        columns: 7,
        rows: 6,
        columnGutterMm: 1,
        rowGutterMm: 2,
        margins: { top: 3, bottom: 4, left: 5, right: 6 },
      },
    })
    const book = makeBook({ spreads: [spread] })
    expect(resolveLayoutGrid(book, spread)).toEqual(spread.layoutGrid)
    const partial = makeSpread({ layoutGrid: { rowGutterMm: 9 } })
    expect(resolveLayoutGrid(book, partial)).toEqual({
      ...book.layoutGrid,
      rowGutterMm: 9,
    })
  })

  it('maps inside / outside onto left / right margins', () => {
    const book = makeBook({
      layoutGrid: { margins: { top: 1, bottom: 1, left: 11, right: 22 } },
    })
    const { values } = effectiveGrid(book)
    expect(values.inside).toBe(11)
    expect(values.outside).toBe(22)
  })
})

describe('patchGridOverride', () => {
  it('keeps earlier overrides and margins when patching another field', () => {
    const first = patchGridOverride(undefined, { columns: 4, inside: 20 })
    const second = patchGridOverride(first, { rows: 3, outside: 8 })
    expect(second).toEqual({
      columns: 4,
      rows: 3,
      margins: { left: 20, right: 8 },
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

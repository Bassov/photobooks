import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Book } from '../core'
import {
  buildAssetRows,
  rowWindow,
  sortAssetRows,
  usesLabel,
  type AssetRow,
} from './assetsPanelModel'

function book(): Book {
  return {
    schemaVersion: 1,
    id: 'b',
    settings: {
      trim: { widthMm: 100, heightMm: 100 },
      bleedMm: 3,
      safeMarginMm: 5,
    },
    layoutGrid: { columns: 1, rows: 1, gutterMm: 0 },
    guides: [],
    assets: { a: {}, b: {}, c: {} },
    gallery: ['a', 'b', 'c'],
    spreads: [
      {
        id: 's1',
        frames: [
          { id: 'f1', rect: { x: 0, y: 0, w: 1, h: 1 }, z: 0, assetId: 'b' },
          { id: 'f2', rect: { x: 0, y: 0, w: 1, h: 1 }, z: 1, assetId: 'b' },
        ],
      },
      {
        id: 's2',
        frames: [
          { id: 'f3', rect: { x: 0, y: 0, w: 1, h: 1 }, z: 0, assetId: 'b' },
          { id: 'f4', rect: { x: 0, y: 0, w: 1, h: 1 }, z: 1, assetId: 'c' },
        ],
      },
    ],
  } as unknown as Book
}

const row = (assetId: string, uses: number, status: AssetRow['status']) =>
  ({
    assetId,
    uses,
    status,
    spreads: [],
    jumpSpreadId: null,
  }) satisfies AssetRow

describe('assetsPanelModel', () => {
  it('builds rows with uses, spreads and first jump target', () => {
    const rows = buildAssetRows(book(), new Map([['c', 'modified']]))
    expect(rows.map((r) => r.assetId)).toEqual(['a', 'b', 'c'])
    expect(rows[0]).toMatchObject({ uses: 0, status: 'ok', jumpSpreadId: null })
    expect(rows[1]).toMatchObject({
      uses: 3,
      spreads: [1, 2],
      jumpSpreadId: 's1',
    })
    expect(rows[2]).toMatchObject({
      status: 'modified',
      spreads: [2],
      jumpSpreadId: 's2',
    })
  })

  it('labels usage', () => {
    expect(usesLabel(row('a', 0, 'ok'))).toBe('unused')
    expect(usesLabel({ ...row('a', 2, 'ok'), spreads: [1, 3] })).toBe(
      '2× · spread 1, 3',
    )
  })

  it('sorts by status then uses, and by uses; ties keep gallery order', () => {
    const rows = [
      row('a', 1, 'ok'),
      row('b', 0, 'missing'),
      row('c', 5, 'ok'),
      row('d', 0, 'modified'),
      row('e', 1, 'ok'),
    ]
    expect(sortAssetRows(rows, 'status').map((r) => r.assetId)).toEqual([
      'b',
      'd',
      'c',
      'a',
      'e',
    ])
    expect(sortAssetRows(rows, 'uses').map((r) => r.assetId)).toEqual([
      'c',
      'a',
      'e',
      'b',
      'd',
    ])
  })

  it('sort is a permutation and does not mutate input', () => {
    const statusArb = fc.constantFrom('ok', 'missing', 'modified' as const)
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat(5), statusArb), { maxLength: 40 }),
        fc.constantFrom('status', 'uses' as const),
        (specs, sort) => {
          const rows = specs.map(([uses, status], i) =>
            row(String(i), uses, status),
          )
          const before = rows.map((r) => r.assetId)
          const sorted = sortAssetRows(rows, sort)
          expect(rows.map((r) => r.assetId)).toEqual(before)
          expect(sorted.map((r) => r.assetId).sort()).toEqual(
            [...before].sort(),
          )
        },
      ),
    )
  })

  it('windows rows with overscan and clamps to count', () => {
    expect(rowWindow(0, 100, 1000, 50, 2)).toEqual({ start: 0, end: 4 })
    expect(rowWindow(500, 100, 1000, 50, 2)).toEqual({ start: 8, end: 14 })
    expect(rowWindow(99999, 100, 10, 50, 2)).toEqual({ start: 10, end: 10 })
    expect(rowWindow(0, 100, 0)).toEqual({ start: 0, end: 0 })
  })

  it('window stays in bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -50, max: 100000 }),
        fc.nat(2000),
        fc.nat(3000),
        (top, vp, count) => {
          const w = rowWindow(top, vp, count)
          expect(w.start).toBeGreaterThanOrEqual(0)
          expect(w.start).toBeLessThanOrEqual(w.end)
          expect(w.end).toBeLessThanOrEqual(count)
        },
      ),
    )
  })
})

import { describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import {
  buildGridAnchors,
  GRID_SNAP_PULL_PX,
  snapEdgesToGrid,
  type GridSnapOptions,
} from './gridSnap'

// 300 mm pages, 10 mm margins, 3 columns of 80 mm with 10 mm gutters, 2 rows.
const book = makeBook({
  layoutGrid: {
    columns: 3,
    rows: 2,
    columnGutterMm: 5,
    rowGutterMm: 10,
    margins: { top: 10, bottom: 10, left: 10, right: 10 },
  },
  spreads: [
    makeSpread({ id: 'a' }),
    makeSpread({ id: 'b' }),
    makeSpread({ id: 'c' }),
  ],
})
const anchors = buildGridAnchors(book, 1)
const on: GridSnapOptions = {
  gridVisible: true,
  snapOn: true,
  altKey: false,
  pxPerMm: 1,
}

describe('buildGridAnchors', () => {
  it('lists band edges of both pages with 1-based labels', () => {
    const xs = anchors.x.map((a) => [a.mm, a.label])
    expect(xs).toContainEqual([10, 'column 1'])
    expect(xs).toContainEqual([105, 'column 2'])
    expect(xs).toContainEqual([310, 'column 1'])
    expect(anchors.x).toHaveLength(12)
    expect(anchors.y.map((a) => a.label)).toContain('row 2')
    expect(anchors.y).toHaveLength(8)
  })
})

describe('snapEdgesToGrid', () => {
  it('pulls an edge within 16 CSS px and labels the column', () => {
    const hit = snapEdgesToGrid(anchors, [107], [], on)
    expect(hit).toEqual({ dx: -2, dy: 0, label: 'snap · column 2' })
    const edge = snapEdgesToGrid(anchors, [10 + GRID_SNAP_PULL_PX], [], on)
    expect(edge?.dx).toBe(-GRID_SNAP_PULL_PX)
    expect(snapEdgesToGrid(anchors, [10 + GRID_SNAP_PULL_PX + 1], [], on)).toBe(
      null,
    )
  })

  it('scales the pull by zoom (CSS px, not mm)', () => {
    const zoomed = { ...on, pxPerMm: 4 }
    expect(snapEdgesToGrid(anchors, [10 + 5], [], zoomed)).toBeNull()
    expect(snapEdgesToGrid(anchors, [10 + 3], [], zoomed)?.dx).toBe(-3)
  })

  it('snaps rows and prefers the column label when both axes hit', () => {
    const rowOnly = snapEdgesToGrid(anchors, [], [12], on)
    expect(rowOnly).toEqual({ dx: 0, dy: -2, label: 'snap · row 1' })
    const both = snapEdgesToGrid(anchors, [11], [12], on)
    expect(both).toEqual({ dx: -1, dy: -2, label: 'snap · column 1' })
  })

  it('keeps the first anchor on an exact tie', () => {
    // 102.5 sits midway between column 1's right edge (100) and column 2's left (105).
    expect(snapEdgesToGrid(anchors, [102.5], [], on)).toEqual({
      dx: -2.5,
      dy: 0,
      label: 'snap · column 1',
    })
  })

  it('picks the closest of several edges', () => {
    const hit = snapEdgesToGrid(anchors, [20, 98], [], on)
    expect(hit?.dx).toBe(2)
  })

  it('does not snap with the grid hidden, snap off, or Alt held', () => {
    expect(
      snapEdgesToGrid(anchors, [11], [], { ...on, gridVisible: false }),
    ).toBe(null)
    expect(snapEdgesToGrid(anchors, [11], [], { ...on, snapOn: false })).toBe(
      null,
    )
    expect(snapEdgesToGrid(anchors, [11], [], { ...on, altKey: true })).toBe(
      null,
    )
  })
})

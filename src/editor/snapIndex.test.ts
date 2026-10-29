import { describe, expect, it } from 'vitest'
import {
  FRAME_SNAP_PULL_PX,
  buildSnapIndex,
  snapEdges,
  snapPoint,
  snapRect,
} from './snapIndex'

const OPTS = { pxPerMm: 1, altKey: false }

const A = { x: 100, y: 100, width: 50, height: 50 }

describe('snapRect', () => {
  it('pulls a dragged edge onto a nearby frame edge', () => {
    const index = buildSnapIndex([A], [])
    const result = snapRect(
      index,
      { x: 153, y: 300, width: 20, height: 20 },
      OPTS,
    )
    expect(result.dx).toBe(-3)
    expect(result.dy).toBe(0)
    expect(result.lines).toEqual([{ axis: 'x', mm: 150, kind: 'frame' }])
  })

  it('snaps centers and reports the kind', () => {
    const index = buildSnapIndex([A], [])
    const result = snapRect(
      index,
      { x: 0, y: 117, width: 20, height: 20 },
      OPTS,
    )
    // y center 127 -> 125 (frame center); top 117 is 17 away from 100.
    expect(result.dy).toBe(-2)
    expect(result.lines).toEqual([{ axis: 'y', mm: 125, kind: 'frame center' }])
  })

  it('does nothing beyond the pull distance', () => {
    const index = buildSnapIndex([A], [])
    const far = 150 + FRAME_SNAP_PULL_PX + 1
    const result = snapRect(
      index,
      { x: far, y: 400, width: 20, height: 20 },
      OPTS,
    )
    expect(result).toEqual({ dx: 0, dy: 0, lines: [], hint: null })
  })

  it('reach shrinks as the camera zooms in', () => {
    const index = buildSnapIndex([A], [])
    const rect = { x: 156, y: 400, width: 20, height: 20 }
    expect(snapRect(index, rect, OPTS).dx).toBe(-6)
    expect(snapRect(index, rect, { ...OPTS, pxPerMm: 4 }).dx).toBe(0)
  })

  it('Alt suppresses snapping', () => {
    const index = buildSnapIndex([A], [])
    const result = snapRect(
      index,
      { x: 153, y: 100, width: 20, height: 20 },
      { ...OPTS, altKey: true },
    )
    expect(result).toEqual({ dx: 0, dy: 0, lines: [], hint: null })
  })

  it('snaps to guides by orientation', () => {
    const index = buildSnapIndex(
      [],
      [
        { orientation: 'vertical', offsetMm: 60 },
        { orientation: 'horizontal', offsetMm: 80 },
      ],
    )
    const result = snapRect(
      index,
      { x: 57, y: 83, width: 20, height: 20 },
      OPTS,
    )
    expect(result.dx).toBe(3)
    expect(result.dy).toBe(-3)
    expect(result.lines.map((l) => l.kind)).toEqual(['guide', 'guide'])
  })

  it('snaps to an equal gap on the matching edge only', () => {
    const b = { x: 160, y: 100, width: 50, height: 50 }
    // Existing gap A→B is 10 mm. Moving frame left of A: its right edge goes
    // 10 mm before A.left (90); its left edge must not catch that anchor.
    const index = buildSnapIndex([A, b], [])
    const result = snapRect(
      index,
      { x: 36, y: 100, width: 50, height: 50 },
      OPTS,
    )
    expect(result.dx).toBe(4)
    expect(result.lines).toContainEqual({
      axis: 'x',
      mm: 90,
      kind: 'equal gap',
    })
  })

  it('ignores gaps between frames that do not overlap across', () => {
    const b = { x: 160, y: 400, width: 50, height: 50 }
    const index = buildSnapIndex([A, b], [])
    const result = snapRect(
      index,
      { x: 36, y: 700, width: 50, height: 50 },
      OPTS,
    )
    expect(result.lines.some((l) => l.kind === 'equal gap')).toBe(false)
  })

  it('finds the same hit as a linear scan on a dense spread', () => {
    const frames = Array.from({ length: 100 }, (_, i) => ({
      x: (i % 10) * 12,
      y: Math.floor(i / 10) * 12,
      width: 10,
      height: 10,
    }))
    const index = buildSnapIndex(frames, [])
    const edges = [...new Set(frames.flatMap((f) => [f.x, f.x + f.width]))]
    for (let x = 0; x <= 118; x += 1) {
      const rect = { x, y: 500, width: 0.1, height: 0.1 }
      const { dx } = snapRect(index, rect, OPTS)
      // No hit is farther than the nearest frame edge, and a snapped rect
      // is already on its anchor.
      const nearestEdge = Math.min(...edges.map((e) => Math.abs(e - x)))
      expect(Math.abs(dx)).toBeLessThanOrEqual(nearestEdge)
      expect(snapRect(index, { ...rect, x: x + dx }, OPTS).dx).toBeCloseTo(0)
    }
  })
})

describe('snapRect · anchors', () => {
  const rectAt = (x: number, y: number, width = 50, height = 50) => ({
    x,
    y,
    width,
    height,
  })

  it('snaps to a frame center on x', () => {
    const index = buildSnapIndex([A], [])
    const result = snapRect(index, rectAt(117, 400, 20, 20), OPTS)
    expect(result.dx).toBe(-2)
    expect(result.lines).toEqual([{ axis: 'x', mm: 125, kind: 'frame center' }])
  })

  it('snaps the start edge to the far side of a neighbour at the shared gap', () => {
    const left = { x: 100, y: 100, width: 50, height: 50 }
    const right = { x: 160, y: 100, width: 50, height: 50 }
    const index = buildSnapIndex([left, right], [])
    // right.right + gap (10) = 220.
    const result = snapRect(index, rectAt(221.5, 400, 20, 20), OPTS)
    expect(result.dx).toBe(-1.5)
    expect(result.lines).toContainEqual({
      axis: 'x',
      mm: 220,
      kind: 'equal gap',
    })
  })

  it('snaps equal gaps on y for stacked frames', () => {
    const top = { x: 100, y: 100, width: 50, height: 50 }
    const bottom = { x: 100, y: 160, width: 50, height: 50 }
    const index = buildSnapIndex([top, bottom], [])
    // top.top - gap (10) = 90 for the moving frame's bottom edge.
    const result = snapRect(index, rectAt(400, 41.5), OPTS)
    expect(result.dy).toBe(-1.5)
    expect(result.dx).toBe(0)
    expect(result.lines).toContainEqual({
      axis: 'y',
      mm: 90,
      kind: 'equal gap',
    })
  })

  it('ignores gaps between frames whose cross ranges only touch', () => {
    const lowLeft = { x: 100, y: 150, width: 50, height: 50 }
    const highRight = { x: 160, y: 100, width: 50, height: 50 }
    const lowRight = { x: 160, y: 150, width: 50, height: 50 }
    const highLeft = { x: 100, y: 100, width: 50, height: 50 }
    for (const frames of [
      [lowLeft, highRight],
      [highLeft, lowRight],
    ]) {
      const index = buildSnapIndex(frames, [])
      // The gap anchor would sit at 90; the nearest real anchor is 8.5 away.
      const result = snapRect(index, rectAt(41.5, 400), OPTS)
      expect(result.lines).toEqual([])
    }
  })

  it('an end-only gap anchor is not caught by the start edge', () => {
    const a = { x: 500, y: 100, width: 10, height: 10 }
    const b = { x: 520, y: 100, width: 10, height: 10 }
    const index = buildSnapIndex([a, b], [])
    // 490 = a.left - 10 is an end anchor; the start edge sits 1 mm from it.
    const result = snapRect(index, rectAt(489, 400, 1000, 20), OPTS)
    expect(result.dx).toBe(0)
    expect(result.lines).toEqual([])
  })

  it('reaches exactly the pull distance and no farther', () => {
    const index = buildSnapIndex([A], [])
    expect(snapRect(index, rectAt(158, 400, 20, 20), OPTS).dx).toBe(-8)
    expect(snapRect(index, rectAt(158.5, 400, 20, 20), OPTS).dx).toBe(0)
  })

  it('on a tie the earlier anchor kind wins (frame edge before guide)', () => {
    const index = buildSnapIndex(
      [A],
      [{ orientation: 'vertical', offsetMm: 100 }],
    )
    const result = snapRect(index, rectAt(98, 400, 20, 20), OPTS)
    expect(result.dx).toBe(2)
    expect(result.lines[0]?.kind).toBe('frame')
  })
})

describe('page anchors', () => {
  const OUT = { x: 120, y: 120, width: 20, height: 20 }
  const facing = { widthMm: 400, heightMm: 300, pageCount: 2 }

  it('snaps to the trim edge', () => {
    const index = buildSnapIndex([], [], facing)
    const result = snapRect(index, { ...OUT, x: 3, y: 50 }, OPTS)
    expect(result.dx).toBe(-3)
    expect(result.lines[0]).toEqual({ axis: 'x', mm: 0, kind: 'trim' })
  })

  it('names the spine and the page centers on facing pages', () => {
    const index = buildSnapIndex([], [], facing)
    const kinds = (x: number) =>
      snapRect(index, { x, y: 50, width: 0.001, height: 20 }, OPTS).lines.find(
        (line) => line.axis === 'x',
      )?.kind
    expect(kinds(201)).toBe('spine')
    expect(kinds(101)).toBe('page center')
    expect(kinds(299)).toBe('page center')
  })

  it('uses center for a lone page and for the vertical middle', () => {
    const index = buildSnapIndex([], [], { ...facing, pageCount: 1 })
    const lines = snapRect(
      index,
      { x: 191, y: 141, width: 20, height: 20 },
      OPTS,
    ).lines
    expect(lines.map((line) => line.kind)).toEqual(['center', 'center'])
  })

  it('has no page anchors without a page', () => {
    const index = buildSnapIndex([], [])
    expect(snapRect(index, { ...OUT, x: 1 }, OPTS).lines).toEqual([])
  })
})

describe('snapEdges', () => {
  const index = buildSnapIndex([A], [])
  const rect = { x: 20, y: 20, width: 83, height: 83 }

  it('probes only the moving edges', () => {
    const none = { left: false, right: false, top: false, bottom: false }
    expect(snapEdges(index, rect, none, OPTS).lines).toEqual([])
    const right = snapEdges(index, rect, { ...none, right: true }, OPTS)
    expect(right.dx).toBe(-3)
    expect(right.lines).toEqual([{ axis: 'x', mm: 100, kind: 'frame' }])
  })

  it('each moving edge probes on its own axis side', () => {
    const none = { left: false, right: false, top: false, bottom: false }
    const near = { x: 103, y: 103, width: 83, height: 83 }
    const left = snapEdges(index, near, { ...none, left: true }, OPTS)
    expect(left).toEqual({
      dx: -3,
      dy: 0,
      lines: [{ axis: 'x', mm: 100, kind: 'frame' }],
      hint: null,
    })
    const top = snapEdges(index, near, { ...none, top: true }, OPTS)
    expect(top).toEqual({
      dx: 0,
      dy: -3,
      lines: [{ axis: 'y', mm: 100, kind: 'frame' }],
      hint: null,
    })
    expect(
      snapEdges(index, near, { ...none, right: true, bottom: true }, OPTS)
        .lines,
    ).toEqual([])
  })

  it('snaps the bottom edge onto a frame bottom', () => {
    const none = { left: false, right: false, top: false, bottom: false }
    const result = snapEdges(
      index,
      { x: 20, y: 20, width: 83, height: 133 },
      { ...none, bottom: true },
      OPTS,
    )
    expect(result.dy).toBe(-3)
    expect(result.lines).toEqual([{ axis: 'y', mm: 150, kind: 'frame' }])
  })

  it('Alt suppresses it', () => {
    const all = { left: true, right: true, top: true, bottom: true }
    expect(
      snapEdges(index, rect, all, { ...OPTS, altKey: true }).lines,
    ).toEqual([])
  })
})

describe('snapPoint', () => {
  it('pulls the draw corner onto an anchor on each axis', () => {
    const index = buildSnapIndex([A], [])
    const result = snapPoint(index, { x: 148, y: 103 }, OPTS)
    expect(result.dx).toBe(2)
    expect(result.dy).toBe(-3)
    expect(result.lines).toHaveLength(2)
  })

  it('Alt suppresses it', () => {
    const index = buildSnapIndex([A], [])
    expect(
      snapPoint(index, { x: 148, y: 103 }, { ...OPTS, altKey: true }).lines,
    ).toEqual([])
  })
})

describe('grid anchors', () => {
  const grid = {
    x: [
      { mm: 40, label: 'column 1' },
      { mm: 80, label: 'column 1' },
    ],
    y: [{ mm: 60, label: 'row 2' }],
  }
  const GRID_OPTS = { ...OPTS, grid: true }
  const none = { left: false, right: false, top: false, bottom: false }

  it('pulls a moved edge to a column with the column pill', () => {
    const index = buildSnapIndex([], [], undefined, grid)
    const result = snapRect(
      index,
      { x: 52, y: 300, width: 20, height: 20 },
      GRID_OPTS,
    )
    // right edge 72 -> 80 (8 away); left 52 is 12 away from 40.
    expect(result.dx).toBe(8)
    expect(result.lines).toEqual([{ axis: 'x', mm: 80, kind: 'grid' }])
    expect(result.hint).toBe('snap · column 1')
  })

  it('reaches the 16 px grid pull, scaled by zoom, and not farther', () => {
    const index = buildSnapIndex([], [], undefined, grid)
    const at = (x: number, pxPerMm = 1) =>
      snapRect(
        index,
        { x, y: 300, width: 5, height: 5 },
        { ...GRID_OPTS, pxPerMm },
      ).dx
    expect(at(56)).toBe(-16)
    expect(at(56.5)).toBe(0)
    expect(at(56, 2)).toBe(0)
  })

  it('snaps rows and labels them', () => {
    const index = buildSnapIndex([], [], undefined, grid)
    const result = snapRect(
      index,
      { x: 300, y: 52, width: 5, height: 5 },
      GRID_OPTS,
    )
    expect(result.dy).toBe(3)
    expect(result.hint).toBe('snap · row 2')
  })

  it('snaps a resized edge to the grid', () => {
    const index = buildSnapIndex([], [], undefined, grid)
    const result = snapEdges(
      index,
      { x: 10, y: 10, width: 66, height: 20 },
      { ...none, right: true },
      GRID_OPTS,
    )
    expect(result.dx).toBe(4)
    expect(result.hint).toBe('snap · column 1')
  })

  it('does not snap the center to the grid', () => {
    const index = buildSnapIndex([], [], undefined, grid)
    const result = snapRect(
      index,
      { x: 300, y: 300, width: 2, height: 2 },
      GRID_OPTS,
    )
    expect(result.hint).toBeNull()
    const centered = snapRect(
      index,
      { x: 100, y: 300, width: 40, height: 5 },
      GRID_OPTS,
    )
    // center 120 is far from 80/40; edges 100 / 140 are 20 / 60 away.
    expect(centered.dx).toBe(0)
    const mid = snapRect(
      index,
      { x: 70, y: 300, width: 20, height: 5 },
      GRID_OPTS,
    )
    // center 80 would be a hit; edges 70 / 90 are 10 away from 80.
    expect(mid.dx).toBe(10)
  })

  it('is inert unless grid is requested, and under Alt', () => {
    const index = buildSnapIndex([], [], undefined, grid)
    const rect = { x: 52, y: 55, width: 20, height: 20 }
    expect(snapRect(index, rect, OPTS).hint).toBeNull()
    expect(snapRect(index, rect, OPTS).lines).toEqual([])
    expect(
      snapRect(index, rect, { ...GRID_OPTS, altKey: true }).hint,
    ).toBeNull()
  })

  it('never overrides a frame or page snap', () => {
    const index = buildSnapIndex(
      [{ x: 100, y: 0, width: 10, height: 10 }],
      [],
      undefined,
      grid,
    )
    // right edge 78: grid 80 is 2 away, frame edge 100 is 22 away -> grid.
    // left edge 98 snaps to the frame (2 away) though grid 80 is 18 away.
    const frameWins = snapRect(
      index,
      { x: 98, y: 300, width: 3, height: 5 },
      GRID_OPTS,
    )
    expect(frameWins.lines).toEqual([{ axis: 'x', mm: 100, kind: 'frame' }])
    expect(frameWins.hint).toBeNull()
    // Frame anchor within 8 beats a nearer grid anchor.
    const nearGrid = snapRect(
      index,
      { x: 92, y: 300, width: 8, height: 5 },
      GRID_OPTS,
    )
    expect(nearGrid.lines[0]).toEqual({ axis: 'x', mm: 100, kind: 'frame' })
  })

  it('adds at most one line per axis', () => {
    const index = buildSnapIndex([], [], undefined, grid)
    const result = snapRect(
      index,
      { x: 38, y: 58, width: 40, height: 4 },
      GRID_OPTS,
    )
    expect(result.lines.filter((l) => l.axis === 'x')).toHaveLength(1)
    expect(result.lines.filter((l) => l.axis === 'y')).toHaveLength(1)
  })
})

describe('query budget', () => {
  it('stays well under a millisecond on a dense spread', () => {
    const frames = Array.from({ length: 60 }, (_, i) => ({
      x: (i % 10) * 40,
      y: Math.floor(i / 10) * 45,
      width: 35,
      height: 40,
    }))
    const index = buildSnapIndex(frames, [], {
      widthMm: 420,
      heightMm: 297,
      pageCount: 2,
    })
    const rounds = 2000
    const t0 = performance.now()
    for (let i = 0; i < rounds; i += 1) {
      snapRect(index, { x: 100 + (i % 7), y: 98, width: 35, height: 40 }, OPTS)
    }
    expect((performance.now() - t0) / rounds).toBeLessThan(0.5)
  })
})

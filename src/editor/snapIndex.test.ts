import { describe, expect, it } from 'vitest'
import {
  FRAME_SNAP_PULL_PX,
  buildSnapIndex,
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
    expect(result.lines).toEqual([{ axis: 'x', mm: 150, kind: 'frame edge' }])
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
    expect(result).toEqual({ dx: 0, dy: 0, lines: [] })
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
    expect(result).toEqual({ dx: 0, dy: 0, lines: [] })
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
    expect(result.lines[0]?.kind).toBe('frame edge')
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

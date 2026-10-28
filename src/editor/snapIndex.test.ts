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

  it('stays fast on a dense spread', () => {
    const frames = Array.from({ length: 200 }, (_, i) => ({
      x: (i % 20) * 12,
      y: Math.floor(i / 20) * 12,
      width: 10,
      height: 10,
    }))
    const index = buildSnapIndex(frames, [])
    const start = performance.now()
    for (let i = 0; i < 1000; i += 1) {
      snapRect(index, { x: i % 240, y: i % 120, width: 10, height: 10 }, OPTS)
    }
    expect((performance.now() - start) / 1000).toBeLessThan(0.5)
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

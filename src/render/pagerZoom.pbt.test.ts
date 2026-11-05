import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import {
  clampPan,
  fitArea,
  fitBox,
  fitInsets,
  settle,
  ZOOM_MAX,
  zoomAt,
  type Rect,
  type Zoom,
} from './pagerZoom'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

interface Stage {
  box: Rect
  area: Rect
}

const FAR = 1e7

const STEPS = 1_000_000

/** Uniform in [min, max] (fc.double clusters at the ends). */
const dim = (min: number, max: number) =>
  fc.integer({ min: 0, max: STEPS }).map((i) => min + ((max - min) * i) / STEPS)

const stage: fc.Arbitrary<Stage> = fc
  .record({
    content: fc.record({ w: dim(50, 1000), h: dim(50, 1000) }),
    view: fc.record({ w: dim(320, 3000), h: dim(320, 2000) }),
    hover: fc.boolean(),
  })
  .map(({ content, view, hover }) => ({
    box: fitBox(content, view, fitInsets(hover)),
    area: fitArea(view, fitInsets(hover)),
  }))

const rawZoom = fc.record({
  z: dim(1, ZOOM_MAX),
  x: dim(-5000, 5000),
  y: dim(-5000, 5000),
})

/** z plus where the pan sits inside its clamp range (0 = low end, 1 = high). */
const spot = fc.record({ z: dim(1, ZOOM_MAX), tx: dim(0, 1), ty: dim(0, 1) })

const factor = dim(0.4, 2.5)
const point = fc.record({ px: dim(0, 3000), py: dim(0, 2000) })

/** The pan range at zoom `z`, read off clampPan at far-away pans. */
function range(z: number, { box, area }: Stage) {
  const lo = clampPan({ z, x: -FAR, y: -FAR }, box, area)
  const hi = clampPan({ z, x: FAR, y: FAR }, box, area)
  return { lo, hi }
}

function inRange(
  { z, tx, ty }: { z: number; tx: number; ty: number },
  st: Stage,
): Zoom {
  const { lo, hi } = range(z, st)
  return { z, x: lo.x + tx * (hi.x - lo.x), y: lo.y + ty * (hi.y - lo.y) }
}

/** `zoomAt(from, f)` landed on `from.z × f` with the pan strictly inside. */
function unclamped(from: Zoom, f: number, next: Zoom, st: Stage): boolean {
  const { lo, hi } = range(next.z, st)
  return (
    next.z === from.z * f &&
    lo.x < next.x &&
    next.x < hi.x &&
    lo.y < next.y &&
    next.y < hi.y
  )
}

describe('pagerZoom (property)', () => {
  it('keeps z in [1, ZOOM_MAX] and has no pan at z = 1', () => {
    fc.assert(
      fc.property(stage, rawZoom, factor, point, (st, raw, f, { px, py }) => {
        const from = clampPan(raw, st.box, st.area)
        const next = zoomAt(from, f, px, py, st.box, st.area)
        expect(next.z).toBeGreaterThanOrEqual(1)
        expect(next.z).toBeLessThanOrEqual(ZOOM_MAX)
        for (const zoom of [next, settle(next)]) {
          if (zoom.z === 1) {
            expect(zoom.x).toBe(0)
            expect(zoom.y).toBe(0)
          }
        }
      }),
      runs,
    )
  })

  it('clamps any pan to no pan at z = 1', () => {
    fc.assert(
      fc.property(stage, rawZoom, (st, raw) => {
        expect(clampPan({ ...raw, z: 1 }, st.box, st.area)).toEqual({
          z: 1,
          x: 0,
          y: 0,
        })
      }),
      runs,
    )
  })

  it('clampPan is idempotent', () => {
    fc.assert(
      fc.property(stage, rawZoom, (st, raw) => {
        const once = clampPan(raw, st.box, st.area)
        expect(clampPan(once, st.box, st.area)).toEqual(once)
      }),
      runs,
    )
  })

  it('unclamped zoomAt keeps the anchor point within 0.01 px', () => {
    fc.assert(
      fc.property(stage, spot, factor, point, (st, at, f, { px, py }) => {
        const from = inRange(at, st)
        const next = zoomAt(from, f, px, py, st.box, st.area)
        fc.pre(unclamped(from, f, next, st))
        const u = (px - st.box.x - from.x) / from.z
        const v = (py - st.box.y - from.y) / from.z
        expect(
          Math.abs(st.box.x + next.x + u * next.z - px),
        ).toBeLessThanOrEqual(0.01)
        expect(
          Math.abs(st.box.y + next.y + v * next.z - py),
        ).toBeLessThanOrEqual(0.01)
      }),
      runs,
    )
  })

  it('zooming back by 1/f about the same point restores the state', () => {
    fc.assert(
      fc.property(stage, spot, factor, point, (st, at, f, { px, py }) => {
        const from = inRange(at, st)
        const there = zoomAt(from, f, px, py, st.box, st.area)
        fc.pre(unclamped(from, f, there, st))
        const back = zoomAt(there, 1 / f, px, py, st.box, st.area)
        fc.pre(unclamped(there, 1 / f, back, st))
        expect(back.z).toBeCloseTo(from.z, 9)
        expect(back.x).toBeCloseTo(from.x, 6)
        expect(back.y).toBeCloseTo(from.y, 6)
      }),
      runs,
    )
  })
})

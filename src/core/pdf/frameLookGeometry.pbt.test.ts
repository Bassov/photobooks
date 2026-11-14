import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import type { ResolvedFrameStyle } from '../geometry/types'
import {
  frameLook,
  insetPhotoMatrix,
  roundedRectPath,
} from './frameLookGeometry'
import { applyMatrix } from './pdfGeometry'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const EPS = 1e-9

const mm = (max: number) =>
  fc.double({ min: 0, max, noNaN: true, noDefaultInfinity: true })

const size = fc.record({
  width: fc.double({ min: 1, max: 600, noNaN: true }),
  height: fc.double({ min: 1, max: 600, noNaN: true }),
})

const style: fc.Arbitrary<ResolvedFrameStyle> = fc.record({
  strokeMm: mm(400),
  matMm: mm(400),
  cornerRadiusMm: mm(400),
})

describe('frameLook (PBT)', () => {
  it('insets the photo by the mat on every side, never to a negative size', () => {
    fc.assert(
      fc.property(size, style, (frame, look) => {
        const result = frameLook(frame, look)
        if (result === undefined) return
        const mat = Math.min(look.matMm, frame.width / 2, frame.height / 2)
        const { rect } = result.photo
        expect(rect.x).toBeCloseTo(mat, 9)
        expect(rect.y).toBeCloseTo(mat, 9)
        expect(frame.width - rect.x - rect.width).toBeCloseTo(mat, 9)
        expect(frame.height - rect.y - rect.height).toBeCloseTo(mat, 9)
        expect(rect.width).toBeGreaterThanOrEqual(-EPS)
        expect(rect.height).toBeGreaterThanOrEqual(-EPS)
      }),
      runs,
    )
  })

  it('clamps the radius to half of the shorter side, for the frame and the photo', () => {
    fc.assert(
      fc.property(size, style, (frame, look) => {
        const result = frameLook(frame, look)
        if (result === undefined) return
        const half = Math.min(frame.width, frame.height) / 2
        expect(result.outer.radiusMm).toBe(Math.min(look.cornerRadiusMm, half))
        const { photo } = result
        expect(photo.radiusMm).toBeLessThanOrEqual(
          Math.max(0, Math.min(photo.rect.width, photo.rect.height) / 2) + EPS,
        )
      }),
      runs,
    )
  })

  it('keeps the stroke inside the frame box', () => {
    fc.assert(
      fc.property(size, style, (frame, look) => {
        const stroke = frameLook(frame, look)?.stroke
        if (stroke === undefined) return
        const half = stroke.widthMm / 2
        const { rect } = stroke
        expect(rect.x - half).toBeGreaterThanOrEqual(-EPS)
        expect(rect.y - half).toBeGreaterThanOrEqual(-EPS)
        expect(rect.x + rect.width + half).toBeLessThanOrEqual(
          frame.width + EPS * frame.width,
        )
        expect(rect.y + rect.height + half).toBeLessThanOrEqual(
          frame.height + EPS * frame.height,
        )
        expect(stroke.radiusMm).toBeLessThanOrEqual(
          Math.min(rect.width, rect.height) / 2 + EPS,
        )
      }),
      runs,
    )
  })
})

describe('roundedRectPath (PBT)', () => {
  it('stays inside its rect and closes where it started', () => {
    fc.assert(
      fc.property(size, mm(400), (frame, radius) => {
        const rect = { x: 0, y: 0, ...frame }
        const radiusMm = Math.min(radius, frame.width / 2, frame.height / 2)
        const segments = roundedRectPath({ rect, radiusMm })
        const points = segments.flatMap((segment) =>
          segment.op === 'close'
            ? []
            : segment.op === 'curve'
              ? [segment.c1, segment.c2, segment.to]
              : [segment.to],
        )
        for (const point of points) {
          expect(point.x).toBeGreaterThanOrEqual(-EPS)
          expect(point.y).toBeGreaterThanOrEqual(-EPS)
          expect(point.x).toBeLessThanOrEqual(frame.width + EPS)
          expect(point.y).toBeLessThanOrEqual(frame.height + EPS)
        }
        expect(points.at(-1)).toEqual(points[0])
        expect(segments.at(-1)).toEqual({ op: 'close' })
      }),
      runs,
    )
  })
})

describe('insetPhotoMatrix (PBT)', () => {
  it('scales uniformly and the scaled frame still covers the photo box', () => {
    fc.assert(
      fc.property(size, style, (frame, look) => {
        const photo = frameLook(frame, look)?.photo.rect
        if (photo === undefined) return
        const m = insetPhotoMatrix(frame, photo)
        expect(m[0]).toBe(m[3])
        const topLeft = applyMatrix(m, { x: 0, y: 0 })
        const bottomRight = applyMatrix(m, {
          x: frame.width,
          y: frame.height,
        })
        const tolerance = 1e-9 * Math.max(frame.width, frame.height)
        expect(topLeft.x).toBeLessThanOrEqual(photo.x + tolerance)
        expect(topLeft.y).toBeLessThanOrEqual(photo.y + tolerance)
        expect(bottomRight.x).toBeGreaterThanOrEqual(
          photo.x + photo.width - tolerance,
        )
        expect(bottomRight.y).toBeGreaterThanOrEqual(
          photo.y + photo.height - tolerance,
        )
      }),
      runs,
    )
  })
})

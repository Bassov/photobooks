import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import { pagesOf } from '../pages'
import {
  applyMatrix,
  compose,
  cropMarkSegments,
  imageMatrix,
  type Matrix,
  orientationMatrix,
  pdfSheets,
  PT_PER_MM,
  rotate,
  sheetBoxes,
  sheetMatrix,
  translate,
} from './pdfGeometry'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

const EPS = 1e-6

interface Point {
  x: number
  y: number
}

function invert([a, b, c, d, e, f]: Matrix): Matrix {
  const det = a * d - b * c
  return [
    d / det,
    -b / det,
    -c / det,
    a / det,
    (c * f - d * e) / det,
    (b * e - a * f) / det,
  ]
}

function sameCorners(actual: Point[], expected: Point[]): boolean {
  return expected.every((want) =>
    actual.some(
      (got) => Math.abs(got.x - want.x) < EPS && Math.abs(got.y - want.y) < EPS,
    ),
  )
}

function corners(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x, y: y + height },
    { x: x + width, y: y + height },
  ]
}

const trimArb = fc.record({
  widthMm: fc.integer({ min: 100, max: 400 }),
  heightMm: fc.integer({ min: 100, max: 400 }),
})

describe('pdfGeometry properties', () => {
  it('pages output prints every book page once and tiles each spread', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 61 }), trimArb, (spreads, trim) => {
        const sheets = pdfSheets(spreads, trim, 'pages')
        expect(sheets).toHaveLength(pagesOf(spreads))
        expect(pdfSheets(spreads, trim, 'spreads')).toHaveLength(spreads)
        for (const sheet of sheets) {
          expect(sheet.trim.width).toBe(trim.widthMm)
          expect(sheet.trim.height).toBe(trim.heightMm)
          const before = sheets.filter(
            (other) =>
              other.spreadIndex === sheet.spreadIndex &&
              other.trim.x < sheet.trim.x,
          )
          expect(sheet.trim.x).toBe(before.length * trim.widthMm)
        }
      }),
      runs,
    )
  })

  it('nests trim in bleed in media; crop marks sit between bleed and media edge', () => {
    fc.assert(
      fc.property(
        trimArb,
        fc.double({ min: 0, max: 10, noNaN: true }),
        fc.boolean(),
        ({ widthMm, heightMm }, bleedMm, marks) => {
          const boxes = sheetBoxes(widthMm, heightMm, bleedMm, marks)
          const bleedPt = bleedMm * PT_PER_MM
          expect(boxes.bleed.x).toBeCloseTo(boxes.trim.x - bleedPt, 6)
          expect(boxes.bleed.y).toBeCloseTo(boxes.trim.y - bleedPt, 6)
          expect(boxes.bleed.width).toBeCloseTo(
            boxes.trim.width + 2 * bleedPt,
            6,
          )
          expect(boxes.bleed.height).toBeCloseTo(
            boxes.trim.height + 2 * bleedPt,
            6,
          )
          expect(boxes.bleed.x).toBeGreaterThanOrEqual(-EPS)
          expect(boxes.media.x).toBe(0)
          expect(boxes.media.width).toBeCloseTo(
            boxes.trim.width + 2 * boxes.trim.x,
            6,
          )
          if (!marks) {
            expect(boxes.bleed.x).toBeCloseTo(0, 6)
            return
          }
          const sheet = {
            spreadIndex: 0,
            trim: { x: 0, y: 0, width: widthMm, height: heightMm },
          }
          const toPdf = sheetMatrix(sheet, boxes.slugMm)
          for (const { from, to } of cropMarkSegments(sheet.trim, bleedMm)) {
            for (const point of [from, to].map((p) => applyMatrix(toPdf, p))) {
              const insideBleed =
                point.x > boxes.bleed.x + EPS &&
                point.x < boxes.bleed.x + boxes.bleed.width - EPS &&
                point.y > boxes.bleed.y + EPS &&
                point.y < boxes.bleed.y + boxes.bleed.height - EPS
              expect(insideBleed).toBe(false)
              expect(point.x).toBeGreaterThanOrEqual(-EPS)
              expect(point.y).toBeGreaterThanOrEqual(-EPS)
              expect(point.x).toBeLessThanOrEqual(boxes.media.width + EPS)
              expect(point.y).toBeLessThanOrEqual(boxes.media.height + EPS)
            }
          }
        },
      ),
      runs,
    )
  })

  it('maps the crop window corners onto the frame corners (turned by straighten)', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 5, max: 400 }),
          height: fc.integer({ min: 5, max: 400 }),
        }),
        fc.record({
          x: fc.double({ min: -0.5, max: 0.9, noNaN: true }),
          y: fc.double({ min: -0.5, max: 0.9, noNaN: true }),
          width: fc.double({ min: 0.05, max: 2, noNaN: true }),
          height: fc.double({ min: 0.05, max: 2, noNaN: true }),
        }),
        fc.constantFrom(0, 1, 2, 3),
        fc.double({ min: -45, max: 45, noNaN: true }),
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: 1, max: 8 }),
        (
          frame,
          window,
          quarterTurns,
          straightenDeg,
          flipH,
          flipV,
          orientation,
        ) => {
          const rectMm = { x: 0, y: 0, ...frame }
          const m = imageMatrix(
            {
              rectMm,
              sourceCropRect: window,
              ...(quarterTurns === 0
                ? {}
                : { photoQuarterTurns: quarterTurns }),
              straightenDeg,
              ...(flipH ? { photoFlipH: true as const } : {}),
              ...(flipV ? { photoFlipV: true as const } : {}),
            },
            orientation,
          )
          // Displayed (oriented, y-down) unit square → PDF image space.
          const fromDisplay = invert(
            compose(orientationMatrix(orientation), [1, 0, 0, -1, 0, 1]),
          )
          // As on the canvas, a flip mirrors the photo about its centre and
          // the window stays put, so the frame shows the mirrored window.
          const mirror = (corner: Point): Point => ({
            x: flipH ? 1 - corner.x : corner.x,
            y: flipV ? 1 - corner.y : corner.y,
          })
          const mapped = corners(
            window.x,
            window.y,
            window.width,
            window.height,
          ).map((corner) =>
            applyMatrix(m, applyMatrix(fromDisplay, mirror(corner))),
          )
          const tilt = compose(
            translate(frame.width / 2, frame.height / 2),
            rotate(straightenDeg),
            translate(-frame.width / 2, -frame.height / 2),
          )
          const expected = corners(0, 0, frame.width, frame.height).map(
            (corner) => applyMatrix(tilt, corner),
          )
          expect(sameCorners(mapped, expected)).toBe(true)
        },
      ),
      runs,
    )
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import type { RectMm } from '../geometry/types'
import { pagesOf } from '../pages'
import {
  applyMatrix,
  blankSheets,
  compose,
  coverPhotoRect,
  coverSheetMarks,
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

  it('blank sheets lift the book to its minimum in whole sheets', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 61 }),
        fc.integer({ min: 0, max: 130 }),
        trimArb,
        fc.constantFrom('pages' as const, 'spreads' as const),
        (spreads, min, trim, output) => {
          const blanks = blankSheets(spreads, min, trim, output)
          const pages = blanks.map((sheet) => sheet.trim.width / trim.widthMm)
          const total = pages.reduce((sum, count) => sum + count, 0)
          expect(pagesOf(spreads) + total).toBe(Math.max(pagesOf(spreads), min))
          const wide = output === 'spreads' ? 2 : 1
          for (const [index, count] of pages.entries()) {
            expect(count).toBe(index < pages.length - 1 ? wide : count)
            expect([1, wide]).toContain(count)
          }
          for (const sheet of blanks) {
            expect(sheet.spreadIndex).toBe(spreads)
            expect(sheet.trim).toMatchObject({ x: 0, y: 0 })
            expect(sheet.trim.height).toBe(trim.heightMm)
          }
        },
      ),
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

  it('keeps every cover mark outside the bleed box and folds on the spine edges', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 400 }),
        fc.integer({ min: 50, max: 400 }),
        fc.double({ min: 2, max: 60, noNaN: true }),
        fc.integer({ min: 0, max: 30 }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        (trimW, trimH, spine, wrap, bleedMm) => {
          const sheet = {
            sheetW: 2 * trimW + spine + 2 * wrap,
            sheetH: trimH + 2 * wrap,
            spine,
            rects: { spine: { x: wrap + trimW } },
          }
          const segments = coverSheetMarks(sheet, bleedMm)
          expect(segments).toHaveLength(12)
          for (const { from, to } of segments) {
            for (const point of [from, to]) {
              const insideBleed =
                point.x > -bleedMm + EPS &&
                point.x < sheet.sheetW + bleedMm - EPS &&
                point.y > -bleedMm + EPS &&
                point.y < sheet.sheetH + bleedMm - EPS
              expect(insideBleed).toBe(false)
            }
          }
          const folds = segments.slice(8).map(({ from, to }) => {
            expect(to.x).toBe(from.x)
            return from.x
          })
          expect(new Set(folds)).toEqual(
            new Set([sheet.rects.spine.x, sheet.rects.spine.x + spine]),
          )
        },
      ),
      runs,
    )
  })

  describe('coverPhotoRect', () => {
    const covers = (rect: RectMm, box: RectMm) =>
      rect.x <= box.x + EPS &&
      rect.y <= box.y + EPS &&
      rect.x + rect.width >= box.x + box.width - EPS &&
      rect.y + rect.height >= box.y + box.height - EPS
    const box = fc.record({
      x: fc.double({ min: -100, max: 400, noNaN: true }),
      y: fc.double({ min: -100, max: 400, noNaN: true }),
      width: fc.double({ min: 10, max: 400, noNaN: true }),
      height: fc.double({ min: 10, max: 400, noNaN: true }),
    })
    const aspect = fc.double({ min: 0.2, max: 5, noNaN: true })
    const crop = fc.option(
      fc.record({
        zoom: fc.double({ min: 1, max: 4, noNaN: true }),
        center: fc.record({
          x: fc.double({ min: 0.05, max: 0.95, noNaN: true }),
          y: fc.double({ min: 0.05, max: 0.95, noNaN: true }),
        }),
      }),
      { nil: undefined },
    )

    it('covers its box at the image aspect', () => {
      fc.assert(
        fc.property(box, aspect, crop, (b, a, c) => {
          const rect = coverPhotoRect(b, a, c)
          expect(covers(rect, b)).toBe(true)
          expect(rect.width / rect.height).toBeCloseTo(a, 6)
        }),
        runs,
      )
    })

    it('covers the box grown by the bleed on top, outer and bottom edges; no bleed = the canvas rect', () => {
      fc.assert(
        fc.property(
          box,
          aspect,
          crop,
          fc.double({ min: 0, max: 10, noNaN: true }),
          (b, a, c, bleedMm) => {
            const bleed = {
              x: b.x,
              y: b.y - bleedMm,
              width: b.width + bleedMm,
              height: b.height + 2 * bleedMm,
            }
            const rect = coverPhotoRect(b, a, c, bleed)
            expect(covers(rect, bleed)).toBe(true)
            expect(rect.width).toBeGreaterThanOrEqual(
              coverPhotoRect(b, a, c).width - EPS,
            )
            const unbled = coverPhotoRect(b, a, c, b)
            const canvas = coverPhotoRect(b, a, c)
            for (const key of ['x', 'y', 'width', 'height'] as const) {
              expect(unbled[key]).toBeCloseTo(canvas[key], 9)
            }
          },
        ),
        runs,
      )
    })
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

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import {
  genericPrintProfile,
  getSpreadPageCount,
  preflight,
  type Frame,
} from '../index'
import { makeBook, makeSpread } from '../testing/fixtures'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

/** Books of up to 61 spreads: fewer runs keep a loaded pre-push fast. */
const runs = {
  seed: gates.pbt.seed,
  numRuns: Math.min(50, Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns)),
}

const generic = genericPrintProfile()
const SAFE = generic.safeMarginMm

/** A placement as fractions of the free room, so any draw stays valid. */
const placementArb = fc.record({
  kind: fc.constantFrom('photo', 'text', 'full-bleed'),
  page: fc.nat(1),
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
  width: fc.double({ min: 0.05, max: 1, noNaN: true }),
  height: fc.double({ min: 0.05, max: 1, noNaN: true }),
  zoom: fc.double({ min: 1, max: 2, noNaN: true }),
  rotationDeg: fc.constantFrom(0, 90, 180),
})

const cleanBookArb = fc
  .record({
    widthMm: fc.integer({ min: 100, max: 400 }),
    heightMm: fc.integer({ min: 100, max: 400 }),
    bleedMm: fc.integer({ min: 0, max: 5 }),
    // pagesOf: 11–61 spreads are 20–120 pages, whole steps of 2.
    spreads: fc.array(fc.array(placementArb, { maxLength: 3 }), {
      minLength: 11,
      maxLength: 61,
    }),
  })
  .map(({ widthMm, heightMm, bleedMm, spreads }) =>
    makeBook({
      settings: { trim: { widthMm, heightMm }, bleedMm },
      // 20000 px over at most 810 mm at zoom 2 stays above 300 dpi.
      assets: { a: { widthPx: 20_000, heightPx: 20_000 } },
      gallery: ['a'],
      spreads: spreads.map((placements, index) => {
        const pageCount = getSpreadPageCount(index, spreads.length)
        const sheetWidth = widthMm * pageCount
        return makeSpread({
          id: `s${String(index)}`,
          frames: placements.map((placement, order): Frame => {
            const id = `f${String(index)}-${String(order)}`
            const crop = { zoom: placement.zoom, center: { x: 0.5, y: 0.5 } }
            if (placement.kind === 'full-bleed') {
              const rect = {
                x: -bleedMm,
                y: -bleedMm,
                width: sheetWidth + 2 * bleedMm,
                height: heightMm + 2 * bleedMm,
              }
              return { id, rect, z: order, assetId: 'a', crop }
            }
            // Inside the safe zone of one page; 90° keeps a square footprint.
            const room = Math.min(widthMm, heightMm) - 2 * SAFE
            const width = placement.width * room
            const height =
              placement.rotationDeg === 90 ? width : placement.height * room
            const pageX = (placement.page % pageCount) * widthMm
            const rect = {
              x: pageX + SAFE + placement.x * (widthMm - 2 * SAFE - width),
              y: SAFE + placement.y * (heightMm - 2 * SAFE - height),
              width,
              height,
            }
            const rotation =
              placement.rotationDeg === 0
                ? {}
                : { rotationDeg: placement.rotationDeg }
            return placement.kind === 'text'
              ? {
                  id,
                  rect,
                  z: order,
                  kind: 'text',
                  content: { type: 'static', text: 'Caption' },
                  ...rotation,
                }
              : { id, rect, z: order, assetId: 'a', crop, ...rotation }
          }),
        })
      }),
    }),
  )

describe('preflight (property)', () => {
  it('a book inside every profile limit yields no issues', () => {
    fc.assert(
      fc.property(cleanBookArb, (book) => {
        expect(preflight(book, generic)).toEqual([])
      }),
      runs,
    )
  })
})

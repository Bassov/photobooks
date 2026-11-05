import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import { getSpreadPageCount } from './geometry/spreadSize'
import { setPageCount } from './ops/spreads'
import { clampPageCount, PAGE_MAX, PAGE_MIN, pagesOf } from './pages'
import { makeBook, makeSpread } from './testing/fixtures'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const runs = {
  seed: gates.pbt.seed,
  numRuns: Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns),
}

describe('pagesOf (property)', () => {
  it('is the sum of every spread page count', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (spreads) => {
        let sum = 0
        for (let i = 0; i < spreads; i++) {
          sum += getSpreadPageCount(i, spreads)
        }
        expect(pagesOf(spreads)).toBe(sum)
      }),
      runs,
    )
  })
})

describe('setPageCount (property)', () => {
  it('lands on an even count in 20–120, keeps the leading spreads and is idempotent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 70 }),
        fc.double({ min: -50, max: 300, noNaN: true }),
        (spreads, pages) => {
          const book = makeBook({
            spreads: Array.from({ length: spreads }, (_, i) =>
              makeSpread({ id: `s${String(i + 1)}` }),
            ),
          })
          const next = setPageCount(book, pages)
          const count = pagesOf(next.spreads.length)
          expect(count).toBe(clampPageCount(pages))
          expect(count % 2).toBe(0)
          expect(count).toBeGreaterThanOrEqual(PAGE_MIN)
          expect(count).toBeLessThanOrEqual(PAGE_MAX)
          const kept = Math.min(spreads, next.spreads.length)
          expect(next.spreads.slice(0, kept).map((s) => s.id)).toEqual(
            book.spreads.slice(0, kept).map((s) => s.id),
          )
          expect(setPageCount(next, pages)).toBe(next)
        },
      ),
      runs,
    )
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fc } from '@fast-check/vitest'
import { getSpreadPageCount } from './geometry/spreadSize'
import { setPageCount } from './ops/spreads'
import {
  clampPageCount,
  PAGE_MAX,
  PAGE_MIN,
  pageCountRange,
  pagesOf,
} from './pages'
import {
  makeBook,
  makeCustomPrintProfile,
  makeSpread,
} from './testing/fixtures'

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

const profilePageCount = fc
  .record({
    min: fc.integer({ min: 1, max: 200 }),
    step: fc.integer({ min: 1, max: 24 }),
    steps: fc.integer({ min: 0, max: 60 }),
  })
  .map(({ min, step, steps }) => ({ min, step, max: min + steps * step }))

describe('profile page-count range (property, D5)', () => {
  it('runs from 20 in whole spreads up to min(120, profile max), and a typed count lands on its nearest step', () => {
    fc.assert(
      fc.property(
        profilePageCount,
        fc.double({ min: -50, max: 400, noNaN: true }),
        (pageCount, pages) => {
          const range = pageCountRange({ pageCount })
          expect(range.min).toBe(PAGE_MIN)
          expect(range.step % 2).toBe(0)
          expect(range.step - pageCount.step).toBeLessThan(2)
          expect(range.max).toBeLessThanOrEqual(
            Math.max(PAGE_MIN, Math.min(PAGE_MAX, pageCount.max)),
          )
          expect(range.max + range.step).toBeGreaterThan(
            Math.min(PAGE_MAX, pageCount.max),
          )
          const n = clampPageCount(pages, range)
          expect((n - range.min) % range.step).toBe(0)
          expect(n).toBeGreaterThanOrEqual(range.min)
          expect(n).toBeLessThanOrEqual(range.max)
          if (pages >= range.min && pages <= range.max) {
            expect(Math.abs(n - pages)).toBeLessThanOrEqual(range.step / 2)
          }
          expect(clampPageCount(n, range)).toBe(n)
        },
      ),
      runs,
    )
  })

  it('setPageCount clamps a custom-profile book to its range', () => {
    fc.assert(
      fc.property(
        profilePageCount,
        fc.integer({ min: 0, max: 300 }),
        (pageCount, pages) => {
          const snapshot = makeCustomPrintProfile({ pageCount })
          const book = makeBook({
            printProfile: { id: snapshot.id, overrides: {}, snapshot },
            spreads: [makeSpread({ id: 's1' })],
          })
          const next = setPageCount(book, pages)
          expect(pagesOf(next.spreads.length)).toBe(
            clampPageCount(pages, pageCountRange(snapshot)),
          )
        },
      ),
      runs,
    )
  })
})

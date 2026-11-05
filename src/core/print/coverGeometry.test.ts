import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  bookCoverGeometry,
  coverGeometry,
  defaultCover,
  genericPrintProfile,
  spineWidthMm,
  TRIM_MAX_MM,
  TRIM_MIN_MM,
  type CoverGeometry,
  type SpineWidthRule,
} from '../index'
import { makeBook, makeSpread } from '../testing/fixtures'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

const RUNS = {
  seed: gates.pbt.seed,
  numRuns: Math.max(100, Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns)),
}

const GENERIC = genericPrintProfile()
const GENERIC_RULE = GENERIC.spine.width
const RANGE = { min: 20, max: 120 }

/** A `widthMm × heightMm` book with `spreads` spreads (2·(spreads − 1) pages). */
function book(
  spreads: number,
  trim = { widthMm: 190, heightMm: 230 },
  extra: Partial<Parameters<typeof makeBook>[0]> = {},
) {
  return makeBook({
    settings: { trim },
    cover: defaultCover('Lake'),
    spreads: Array.from({ length: spreads }, (_, i) =>
      makeSpread({ id: `s${String(i)}` }),
    ),
    ...extra,
  })
}

function manualBook(spineMm: number) {
  const base = book(11)
  return {
    ...base,
    cover: {
      ...base.cover,
      style: { ...base.cover.style, spineWidthMm: spineMm },
      print: { spineWidthSource: 'manual' as const },
    },
  }
}

const TABLE: SpineWidthRule = {
  kind: 'table',
  rows: [
    { maxPages: 40, widthMm: 10 },
    { maxPages: 80, widthMm: 15 },
  ],
}

describe('spineWidthMm', () => {
  it('generic: 8 mm + 0.2 mm per page to 0.1 mm, clamped to 20–120 pages', () => {
    expect(
      [0, 19, 20, 22, 42, 60, 119, 120, 121, 400].map((pages) =>
        spineWidthMm(GENERIC_RULE, pages, RANGE),
      ),
    ).toEqual([12, 12, 12, 12.4, 16.4, 20, 31.8, 32, 32, 32])
  })

  it('rounds the formula to 0.1 mm', () => {
    const rule: SpineWidthRule = {
      kind: 'formula',
      baseMm: 1,
      perPageMm: 0.123,
    }
    expect(spineWidthMm(rule, 10, { min: 1, max: 100 })).toBe(2.2)
  })

  it('table: the first row covering the count, else the last row', () => {
    const wide = { min: 1, max: 500 }
    expect(
      [1, 40, 41, 80, 81, 500].map((pages) => spineWidthMm(TABLE, pages, wide)),
    ).toEqual([10, 10, 15, 15, 15, 15])
  })

  it('table: clamps the count to the profile range first', () => {
    expect(spineWidthMm(TABLE, 10, { min: 50, max: 60 })).toBe(15)
    expect(spineWidthMm(TABLE, 70, { min: 20, max: 30 })).toBe(10)
  })

  it('outside the page range the spine is the one at the nearest end', () => {
    const ruleArb = fc.oneof(
      fc.record({
        kind: fc.constant('formula' as const),
        baseMm: fc.double({ min: 0, max: 20, noNaN: true }),
        perPageMm: fc.double({ min: 0.01, max: 1, noNaN: true }),
      }),
      fc
        .array(
          fc.record({
            up: fc.integer({ min: 1, max: 60 }),
            widthMm: fc.double({ min: 1, max: 60, noNaN: true }),
          }),
          { minLength: 1, maxLength: 4 },
        )
        .map((steps) => {
          let maxPages = 0
          const rows = steps.map(({ up, widthMm }) => {
            maxPages += up
            return { maxPages, widthMm }
          })
          return { kind: 'table' as const, rows }
        }),
    )
    fc.assert(
      fc.property(
        ruleArb,
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (rule, min, span, beyond) => {
          const range = { min, max: min + span }
          expect(spineWidthMm(rule, min - beyond, range)).toBe(
            spineWidthMm(rule, min, range),
          )
          expect(spineWidthMm(rule, range.max + beyond, range)).toBe(
            spineWidthMm(rule, range.max, range),
          )
        },
      ),
      RUNS,
    )
  })
})

describe('bookCoverGeometry', () => {
  it('19 × 23 cm, 20 pages: the Spec sheet, cover and overlays (mm)', () => {
    const g = bookCoverGeometry(book(11))
    expect(g).toEqual({
      trimW: 190,
      trimH: 230,
      spine: 12,
      wrap: 15,
      hinge: 8,
      safe: 5,
      coverW: 392,
      sheetW: 422,
      sheetH: 260,
      pages: 20,
      printedPages: 20,
      profileName: 'Generic',
      source: 'profile',
      rects: {
        cover: { x: 15, y: 15, width: 392, height: 230 },
        back: { x: 15, y: 15, width: 190, height: 230 },
        spine: { x: 205, y: 15, width: 12, height: 230 },
        front: { x: 217, y: 15, width: 190, height: 230 },
        hingeBack: { x: 197, y: 15, width: 8, height: 230 },
        hingeFront: { x: 217, y: 15, width: 8, height: 230 },
        safeBack: { x: 20, y: 20, width: 177, height: 220 },
        safeFront: { x: 225, y: 20, width: 177, height: 220 },
        frontPhoto: { x: 217, y: 0, width: 205, height: 260 },
      },
    } satisfies CoverGeometry)
  })

  it('matches the Spec px at Fit (sheet 848 px wide) to 0.05 px', () => {
    const g = bookCoverGeometry(book(11))
    const px = 848 / g.sheetW
    expect(g.sheetH * px).toBeCloseTo(522.47, 1)
    expect(g.coverW * px).toBeCloseTo(787.73, 1)
    expect(g.spine * px).toBeCloseTo(24.11, 1)
    expect(g.wrap * px).toBeCloseTo(30.14, 1)
    expect(g.hinge * px).toBeCloseTo(16.08, 1)
    expect(g.rects.spine.x * px).toBeCloseTo(663.94 - 252, 1)
    expect(g.rects.safeFront.x * px).toBeCloseTo(704.13 - 252, 1)
  })

  it('120 pages: spine 32 mm, sheet 442 × 260 mm', () => {
    const g = bookCoverGeometry(book(61))
    expect([g.pages, g.printedPages, g.spine, g.sheetW, g.sheetH]).toEqual([
      120, 120, 32, 442, 260,
    ])
    expect((g.spine * 848) / g.sheetW).toBeCloseTo(61.39, 2)
  })

  it('prints a short book as the 20-page minimum and a long one as 120', () => {
    const short = bookCoverGeometry(book(3))
    expect([short.pages, short.printedPages, short.spine]).toEqual([4, 20, 12])
    const long = bookCoverGeometry(book(71))
    expect([long.pages, long.printedPages, long.spine]).toEqual([140, 120, 32])
  })

  it('an unknown profile id falls back to the generic profile', () => {
    const unknown = book(11, undefined, {
      printProfile: { id: 'no-such-printer', overrides: {} },
    })
    expect(bookCoverGeometry(unknown)).toEqual(bookCoverGeometry(book(11)))
  })

  it('a manual spine uses the stored width where the profile allows it', () => {
    const g = bookCoverGeometry(manualBook(20))
    expect([g.source, g.spine, g.coverW, g.sheetW]).toEqual([
      'manual',
      20,
      400,
      430,
    ])
    const locked = coverGeometry(
      { ...GENERIC, spine: { ...GENERIC.spine, manualOverride: false } },
      manualBook(20),
    )
    expect([locked.source, locked.spine]).toEqual(['profile', 12])
  })

  it('a cover without print fields takes the spine from the profile', () => {
    const base = book(22)
    const { front, spine, back, style } = base.cover
    const g = bookCoverGeometry({
      ...base,
      cover: { front, spine, back, style },
    })
    expect([g.source, g.spine]).toEqual(['profile', 16.4])
  })

  it('sheet = 2·trim + spine + 2·wrap exactly and the rects tile it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: TRIM_MIN_MM, max: TRIM_MAX_MM }),
        fc.integer({ min: TRIM_MIN_MM, max: TRIM_MAX_MM }),
        fc.integer({ min: 0, max: 80 }),
        (widthMm, heightMm, spreads) => {
          const g = bookCoverGeometry(book(spreads, { widthMm, heightMm }))
          const { back, spine, front, cover, frontPhoto } = g.rects
          expect(g.sheetW).toBe(2 * widthMm + g.spine + 2 * g.wrap)
          expect(g.sheetH).toBe(heightMm + 2 * g.wrap)
          // Same sums in another order: equal up to float rounding.
          expect(cover.width).toBeCloseTo(
            back.width + spine.width + front.width,
            9,
          )
          expect(back.x + back.width).toBe(spine.x)
          expect(spine.x + spine.width).toBe(front.x)
          expect(front.x + front.width + g.wrap).toBeCloseTo(g.sheetW, 9)
          expect(frontPhoto.x + frontPhoto.width).toBeCloseTo(g.sheetW, 9)
          expect(frontPhoto.height).toBe(g.sheetH)
          expect(g.rects.hingeBack.x + g.hinge).toBe(spine.x)
          expect(g.rects.safeFront.x - g.hinge).toBeCloseTo(front.x, 9)
          expect(g.rects.safeBack.x + g.rects.safeBack.width + g.hinge).toBe(
            spine.x,
          )
        },
      ),
      RUNS,
    )
  })
})

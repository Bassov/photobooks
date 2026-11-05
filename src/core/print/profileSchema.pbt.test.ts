import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fc } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  DPI_MIN,
  DPI_WARN,
  PAGE_MAX,
  PAGE_MIN,
  PRINT_COLOR_SPACES,
  PRINT_OUTPUTS,
  TRIM_MAX_MM,
  TRIM_MIN_MM,
  genericPrintProfile,
  parsePrintProfile,
  type PrintProfileInput,
} from '../index'

const gates = JSON.parse(
  readFileSync(resolve(process.cwd(), 'quality/gates.json'), 'utf8'),
) as { pbt: { seed: number; numRuns: number } }

/** Done-when floor for this item: at least 100 runs per property. */
const RUNS = {
  seed: gates.pbt.seed,
  numRuns: Math.max(100, Number(process.env.FC_NUM_RUNS ?? gates.pbt.numRuns)),
}

const mmArb = (min: number, max: number) =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true })

const rangeArb = (min: number, max: number) =>
  fc
    .tuple(mmArb(min, max), mmArb(min, max))
    .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const)

const pageCountArb = fc
  .record({
    min: fc.integer({ min: 1, max: 100 }),
    step: fc.integer({ min: 1, max: 8 }),
    steps: fc.integer({ min: 0, max: 50 }),
  })
  .map(({ min, step, steps }) => ({ min, step, max: min + step * steps }))

const spineWidthArb = fc.oneof(
  fc.record({
    kind: fc.constant('formula' as const),
    baseMm: mmArb(0, 10),
    perPageMm: mmArb(0.01, 1),
  }),
  fc
    .array(
      fc.record({
        pagesUp: fc.integer({ min: 1, max: 60 }),
        widthMm: mmArb(1, 60),
      }),
      { minLength: 1, maxLength: 5 },
    )
    .map((steps) => {
      let maxPages = 0
      const rows = steps.map(({ pagesUp, widthMm }) => {
        maxPages += pagesUp
        return { maxPages, widthMm }
      })
      return { kind: 'table' as const, rows }
    }),
)

/** Valid profile inputs; `cropMarks` is sometimes omitted (default off). */
const inputArb: fc.Arbitrary<PrintProfileInput> = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 12 }),
    name: fc.string({ minLength: 1, maxLength: 16 }),
    trim: rangeArb(1, 600),
    bleed: rangeArb(0, 20),
    coverBleedMm: mmArb(0, 30),
    coverWrapMm: mmArb(0, 30),
    coverHingeMm: mmArb(0, 20),
    safeMarginMm: mmArb(0, 30),
    pageCount: pageCountArb,
    singleFirstPage: fc.boolean(),
    printedEndpapers: fc.boolean(),
    spine: fc.record({
      width: spineWidthArb,
      manualOverride: fc.boolean(),
    }),
    output: fc.constantFrom(...PRINT_OUTPUTS),
    cropMarks: fc.option(fc.boolean(), { nil: undefined }),
    colorSpace: fc.constantFrom(...PRINT_COLOR_SPACES),
    fileLimits: fc.record({
      maxFileBytes: fc.integer({ min: 1, max: 2 ** 31 }),
      maxSidePx: fc.integer({ min: 1, max: 100_000 }),
    }),
    dpi: rangeArb(1, 1200),
    minFontPt: mmArb(0.5, 24),
  })
  .map(({ trim, bleed, dpi, cropMarks, ...rest }) => ({
    ...rest,
    trimMinMm: trim[0],
    trimMaxMm: trim[1],
    bleedMinMm: bleed[0],
    bleedMaxMm: bleed[1],
    dpi: { min: dpi[0], warn: dpi[1] },
    ...(cropMarks === undefined ? {} : { cropMarks }),
  }))

/** One broken invariant per case; each must fail to parse. */
const breakers: readonly [string, (p: PrintProfileInput) => unknown][] = [
  ['trim min above max', (p) => ({ ...p, trimMinMm: p.trimMaxMm + 1 })],
  ['bleed min above max', (p) => ({ ...p, bleedMinMm: p.bleedMaxMm + 1 })],
  ['negative cover bleed', (p) => ({ ...p, coverBleedMm: -1 })],
  ['negative cover wrap', (p) => ({ ...p, coverWrapMm: -1 })],
  ['negative cover hinge', (p) => ({ ...p, coverHingeMm: -1 })],
  [
    'dpi min above warn',
    (p) => ({ ...p, dpi: { ...p.dpi, min: p.dpi.warn + 1 } }),
  ],
  [
    'page count min above max',
    (p) => ({ ...p, pageCount: { ...p.pageCount, min: p.pageCount.max + 1 } }),
  ],
  [
    'page count off the step grid',
    (p) => ({
      ...p,
      pageCount: { min: 20, step: 2, max: 21 + 2 * p.pageCount.step },
    }),
  ],
  [
    'spine table not ascending',
    (p) => ({
      ...p,
      spine: {
        ...p.spine,
        width: {
          kind: 'table',
          rows: [
            { maxPages: 40, widthMm: 8 },
            { maxPages: 40, widthMm: 9 },
          ],
        },
      },
    }),
  ],
  [
    'empty spine table',
    (p) => ({
      ...p,
      spine: { ...p.spine, width: { kind: 'table', rows: [] } },
    }),
  ],
  ['jpeg spreads output', (p) => ({ ...p, output: 'jpeg-spreads' })],
  ['cmyk color space', (p) => ({ ...p, colorSpace: 'cmyk' })],
  ['empty id', (p) => ({ ...p, id: '' })],
  [
    'fractional file limit',
    (p) => ({ ...p, fileLimits: { ...p.fileLimits, maxSidePx: 1.5 } }),
  ],
]

// `fc.assert` inside `it` (not `test.prop`): a stable test name lets Stryker
// re-run these per mutant.
describe('print profile schema', () => {
  it('parses every valid profile, crop marks default off', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const parsed = parsePrintProfile(input)
        assert(parsed.ok)
        expect(parsed.profile).toEqual({
          ...input,
          cropMarks: input.cropMarks ?? false,
        })
      }),
      RUNS,
    )
  })

  it('round-trips through JSON unchanged', () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const first = parsePrintProfile(input)
        assert(first.ok)
        const again = parsePrintProfile(
          JSON.parse(JSON.stringify(first.profile)),
        )
        assert(again.ok)
        expect(again.profile).toEqual(first.profile)
      }),
      RUNS,
    )
  })

  it.each(breakers)('rejects a profile with %s', (_name, breakIt) => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(parsePrintProfile(breakIt(input)).ok).toBe(false)
      }),
      RUNS,
    )
  })

  it('the generic profile parses as is', () => {
    expect(parsePrintProfile(genericPrintProfile())).toEqual({
      ok: true,
      profile: genericPrintProfile(),
    })
  })

  it.each([
    ['bleedMaxMm', { bleedMinMm: 12 }, 'bleed min must not exceed max'],
    ['trimMaxMm', { trimMinMm: 600 }, 'trim min must not exceed max'],
    [
      'dpi.min',
      { dpi: { warn: 150, min: 200 } },
      'dpi min must not exceed warn',
    ],
    [
      'pageCount',
      { pageCount: { min: 20, step: 2, max: 21 } },
      'page count max must be min plus whole steps',
    ],
    [
      'spine.width.rows',
      {
        spine: {
          width: {
            kind: 'table',
            rows: [
              { maxPages: 60, widthMm: 8 },
              { maxPages: 40, widthMm: 6 },
            ],
          },
          manualOverride: false,
        },
      },
      'spine table rows must ascend by maxPages',
    ],
  ] as const)('names the failing field %s', (field, patch, message) => {
    const parsed = parsePrintProfile({ ...genericPrintProfile(), ...patch })
    assert(!parsed.ok)
    expect(parsed.issues).toEqual([{ path: field.split('.'), message }])
  })

  it('accepts equal bounds: one trim, one bleed, one DPI gate', () => {
    const parsed = parsePrintProfile({
      ...genericPrintProfile(),
      trimMinMm: 200,
      trimMaxMm: 200,
      bleedMinMm: 3,
      bleedMaxMm: 3,
      dpi: { warn: 300, min: 300 },
    })
    expect(parsed.ok).toBe(true)
  })
})

describe('generic print profile', () => {
  it("carries the editor's limits and the default printer data", () => {
    expect(genericPrintProfile()).toEqual({
      id: 'generic',
      name: 'Generic',
      trimMinMm: TRIM_MIN_MM,
      trimMaxMm: TRIM_MAX_MM,
      bleedMinMm: 0,
      bleedMaxMm: 10,
      coverBleedMm: 3,
      coverWrapMm: 15,
      coverHingeMm: 8,
      safeMarginMm: 5,
      pageCount: { min: PAGE_MIN, step: 2, max: PAGE_MAX },
      singleFirstPage: true,
      printedEndpapers: true,
      spine: {
        width: { kind: 'formula', baseMm: 8, perPageMm: 0.2 },
        manualOverride: true,
      },
      output: 'pages',
      cropMarks: false,
      colorSpace: 'srgb',
      fileLimits: { maxFileBytes: 500 * 1024 * 1024, maxSidePx: 30_000 },
      dpi: { warn: DPI_WARN, min: DPI_MIN },
      minFontPt: 6,
    })
  })
})

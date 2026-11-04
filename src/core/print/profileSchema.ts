import { z } from 'zod'
import { DPI_MIN, DPI_WARN } from '../geometry/dpi'
import { TRIM_MAX_MM, TRIM_MIN_MM } from '../ops/bookSettings'
import { PAGE_MAX, PAGE_MIN, PAGE_STEP } from '../pages'

export const DEFAULT_PRINT_PROFILE_ID = 'generic'

export const PRINT_OUTPUTS = ['pages', 'spreads'] as const
export const PRINT_COLOR_SPACES = ['srgb'] as const

/**
 * Printer data for one print product (mm, pixels, points). Built per call (not
 * at module load) so that its mutants are reachable per test.
 */
function makePrintProfileSchema() {
  const mm = z.number().nonnegative()
  const positiveMm = z.number().positive()
  const count = z.number().int().positive()
  const pageCount = z
    .object({ min: count, step: count, max: count })
    .refine((p) => p.min <= p.max && (p.max - p.min) % p.step === 0, {
      message: 'page count max must be min plus whole steps',
    })
  /** Spine width = `baseMm + perPageMm × pages`. */
  const spineFormula = z.object({
    kind: z.literal('formula'),
    baseMm: mm,
    perPageMm: positiveMm,
  })
  /** Spine width of the first row whose `maxPages` covers the page count. */
  const spineTable = z.object({
    kind: z.literal('table'),
    rows: z
      .array(z.object({ maxPages: count, widthMm: positiveMm }))
      .min(1)
      .refine(
        (rows) =>
          rows.every((row, index) => {
            const previous = rows[index - 1]
            return previous === undefined || previous.maxPages < row.maxPages
          }),
        { message: 'spine table rows must ascend by maxPages' },
      ),
  })
  const spine = z.object({
    width: z.discriminatedUnion('kind', [spineFormula, spineTable]),
    /** The user may type the spine width instead (`cover.print`). */
    manualOverride: z.boolean(),
  })
  const dpi = z
    .object({ warn: z.number().positive(), min: z.number().positive() })
    .refine((d) => d.min <= d.warn, {
      message: 'dpi min must not exceed warn',
      path: ['min'],
    })
  return z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      trimMinMm: positiveMm,
      trimMaxMm: positiveMm,
      /** Page bleed range; the book's bleed is the user's value inside it. */
      bleedMinMm: mm,
      bleedMaxMm: mm,
      coverBleedMm: mm,
      safeMarginMm: mm,
      pageCount,
      /** The first page prints alone (right-hand), not as a spread half. */
      singleFirstPage: z.boolean(),
      printedEndpapers: z.boolean(),
      spine,
      output: z.enum(PRINT_OUTPUTS),
      cropMarks: z.boolean().default(false),
      colorSpace: z.enum(PRINT_COLOR_SPACES),
      fileLimits: z.object({ maxFileBytes: count, maxSidePx: count }),
      dpi,
      minFontPt: z.number().positive(),
    })
    .refine((p) => p.trimMinMm <= p.trimMaxMm, {
      message: 'trim min must not exceed max',
      path: ['trimMaxMm'],
    })
    .refine((p) => p.bleedMinMm <= p.bleedMaxMm, {
      message: 'bleed min must not exceed max',
      path: ['bleedMaxMm'],
    })
}

export type PrintProfile = z.output<ReturnType<typeof makePrintProfileSchema>>
export type PrintProfileInput = z.input<
  ReturnType<typeof makePrintProfileSchema>
>
export type PrintOutput = PrintProfile['output']
export type SpineWidthRule = PrintProfile['spine']['width']

export type PrintProfileParseResult =
  | { ok: true; profile: PrintProfile }
  | { ok: false; issues: { path: PropertyKey[]; message: string }[] }

export function parsePrintProfile(input: unknown): PrintProfileParseResult {
  const result = makePrintProfileSchema().safeParse(input)
  return result.success
    ? { ok: true, profile: result.data }
    : {
        ok: false,
        issues: result.error.issues.map(({ path, message }) => ({
          path,
          message,
        })),
      }
}

/**
 * Built-in default: the editor trim range and page count, today's DPI gates;
 * the spine formula gives 4 mm at 20 pages and 14 mm at 120.
 */
export function genericPrintProfile(): PrintProfile {
  return {
    id: DEFAULT_PRINT_PROFILE_ID,
    name: 'Generic',
    trimMinMm: TRIM_MIN_MM,
    trimMaxMm: TRIM_MAX_MM,
    bleedMinMm: 0,
    bleedMaxMm: 10,
    coverBleedMm: 3,
    safeMarginMm: 5,
    pageCount: { min: PAGE_MIN, step: PAGE_STEP, max: PAGE_MAX },
    singleFirstPage: true,
    printedEndpapers: true,
    spine: {
      width: { kind: 'formula', baseMm: 2, perPageMm: 0.1 },
      manualOverride: true,
    },
    output: 'pages',
    cropMarks: false,
    colorSpace: 'srgb',
    /** 500 MiB per file. */
    fileLimits: { maxFileBytes: 524_288_000, maxSidePx: 30_000 },
    dpi: { warn: DPI_WARN, min: DPI_MIN },
    minFontPt: 6,
  }
}

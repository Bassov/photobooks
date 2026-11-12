import { z } from '../../lib/zod'

export const PRINT_OUTPUTS = ['pages', 'spreads'] as const
export const PRINT_COLOR_SPACES = ['srgb'] as const

/**
 * Printer data for one print product (mm, pixels, points). Built per call (not
 * at module load) so that its mutants are reachable per test.
 */
export function printProfileSchema() {
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
      /** Name of the profile a custom one was made from ("Based on …"). */
      basedOn: z.string().min(1).optional(),
      trimMinMm: positiveMm,
      trimMaxMm: positiveMm,
      /** Page bleed range; the book's bleed is the user's value inside it. */
      bleedMinMm: mm,
      bleedMaxMm: mm,
      coverBleedMm: mm,
      /** Cover paper folded over each board edge, outside the closed cover. */
      coverWrapMm: mm,
      /** Groove beside the spine where the board bends. */
      coverHingeMm: mm,
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

export type PrintProfile = z.output<ReturnType<typeof printProfileSchema>>
export type PrintProfileInput = z.input<ReturnType<typeof printProfileSchema>>
export type PrintOutput = PrintProfile['output']
export type SpineWidthRule = PrintProfile['spine']['width']

export type PrintProfileParseResult =
  | { ok: true; profile: PrintProfile }
  | { ok: false; issues: { path: PropertyKey[]; message: string }[] }

export function parsePrintProfile(input: unknown): PrintProfileParseResult {
  const result = printProfileSchema().safeParse(input)
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

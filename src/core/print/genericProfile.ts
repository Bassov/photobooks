// Zod-free: the cover geometry and `printProfile.ts` reach the site bundle.
import { DPI_MIN, DPI_WARN } from '../geometry/dpi'
import { TRIM_MAX_MM, TRIM_MIN_MM } from '../ops/bookSettings'
import { PAGE_MAX, PAGE_MIN, PAGE_STEP } from '../pages'
import type { PrintProfile } from './profileSchema'

export const DEFAULT_PRINT_PROFILE_ID = 'generic'

/**
 * Built-in default: the editor trim range and page count, today's DPI gates;
 * the spine formula gives 12 mm at 20 pages and 32 mm at 120 (hardcover
 * boards 8 mm + one ~200 gsm page 0.2 mm), wrap 15 mm and hinge 8 mm.
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
    coverWrapMm: 15,
    coverHingeMm: 8,
    safeMarginMm: 5,
    pageCount: { min: PAGE_MIN, step: PAGE_STEP, max: PAGE_MAX },
    singleFirstPage: true,
    printedEndpapers: true,
    spine: {
      width: { kind: 'formula', baseMm: 8, perPageMm: 0.2 },
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

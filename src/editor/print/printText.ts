import type { ExportWriteErrorCode } from '../../project'
import type { PreflightRow } from '../../core'
import type { ImpositionLayout } from '../../core/print/imposition'
import { fmtN } from '../../core/print/profileText'
import { PAGE_SIZE_PRESETS } from '../pageSizePresets'

/** Designer spec pdf-export D1, D5, §2.1–2.4: every Print string. */

/** Painting fills 0–95 %; the last 5 % is writing the file. */
const PAINT_SHARE = 95
/** A booklet paints up to 80 % and imposes from 80 to 95 %. */
const BOOKLET_PAINT_SHARE = 80
/** The percent shown while the file is written. */
export const PRINT_SAVING_PERCENT = 97

/** Imposition choices of the Print dialog (booklet-imposition). */
export type PrintLayout = 'single' | ImpositionLayout

export const PRINT_LAYOUTS: { id: PrintLayout; label: string }[] = [
  { id: 'single', label: '1 per sheet' },
  { id: '2up', label: '2-up' },
  { id: '4up', label: '4-up' },
]

function plural(count: number, one: string, many = `${one}s`): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

function share(part: number, whole: number, of: number): number {
  return whole > 0 ? Math.round((of * part) / whole) : of
}

/** `round(95 · painted / sheets)` (a booklet: 80); no sheets counts as painted. */
export function printPercent(
  painted: number,
  sheets: number,
  layout: PrintLayout,
): number {
  return share(
    painted,
    sheets,
    layout === 'single' ? PAINT_SHARE : BOOKLET_PAINT_SHARE,
  )
}

/** A booklet's imposing: 80–95 %. */
export function imposePercent(imposed: number, sheets: number): number {
  return (
    BOOKLET_PAINT_SHARE +
    share(imposed, sheets, PAINT_SHARE - BOOKLET_PAINT_SHARE)
  )
}

/** "A5 · 14.8 × 21 cm" / "Custom · 19 × 23 cm" (either orientation matches a preset). */
export function printSizeText(trim: {
  widthMm: number
  heightMm: number
}): string {
  const w = fmtN(trim.widthMm / 10)
  const h = fmtN(trim.heightMm / 10)
  const preset = PAGE_SIZE_PRESETS.find(
    (p) =>
      (fmtN(p.wCm) === w && fmtN(p.hCm) === h) ||
      (fmtN(p.wCm) === h && fmtN(p.hCm) === w),
  )
  return `${preset?.name ?? 'Custom'} · ${w} × ${h} cm`
}

export function printBleedLabel(bleedMm: number): string {
  return `Add ${fmtN(bleedMm)} mm bleed and crop marks`
}

/** D5: `PDF · {pages} pages` [` on {sheets} sheets`] + ` · bleed {b} mm` / ` · trim size, no marks`. */
export function printSummary(
  pages: number,
  sheets: number,
  bleedMm: number | null,
): string {
  const on = sheets === pages ? '' : ` on ${plural(sheets, 'sheet')}`
  const marks =
    bleedMm === null ? ' · trim size, no marks' : ` · bleed ${fmtN(bleedMm)} mm`
  return `PDF · ${String(pages)} pages${on}${marks}`
}

/** "Check" / "Check · 2 errors, 3 warnings" (zero counts left out; info isn't counted). */
export function printCheckLabel(rows: readonly PreflightRow[]): string {
  const errors = rows.filter((row) => row.severity === 'error').length
  const warnings = rows.filter((row) => row.severity === 'warning').length
  const parts = [
    errors > 0 ? plural(errors, 'error') : '',
    warnings > 0 ? plural(warnings, 'warning') : '',
  ].filter((part) => part !== '')
  return parts.length === 0 ? 'Check' : `Check · ${parts.join(', ')}`
}

/**
 * §2.2: "Page {i} of {sheets} · {p}%" while painting, a booklet's
 * "Imposing sheets · {i} of {n} · {p}%" next, "Saving · {p}%" after.
 */
export function printRunText(run: {
  painted: number
  sheets: number
  percent: number
  saving: boolean
  imposing: { imposed: number; sheets: number } | null
}): string {
  const percent = `${String(run.percent)}%`
  if (run.saving) return `Saving · ${percent}`
  if (run.imposing !== null) {
    const { imposed, sheets } = run.imposing
    const sheet = Math.min(imposed + 1, sheets)
    return `Imposing sheets · ${String(sheet)} of ${String(sheets)} · ${percent}`
  }
  const page = Math.min(run.painted + 1, run.sheets)
  return `Page ${String(page)} of ${String(run.sheets)} · ${percent}`
}

/** §2.3: "lake-trip-A5.pdf · 40 pages · 12.3 MB" (MB = 10^6 bytes); a booklet counts paper sheets. */
export function printDoneText(
  file: string,
  sheets: number,
  bytes: number,
  layout: PrintLayout,
): string {
  const count = plural(sheets, layout === 'single' ? 'page' : 'sheet')
  return `${file} · ${count} · ${(bytes / 1_000_000).toFixed(1)} MB`
}

/** How to print and fold a booklet on a home duplex printer. */
export function printDuplexText(layout: ImpositionLayout): string {
  return layout === '2up'
    ? 'Print on both sides, flip on the short edge. Stack the sheets in order, fold in half and staple on the fold.'
    : 'Print on both sides, flip on the long edge. Cut each sheet across, put the top half on the bottom half, fold and staple.'
}

export function printSavedText(library: string): string {
  return `Saved in ${library}/exports.`
}

/** §2.3 skipped-photos row (the page list follows, muted). */
export function printSkippedText(count: number): string {
  return `${plural(count, 'photo')} couldn’t be read and print${count === 1 ? 's' : ''} as blank paper`
}

/** §2.4 failed texts. */
export function printFailText(
  code: ExportWriteErrorCode,
  library: string,
): string {
  switch (code) {
    case 'access':
      return `Photobooks can’t write to “${library}”. Allow access to the folder and try again.`
    case 'full':
      return 'The disk is full.'
    case 'other':
      return 'Something went wrong while making the PDF. Try again.'
  }
}

/** D1 pill titles and status-region texts. */
export const PRINT_NAME = 'Print'
export const PRINT_DONE_STATUS = 'PDF ready'
export const PRINT_FAILED_STATUS = 'PDF not exported'

export function printRunningTitle(percent: number): string {
  return `Exporting PDF · ${String(percent)}%`
}

export function printStatusText(percent: number): string {
  return `Exporting PDF, ${String(percent)}%`
}

import type { ExportWriteErrorCode } from '../../project'
import type { PreflightRow } from '../../core'
import { fmtN } from '../../core/print/profileText'
import { PAGE_SIZE_PRESETS } from '../pageSizePresets'

/** Designer spec pdf-export D1, D5, §2.1–2.4: every Print string. */

/** Painting fills 0–95 %; the last 5 % is writing the file. */
const PAINT_SHARE = 95
/** The percent shown while the file is written. */
export const PRINT_SAVING_PERCENT = 97

function plural(count: number, one: string, many = `${one}s`): string {
  return `${String(count)} ${count === 1 ? one : many}`
}

/** `round(95 · painted / sheets)`; no sheets counts as painted. */
export function printPercent(painted: number, sheets: number): number {
  return sheets > 0 ? Math.round((PAINT_SHARE * painted) / sheets) : PAINT_SHARE
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
  const on = sheets === pages ? '' : ` on ${String(sheets)} sheets`
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

/** §2.2: "Page {i} of {sheets} · {p}%" while painting, "Saving · {p}%" after. */
export function printRunText(run: {
  painted: number
  sheets: number
  percent: number
  saving: boolean
}): string {
  if (run.saving) return `Saving · ${String(run.percent)}%`
  const page = Math.min(run.painted + 1, run.sheets)
  return `Page ${String(page)} of ${String(run.sheets)} · ${String(run.percent)}%`
}

/** §2.3: "lake-trip-A5.pdf · 40 pages · 12.3 MB" (MB = 10^6 bytes). */
export function printDoneText(
  file: string,
  sheets: number,
  bytes: number,
): string {
  return `${file} · ${plural(sheets, 'page')} · ${(bytes / 1_000_000).toFixed(1)} MB`
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

import type { SiteExportErrorCode } from '../../site/export/writeSiteTree'

/** Designer spec static-export §1–§2: every Export site string. */

export type ExportSitePhase = 'prepare' | 'render' | 'write'

export interface ExportSiteSummary {
  books: number
  files: number
  bytes: number
}

/** Names listed in the Books sentence before "and N more". */
const BOOKS_LISTED = 3

/** Overall percent bands per phase (kit `exportPhase`: <30, <80, else). */
const PHASE_BANDS: Record<ExportSitePhase, readonly [number, number]> = {
  prepare: [0, 30],
  render: [30, 80],
  write: [80, 100],
}

const PHASE_LABELS: Record<ExportSitePhase, string> = {
  prepare: 'Preparing photos',
  render: 'Rendering pages',
  write: 'Writing files',
}

/** The status region speaks again only after this many percent. */
const ANNOUNCE_STEP = 10

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`
}

/** "“Lake” as it is now, plus 2 books from earlier exports: Fog, Summer." */
export function exportBooksLine(
  title: string,
  others: readonly string[],
): string {
  if (others.length === 0) {
    return `“${title}” as it is now.`
  }
  const shown = others.slice(0, BOOKS_LISTED).join(', ')
  const names =
    others.length > BOOKS_LISTED
      ? `${shown} and ${String(others.length - BOOKS_LISTED)} more`
      : shown
  return `“${title}” as it is now, plus ${plural(others.length, 'book')} from earlier exports: ${names}.`
}

export function exportPhaseLabel(phase: ExportSitePhase): string {
  return PHASE_LABELS[phase]
}

/** One 0–100 integer across the phases; `total` 0 counts as done. */
export function exportPercent(
  phase: ExportSitePhase,
  done: number,
  total: number,
): number {
  const [from, to] = PHASE_BANDS[phase]
  const share = total > 0 ? Math.min(1, Math.max(0, done / total)) : 1
  return Math.floor(from + (to - from) * share)
}

/**
 * The percent the status region should announce now, or `null` to stay
 * quiet: the first progress, then every `ANNOUNCE_STEP` percent.
 */
export function nextAnnouncedPercent(
  percent: number,
  announced: number | null,
): number | null {
  return announced === null || percent - announced >= ANNOUNCE_STEP
    ? percent
    : null
}

export function exportStatusText(percent: number): string {
  return `Exporting site, ${String(percent)}%`
}

export const EXPORT_DONE_STATUS = 'Site exported'
export const EXPORT_FAILED_STATUS = 'Site export failed'

export function exportRunningTitle(percent: number): string {
  return `Exporting site · ${String(percent)}%`
}

export function exportFailText(
  code: SiteExportErrorCode,
  folder: string,
): string {
  switch (code) {
    case 'permission':
      return `Photobooks can’t write to “${folder}”. Allow access to the folder and try again.`
    case 'not-our-export':
      return `dist in “${folder}” isn’t a Photobooks export, so it was left as it is. Choose another folder.`
    case 'quota':
      return 'The disk is full.'
    case 'unknown':
      return 'Something went wrong while writing the site. Try again.'
  }
}

/** "2 books · 120 files · 32.1 MB in Site/dist." (MB = 10^6 bytes). */
export function exportSummaryText(
  summary: ExportSiteSummary,
  folder: string,
): string {
  const mb = (summary.bytes / 1_000_000).toFixed(1)
  return `${plural(summary.books, 'book')} · ${plural(summary.files, 'file')} · ${mb} MB in ${folder}/dist.`
}

// Zod-free: the print PDF's file name (Designer Spec pdf-export D8).
import { fmtN } from './profileText'

/** Kit page-size presets (portrait cm); `src/editor/pageSizePresets.ts` holds the same ids and sizes. */
export const PDF_NAME_PRESETS: readonly {
  id: string
  wCm: number
  hCm: number
}[] = [
  { id: 'A6', wCm: 10.5, hCm: 14.8 },
  { id: 'A5', wCm: 14.8, hCm: 21 },
  { id: 'A4', wCm: 21, hCm: 29.7 },
  { id: 'A3', wCm: 29.7, hCm: 42 },
  { id: 'Letter', wCm: 21.6, hCm: 27.9 },
  { id: 'sq20', wCm: 20, hCm: 20 },
  { id: 'sq30', wCm: 30, hCm: 30 },
]

/** Kit slug: lower-case ASCII letters and digits joined by `-`; `book` when none are left. */
export function titleSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'book'
  )
}

/**
 * `{slug(title)}-{preset id}.pdf` when the trim is a kit preset in either
 * orientation, else `{slug(title)}-{w}x{h}cm.pdf` (e.g. `lake-trip-A5.pdf`,
 * `lake-trip-19x23cm.pdf`).
 */
export function pdfFileName(
  title: string,
  trim: { widthMm: number; heightMm: number },
): string {
  const w = fmtN(trim.widthMm / 10)
  const h = fmtN(trim.heightMm / 10)
  const preset = PDF_NAME_PRESETS.find(
    (p) =>
      (fmtN(p.wCm) === w && fmtN(p.hCm) === h) ||
      (fmtN(p.wCm) === h && fmtN(p.hCm) === w),
  )
  return `${titleSlug(title)}-${preset?.id ?? `${w}x${h}cm`}.pdf`
}

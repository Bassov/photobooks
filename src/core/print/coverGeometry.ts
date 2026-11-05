// Zod-free: the site entry draws covers through `pages.ts`.
import type { RectMm } from '../geometry/types'
import { pagesOf } from '../pages'
import { bookPrintProfileRef, resolvePrintProfile } from '../printProfile'
import type { Book, SpineWidthSource } from '../schema'
import { genericPrintProfile } from './genericProfile'
import type { PrintProfile, SpineWidthRule } from './profileSchema'

export type CoverGeometryBook = Pick<
  Book,
  'spreads' | 'settings' | 'cover' | 'printProfile'
>

/** Rects in mm, origin at the cover sheet's top-left corner. */
export interface CoverGeometryRects {
  /** The closed cover: back, spine and front at trim height. */
  cover: RectMm
  back: RectMm
  spine: RectMm
  front: RectMm
  /** On the back board, touching the spine. */
  hingeBack: RectMm
  /** On the front board, touching the spine. */
  hingeFront: RectMm
  /** Safe frames; the spine-side edge is the hinge. */
  safeBack: RectMm
  safeFront: RectMm
  /** Front board plus the wrap on its top, outer and bottom edges. */
  frontPhoto: RectMm
}

/** Printed cover sheet of a hardcover book (mm). */
export interface CoverGeometry {
  trimW: number
  trimH: number
  spine: number
  wrap: number
  hinge: number
  safe: number
  /** Closed cover width: `2 × trimW + spine`. */
  coverW: number
  /** `coverW + 2 × wrap`. */
  sheetW: number
  /** `trimH + 2 × wrap`. */
  sheetH: number
  /** Pages of the book. */
  pages: number
  /** Pages printed: `pages` clamped to the profile's page count range. */
  printedPages: number
  profileName: string
  /** Effective spine source: `manual` only where the profile allows it. */
  source: SpineWidthSource
  rects: CoverGeometryRects
}

/**
 * Spine width (mm) of `rule` at `pages`, clamped to the profile's page count
 * range first. Formula: `baseMm + perPageMm × pages` to 0.1 mm; table: the
 * first row whose `maxPages` covers the count, else the last row.
 */
export function spineWidthMm(
  rule: SpineWidthRule,
  pages: number,
  pageCount: { min: number; max: number },
): number {
  const printed = Math.min(pageCount.max, Math.max(pageCount.min, pages))
  if (rule.kind === 'formula') {
    return Math.round((rule.baseMm + rule.perPageMm * printed) * 10) / 10
  }
  const row =
    rule.rows.find((candidate) => candidate.maxPages >= printed) ??
    rule.rows.reduce((_, last) => last)
  return row.widthMm
}

function rect(x: number, y: number, width: number, height: number): RectMm {
  return { x, y, width, height }
}

/** Cover sheet of `book` printed with `profile`. */
export function coverGeometry(
  profile: PrintProfile,
  book: CoverGeometryBook,
): CoverGeometry {
  const { widthMm: trimW, heightMm: trimH } = book.settings.trim
  const pages = pagesOf(book.spreads.length)
  const { min, max } = profile.pageCount
  const printedPages = Math.min(max, Math.max(min, pages))
  const source: SpineWidthSource =
    book.cover.print?.spineWidthSource === 'manual' &&
    profile.spine.manualOverride
      ? 'manual'
      : 'profile'
  const spine =
    source === 'manual'
      ? book.cover.style.spineWidthMm
      : spineWidthMm(profile.spine.width, pages, profile.pageCount)
  const wrap = profile.coverWrapMm
  const hinge = profile.coverHingeMm
  const safe = profile.safeMarginMm
  const coverW = 2 * trimW + spine
  const spineX = wrap + trimW
  const frontX = spineX + spine
  const safeW = trimW - safe - hinge
  const safeH = trimH - 2 * safe
  return {
    trimW,
    trimH,
    spine,
    wrap,
    hinge,
    safe,
    coverW,
    sheetW: coverW + 2 * wrap,
    sheetH: trimH + 2 * wrap,
    pages,
    printedPages,
    profileName: profile.name,
    source,
    rects: {
      cover: rect(wrap, wrap, coverW, trimH),
      back: rect(wrap, wrap, trimW, trimH),
      spine: rect(spineX, wrap, spine, trimH),
      front: rect(frontX, wrap, trimW, trimH),
      hingeBack: rect(spineX - hinge, wrap, hinge, trimH),
      hingeFront: rect(frontX, wrap, hinge, trimH),
      safeBack: rect(wrap + safe, wrap + safe, safeW, safeH),
      safeFront: rect(frontX + hinge, wrap + safe, safeW, safeH),
      frontPhoto: rect(frontX, 0, trimW + wrap, trimH + 2 * wrap),
    },
  }
}

/** Cover sheet of `book` with its effective profile; unknown id → generic. */
export function bookCoverGeometry(book: CoverGeometryBook): CoverGeometry {
  return coverGeometry(
    resolvePrintProfile(bookPrintProfileRef(book)) ?? genericPrintProfile(),
    book,
  )
}

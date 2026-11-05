import type { DpiThresholds } from './geometry/dpi'
import { pagesOf } from './pages'
import { builtInPrintProfiles } from './print/catalog'
import {
  DEFAULT_PRINT_PROFILE_ID,
  genericPrintProfile,
} from './print/genericProfile'
import type { PrintProfile } from './print/profileSchema'
import type { Book, PrintProfileOverrides, PrintProfileRef } from './schema'

export function defaultPrintProfileRef(): PrintProfileRef {
  return { id: DEFAULT_PRINT_PROFILE_ID, overrides: {} }
}

/** The book's profile reference; absent → the default profile. */
export function bookPrintProfileRef(
  book: Pick<Book, 'printProfile'>,
): PrintProfileRef {
  return book.printProfile ?? defaultPrintProfileRef()
}

/** Built-in profile `id`, else the library's custom one; neither → undefined. */
export function findPrintProfile(
  id: string,
  customs: readonly PrintProfile[],
): PrintProfile | undefined {
  return (
    builtInPrintProfiles().find((profile) => profile.id === id) ??
    customs.find((profile) => profile.id === id)
  )
}

/**
 * Spec D6: built-in id → library custom id (`customs`) → the book's snapshot,
 * with the overrides applied; none of them → undefined.
 */
export function resolvePrintProfile(
  ref: PrintProfileRef,
  customs: readonly PrintProfile[] = [],
): PrintProfile | undefined {
  const base = findPrintProfile(ref.id, customs) ?? ref.snapshot
  if (base === undefined) {
    return undefined
  }
  const overrides: PrintProfileOverrides = ref.overrides
  return {
    ...base,
    trimMinMm: overrides.trimMinMm ?? base.trimMinMm,
    trimMaxMm: overrides.trimMaxMm ?? base.trimMaxMm,
    bleedMinMm: overrides.bleedMinMm ?? base.bleedMinMm,
    bleedMaxMm: overrides.bleedMaxMm ?? base.bleedMaxMm,
  }
}

/** The book's effective profile; unresolved → Generic. */
export function bookPrintProfile(
  book: Pick<Book, 'printProfile'>,
  customs: readonly PrintProfile[] = [],
): PrintProfile {
  return (
    resolvePrintProfile(bookPrintProfileRef(book), customs) ??
    genericPrintProfile()
  )
}

/** DPI gates of the book's effective profile; unknown id → Generic's. */
export function bookDpiThresholds(
  book: Pick<Book, 'printProfile'>,
  customs: readonly PrintProfile[] = [],
): DpiThresholds {
  return bookPrintProfile(book, customs).dpi
}

export type PrintRangeField = 'trim-width' | 'trim-height' | 'bleed'

export type PrintProfileIssue =
  | { code: 'unknown-profile'; profileId: string }
  | {
      code: 'out-of-range'
      field: PrintRangeField
      valueMm: number
      minMm: number
      maxMm: number
    }
  | { code: 'pages-below-min'; pages: number; min: number }
  | { code: 'pages-above-max'; pages: number; max: number }

function rangeIssue(
  field: PrintRangeField,
  valueMm: number,
  minMm: number,
  maxMm: number,
): PrintProfileIssue[] {
  return valueMm >= minMm && valueMm <= maxMm
    ? []
    : [{ code: 'out-of-range', field, valueMm, minMm, maxMm }]
}

/**
 * Trim and bleed stay the user's values: the profile only reports the ones
 * outside its (overridden) limits and never changes the book. An unknown
 * profile is reported and the book is checked against Generic (Spec D6).
 */
export function validatePrintSettings(
  book: Pick<Book, 'settings' | 'printProfile'>,
  customs: readonly PrintProfile[] = [],
): PrintProfileIssue[] {
  const ref = bookPrintProfileRef(book)
  const resolved = resolvePrintProfile(ref, customs)
  const profile = resolved ?? genericPrintProfile()
  const { trim, bleedMm } = book.settings
  return [
    ...(resolved === undefined
      ? [{ code: 'unknown-profile' as const, profileId: ref.id }]
      : []),
    ...rangeIssue(
      'trim-width',
      trim.widthMm,
      profile.trimMinMm,
      profile.trimMaxMm,
    ),
    ...rangeIssue(
      'trim-height',
      trim.heightMm,
      profile.trimMinMm,
      profile.trimMaxMm,
    ),
    ...rangeIssue('bleed', bleedMm, profile.bleedMinMm, profile.bleedMaxMm),
  ]
}

/**
 * Book settings PRINT warnings: the trim / bleed checks plus a page count
 * outside the profile's (Spec D5: fewer pages print as the minimum).
 */
export function printIssues(
  book: Pick<Book, 'settings' | 'printProfile' | 'spreads'>,
  customs: readonly PrintProfile[] = [],
): PrintProfileIssue[] {
  const { min, max } = bookPrintProfile(book, customs).pageCount
  const pages = pagesOf(book.spreads.length)
  return [
    ...validatePrintSettings(book, customs),
    ...(pages < min ? [{ code: 'pages-below-min' as const, pages, min }] : []),
    ...(pages > max ? [{ code: 'pages-above-max' as const, pages, max }] : []),
  ]
}

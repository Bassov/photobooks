import { TRIM_MAX_MM, TRIM_MIN_MM } from './ops/bookSettings'
import type { Book, PrintProfileOverrides, PrintProfileRef } from './schema'

/** Trim / bleed limits a print profile puts on the book's own values (mm). */
export interface PrintProfile {
  id: string
  trimMinMm: number
  trimMaxMm: number
  bleedMinMm: number
  bleedMaxMm: number
}

export const DEFAULT_PRINT_PROFILE_ID = 'generic'

/**
 * Built-in profiles; `print-profiles` grows this into printer data. Built per
 * call (not at module load) so that its mutants are reachable per test.
 */
function builtInProfiles(): readonly PrintProfile[] {
  return [
    {
      id: DEFAULT_PRINT_PROFILE_ID,
      trimMinMm: TRIM_MIN_MM,
      trimMaxMm: TRIM_MAX_MM,
      bleedMinMm: 0,
      bleedMaxMm: 10,
    },
  ]
}

export function defaultPrintProfileRef(): PrintProfileRef {
  return { id: DEFAULT_PRINT_PROFILE_ID, overrides: {} }
}

/** The book's profile reference; absent → the default profile. */
export function bookPrintProfileRef(
  book: Pick<Book, 'printProfile'>,
): PrintProfileRef {
  return book.printProfile ?? defaultPrintProfileRef()
}

/** Built-in profile with the overrides applied; unknown id → undefined. */
export function resolvePrintProfile(
  ref: PrintProfileRef,
): PrintProfile | undefined {
  const base = builtInProfiles().find((profile) => profile.id === ref.id)
  if (base === undefined) {
    return undefined
  }
  const overrides: PrintProfileOverrides = ref.overrides
  return {
    id: base.id,
    trimMinMm: overrides.trimMinMm ?? base.trimMinMm,
    trimMaxMm: overrides.trimMaxMm ?? base.trimMaxMm,
    bleedMinMm: overrides.bleedMinMm ?? base.bleedMinMm,
    bleedMaxMm: overrides.bleedMaxMm ?? base.bleedMaxMm,
  }
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
 * outside its (overridden) limits and never changes the book.
 */
export function validatePrintSettings(
  book: Pick<Book, 'settings' | 'printProfile'>,
): PrintProfileIssue[] {
  const ref = bookPrintProfileRef(book)
  const profile = resolvePrintProfile(ref)
  if (profile === undefined) {
    return [{ code: 'unknown-profile', profileId: ref.id }]
  }
  const { trim, bleedMm } = book.settings
  return [
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

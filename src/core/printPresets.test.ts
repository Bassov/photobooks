import { describe, expect, it } from 'vitest'
import {
  applyBookOp,
  bookDpiThresholds,
  bookPrintProfile,
  builtInPrintProfiles,
  findPrintProfile,
  genericPrintProfile,
  pagesOf,
  parseBook,
  printIssues,
  refreshPrintProfile,
  resolvePrintProfile,
  serializeBook,
  setPageCount,
  setPrintProfile,
  validatePrintSettings,
  type Book,
} from './index'
import { spreadsForPages } from './pages'
import {
  makeBook,
  makeCustomPrintProfile,
  makeSpread,
} from './testing/fixtures'

const CUSTOM = makeCustomPrintProfile()
const GENERIC = genericPrintProfile()

function bookOfPages(pages: number, patch: Partial<Book> = {}): Book {
  return makeBook({
    ...patch,
    spreads: Array.from({ length: spreadsForPages(pages) }, (_, i) =>
      makeSpread({ id: `s${String(i + 1)}` }),
    ),
  })
}

function customBook(patch: Parameters<typeof makeBook>[0] = {}): Book {
  return makeBook({
    settings: { bleedMm: CUSTOM.bleedMinMm },
    printProfile: { id: CUSTOM.id, overrides: {}, snapshot: CUSTOM },
    ...patch,
  })
}

describe('built-in profiles', () => {
  it('lists Generic first, then the sourced shop profiles', () => {
    expect(builtInPrintProfiles()[0]).toEqual(GENERIC)
    expect(findPrintProfile('generic', [CUSTOM])).toEqual(GENERIC)
    expect(findPrintProfile(CUSTOM.id, [CUSTOM])).toBe(CUSTOM)
    expect(findPrintProfile(CUSTOM.id, [])).toBeUndefined()
  })
})

describe('profile resolution (D6)', () => {
  it('takes a built-in id before a custom profile or a snapshot with the same id', () => {
    const shadow = makeCustomPrintProfile({ id: 'generic', safeMarginMm: 1 })
    const ref = { id: 'generic', overrides: {}, snapshot: shadow }
    expect(resolvePrintProfile(ref, [shadow])).toEqual(GENERIC)
  })

  it('takes the library custom profile before the book snapshot', () => {
    const edited = makeCustomPrintProfile({ safeMarginMm: 9 })
    const ref = { id: CUSTOM.id, overrides: {}, snapshot: CUSTOM }
    expect(resolvePrintProfile(ref, [edited])).toEqual(edited)
    expect(resolvePrintProfile(ref)).toEqual(CUSTOM)
  })

  it('applies the overrides to a snapshot', () => {
    const ref = {
      id: CUSTOM.id,
      overrides: { trimMaxMm: 330, bleedMinMm: 0 },
      snapshot: CUSTOM,
    }
    expect(resolvePrintProfile(ref)).toEqual({
      ...CUSTOM,
      trimMaxMm: 330,
      bleedMinMm: 0,
    })
  })

  it('falls back to Generic with an unknown-profile issue when nothing matches', () => {
    const book = makeBook({ printProfile: { id: 'gone', overrides: {} } })
    expect(resolvePrintProfile({ id: 'gone', overrides: {} })).toBeUndefined()
    expect(bookPrintProfile(book)).toEqual(GENERIC)
    expect(validatePrintSettings(book)[0]).toEqual({
      code: 'unknown-profile',
      profileId: 'gone',
    })
    expect(validatePrintSettings(customBook())).toEqual([])
  })

  it('reads the DPI gates of a custom book from the library, else its snapshot', () => {
    const edited = makeCustomPrintProfile({ dpi: { warn: 250, min: 120 } })
    expect(bookDpiThresholds(customBook())).toEqual({ warn: 300, min: 150 })
    expect(bookDpiThresholds(customBook(), [edited])).toEqual({
      warn: 250,
      min: 120,
    })
  })

  it('round-trips a snapshot through the book schema and rejects a bad one', () => {
    const book = customBook()
    expect(parseBook(serializeBook(book))).toEqual({ ok: true, book })
    const bad = {
      ...book,
      printProfile: {
        id: CUSTOM.id,
        overrides: {},
        snapshot: { ...CUSTOM, trimMinMm: 0 },
      },
    }
    expect(parseBook(bad).ok).toBe(false)
  })
})

describe('printIssues (D5)', () => {
  it('reports fewer pages than the profile minimum', () => {
    const { printProfile, settings } = customBook()
    const book = bookOfPages(20, { printProfile, settings })
    expect(printIssues(book)).toEqual([
      { code: 'pages-below-min', pages: 20, min: 24 },
    ])
  })

  it('reports more pages than the profile maximum, after the trim checks', () => {
    const book = bookOfPages(84, {
      printProfile: customBook().printProfile,
      settings: {
        ...makeBook().settings,
        bleedMm: 3.175,
        trim: { widthMm: 310, heightMm: 300 },
      },
    })
    expect(printIssues(book)).toEqual([
      {
        code: 'out-of-range',
        field: 'trim-width',
        valueMm: 310,
        minMm: 150,
        maxMm: 300,
      },
      { code: 'pages-above-max', pages: 84, max: 80 },
    ])
  })

  it('reports nothing at both ends of the page range', () => {
    const printProfile = customBook().printProfile
    const settings = { ...makeBook().settings, bleedMm: 3.175 }
    for (const pages of [24, 80]) {
      expect(
        printIssues(bookOfPages(pages, { printProfile, settings })),
      ).toEqual([])
    }
  })
})

describe('setPrintProfile (D4)', () => {
  const book = bookOfPages(20, {
    settings: { ...makeBook().settings, bleedMm: 3, safeMarginMm: 5 },
    printProfile: { id: 'generic', overrides: { trimMaxMm: 330 } },
  })

  it('picks a custom profile with a snapshot, its bleed and safe margin, and keeps trim and pages', () => {
    const next = applyBookOp(book, {
      type: 'setPrintProfile',
      id: CUSTOM.id,
      customs: [CUSTOM],
    })
    expect(next.printProfile).toEqual({
      id: CUSTOM.id,
      overrides: {},
      snapshot: CUSTOM,
    })
    expect(next.settings).toEqual({
      ...book.settings,
      bleedMm: 3.175,
      safeMarginMm: 12.7,
    })
    expect(next.spreads).toBe(book.spreads)
    expect(pagesOf(setPageCount(next, 90).spreads.length)).toBe(80)
    expect(pagesOf(setPageCount(next, 27).spreads.length)).toBe(28)
  })

  it('picks a built-in profile without a snapshot and drops the overrides', () => {
    const custom = setPrintProfile(book, CUSTOM.id, [CUSTOM])
    const next = setPrintProfile(custom, 'generic')
    expect(next.printProfile).toEqual({ id: 'generic', overrides: {} })
    expect(next.settings).toEqual({
      ...book.settings,
      bleedMm: 3.175,
      safeMarginMm: 5,
    })
  })

  it('clamps the bleed into the profile range from below and above', () => {
    const wide = makeCustomPrintProfile({ bleedMinMm: 2, bleedMaxMm: 4 })
    const withBleed = (bleedMm: number) =>
      setPrintProfile(
        { ...book, settings: { ...book.settings, bleedMm } },
        wide.id,
        [wide],
      ).settings.bleedMm
    expect([1, 3, 6].map(withBleed)).toEqual([2, 3, 4])
  })

  it('leaves the book unchanged for an unknown id', () => {
    expect(setPrintProfile(book, 'gone', [CUSTOM])).toBe(book)
    expect(applyBookOp(book, { type: 'setPrintProfile', id: CUSTOM.id })).toBe(
      book,
    )
  })
})

describe('refreshPrintProfile (D6 snapshot refresh)', () => {
  const book = setPrintProfile(bookOfPages(20), CUSTOM.id, [CUSTOM])
  const edited = { ...CUSTOM, name: 'Edited', safeMarginMm: 9 }

  it('re-snapshots a book on the edited profile with its safe margin', () => {
    const next = applyBookOp(book, {
      type: 'refreshPrintProfile',
      profile: edited,
    })
    expect(next.printProfile?.snapshot).toEqual(edited)
    expect(next.settings.safeMarginMm).toBe(9)
  })

  it('leaves a book on another profile as it is', () => {
    const generic = bookOfPages(20)
    expect(refreshPrintProfile(generic, edited)).toBe(generic)
    expect(refreshPrintProfile(book, { ...edited, id: 'other' })).toBe(book)
  })
})

import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRINT_PROFILE_ID,
  DPI_MIN,
  DPI_WARN,
  TRIM_MAX_MM,
  TRIM_MIN_MM,
  bookDpiThresholds,
  bookPrintProfileRef,
  defaultCover,
  defaultPrintProfileRef,
  genericPrintProfile,
  parseBook,
  resolvePrintProfile,
  serializeBook,
  validatePrintSettings,
  type PrintProfileOverrides,
} from './index'
import { makeBook } from './testing/fixtures'

function bookWith(
  trim: { widthMm: number; heightMm: number },
  bleedMm: number,
  overrides: PrintProfileOverrides = {},
) {
  return makeBook({
    settings: { trim, bleedMm },
    printProfile: { id: DEFAULT_PRINT_PROFILE_ID, overrides },
  })
}

describe('print profile', () => {
  it('a book without a profile reads as the default profile', () => {
    const book = makeBook()
    expect(book).not.toHaveProperty('printProfile')
    expect(bookPrintProfileRef(book)).toEqual({
      id: 'generic',
      overrides: {},
    })
  })

  it('the default profile allows the editor trim range and 0–10 mm bleed', () => {
    const profile = resolvePrintProfile(defaultPrintProfileRef())
    expect(profile).toEqual(genericPrintProfile())
    expect(profile).toMatchObject({
      id: 'generic',
      coverWrapMm: 15,
      coverHingeMm: 8,
      trimMinMm: TRIM_MIN_MM,
      trimMaxMm: TRIM_MAX_MM,
      bleedMinMm: 0,
      bleedMaxMm: 10,
    })
  })

  it('the default profile keeps the editor DPI gates', () => {
    expect(bookDpiThresholds(makeBook())).toEqual({
      warn: DPI_WARN,
      min: DPI_MIN,
    })
    expect(
      bookDpiThresholds({ printProfile: defaultPrintProfileRef() }),
    ).toEqual({ warn: 200, min: 150 })
  })

  it('an unknown profile falls back to the default DPI gates', () => {
    expect(
      bookDpiThresholds({ printProfile: { id: 'lab-x', overrides: {} } }),
    ).toEqual({ warn: 200, min: 150 })
  })

  it.each([
    ['trimMinMm', { trimMinMm: 120 }],
    ['trimMaxMm', { trimMaxMm: 320 }],
    ['bleedMinMm', { bleedMinMm: 2 }],
    ['bleedMaxMm', { bleedMaxMm: 5 }],
  ] as const)('an override replaces only %s', (_field, overrides) => {
    const base = resolvePrintProfile(defaultPrintProfileRef())
    expect(
      resolvePrintProfile({ id: DEFAULT_PRINT_PROFILE_ID, overrides }),
    ).toEqual({ ...base, ...overrides })
  })

  it('an unknown profile id resolves to nothing', () => {
    expect(resolvePrintProfile({ id: 'lab-x', overrides: {} })).toBeUndefined()
  })
})

describe('validatePrintSettings', () => {
  it('reports nothing for trim and bleed inside the profile, bounds included', () => {
    expect(validatePrintSettings(makeBook())).toEqual([])
    expect(
      validatePrintSettings(
        bookWith({ widthMm: TRIM_MIN_MM, heightMm: TRIM_MAX_MM }, 0),
      ),
    ).toEqual([])
    expect(
      validatePrintSettings(bookWith({ widthMm: 300, heightMm: 300 }, 10)),
    ).toEqual([])
  })

  it('reports a trim width below and a trim height above the profile', () => {
    expect(
      validatePrintSettings(bookWith({ widthMm: 49.9, heightMm: 500.1 }, 3)),
    ).toEqual([
      {
        code: 'out-of-range',
        field: 'trim-width',
        valueMm: 49.9,
        minMm: TRIM_MIN_MM,
        maxMm: TRIM_MAX_MM,
      },
      {
        code: 'out-of-range',
        field: 'trim-height',
        valueMm: 500.1,
        minMm: TRIM_MIN_MM,
        maxMm: TRIM_MAX_MM,
      },
    ])
  })

  it('reports a bleed above the profile and keeps the book unchanged', () => {
    const book = bookWith({ widthMm: 300, heightMm: 300 }, 12)
    const before = structuredClone(book)
    expect(validatePrintSettings(book)).toEqual([
      {
        code: 'out-of-range',
        field: 'bleed',
        valueMm: 12,
        minMm: 0,
        maxMm: 10,
      },
    ])
    expect(book).toEqual(before)
  })

  it('validates against the overridden limits', () => {
    const book = bookWith({ widthMm: 300, heightMm: 210 }, 3, {
      trimMinMm: 250,
      trimMaxMm: 280,
      bleedMinMm: 5,
    })
    expect(validatePrintSettings(book)).toEqual([
      {
        code: 'out-of-range',
        field: 'trim-width',
        valueMm: 300,
        minMm: 250,
        maxMm: 280,
      },
      {
        code: 'out-of-range',
        field: 'trim-height',
        valueMm: 210,
        minMm: 250,
        maxMm: 280,
      },
      { code: 'out-of-range', field: 'bleed', valueMm: 3, minMm: 5, maxMm: 10 },
    ])
  })

  it('reports an unknown profile and checks the book against Generic (D6)', () => {
    const book = makeBook({
      settings: { bleedMm: 99 },
      printProfile: { id: 'lab-x', overrides: { bleedMaxMm: 100 } },
    })
    expect(validatePrintSettings(book)).toEqual([
      { code: 'unknown-profile', profileId: 'lab-x' },
      {
        code: 'out-of-range',
        field: 'bleed',
        valueMm: 99,
        minMm: 0,
        maxMm: 10,
      },
    ])
  })
})

describe('print fields in the schema', () => {
  it('round-trips a profile with overrides and a manual spine', () => {
    const book = makeBook({
      printProfile: {
        id: 'generic',
        overrides: { trimMaxMm: 330, bleedMinMm: 0 },
      },
      cover: { ...defaultCover('A'), print: { spineWidthSource: 'manual' } },
    })
    const result = parseBook(serializeBook(book))
    assert.equal(result.ok, true)
    expect(result.book).toEqual(book)
  })

  it('accepts a book without the optional print fields', () => {
    const book = makeBook()
    const cover: Record<string, unknown> = { ...book.cover }
    delete cover.print
    const result = parseBook({ ...book, cover })
    assert.equal(result.ok, true)
    expect(result.book).not.toHaveProperty('printProfile')
    expect(result.book.cover).not.toHaveProperty('print')
  })

  it.each([
    ['an empty profile id', { printProfile: { id: '', overrides: {} } }],
    ['missing overrides', { printProfile: { id: 'generic' } }],
    [
      'a zero trim override',
      { printProfile: { id: 'generic', overrides: { trimMinMm: 0 } } },
    ],
    [
      'a negative bleed override',
      { printProfile: { id: 'generic', overrides: { bleedMaxMm: -1 } } },
    ],
    [
      'a non-numeric override',
      { printProfile: { id: 'generic', overrides: { trimMaxMm: '300' } } },
    ],
    [
      'an unknown spine width source',
      {
        cover: { ...defaultCover(''), print: { spineWidthSource: 'pages' } },
      },
    ],
  ])('rejects %s', (_name, patch) => {
    const result = parseBook({ ...makeBook(), ...patch })
    expect(result.ok).toBe(false)
  })
})

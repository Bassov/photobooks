import { describe, expect, it } from 'vitest'
import { makeCustomPrintProfile } from '../testing/fixtures'
import { genericPrintProfile } from './genericProfile'
import {
  editableProfileIssues,
  printIssueText,
  profileHint,
  profileSummary,
} from './profileText'

const CUSTOM = makeCustomPrintProfile()
const NAME = CUSTOM.name

describe('profile summary and hint', () => {
  it('summarises Generic with its bleed range', () => {
    expect(profileSummary(genericPrintProfile())).toBe(
      '5–50 cm · bleed 0–10 mm · safe 5 mm · 20–120 pages · photos ≥ 200 ppi',
    )
  })

  it('summarises one bleed and rounds mm and cm to one decimal', () => {
    expect(profileSummary(CUSTOM)).toBe(
      '15–30 cm · bleed 3.2 mm · safe 12.7 mm · 24–80 pages · photos ≥ 300 ppi',
    )
    expect(
      profileSummary(makeCustomPrintProfile({ trimMinMm: 203.2 })),
    ).toMatch(/^20\.3–30 cm/)
  })

  it('hints the trim range, page count and photo resolution', () => {
    expect(profileHint(CUSTOM)).toBe(
      '15–30 cm · 24–80 pages · photos ≥ 300 ppi',
    )
  })
})

describe('printIssueText', () => {
  it.each([
    [
      { code: 'unknown-profile', profileId: 'gone' } as const,
      'This book’s printer isn’t in this library. Using Generic.',
    ],
    [
      { code: 'pages-below-min', pages: 20, min: 24 } as const,
      `${NAME} prints at least 24 pages; this book’s 20 print as 24.`,
    ],
    [
      { code: 'pages-above-max', pages: 84, max: 80 } as const,
      `${NAME} prints up to 80 pages. This book has 84.`,
    ],
    [
      {
        code: 'out-of-range',
        field: 'trim-width',
        valueMm: 140,
        minMm: 150,
        maxMm: 300,
      } as const,
      `${NAME} takes pages from 15 cm. This page is 14 cm wide.`,
    ],
    [
      {
        code: 'out-of-range',
        field: 'trim-height',
        valueMm: 305,
        minMm: 150,
        maxMm: 300,
      } as const,
      `${NAME} takes pages up to 30 cm. This page is 30.5 cm high.`,
    ],
    [
      {
        code: 'out-of-range',
        field: 'bleed',
        valueMm: 3,
        minMm: 3.175,
        maxMm: 3.175,
      } as const,
      `${NAME} takes 3.2 mm bleed. This book has 3 mm.`,
    ],
    [
      {
        code: 'out-of-range',
        field: 'bleed',
        valueMm: 12,
        minMm: 0,
        maxMm: 10,
      } as const,
      `${NAME} takes 0–10 mm bleed. This book has 12 mm.`,
    ],
  ])('words %j', (issue, text) => {
    expect(printIssueText(issue, NAME)).toBe(text)
  })
})

describe('editableProfileIssues', () => {
  it('passes the Generic and the custom profile', () => {
    expect(editableProfileIssues(genericPrintProfile())).toEqual([])
    expect(editableProfileIssues(CUSTOM)).toEqual([])
  })

  it('asks for a name', () => {
    expect(editableProfileIssues({ ...CUSTOM, name: '  ' })).toEqual([
      { field: 'name', message: 'Give the profile a name.' },
    ])
  })

  it('asks for numbers above 0 where they must be positive', () => {
    const zeroed = {
      ...CUSTOM,
      trimMinMm: 0,
      trimMaxMm: -1,
      pageCount: { min: 0, step: 0, max: 0 },
      spine: {
        ...CUSTOM.spine,
        width: { kind: 'formula' as const, baseMm: 0, perPageMm: 0 },
      },
      dpi: { warn: 0, min: 0 },
    }
    expect(editableProfileIssues(zeroed).map(({ field }) => field)).toEqual([
      'trimMinMm',
      'trimMaxMm',
      'pageCount.min',
      'pageCount.max',
      'pageCount.step',
      'spine.perPageMm',
      'dpi.warn',
      'dpi.min',
    ])
    expect(
      new Set(editableProfileIssues(zeroed).map(({ message }) => message)),
    ).toEqual(new Set(['Enter a number above 0.']))
  })

  it('skips the spine per-page check for a table spine', () => {
    const table = {
      ...CUSTOM,
      spine: {
        ...CUSTOM.spine,
        width: {
          kind: 'table' as const,
          rows: [{ maxPages: 80, widthMm: 10 }],
        },
      },
    }
    expect(editableProfileIssues(table)).toEqual([])
  })

  it('rejects a largest side below the smallest', () => {
    expect(editableProfileIssues({ ...CUSTOM, trimMaxMm: 149 })).toEqual([
      {
        field: 'trimMaxMm',
        message: 'The largest side can’t be smaller than the smallest.',
      },
    ])
    expect(editableProfileIssues({ ...CUSTOM, trimMaxMm: 150 })).toEqual([])
    expect(editableProfileIssues({ ...CUSTOM, trimMaxMm: 0 })).toEqual([
      { field: 'trimMaxMm', message: 'Enter a number above 0.' },
    ])
  })

  it('asks for an even step and whole steps with the nearest maxima', () => {
    expect(
      editableProfileIssues({
        ...CUSTOM,
        pageCount: { min: 24, step: 3, max: 81 },
      }),
    ).toEqual([
      {
        field: 'pageCount.step',
        message: 'Pages come in spreads: the step must be even.',
      },
    ])
    expect(
      editableProfileIssues({
        ...CUSTOM,
        pageCount: { min: 24, step: 4, max: 82 },
      }),
    ).toEqual([
      {
        field: 'pageCount.max',
        message: '24 to 82 isn’t whole steps of 4. Try 80 or 84.',
      },
    ])
    expect(
      editableProfileIssues({
        ...CUSTOM,
        pageCount: { min: 40, step: 4, max: 20 },
      }),
    ).toEqual([
      {
        field: 'pageCount.max',
        message: '40 to 20 isn’t whole steps of 4. Try 40 or 44.',
      },
    ])
  })

  it('keeps the DPI minimum at or below Warn under', () => {
    expect(
      editableProfileIssues({ ...CUSTOM, dpi: { warn: 300, min: 301 } }),
    ).toEqual([
      { field: 'dpi.min', message: 'Minimum can’t be above Warn under.' },
    ])
    expect(
      editableProfileIssues({ ...CUSTOM, dpi: { warn: 300, min: 300 } }),
    ).toEqual([])
    expect(
      editableProfileIssues({ ...CUSTOM, dpi: { warn: -1, min: 0 } }),
    ).toEqual([
      { field: 'dpi.warn', message: 'Enter a number above 0.' },
      { field: 'dpi.min', message: 'Enter a number above 0.' },
    ])
  })
})

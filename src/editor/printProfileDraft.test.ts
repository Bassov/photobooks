import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import { genericPrintProfile, type PrintProfile } from '../core'
import { makeCustomPrintProfile } from '../core/testing/fixtures'
import {
  DRAFT_NUMBERS,
  draftBleed,
  draftIssues,
  fromDraft,
  printProfileOptions,
  savableProfile,
  toDraft,
} from './printProfileDraft'

const CUSTOM = makeCustomPrintProfile()
const TABLE: PrintProfile = makeCustomPrintProfile({
  id: 'custom-table',
  basedOn: 'Shop',
  spine: {
    ...genericPrintProfile().spine,
    width: {
      kind: 'table',
      rows: [
        { maxPages: 40, widthMm: 10 },
        { maxPages: 80, widthMm: 14 },
      ],
    },
  },
})

describe('toDraft / fromDraft', () => {
  it('shows stored values as is and one bleed inside a built-in range', () => {
    const draft = toDraft(CUSTOM)
    expect(draft).toMatchObject({
      name: CUSTOM.name,
      bleed: '3.175',
      safe: '12.7',
      pMin: '24',
      pStep: '4',
      dpiWarn: '300',
    })
    expect(draftBleed(genericPrintProfile())).toBe(3)
    expect(draftBleed({ ...CUSTOM, bleedMinMm: 4, bleedMaxMm: 6 })).toBe(4)
    expect(draftBleed({ ...CUSTOM, bleedMinMm: 0, bleedMaxMm: 2 })).toBe(2)
  })

  it('keeps a table spine and writes one bleed to both ends', () => {
    const next = fromDraft(TABLE, { ...toDraft(TABLE), bleed: '5' })
    expect(next.spine.width).toEqual(TABLE.spine.width)
    expect([next.bleedMinMm, next.bleedMaxMm]).toEqual([5, 5])
  })

  test.prop([
    fc.record({
      trimMin: fc.integer({ min: 50, max: 200 }),
      extra: fc.integer({ min: 0, max: 300 }),
      bleed: fc.integer({ min: 0, max: 100 }).map((n) => n / 10),
      pMin: fc.integer({ min: 1, max: 20 }).map((n) => n * 2),
      steps: fc.integer({ min: 0, max: 40 }),
      dpiMin: fc.integer({ min: 1, max: 300 }),
    }),
  ])('a valid profile round-trips through the draft', (v) => {
    const profile: PrintProfile = {
      ...CUSTOM,
      trimMinMm: v.trimMin,
      trimMaxMm: v.trimMin + v.extra,
      bleedMinMm: v.bleed,
      bleedMaxMm: v.bleed,
      pageCount: { min: v.pMin, step: 2, max: v.pMin + v.steps * 2 },
      dpi: { warn: v.dpiMin + 50, min: v.dpiMin },
    }
    expect(draftIssues(profile, toDraft(profile))).toEqual({})
    expect(savableProfile(profile, toDraft(profile))).toEqual(profile)
  })
})

describe('draftIssues', () => {
  test.prop([
    fc.constantFrom(...DRAFT_NUMBERS),
    fc.constantFrom('', 'abc', '-1', ' '),
  ])('a non-number blocks Save on that field', (key, text) => {
    const draft = { ...toDraft(CUSTOM), [key]: text }
    expect(draftIssues(CUSTOM, draft)[key]).toBe('Enter a number above 0.')
    expect(savableProfile(CUSTOM, draft)).toBeUndefined()
  })

  it('lets bleed, safe, spine base, wrap and hinge be 0, not the rest', () => {
    const zero = (key: string) =>
      draftIssues(CUSTOM, { ...toDraft(CUSTOM), [key]: '0' })
    for (const key of ['bleed', 'safe', 'spineBase', 'wrap', 'hinge']) {
      expect(zero(key)).toEqual({})
    }
    expect(zero('dpiMin')).toEqual({ dpiMin: 'Enter a number above 0.' })
  })

  it('asks for whole page counts', () => {
    expect(draftIssues(CUSTOM, { ...toDraft(CUSTOM), pMin: '24.5' }).pMin).toBe(
      'Enter a number above 0.',
    )
  })

  it('maps the core rules onto their fields', () => {
    const issues = draftIssues(CUSTOM, {
      ...toDraft(CUSTOM),
      name: ' ',
      trimMin: '300',
      trimMax: '200',
      pMax: '30',
      dpiMin: '400',
    })
    expect(issues).toEqual({
      name: 'Give the profile a name.',
      trimMax: 'The largest side can’t be smaller than the smallest.',
      pMax: '24 to 30 isn’t whole steps of 4. Try 28 or 32.',
      dpiMin: 'Minimum can’t be above Warn under.',
    })
  })

  it('reports an odd step once and holds the range rule while inputs are bad', () => {
    expect(draftIssues(CUSTOM, { ...toDraft(CUSTOM), pStep: '3' })).toEqual({
      pStep: 'Pages come in spreads: the step must be even.',
    })
    expect(
      draftIssues(CUSTOM, { ...toDraft(CUSTOM), pMin: 'x', pMax: '31' }),
    ).toEqual({ pMin: 'Enter a number above 0.' })
  })

  it('treats blank, infinite and negative text as no number, even where 0 is fine', () => {
    for (const text of ['', ' ', 'Infinity', '-0.5']) {
      expect(draftIssues(CUSTOM, { ...toDraft(CUSTOM), bleed: text })).toEqual({
        bleed: 'Enter a number above 0.',
      })
    }
    expect(draftIssues(CUSTOM, { ...toDraft(CUSTOM), bleed: '0.5' })).toEqual(
      {},
    )
  })

  it('checks the spine numbers of a formula spine', () => {
    expect(draftIssues(CUSTOM, { ...toDraft(CUSTOM), spineBase: 'x' })).toEqual(
      { spineBase: 'Enter a number above 0.' },
    )
  })

  it('saves a trimmed name, and nothing while a core rule fails', () => {
    expect(
      savableProfile(CUSTOM, { ...toDraft(CUSTOM), name: '  Lab  ' })?.name,
    ).toBe('Lab')
    expect(
      savableProfile(CUSTOM, { ...toDraft(CUSTOM), dpiMin: '400' }),
    ).toBeUndefined()
  })

  it('skips the spine numbers of a table spine', () => {
    const draft = { ...toDraft(TABLE), spineBase: 'x', spinePer: '' }
    expect(draftIssues(TABLE, draft)).toEqual({})
    expect(savableProfile(TABLE, draft)?.spine).toEqual(TABLE.spine)
  })
})

describe('printProfileOptions', () => {
  it('groups print shops, then customs, plus a book-only snapshot', () => {
    const lost = { ...CUSTOM, id: 'custom-lost', name: 'Lost' }
    expect(printProfileOptions([CUSTOM], lost)).toEqual([
      { value: 'generic', label: 'Generic', group: 'Print shops' },
      { value: CUSTOM.id, label: CUSTOM.name, group: 'Custom' },
      { value: 'custom-lost', label: 'Lost', group: 'Custom' },
    ])
    expect(printProfileOptions([CUSTOM], CUSTOM)).toHaveLength(2)
    expect(printProfileOptions([], genericPrintProfile())).toHaveLength(1)
    const other = { ...CUSTOM, id: 'custom-other', name: 'Other' }
    expect(printProfileOptions([other, CUSTOM], CUSTOM)).toHaveLength(3)
  })
})

import { describe, expect, it } from 'vitest'
import {
  pageList,
  preflightRows,
  preflightRules,
  type PreflightIssue,
  type PreflightRuleId,
} from '../index'

const profile = { name: 'Shop', safeMarginMm: 4.5, colorSpace: 'srgb' } as const

function issue(
  rule: PreflightRuleId,
  page?: number,
  numbers: { measured?: number; threshold?: number } = {},
): PreflightIssue {
  return {
    rule,
    ...preflightRules()[rule],
    location: page === undefined ? {} : { page, itemId: `f${String(page)}` },
    ...numbers,
  }
}

function texts(issues: PreflightIssue[]) {
  return preflightRows({ issues, colors: [], profile }).map(
    ({ text, pageList }) => text + pageList,
  )
}

describe('pageList', () => {
  it('is empty without pages', () => {
    expect(pageList([])).toBe('')
  })

  it('names one page and lists up to five', () => {
    expect(pageList([6])).toBe(' · page 6')
    expect(pageList([2, 3, 6])).toBe(' · pages 2, 3, 6')
    expect(pageList([1, 2, 3, 4, 5])).toBe(' · pages 1, 2, 3, 4, 5')
  })

  it('counts the pages past five as +n', () => {
    expect(pageList([1, 2, 3, 4, 5, 6, 9, 12])).toBe(
      ' · pages 1, 2, 3, 4, 5 +3',
    )
  })
})

describe('preflightRows', () => {
  it('is empty for a clean book', () => {
    expect(preflightRows({ issues: [], colors: [], profile })).toEqual([])
  })

  it('words the page-count rules with the profile name', () => {
    expect(
      texts([
        issue('page-count-below-min', undefined, {
          measured: 12,
          threshold: 20,
        }),
      ]),
    ).toEqual(['Shop prints at least 20 pages. This book has 12.'])
    expect(
      texts([
        issue('page-count-above-max', undefined, {
          measured: 130,
          threshold: 120,
        }),
      ]),
    ).toEqual(['Shop prints up to 120 pages. This book has 130.'])
    expect(
      texts([
        issue('page-count-step', undefined, { measured: 23, threshold: 2 }),
      ]),
    ).toEqual(['Shop prints pages in steps of 2. This book has 23.'])
  })

  it('words one issue in the singular', () => {
    expect(
      texts([
        issue('asset-missing', 2),
        issue('asset-modified', 3),
        issue('dpi-below-min', 4, { measured: 90, threshold: 150 }),
        issue('dpi-below-warn', 5, { measured: 200, threshold: 240 }),
        issue('empty-image-frame', 6),
        issue('empty-text-frame', 7),
        issue('safe-zone-intrusion', 8),
        issue('bleed-hazard', 9),
      ]),
    ).toEqual([
      '1 photo can’t be found · page 2',
      '1 photo below 150 ppi · page 4',
      '1 photo changed on disk since it was added · page 3',
      '1 photo below 240 ppi · page 5',
      '1 empty photo frame · page 6',
      '1 frame crosses the 4.5 mm safe margin · page 8',
      '1 photo stops short of the bleed · page 9',
      '1 empty text frame · page 7',
    ])
  })

  it('groups a rule into one row with the count and the pages', () => {
    const rows = preflightRows({
      issues: [
        issue('bleed-hazard', 6),
        issue('asset-modified', 3),
        issue('bleed-hazard', 2),
        issue('asset-modified', 3),
        issue('safe-zone-intrusion', 4),
        issue('safe-zone-intrusion', 4),
        issue('empty-image-frame', 1),
        issue('empty-image-frame', 1),
        issue('empty-text-frame', 1),
        issue('empty-text-frame', 1),
      ],
      colors: [],
      profile,
    })

    expect(
      rows.map(({ id, count, text, pages }) => ({ id, count, text, pages })),
    ).toEqual([
      {
        id: 'asset-modified',
        count: 2,
        text: '2 photos changed on disk since they were added',
        pages: [3],
      },
      {
        id: 'empty-image-frame',
        count: 2,
        text: '2 empty photo frames',
        pages: [1],
      },
      {
        id: 'safe-zone-intrusion',
        count: 2,
        text: '2 frames cross the 4.5 mm safe margin',
        pages: [4],
      },
      {
        id: 'bleed-hazard',
        count: 2,
        text: '2 photos stop short of the bleed',
        pages: [2, 6],
      },
      {
        id: 'empty-text-frame',
        count: 2,
        text: '2 empty text frames',
        pages: [1],
      },
    ])
    expect(rows.map(({ severity }) => severity)).toEqual([
      'warning',
      'warning',
      'warning',
      'warning',
      'info',
    ])
  })

  it('adds the colour row after dpi-below-warn, families in a fixed order', () => {
    const rows = preflightRows({
      issues: [
        issue('empty-image-frame', 9),
        issue('dpi-below-warn', 5, { threshold: 240 }),
        issue('asset-missing', 2),
        issue('asset-missing', 4),
      ],
      colors: [
        { family: 'display-p3', pages: [8, 3] },
        { family: 'adobe-rgb', pages: [3] },
        { family: 'display-p3', pages: [] },
      ],
      profile,
    })

    expect(
      rows.map(({ id, severity, text, pageList }) => [
        id,
        severity,
        text + pageList,
      ]),
    ).toEqual([
      ['asset-missing', 'error', '2 photos can’t be found · pages 2, 4'],
      ['dpi-below-warn', 'warning', '1 photo below 240 ppi · page 5'],
      [
        'color-space',
        'warning',
        '3 photos aren’t sRGB (Adobe RGB, Display P3), colours may shift · pages 3, 8',
      ],
      ['empty-image-frame', 'warning', '1 empty photo frame · page 9'],
    ])
    expect(rows[2]?.count).toBe(3)
  })

  it('words one non-sRGB photo in the singular', () => {
    const [row] = preflightRows({
      issues: [],
      colors: [{ family: 'other-rgb', pages: [6] }],
      profile,
    })

    expect(row?.text).toBe('1 photo isn’t sRGB (other RGB), colours may shift')
  })
})

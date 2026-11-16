import { describe, expect, it } from 'vitest'
import type { PreflightRow } from '../../core'
import {
  imposePercent,
  PRINT_LAYOUTS,
  printBleedLabel,
  printCheckLabel,
  printCoverText,
  printDoneCoverText,
  printDoneText,
  printDuplexText,
  printFailText,
  printPercent,
  printRunningTitle,
  printRunText,
  printSavedText,
  printSizeText,
  printSkippedPages,
  printSkippedText,
  printStatusText,
  printSummary,
} from './printText'

const row = (severity: PreflightRow['severity']): PreflightRow => ({
  id: 'dpi-below-min',
  severity,
  count: 1,
  text: '',
  pages: [],
  pageList: '',
})

describe('printText', () => {
  it('names a preset size in either orientation, else Custom', () => {
    expect(printSizeText({ widthMm: 148, heightMm: 210 })).toBe(
      'A5 · 14.8 × 21 cm',
    )
    expect(printSizeText({ widthMm: 210, heightMm: 148 })).toBe(
      'A5 · 21 × 14.8 cm',
    )
    expect(printSizeText({ widthMm: 200, heightMm: 200 })).toBe(
      'Square 20×20 · 20 × 20 cm',
    )
    expect(printSizeText({ widthMm: 190, heightMm: 230 })).toBe(
      'Custom · 19 × 23 cm',
    )
  })

  it('labels the bleed checkbox, naming a different cover bleed', () => {
    expect(printBleedLabel(3)).toBe('Add 3 mm bleed and crop marks')
    expect(printBleedLabel(2.5)).toBe('Add 2.5 mm bleed and crop marks')
    expect(printBleedLabel(3, 3)).toBe('Add 3 mm bleed and crop marks')
    expect(printBleedLabel(3, 5)).toBe(
      'Add 3 mm bleed (cover 5 mm) and crop marks',
    )
  })

  it('writes the Cover row: the sheet with 1 per sheet, else none', () => {
    expect(printCoverText({ sheetW: 338, sheetH: 240, spine: 12 })).toBe(
      '33.8 × 24 cm · spine 12 mm',
    )
    expect(printCoverText({ sheetW: 422, sheetH: 260, spine: 12.4 })).toBe(
      '42.2 × 26 cm · spine 12.4 mm',
    )
    expect(printCoverText(null)).toBe('None with booklets')
  })

  it('adds the cover to the 1 per sheet summary (cover-pdf §2.1.3)', () => {
    expect(printSummary(20, 20, 3, 3)).toBe(
      'PDF · 20 pages + cover · bleed 3 mm',
    )
    expect(printSummary(20, 20, 3, 5)).toBe(
      'PDF · 20 pages + cover · bleed 3 mm, cover 5 mm',
    )
    expect(printSummary(20, 20, null, 5)).toBe(
      'PDF · 20 pages + cover · trim size, no marks',
    )
  })

  it('summarises pages, sheets and the bleed choice (D5)', () => {
    expect(printSummary(20, 20, 3)).toBe('PDF · 20 pages · bleed 3 mm')
    expect(printSummary(20, 20, null)).toBe(
      'PDF · 20 pages · trim size, no marks',
    )
    expect(printSummary(8, 1, null)).toBe(
      'PDF · 8 pages on 1 sheet · trim size, no marks',
    )
    expect(printSummary(20, 11, 3)).toBe(
      'PDF · 20 pages on 11 sheets · bleed 3 mm',
    )
  })

  it('counts errors and warnings in the Check label, not info', () => {
    expect(printCheckLabel([])).toBe('Check')
    expect(printCheckLabel([row('info')])).toBe('Check')
    expect(printCheckLabel([row('error'), row('warning'), row('info')])).toBe(
      'Check · 1 error, 1 warning',
    )
    expect(
      printCheckLabel([row('warning'), row('warning'), row('warning')]),
    ).toBe('Check · 3 warnings')
    expect(printCheckLabel([row('error'), row('error')])).toBe(
      'Check · 2 errors',
    )
  })

  it('maps painted sheets + the cover to 0–95 %, a booklet to 0–80 %', () => {
    expect(printPercent(0, 20, 'single')).toBe(0)
    expect(printPercent(10, 20, 'single')).toBe(45)
    expect(printPercent(20, 20, 'single')).toBe(90)
    expect(printPercent(21, 20, 'single')).toBe(95)
    expect(printPercent(0, 0, 'single')).toBe(0)
    expect(printPercent(10, 20, '2up')).toBe(40)
    expect(printPercent(20, 20, '4up')).toBe(80)
    expect(printPercent(0, 0, '2up')).toBe(80)
  })

  it('maps imposed sheets to 80–95 %', () => {
    expect(imposePercent(0, 4)).toBe(80)
    expect(imposePercent(1, 4)).toBe(84)
    expect(imposePercent(4, 4)).toBe(95)
    expect(imposePercent(0, 0)).toBe(95)
  })

  it('shows the page being painted, the cover or a booklet imposing, then saving', () => {
    const run = {
      painted: 10,
      sheets: 20,
      percent: 45,
      saving: false,
      layout: 'single' as const,
      imposing: null,
    }
    expect(printRunText(run)).toBe('Page 11 of 20 · 45%')
    expect(printRunText({ ...run, painted: 19, percent: 86 })).toBe(
      'Page 20 of 20 · 86%',
    )
    expect(printRunText({ ...run, painted: 20, percent: 90 })).toBe(
      'Cover · 90%',
    )
    const booklet = { ...run, layout: '2up' as const }
    expect(printRunText({ ...booklet, painted: 20, percent: 80 })).toBe(
      'Page 20 of 20 · 80%',
    )
    const imposing = { ...booklet, painted: 20, percent: 84 }
    expect(
      printRunText({ ...imposing, imposing: { imposed: 1, sheets: 4 } }),
    ).toBe('Imposing sheets · 2 of 4 · 84%')
    expect(
      printRunText({ ...imposing, imposing: { imposed: 4, sheets: 4 } }),
    ).toBe('Imposing sheets · 4 of 4 · 84%')
    expect(printRunText({ ...run, percent: 97, saving: true })).toBe(
      'Saving · 97%',
    )
    expect(
      printRunText({
        ...run,
        percent: 97,
        saving: true,
        imposing: { imposed: 4, sheets: 4 },
      }),
    ).toBe('Saving · 97%')
  })

  it('lists the imposition choices', () => {
    expect(PRINT_LAYOUTS).toEqual([
      { id: 'single', label: '1 per sheet' },
      { id: '2up', label: '2-up' },
      { id: '4up', label: '4-up' },
    ])
  })

  it('tells how to print and fold each booklet', () => {
    expect(printDuplexText('2up')).toBe(
      'Print on both sides, flip on the short edge. Stack the sheets in order, fold in half and staple on the fold.',
    )
    expect(printDuplexText('4up')).toBe(
      'Print on both sides, flip on the long edge. Cut each sheet across, put the top half on the bottom half, fold and staple.',
    )
  })

  it('writes the done, saved and skipped lines', () => {
    expect(printDoneText('lake-trip-A5.pdf', 20, 12_345_678, 'single')).toBe(
      'lake-trip-A5.pdf · 20 pages · 12.3 MB',
    )
    expect(printDoneText('a.pdf', 1, 40_000, 'single')).toBe(
      'a.pdf · 1 page · 0.0 MB',
    )
    expect(printDoneText('a-2up.pdf', 4, 2_000_000, '2up')).toBe(
      'a-2up.pdf · 4 sheets · 2.0 MB',
    )
    expect(printDoneText('a-4up.pdf', 1, 2_000_000, '4up')).toBe(
      'a-4up.pdf · 1 sheet · 2.0 MB',
    )
    expect(printSavedText('Photobooks')).toBe('Saved in Photobooks/exports.')
    expect(printSkippedText(1)).toBe(
      '1 photo couldn’t be read and prints as blank paper',
    )
    expect(printSkippedText(2)).toBe(
      '2 photos couldn’t be read and print as blank paper',
    )
    expect(printDoneCoverText('lake-trip-A5-cover.pdf', 2_940_000)).toBe(
      'lake-trip-A5-cover.pdf · cover · 2.9 MB',
    )
  })

  it('lists the skipped photos’ pages with the cover first', () => {
    expect(printSkippedPages([2, 6], false)).toBe(' · pages 2, 6')
    expect(printSkippedPages([2, 6], true)).toBe(' · cover, pages 2, 6')
    expect(printSkippedPages([3], true)).toBe(' · cover, page 3')
    expect(printSkippedPages([], true)).toBe(' · cover')
    expect(printSkippedPages([], false)).toBe('')
  })

  it('explains each failure', () => {
    expect(printFailText('access', 'Photobooks')).toBe(
      'Photobooks can’t write to “Photobooks”. Allow access to the folder and try again.',
    )
    expect(printFailText('full', 'L')).toBe('The disk is full.')
    expect(printFailText('other', 'L')).toBe(
      'Something went wrong while making the PDF. Try again.',
    )
  })

  it('titles and announces the running pill', () => {
    expect(printRunningTitle(42)).toBe('Exporting PDF · 42%')
    expect(printStatusText(40)).toBe('Exporting PDF, 40%')
  })
})

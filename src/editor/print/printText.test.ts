import { describe, expect, it } from 'vitest'
import type { PreflightRow } from '../../core'
import {
  imposePercent,
  PRINT_LAYOUTS,
  printBleedLabel,
  printCheckLabel,
  printDoneText,
  printDuplexText,
  printFailText,
  printPercent,
  printRunningTitle,
  printRunText,
  printSavedText,
  printSizeText,
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

  it('labels the bleed checkbox from the profile bleed', () => {
    expect(printBleedLabel(3)).toBe('Add 3 mm bleed and crop marks')
    expect(printBleedLabel(2.5)).toBe('Add 2.5 mm bleed and crop marks')
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

  it('maps painted sheets to 0–95 %, a booklet to 0–80 %', () => {
    expect(printPercent(0, 20, 'single')).toBe(0)
    expect(printPercent(10, 20, 'single')).toBe(48)
    expect(printPercent(20, 20, 'single')).toBe(95)
    expect(printPercent(0, 0, 'single')).toBe(95)
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

  it('shows the page being painted, a booklet imposing, then saving', () => {
    const run = {
      painted: 10,
      sheets: 20,
      percent: 48,
      saving: false,
      imposing: null,
    }
    expect(printRunText(run)).toBe('Page 11 of 20 · 48%')
    expect(printRunText({ ...run, painted: 20, percent: 95 })).toBe(
      'Page 20 of 20 · 95%',
    )
    const imposing = { ...run, painted: 20, percent: 84 }
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

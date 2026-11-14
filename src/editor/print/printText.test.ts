import { describe, expect, it } from 'vitest'
import type { PreflightRow } from '../../core'
import {
  printBleedLabel,
  printCheckLabel,
  printDoneText,
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

  it('maps painted sheets to 0–95 %', () => {
    expect(printPercent(0, 20)).toBe(0)
    expect(printPercent(10, 20)).toBe(48)
    expect(printPercent(20, 20)).toBe(95)
    expect(printPercent(0, 0)).toBe(95)
  })

  it('shows the page being painted, then saving', () => {
    const run = { painted: 10, sheets: 20, percent: 48, saving: false }
    expect(printRunText(run)).toBe('Page 11 of 20 · 48%')
    expect(printRunText({ ...run, painted: 20, percent: 95 })).toBe(
      'Page 20 of 20 · 95%',
    )
    expect(printRunText({ ...run, percent: 97, saving: true })).toBe(
      'Saving · 97%',
    )
  })

  it('writes the done, saved and skipped lines', () => {
    expect(printDoneText('lake-trip-A5.pdf', 20, 12_345_678)).toBe(
      'lake-trip-A5.pdf · 20 pages · 12.3 MB',
    )
    expect(printDoneText('a.pdf', 1, 40_000)).toBe('a.pdf · 1 page · 0.0 MB')
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

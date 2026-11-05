import { describe, expect, it } from 'vitest'
import {
  exportBooksLine,
  exportFailText,
  exportPercent,
  exportPhaseLabel,
  exportRunningTitle,
  exportStatusText,
  exportSummaryText,
  nextAnnouncedPercent,
} from './exportSiteText'

describe('exportBooksLine', () => {
  it('names only the open book with no other books', () => {
    expect(exportBooksLine('Lake', [])).toBe('“Lake” as it is now.')
  })

  it('uses "1 book" for one other book', () => {
    expect(exportBooksLine('Lake', ['Fog'])).toBe(
      '“Lake” as it is now, plus 1 book from earlier exports: Fog.',
    )
  })

  it('lists two other books', () => {
    expect(exportBooksLine('Lake', ['Fog', 'Summer'])).toBe(
      '“Lake” as it is now, plus 2 books from earlier exports: Fog, Summer.',
    )
  })

  it('truncates after three names', () => {
    expect(exportBooksLine('Lake', ['A', 'B', 'C'])).toBe(
      '“Lake” as it is now, plus 3 books from earlier exports: A, B, C.',
    )
    expect(exportBooksLine('Lake', ['A', 'B', 'C', 'D', 'E'])).toBe(
      '“Lake” as it is now, plus 5 books from earlier exports: A, B, C and 2 more.',
    )
  })
})

describe('exportPercent', () => {
  it('maps each phase into its band', () => {
    expect(exportPercent('prepare', 0, 4)).toBe(0)
    expect(exportPercent('prepare', 2, 4)).toBe(15)
    expect(exportPercent('render', 0, 1)).toBe(30)
    expect(exportPercent('render', 1, 2)).toBe(55)
    expect(exportPercent('write', 1, 4)).toBe(85)
    expect(exportPercent('write', 4, 4)).toBe(100)
  })

  it('treats an empty phase as done and clamps overshoot', () => {
    expect(exportPercent('prepare', 0, 0)).toBe(30)
    expect(exportPercent('write', 9, 4)).toBe(100)
    expect(exportPercent('write', -1, 4)).toBe(80)
  })
})

describe('status announcements', () => {
  it('announces the first progress, then every 10 %', () => {
    expect(nextAnnouncedPercent(3, null)).toBe(3)
    expect(nextAnnouncedPercent(12, 3)).toBeNull()
    expect(nextAnnouncedPercent(13, 3)).toBe(13)
    expect(nextAnnouncedPercent(42, 13)).toBe(42)
  })

  it('reads "Exporting site, 42%" and titles with a middle dot', () => {
    expect(exportStatusText(42)).toBe('Exporting site, 42%')
    expect(exportRunningTitle(42)).toBe('Exporting site · 42%')
  })
})

describe('labels', () => {
  it('names the phases', () => {
    expect(
      (['prepare', 'render', 'write'] as const).map(exportPhaseLabel),
    ).toEqual(['Preparing photos', 'Rendering pages', 'Writing files'])
  })

  it('explains each failure', () => {
    expect(exportFailText('permission', 'Site')).toBe(
      'Photobooks can’t write to “Site”. Allow access to the folder and try again.',
    )
    expect(exportFailText('not-our-export', 'Site')).toBe(
      'dist in “Site” isn’t a Photobooks export, so it was left as it is. Choose another folder.',
    )
    expect(exportFailText('quota', 'Site')).toBe('The disk is full.')
    expect(exportFailText('unknown', 'Site')).toBe(
      'Something went wrong while writing the site. Try again.',
    )
  })

  it('summarises books, files and MB', () => {
    expect(
      exportSummaryText({ books: 1, files: 1, bytes: 1_250_000 }, 'Site'),
    ).toBe('1 book · 1 file · 1.3 MB in Site/dist.')
    expect(exportSummaryText({ books: 2, files: 40, bytes: 0 }, 'Out')).toBe(
      '2 books · 40 files · 0.0 MB in Out/dist.',
    )
  })
})

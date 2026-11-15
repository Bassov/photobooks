import { describe, expect, it } from 'vitest'
import { PDF_NAME_PRESETS, pdfFileName, titleSlug } from './pdfFileName'

describe('pdfFileName', () => {
  it('names a preset trim by its id, in either orientation', () => {
    expect(pdfFileName('Lake trip', { widthMm: 148, heightMm: 210 })).toBe(
      'lake-trip-A5.pdf',
    )
    expect(pdfFileName('Lake trip', { widthMm: 210, heightMm: 148 })).toBe(
      'lake-trip-A5.pdf',
    )
    expect(pdfFileName('Squares', { widthMm: 200, heightMm: 200 })).toBe(
      'squares-sq20.pdf',
    )
  })

  it('names a custom trim by its cm size', () => {
    expect(pdfFileName('Lake trip', { widthMm: 190, heightMm: 230 })).toBe(
      'lake-trip-19x23cm.pdf',
    )
    expect(pdfFileName('Lake trip', { widthMm: 148.4, heightMm: 211 })).toBe(
      'lake-trip-14.8x21.1cm.pdf',
    )
  })

  it.each(PDF_NAME_PRESETS)('names the $id trim $id', ({ id, wCm, hCm }) => {
    expect(pdfFileName('b', { widthMm: wCm * 10, heightMm: hCm * 10 })).toBe(
      `b-${id}.pdf`,
    )
  })
})

describe('titleSlug', () => {
  it.each([
    ['Lake Trip 2024!', 'lake-trip-2024'],
    ['  --Summer__in   Rome--  ', 'summer-in-rome'],
    ['Лето', 'book'],
    ['', 'book'],
  ])('%j → %s', (title, slug) => {
    expect(titleSlug(title)).toBe(slug)
  })
})

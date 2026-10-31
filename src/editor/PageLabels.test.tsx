import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { dropChipLabel } from '../render/dropChip'
import { PageLabels } from './PageLabels'
import {
  PAGE_LABELS_MIN_GAP_PX,
  pageLabelsFit,
  pageLabelTexts,
} from './pageLabelsModel'

describe('page labels', () => {
  afterEach(cleanup)

  it('first spread has an empty left half, then 2si / 2si+1', () => {
    expect(pageLabelTexts(0)).toEqual(['', '1'])
    expect(pageLabelTexts(1)).toEqual(['2', '3'])
    expect(pageLabelTexts(5)).toEqual(['10', '11'])
  })

  it('a single page keeps one number (page 1 right, last page left)', () => {
    expect(pageLabelTexts(0, 1)).toEqual(['', '1'])
    expect(pageLabelTexts(3, 1)).toEqual(['6', ''])
    expect(pageLabelTexts(3, 2)).toEqual(['6', '7'])
  })

  it('marks the page count for the single-page centring', () => {
    render(<PageLabels spreadIndex={2} pages={1} />)
    const root = screen.getByTestId('page-labels')
    expect(root.dataset.pages).toBe('1')
    expect([...root.children].map((c) => c.textContent)).toEqual(['4', ''])
  })

  it('renders two aria-hidden halves', () => {
    render(<PageLabels spreadIndex={2} />)
    const root = screen.getByTestId('page-labels')
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.dataset.pages).toBe('2')
    expect([...root.children].map((c) => c.textContent)).toEqual(['4', '5'])
  })

  it('hides when the gap is shorter than 6 px offset + 16 px line', () => {
    expect(PAGE_LABELS_MIN_GAP_PX).toBe(22)
    expect(pageLabelsFit(44)).toBe(true)
    expect(pageLabelsFit(22)).toBe(true)
    expect(pageLabelsFit(21.9)).toBe(false)
    expect(pageLabelsFit(0)).toBe(false)
  })
})

describe('drop chip label', () => {
  it('distinguishes empty and filled frames', () => {
    expect(dropChipLabel(false)).toBe('Release to place')
    expect(dropChipLabel(true)).toBe('Release to replace')
  })
})

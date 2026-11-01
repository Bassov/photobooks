import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { dropChipLabel } from '../render/dropChip'
import { PageLabels } from './PageLabels'
import {
  PAGE_LABEL_LINE_PX,
  PAGE_LABEL_OFFSET_PX,
  PAGE_LABELS_MIN_GAP_PX,
  NEW_SPREAD_PILL_HEIGHT_PX,
  NEW_SPREAD_PILL_MIN_GAP_PX,
  NEW_SPREAD_PILL_SHIFT_PX,
  newSpreadPillFits,
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
    render(<PageLabels spreadIndex={2} pages={1} gapPx={72} />)
    const root = screen.getByTestId('page-labels')
    expect(root.dataset.pages).toBe('1')
    expect([...root.children].map((c) => c.textContent)).toEqual(['4', ''])
  })

  it('marks the side of a single page on a spread-wide slot', () => {
    render(<PageLabels spreadIndex={3} pages={1} side="left" gapPx={104} />)
    const root = screen.getByTestId('page-labels')
    expect(root.dataset.pageSide).toBe('left')
    expect([...root.children].map((c) => c.textContent)).toEqual(['6', ''])
    cleanup()
    render(<PageLabels spreadIndex={1} gapPx={104} />)
    expect(screen.getByTestId('page-labels').dataset.pageSide).toBeUndefined()
  })

  it('shows the new-spread pill only when the gap holds it and both label clearances', () => {
    expect(NEW_SPREAD_PILL_HEIGHT_PX).toBe(32)
    expect(NEW_SPREAD_PILL_MIN_GAP_PX).toBe(32 + 19 + 19)
    expect(newSpreadPillFits(70)).toBe(true)
    expect(newSpreadPillFits(70.01)).toBe(true)
    expect(newSpreadPillFits(69.99)).toBe(false)
    expect(newSpreadPillFits(0)).toBe(false)
  })

  it('centres the pill between the page-number line and the next spread', () => {
    // Pill centre under the page = 19 + (gap − 19) / 2 = gap / 2 + shift.
    expect(NEW_SPREAD_PILL_SHIFT_PX).toBe(9.5)
    const gap = 90.78
    const centre = gap / 2 + NEW_SPREAD_PILL_SHIFT_PX
    const above =
      centre - NEW_SPREAD_PILL_HEIGHT_PX / 2 - PAGE_LABELS_MIN_GAP_PX
    const below = gap - centre - NEW_SPREAD_PILL_HEIGHT_PX / 2
    expect(above).toBeCloseTo(below, 9)
    expect(above).toBeCloseTo(19.89, 9)
  })

  it('renders two aria-hidden halves', () => {
    render(<PageLabels spreadIndex={2} gapPx={72} />)
    const root = screen.getByTestId('page-labels')
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.dataset.pages).toBe('2')
    expect([...root.children].map((c) => c.textContent)).toEqual(['4', '5'])
  })

  it('hides when the gap is shorter than the 8 px offset + 11 px line', () => {
    expect(PAGE_LABEL_OFFSET_PX).toBe(8)
    expect(PAGE_LABEL_LINE_PX).toBe(11)
    expect(PAGE_LABELS_MIN_GAP_PX).toBe(19)
    expect(pageLabelsFit(72)).toBe(true)
    // Designer-accepted (2026-10-31): just above, at and just below 8 + 11.
    expect(pageLabelsFit(PAGE_LABELS_MIN_GAP_PX + 0.01)).toBe(true)
    expect(pageLabelsFit(19)).toBe(true)
    expect(pageLabelsFit(PAGE_LABELS_MIN_GAP_PX - 0.01)).toBe(false)
    expect(pageLabelsFit(16)).toBe(false)
    expect(pageLabelsFit(0)).toBe(false)
  })

  it('carries its layout gap for the live-zoom check', () => {
    render(<PageLabels spreadIndex={1} gapPx={62.5} />)
    expect(screen.getByTestId('page-labels').dataset.gapPx).toBe('62.5')
  })
})

describe('drop chip label', () => {
  it('distinguishes empty and filled frames', () => {
    expect(dropChipLabel(false)).toBe('Release to place')
    expect(dropChipLabel(true)).toBe('Release to replace')
  })
})

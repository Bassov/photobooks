import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultCover } from '../core'
import { makeBookWithAsset } from '../core/testing/fixtures'
import { CoverCanvas } from './CoverCanvas'
import { CoverSection } from './CoverSection'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'

function seed(
  photo: { widthPx: number; heightPx: number } | null,
  crop: { zoom: number; center: { x: number; y: number } } | null = {
    zoom: 1,
    center: { x: 0.5, y: 0.5 },
  },
): void {
  const base = makeBookWithAsset('a1', { place: false })
  resetBookStore({
    book: {
      ...base,
      cover: {
        ...defaultCover('Lake trip'),
        front: {
          text: 'Lake trip',
          ...(photo === null
            ? {}
            : { assetId: 'a1', ...(crop === null ? {} : { crop }) }),
        },
      },
    },
    sessionMeta: new Map([
      [
        'a1',
        {
          name: 'IMG_0001.jpg',
          correctedWidth: photo?.widthPx ?? 10,
          correctedHeight: photo?.heightPx ?? 10,
          orientation: 1,
          aspect: 1,
        },
      ],
    ]),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('CoverCanvas kit chrome', () => {
  beforeEach(() => {
    seed(null)
  })
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('names the panels and draws the wrap guide and chip', () => {
    render(<CoverCanvas />)
    expect(screen.getByTestId('cover-label-back').textContent).toBe('Back')
    expect(screen.getByTestId('cover-label-spine').textContent).toBe('Spine')
    expect(screen.getByTestId('cover-label-front').textContent).toBe('Front')
    expect(screen.getByTestId('cover-wrap-chip').textContent).toBe('Wrap 15 mm')
    const guide = screen.getByTestId('cover-safe')
    // makeBook trims to 300 mm: 15 mm of 300 high, of 612 wide.
    expect(guide.style.inset.replace(/\s+/g, ' ')).toContain('5%')
    expect(guide.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps the list thumbnail plain', () => {
    render(<CoverCanvas mini />)
    expect(document.querySelector('.cover-panel-label')).toBeNull()
    expect(document.querySelector('.cover-wrap-guide')).toBeNull()
    expect(document.querySelector('.cover-wrap-chip')).toBeNull()
  })
})

describe('CoverSection kit rows', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('lists the kit rows as editable controls (uikit/src/sandbox/v7.tsx:214-221)', () => {
    seed(null)
    render(<CoverSection />)
    const section = screen.getByTestId('insp-cover')
    const text = section.textContent
    expect(text).toContain('Hardcover · back, spine, front · wrap 15 mm')
    for (const label of [
      'Title font',
      'Spine width',
      'Direction',
      'Fill',
      'Material',
      'Finish',
    ]) {
      expect(text).toContain(label)
    }
    const value = (testId: string) =>
      screen.getByTestId<HTMLSelectElement>(testId).value
    expect(value('cover-title-font')).toBe('serif-italic')
    expect(value('cover-material')).toBe('printed')
    expect(value('cover-finish')).toBe('matte')
    expect(screen.getByTestId('cover-spine-width').textContent).toContain('12')
    expect(screen.queryByText('coming later')).toBeNull()
    expect(section.querySelectorAll('input[type="text"]')).toHaveLength(3)
  })

  it('writes each cover style control to the book', () => {
    seed(null)
    render(<CoverSection />)
    const pick = (testId: string, value: string) => {
      fireEvent.change(screen.getByTestId(testId), { target: { value } })
    }
    pick('cover-title-font', 'sans')
    pick('cover-material', 'linen')
    pick('cover-finish', 'gloss')
    fireEvent.click(screen.getByLabelText('Bottom to top'))
    fireEvent.click(screen.getByLabelText('Navy'))
    const { style } = getBookStoreSnapshot().book.cover
    expect(style).toMatchObject({
      titleFont: 'sans',
      material: 'linen',
      finish: 'gloss',
      spineDirection: 'bottom-to-top',
      backFill: '#1f2a44',
    })
  })

  it('shows Full bleed alone without a decoded photo', () => {
    seed(null)
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('Full bleed')
    expect(screen.getByTestId('insp-cover').textContent).not.toContain('ppi')
  })

  it('adds the effective resolution once the photo is decoded', () => {
    seed({ widthPx: 2400, heightPx: 1800 })
    render(<CoverSection />)
    expect(getBookStoreSnapshot().book.cover.front.assetId).toBe('a1')
    expect(screen.getByTestId('insp-cover').textContent).toContain(
      'Full bleed · 152 ppi',
    )
  })

  it('divides the resolution by the crop zoom, and defaults to 1 without a crop', () => {
    seed(
      { widthPx: 2400, heightPx: 1800 },
      { zoom: 2, center: { x: 0.5, y: 0.5 } },
    )
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('· 76 ppi')
    cleanup()
    seed({ widthPx: 2400, heightPx: 1800 }, null)
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('· 152 ppi')
  })

  it('uses the width axis when it is the tighter one', () => {
    seed({ widthPx: 1800, heightPx: 2400 })
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('· 152 ppi')
  })

  it('only hides ppi when both sides are placeholder-sized', () => {
    seed({ widthPx: 1, heightPx: 1800 })
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('ppi')
    cleanup()
    seed({ widthPx: 1800, heightPx: 1 })
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('ppi')
  })

  it('uses the sub ink for row labels and the resolution caption', () => {
    seed(null)
    render(<CoverSection />)
    expect(screen.getByText('Title font').style.color).toBe('#535152')
    expect(screen.getByText('Full bleed').style.color).toBe('#535152')
  })

  it('omits ppi for the 1×1 placeholder size', () => {
    seed({ widthPx: 1, heightPx: 1 })
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).not.toContain('ppi')
  })
})

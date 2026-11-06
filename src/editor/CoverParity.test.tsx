import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultCover } from '../core'
import { makeBookWithAsset } from '../core/testing/fixtures'
import { CoverCanvas } from './CoverCanvas'
import { CoverSection } from './CoverSection'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'

function seed(
  photo: { widthPx: number; heightPx: number } | null,
  crop: { zoom: number; center: { x: number; y: number } } | null = {
    zoom: 1,
    center: { x: 0.5, y: 0.5 },
  },
  backFill?: string,
): void {
  const base = makeBookWithAsset('a1', { place: false })
  const cover = defaultCover('Lake trip')
  resetBookStore({
    book: {
      ...base,
      cover: {
        ...cover,
        style:
          backFill === undefined ? cover.style : { ...cover.style, backFill },
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
    vi.restoreAllMocks()
  })

  it('names the panels and draws the safe frames, veil and chip', () => {
    // Sheet 642 × 330 mm at 2 px / mm: a 30 px band shows the chip.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ width: 1284, height: 660 }),
    )
    render(<CoverCanvas />)
    expect(screen.getByTestId('cover-label-back').textContent).toBe('Back')
    expect(screen.getByTestId('cover-label-spine').textContent).toBe('Spine')
    expect(screen.getByTestId('cover-label-front').textContent).toBe('Front')
    expect(screen.getByTestId('cover-wrap-chip').textContent).toBe('Wrap 15 mm')
    // makeBook trims to 300 mm: safe 5 mm, hinge 8 mm → 287 mm of 642 wide.
    const safe = screen.getByTestId('cover-safe-front')
    expect(Number.parseFloat(safe.style.width)).toBeCloseTo(
      (287 / 642) * 100,
      9,
    )
    expect(screen.getByTestId('cover-safe-back').style.width).toBe(
      safe.style.width,
    )
    expect(screen.getByTestId('cover-wrap').getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('keeps the list thumbnail plain', () => {
    render(<CoverCanvas mini />)
    expect(document.querySelector('.cover-panel-label')).toBeNull()
    expect(document.querySelector('.cover-sheet')).toBeNull()
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
    expect(screen.getByTestId('cover-head-sub').textContent).toBe(
      'Hardcover · wrap 15 mm · hinge 8 mm',
    )
    // makeBookWithAsset has under 20 pages: printed as the profile minimum.
    expect(screen.getByTestId('cover-spine-hint').textContent).toMatch(
      /^Generic print profile · \d+ pages, printed as 20$/,
    )
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
    // Kit v7.tsx:277: Fill is the read-only back fill, swatch + upper-case hex.
    expect(screen.getByTestId('fill-readonly').textContent).toBe('#3E3C3B')
    expect(screen.getByTestId('fill-swatch').style.background).toBe('#3e3c3b')
    expect(text).not.toContain('coming later')
    // Kit v7.tsx:215: Direction is a Val pill, not a segmented control.
    expect(screen.getByTestId('cover-direction').textContent).toBe(
      'Top to bottom',
    )
    expect(section.querySelectorAll('input[type="text"]')).toHaveLength(3)
  })

  it('shows the book back fill as its swatch and upper-case hex', () => {
    seed(null, null, '#112233')
    render(<CoverSection />)
    expect(screen.getByTestId('fill-readonly').textContent).toBe('#112233')
    expect(screen.getByTestId('fill-swatch').style.background).toBe('#112233')
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
    const { style } = getBookStoreSnapshot().book.cover
    expect(style).toMatchObject({
      titleFont: 'sans',
      material: 'linen',
      finish: 'gloss',
    })
  })

  it('titles each section with the kit Sec eyebrow (Owner Must M57, round 9)', () => {
    seed(null)
    render(<CoverSection />)
    expect(
      [...document.querySelectorAll('.inspector-eyebrow')].map((title) => [
        title.textContent,
        title.className,
      ]),
    ).toEqual(
      ['Front', 'Spine', 'Back', 'Material'].map((name) => [
        name,
        'inspector-eyebrow inspector-sec-title',
      ]),
    )
  })

  it('shows Full bleed alone without a decoded photo', () => {
    seed(null)
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('Full bleed')
    expect(screen.getByTestId('insp-cover').textContent).not.toContain('ppi')
  })

  // D4: the photo box is the 300 mm front board plus 15 mm wrap on its outer,
  // top and bottom edges: 315 × 330 mm.
  it('names the spine source: profile pages, no hint for a manual spine', () => {
    seed(null)
    act(() => {
      dispatchBookOp({ type: 'setPageCount', pages: 60 })
    })
    render(<CoverSection />)
    const hint = screen.getByTestId('cover-spine-hint')
    expect(hint.textContent).toBe('Generic print profile · 60 pages')
    expect(hint.style.color).toBe('#535152')
    expect(screen.getByTestId('cover-spine-width').textContent).toBe('20 mm')
    cleanup()
    const { book } = getBookStoreSnapshot()
    resetBookStore({
      ...getBookStoreSnapshot(),
      book: {
        ...book,
        cover: {
          ...book.cover,
          print: { spineWidthSource: 'manual' },
          style: { ...book.cover.style, spineWidthMm: 17 },
        },
      },
    })
    render(<CoverSection />)
    expect(screen.queryByTestId('cover-spine-hint')).toBeNull()
    expect(screen.getByTestId('cover-spine-width').textContent).toBe('17 mm')
  })

  it('adds the effective resolution once the photo is decoded', () => {
    seed({ widthPx: 2400, heightPx: 1800 })
    render(<CoverSection />)
    expect(getBookStoreSnapshot().book.cover.front.assetId).toBe('a1')
    expect(screen.getByTestId('insp-cover').textContent).toContain(
      'Full bleed · 139 ppi',
    )
  })

  it('divides the resolution by the crop zoom, and defaults to 1 without a crop', () => {
    seed(
      { widthPx: 2400, heightPx: 1800 },
      { zoom: 2, center: { x: 0.5, y: 0.5 } },
    )
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('· 69 ppi')
    cleanup()
    seed({ widthPx: 2400, heightPx: 1800 }, null)
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('· 139 ppi')
  })

  it('uses the width axis when it is the tighter one', () => {
    seed({ widthPx: 1800, heightPx: 2400 })
    render(<CoverSection />)
    expect(screen.getByTestId('insp-cover').textContent).toContain('· 145 ppi')
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

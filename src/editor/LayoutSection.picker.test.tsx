import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { resetBookStore } from './bookStore'
import { matchesChip } from './layoutChips'
import { LayoutSection } from './LayoutSection'
import { resetSavedTemplatesForTests } from './savedTemplates'

function seed(frames = [makeFrame({ id: 'f1' })], templateId?: string) {
  resetBookStore({
    book: makeBook({
      assets: { a: {} },
      spreads: [
        makeSpread({
          id: 's1',
          frames,
          ...(templateId === undefined ? {} : { templateId }),
        }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const listed = () =>
  screen
    .queryAllByTestId('layout-tile')
    .map((tile) => tile.getAttribute('data-template'))

const chip = (id: string): HTMLElement => {
  const found = screen
    .getByTestId('tpl-chips')
    .querySelector<HTMLElement>(`[data-chip="${id}"]`)
  if (found === null) {
    throw new Error(`missing chip ${id}`)
  }
  return found
}

afterEach(() => {
  cleanup()
  resetBookStore()
  window.localStorage.clear()
  resetSavedTemplatesForTests()
})

describe('matchesChip (kit context-inspector.tsx:94)', () => {
  it('Any matches everything; N matches exactly; 4+ matches four or more', () => {
    expect(matchesChip(0, 'all')).toBe(true)
    expect(matchesChip(1, '1')).toBe(true)
    expect(matchesChip(2, '1')).toBe(false)
    expect(matchesChip(3, '3')).toBe(true)
    expect(matchesChip(3, '4')).toBe(false)
    expect(matchesChip(4, '4')).toBe(true)
    expect(matchesChip(9, '4')).toBe(true)
  })
})

describe('LayoutSection picker (kit context-inspector.tsx:131-195)', () => {
  it('shows tabs with counts, search, chips and the hint', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    expect(screen.getByTestId('tab-all').textContent).toContain('All')
    expect(screen.getByTestId('tab-all').textContent).toContain('10')
    expect(screen.getByTestId('tab-mine').textContent).toContain('My templates')
    expect(screen.getByTestId('tab-all').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByTestId('tab-mine').getAttribute('aria-pressed')).toBe(
      'false',
    )
    expect(screen.getByTestId('layout-search')).toBeTruthy()
    expect(
      [...screen.getByTestId('tpl-chips').querySelectorAll('button')].map(
        (b) => b.textContent,
      ),
    ).toEqual(['Any', '1', '2', '3', '4+'])
    expect(screen.getByTestId('tpl-hint').textContent).toBe(
      'Hover a layout to preview it on the spread; click to apply. Photos are kept in order.',
    )
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('renders nothing for an unknown spread', () => {
    seed()
    render(<LayoutSection spreadId="missing" />)
    expect(screen.queryByTestId('layout-section')).toBeNull()
  })

  it('regenerates thumbnails when the trim size changes', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    const paper = () =>
      screen.getAllByTestId('layout-thumb-paper')[0]?.getAttribute('style')
    const before = paper()
    act(() => {
      resetBookStore({
        book: makeBook({
          assets: { a: {} },
          settings: { trim: { widthMm: 200, heightMm: 100 } },
          spreads: [
            makeSpread({ id: 's1', frames: [makeFrame({ id: 'f1' })] }),
          ],
        }),
        sessionMeta: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
    })
    expect(before).toBe('left: 25%; top: 0%; width: 50%; height: 100%;')
    expect(paper()).not.toBe(before)
    expect(paper()).toBe('left: 0%; top: 0%; width: 100%; height: 100%;')
  })

  it('filters by photo count chip and returns on Any', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    fireEvent.click(chip('1'))
    expect(listed()).toEqual([
      'full-bleed',
      'one-per-page',
      'panorama',
      'framed-single',
    ])
    expect(chip('1').getAttribute('aria-pressed')).toBe('true')
    expect(chip('all').getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(chip('4'))
    expect(listed()).toEqual(['hero-grid'])
    fireEvent.click(chip('all'))
    expect(listed()).toHaveLength(10)
  })

  it('searches layouts by name, case-insensitively, and reports no match', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    const search = screen.getByTestId('layout-search')
    fireEvent.change(search, { target: { value: '  GRID ' } })
    expect(listed()).toEqual(['hero-grid'])
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(listed()).toEqual([])
    expect(screen.getByTestId('tpl-empty').textContent).toBe(
      'No layouts match.',
    )
  })

  it('My templates lists none yet (a new user has no saved templates)', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    fireEvent.click(screen.getByTestId('tab-mine'))
    expect(screen.getByTestId('tab-mine').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByTestId('tab-all').getAttribute('aria-pressed')).toBe(
      'false',
    )
    expect(listed()).toEqual([])
    expect(screen.getByTestId('tab-mine').textContent).toBe('My templates 0')
    expect(screen.getByTestId('tpl-empty').textContent).toBe(
      'No templates yet. Save a spread you like.',
    )
    expect(screen.queryByTestId('tpl-suggested')).toBeNull()
    fireEvent.change(screen.getByTestId('layout-search'), {
      target: { value: 'x' },
    })
    expect(screen.getByTestId('tpl-empty').textContent).toBe(
      'No layouts match.',
    )
    fireEvent.change(screen.getByTestId('layout-search'), {
      target: { value: '' },
    })
    fireEvent.click(chip('2'))
    expect(screen.getByTestId('tpl-empty').textContent).toBe(
      'No layouts match.',
    )
    fireEvent.click(screen.getByTestId('tab-all'))
    expect(listed().length).toBeGreaterThan(0)
  })

  it('suggests up to three layouts for the photo count, singular', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    const suggested = screen.getByTestId('tpl-suggested')
    expect(suggested.textContent).toContain('Suggested for 1 photo')
    expect(suggested.textContent).not.toContain('photos')
    expect(suggested.textContent).toContain('Full bleed')
    expect(screen.getByText('All layouts')).toBeTruthy()
    // Suggested tiles keep their own accessible name and test id.
    expect(
      screen.getByRole('button', { name: 'Apply suggested layout Full bleed' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Apply layout Full bleed' }),
    ).toBeTruthy()
    // Kit caps Suggested at three tiles (framed-single also fits one photo).
    expect(
      screen
        .getAllByTestId('layout-suggested-tile')
        .map((tile) => tile.getAttribute('data-template')),
    ).toEqual(['full-bleed', 'one-per-page', 'panorama'])
  })

  it('counts filled photo frames, pluralises, and hides suggestions when filtering', () => {
    seed([
      makeFrame({ id: 'f1', assetId: 'a' }),
      makeFrame({ id: 'f2', assetId: 'a', z: 1 }),
      makeFrame({ id: 'f3', z: 2 }),
    ])
    render(<LayoutSection spreadId="s1" />)
    expect(screen.getByTestId('tpl-suggested').textContent).toContain(
      'Suggested for 2 photos',
    )
    fireEvent.click(chip('1'))
    expect(screen.queryByTestId('tpl-suggested')).toBeNull()
    expect(screen.queryByText('All layouts')).toBeNull()
    fireEvent.click(chip('all'))
    fireEvent.change(screen.getByTestId('layout-search'), {
      target: { value: 'a' },
    })
    expect(screen.queryByTestId('tpl-suggested')).toBeNull()
  })

  // Owner design change (round 7, M47): the current layout stays suggested.
  it('keeps the layout the spread already uses, pressed, in catalogue order', () => {
    seed([makeFrame({ id: 'f1' })], 'one-per-page')
    render(<LayoutSection spreadId="s1" />)
    const tiles = screen.getAllByTestId('layout-suggested-tile')
    expect(tiles.map((tile) => tile.getAttribute('data-template'))).toEqual([
      'full-bleed',
      'one-per-page',
      'panorama',
    ])
    expect(tiles.map((tile) => tile.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ])
  })

  it('a suggested tile applies its layout', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply suggested layout Full bleed' }),
    )
    expect(
      screen
        .getByTestId('layout-section')
        .querySelector('[aria-pressed="true"][data-template="full-bleed"]'),
    ).not.toBeNull()
  })
})

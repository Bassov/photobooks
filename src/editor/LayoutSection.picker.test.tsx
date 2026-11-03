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

/** Three spreads: `s2` is a two-page spread (Two portraits merges there). */
function seedTwoPage(templateId?: string) {
  resetBookStore({
    book: makeBook({
      spreads: ['s1', 's2', 's3'].map((id) =>
        makeSpread({
          id,
          ...(id === 's2' && templateId !== undefined ? { templateId } : {}),
        }),
      ),
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

const pressed = () =>
  screen
    .queryAllByTestId('layout-tile')
    .filter((tile) => tile.getAttribute('aria-pressed') === 'true')
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
  it('shows tabs with counts, chips and the hint, and no search field', () => {
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
    expect(screen.queryByRole('searchbox')).toBeNull()
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
    const thumb = () =>
      screen.getAllByTestId('layout-thumb')[0]?.getAttribute('style')
    const paper = () =>
      screen.getAllByTestId('layout-thumb-paper')[0]?.getAttribute('style')
    const grid = () => screen.getByTestId('tpl-grid').className
    // A square page: square thumbs filled by the paper, 3 columns.
    expect(thumb()).toBe('aspect-ratio: 1 / 1;')
    expect(paper()).toBe('left: 0%; top: 0%; width: 100%; height: 100%;')
    expect(grid()).toContain('grid-cols-3')
    expect(grid()).not.toContain('grid-cols-2')
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
    // A 2:1 page: 2:1 thumbs, still filled, 2 columns.
    expect(thumb()).toBe('aspect-ratio: 2 / 1;')
    expect(paper()).toBe('left: 0%; top: 0%; width: 100%; height: 100%;')
    expect(grid()).toContain('grid-cols-2')
    expect(grid()).not.toContain('grid-cols-3')
  })

  // Owner 2026-11-02: one list from one photo up, no Suggested / All split.
  it('lists every layout in one grid by photo count, kit order inside a count', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    expect(listed()).toEqual([
      'full-bleed',
      'one-per-page',
      'panorama',
      'framed-single',
      'offset-pair',
      'two-portraits',
      'hero-two',
      'three-across',
      'landscape-two-portraits',
      'hero-grid',
    ])
    expect(screen.getAllByTestId('tpl-grid')).toHaveLength(1)
    expect(screen.getByTestId('layout-section').textContent).not.toMatch(
      /Suggested|All layouts/,
    )
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
    fireEvent.click(chip('2'))
    expect(screen.getByTestId('tpl-empty').textContent).toBe(
      'No layouts match.',
    )
    fireEvent.click(screen.getByTestId('tab-all'))
    expect(listed().length).toBeGreaterThan(0)
  })

  it('builtin tiles carry the name as tooltip and accessible name, no caption', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    const tile = screen.getByRole('button', { name: 'Apply layout Full bleed' })
    expect(tile.getAttribute('title')).toBe('Full bleed')
    expect(tile.textContent).toBe('')
    expect(screen.queryAllByTestId('tpl-name')).toEqual([])
  })

  it('heads the section with the selected layout, expanded and collapsed', () => {
    seed([makeFrame({ id: 'f1' })], 'one-per-page')
    render(<LayoutSection spreadId="s1" />)
    expect(screen.getByTestId('layout-note').textContent).toBe('· One per page')
    expect(pressed()).toEqual(['one-per-page'])
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }))
    expect(screen.getByTestId('layout-note').textContent).toBe('· One per page')
  })

  it('merges Two portraits into One per page on a two-page spread', () => {
    seedTwoPage('two-portraits')
    render(<LayoutSection spreadId="s2" />)
    expect(listed()).not.toContain('two-portraits')
    expect(listed()).toHaveLength(9)
    expect(screen.getByTestId('tab-all').textContent).toBe('All 9')
    expect(pressed()).toEqual(['one-per-page'])
    expect(screen.getByTestId('layout-note').textContent).toBe('· One per page')
  })

  it('names and presses an unmerged stored layout as itself', () => {
    seedTwoPage('hero-two')
    render(<LayoutSection spreadId="s2" />)
    expect(pressed()).toEqual(['hero-two'])
    expect(screen.getByTestId('layout-note').textContent).toBe('· Hero + two')
  })

  it('a tile applies its layout', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply layout Full bleed' }),
    )
    expect(pressed()).toEqual(['full-bleed'])
  })
})

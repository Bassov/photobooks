import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { BookSettingsSection } from './BookSettingsSection'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  EDITOR_CHROME_CSS,
  SWATCH_RING,
  TOGGLE_OFF,
  TOGGLE_ON,
} from './editorChromeTokens'
import { setBookSettingsSelected } from './bookSettingsSelection'
import { Inspector } from './Inspector'
import { LayoutSection } from './LayoutSection'
import { setActiveSpreadId } from './photoRootSession'

function seed(templateId?: string) {
  resetBookStore({
    book: makeBook({
      spreads: [
        makeSpread({
          id: 's1',
          ...(templateId === undefined ? {} : { templateId }),
        }),
        makeSpread({ id: 's2' }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

/** Kit Section shows its summary only while collapsed. */
function collapseLayout() {
  fireEvent.click(screen.getByRole('button', { name: 'Layout' }))
}

const spreadTemplate = () => getBookStoreSnapshot().book.spreads[0]?.templateId

describe('LayoutSection', () => {
  afterEach(() => {
    cleanup()
    setActiveSpreadId(null)
    resetBookStore()
  })

  it('lists the kit layouts in kit order and marks the current one', () => {
    seed('hero-two')
    render(<LayoutSection spreadId="s1" />)
    const tiles = screen.getAllByTestId('layout-tile')
    expect(tiles.map((t) => t.getAttribute('data-template'))).toEqual([
      'full-bleed',
      'one-per-page',
      'hero-two',
      'hero-grid',
      'panorama',
      'three-across',
      'framed-single',
      'offset-pair',
      'two-portraits',
      'landscape-two-portraits',
    ])
    expect(tiles.map((t) => t.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
      'false',
      'false',
    ])
    collapseLayout()
    expect(screen.getByTestId('layout-summary').textContent).toBe('Hero + two')
  })

  it('draws one slot per frame in each tile thumb', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    const [fullBleed, , heroTwo] = screen.getAllByTestId('layout-tile')
    expect(
      fullBleed?.querySelectorAll('[data-testid="layout-thumb-slot"]'),
    ).toHaveLength(1)
    expect(
      heroTwo?.querySelectorAll('[data-testid="layout-thumb-slot"]'),
    ).toHaveLength(3)
  })

  it('draws the spine only on two-page spread thumbs', () => {
    resetBookStore({
      book: makeBook({
        spreads: ['a', 'b', 'c'].map((id) => makeSpread({ id })),
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const spines = () => document.querySelectorAll('.layout-thumb-spine')
    const thumbs = () => screen.getAllByTestId('layout-thumb')
    const single = render(<LayoutSection spreadId="a" />)
    expect(thumbs().length).toBeGreaterThan(0)
    expect(spines()).toHaveLength(0)
    single.unmount()
    render(<LayoutSection spreadId="b" />)
    expect(spines()).toHaveLength(thumbs().length)
  })

  it('applies a template to the spread on click', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply layout Hero + grid' }),
    )
    expect(spreadTemplate()).toBe('hero-grid')
  })

  it('applies a contact sheet from the columns × rows fields', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    fireEvent.change(screen.getByTestId('layout-contact-cols'), {
      target: { value: '4' },
    })
    fireEvent.blur(screen.getByTestId('layout-contact-cols'))
    fireEvent.click(screen.getByTestId('layout-contact-apply'))
    expect(spreadTemplate()).toBe('contact-4x2')
  })

  it('shows a contact-sheet spread in the fields and the summary', () => {
    seed('contact-5x3')
    render(<LayoutSection spreadId="s1" />)
    collapseLayout()
    expect(screen.getByTestId('layout-summary').textContent).toBe(
      'Contact sheet 5×3',
    )
    expect(
      screen.getByTestId<HTMLInputElement>('layout-contact-cols').value,
    ).toBe('5')
    expect(
      screen.getByTestId<HTMLInputElement>('layout-contact-rows').value,
    ).toBe('3')
  })

  it('renders nothing for an unknown spread', () => {
    seed()
    render(<LayoutSection spreadId="nope" />)
    expect(screen.queryByTestId('layout-section')).toBeNull()
  })

  it('shows no summary for an unset or unknown template', () => {
    seed()
    const { unmount } = render(<LayoutSection spreadId="s1" />)
    collapseLayout()
    expect(screen.queryByTestId('layout-summary')).toBeNull()
    unmount()
    seed('custom-x')
    render(<LayoutSection spreadId="s1" />)
    collapseLayout()
    expect(screen.queryByTestId('layout-summary')).toBeNull()
  })
})

describe('Inspector Spread / Book settings sections', () => {
  afterEach(() => {
    cleanup()
    setBookSettingsSelected(false)
    setActiveSpreadId(null)
    resetBookStore()
  })

  it('Spread: kit order Layout, Master & spacing, Background, Grid', () => {
    seed()
    act(() => {
      setActiveSpreadId('s1')
    })
    render(<Inspector />)
    const order = [
      screen.getByTestId('layout-section'),
      screen.getByTestId('spread-spacing'),
      screen.getByTestId('bg-swatches'),
      screen.getByTestId('grid-section-spread'),
    ]
    for (const [prev, next] of order.slice(1).map((el, i) => [order[i], el])) {
      expect(
        prev &&
          next &&
          prev.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
    expect(screen.queryByText('Layout grid')).toBeNull()
  })

  it('Without a spread, no Layout section; shows no Layout section', () => {
    seed()
    render(<Inspector />)
    expect(screen.queryByTestId('layout-section')).toBeNull()
  })

  it('Book settings: settings from the model above the book grid, no Layout', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setBookSettingsSelected(true)
    })
    const settings = screen.getByTestId('book-settings')
    expect(settings).toBeTruthy()
    // Kit v7.tsx:202-210: no Layout grid section in Book settings.
    expect(screen.queryByTestId('grid-section-book')).toBeNull()
    expect(screen.queryByTestId('layout-section')).toBeNull()
  })
})

describe('BookSettingsSection', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('shows the kit sections with working controls (uikit/src/sandbox/v7.tsx:200-210)', () => {
    seed()
    render(<BookSettingsSection />)
    expect(screen.getByTestId('inspector-context').textContent).toBe(
      'Book settings',
    )
    expect(screen.getByTestId('book-settings-subtitle').textContent).toBe(
      'Untitled book · applies to the whole book',
    )
    const eyebrows = screen
      .getAllByRole('heading', { level: 4 })
      .map((el) => el.textContent)
    expect(eyebrows).toEqual(['Page size', 'Binding', 'Print', 'Defaults'])
    for (const el of screen.getAllByRole('heading', { level: 4 })) {
      expect(el.className).toBe('inspector-eyebrow')
    }
    expect(screen.getByTestId('book-pages').textContent).toBe('420–120')
    expect(screen.getByTestId('book-pages-range').textContent).toBe('20–120')
    expect(screen.getByTestId('book-pages-note').textContent).toBe(
      'Add 8 spreads to reach the 20-page minimum',
    )
    expect(screen.getByTestId('binding-readonly').textContent).toBe('read-only')
  })

  it('edits size, orientation, endpapers and page colour', () => {
    seed()
    render(<BookSettingsSection />)
    const trim = () => getBookStoreSnapshot().book.settings.trim
    const before = trim()
    fireEvent.click(screen.getByLabelText('Landscape'))
    expect(trim()).toEqual({
      widthMm: Math.max(before.widthMm, before.heightMm),
      heightMm: Math.min(before.widthMm, before.heightMm),
    })
    fireEvent.change(screen.getByLabelText('Page size'), {
      target: { value: 'custom' },
    })
    fireEvent.click(screen.getByLabelText('mm'))
    fireEvent.change(screen.getByLabelText('Width (mm)'), {
      target: { value: '210' },
    })
    expect(trim().widthMm).toBe(210)
    fireEvent.change(screen.getByLabelText('Height (mm)'), {
      target: { value: '9999' },
    })
    expect(trim().heightMm).not.toBe(9999)
    const { settings } = getBookStoreSnapshot().book
    fireEvent.click(screen.getByRole('switch', { name: 'Endpapers' }))
    expect(getBookStoreSnapshot().book.settings.endpapers.enabled).toBe(
      !settings.endpapers.enabled,
    )
    // Kit v7.tsx:201: page colour is read-only text, no swatches.
    expect(screen.getByTestId('page-colour-readonly').textContent).toBe(
      'Paper white · coming later',
    )
  })
})

describe('toggle and swatch tokens', () => {
  it('exposes the owner colours as chrome tokens', () => {
    expect(TOGGLE_ON).toBe('#A8A8A8')
    expect(TOGGLE_OFF).toBe('#CACACA')
    expect(SWATCH_RING).toBe('#8E8E8E')
    expect(EDITOR_CHROME_CSS).toContain('--toggle-on: #A8A8A8')
    expect(EDITOR_CHROME_CSS).toContain('--toggle-off: #CACACA')
    expect(EDITOR_CHROME_CSS).toContain('--swatch-ring: #8E8E8E')
  })
})

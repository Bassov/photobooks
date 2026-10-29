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

const spreadTemplate = () => getBookStoreSnapshot().book.spreads[0]?.templateId

describe('LayoutSection', () => {
  afterEach(() => {
    cleanup()
    setActiveSpreadId(null)
    resetBookStore()
  })

  it('lists the six catalog templates and marks the current one', () => {
    seed('2-up')
    render(<LayoutSection spreadId="s1" />)
    const tiles = screen.getAllByTestId('layout-tile')
    expect(tiles.map((t) => t.getAttribute('data-template'))).toEqual([
      'full-bleed',
      'one-per-page',
      '2-up',
      '4-grid',
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
    ])
    expect(screen.getByTestId('layout-summary').textContent).toBe('2-up')
    expect(tiles[0]?.querySelectorAll('rect')).toHaveLength(1)
  })

  it('applies a template to the spread on click', () => {
    seed()
    render(<LayoutSection spreadId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Apply layout 4-grid' }))
    expect(spreadTemplate()).toBe('4-grid')
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
    expect(screen.queryByTestId('layout-summary')).toBeNull()
    unmount()
    seed('custom-x')
    render(<LayoutSection spreadId="s1" />)
    expect(screen.queryByTestId('layout-summary')).toBeNull()
  })
})

describe('Inspector Spread / Book tab sections', () => {
  afterEach(() => {
    cleanup()
    setActiveSpreadId(null)
    resetBookStore()
  })

  it('Spread tab: Layout comes before Layout grid; no Background', () => {
    seed()
    act(() => {
      setActiveSpreadId('s1')
    })
    render(<Inspector />)
    fireEvent.click(screen.getByTestId('inspector-tab-spread'))
    const layout = screen.getByTestId('layout-section')
    const grid = screen.getByTestId('grid-section-spread')
    expect(
      layout.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.queryByText('Background')).toBeNull()
  })

  it('Spread tab without a spread shows no Layout section', () => {
    seed()
    render(<Inspector />)
    fireEvent.click(screen.getByTestId('inspector-tab-spread'))
    expect(screen.queryByTestId('layout-section')).toBeNull()
  })

  it('Book tab: settings from the model above the book grid, no Layout', () => {
    seed()
    render(<Inspector />)
    fireEvent.click(screen.getByTestId('inspector-tab-book'))
    const settings = screen.getByTestId('book-settings')
    expect(
      settings.compareDocumentPosition(
        screen.getByTestId('grid-section-book'),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.queryByTestId('layout-section')).toBeNull()
  })
})

describe('BookSettingsSection', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('lists only settings the document holds', () => {
    seed()
    render(<BookSettingsSection />)
    const { settings } = getBookStoreSnapshot().book
    const labels = screen.getAllByRole('term').map((el) => el.textContent)
    expect(labels).toEqual(['Page size', 'Bleed', 'Safe margin', 'Pages'])
    const values = screen.getAllByRole('definition').map((el) => el.textContent)
    expect(values[0]).toBe(
      `${String(settings.trim.widthMm)} × ${String(settings.trim.heightMm)} mm`,
    )
    expect(values[3]).toBe('4')
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

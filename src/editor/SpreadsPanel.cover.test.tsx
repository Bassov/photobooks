import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  resetBookStore,
} from './bookStore'
import { isCoverSelected, setCoverSelected } from './coverSelection'
import { setBookSettingsSelected } from './bookSettingsSelection'
import { Inspector } from './Inspector'
import { resetActiveSpreadIdForTests } from './photoRootSession'
import { SpreadsPanel } from './SpreadsPanel'

function seed(): void {
  resetBookStore({
    book: makeBook({
      spreads: [makeSpread({ id: 's1' }), makeSpread({ id: 's2' })],
    }),
    sessionMeta: new Map(),
    previewUrls: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('cover row in the pages list', () => {
  afterEach(() => {
    cleanup()
    setCoverSelected(false)
    setBookSettingsSelected(false)
    resetBookStore()
    resetActiveSpreadIdForTests()
  })

  it('scrolls with the list, outside the pages listbox, pressed when selected', () => {
    seed()
    render(<SpreadsPanel />)
    const row = screen.getByTestId('cover-list-item')
    // Not a spread: no `data-item`, so reorder / panel order skip it.
    expect(row.hasAttribute('data-item')).toBe(false)
    expect(row.hasAttribute('data-cover-row')).toBe(true)
    expect(row.getAttribute('aria-pressed')).toBe('false')
    const listbox = screen.getByRole('listbox', { name: 'Pages' })
    expect(listbox.contains(row)).toBe(false)
    // Kit chrome.tsx:272-277: one scroller, Cover first, then the pages.
    const scroller = screen.getByTestId('spreads-list')
    expect(scroller.contains(row)).toBe(true)
    expect(scroller.contains(listbox)).toBe(true)
    expect(
      row.compareDocumentPosition(listbox) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.queryByTestId('add-spread')).toBeNull()
    fireEvent.click(row)
    expect(isCoverSelected()).toBe(true)
    expect(row.getAttribute('aria-pressed')).toBe('true')
    // No page row is selected while the cover is.
    expect(
      screen
        .getAllByRole('option')
        .filter((option) => option.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(0)
  })

  it('draws the Cover and Endpaper rows as kit cards, back Endpaper after the pages', () => {
    seed()
    dispatchBookOp({ type: 'setEndpapersEnabled', enabled: true })
    render(<SpreadsPanel />)
    const { settings } = getBookStoreSnapshot().book
    const { widthMm, heightMm } = settings.trim
    const paper = (testId: string): HTMLElement | null =>
      screen.getByTestId(testId).querySelector('[data-thumb-paper]')
    // jsdom serialises `aspect-ratio: r` as `r / 1`.
    expect(paper('cover-list-item')?.style.aspectRatio).toBe(
      `${String((2 * widthMm + 12) / heightMm)} / 1`,
    )
    expect(paper('endpaper-list-item-front')?.style.aspectRatio).toBe(
      `${String((2 * widthMm) / heightMm)} / 1`,
    )
    const listbox = screen.getByRole('listbox', { name: 'Pages' })
    const front = screen.getByTestId('endpaper-list-item-front')
    const back = screen.getByTestId('endpaper-list-item-back')
    expect(screen.getByTestId('cover-list').contains(front)).toBe(true)
    expect(listbox.contains(back)).toBe(false)
    expect(
      listbox.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByTestId('spreads-list').contains(back)).toBe(true)
  })

  it('widens the cover card with the computed spine when pages are added', () => {
    seed()
    render(<SpreadsPanel />)
    act(() => {
      dispatchBookOp({ type: 'setPageCount', pages: 120 })
    })
    const { widthMm, heightMm } = getBookStoreSnapshot().book.settings.trim
    expect(
      screen
        .getByTestId('cover-list-item')
        .querySelector<HTMLElement>('[data-thumb-paper]')?.style.aspectRatio,
    ).toBe(`${String((2 * widthMm + 32) / heightMm)} / 1`)
  })

  it('clicking a page row leaves the cover', () => {
    seed()
    render(<SpreadsPanel />)
    fireEvent.click(screen.getByTestId('cover-list-item'))
    fireEvent.click(screen.getByTestId('spread-list-item-s2'))
    expect(isCoverSelected()).toBe(false)
    expect(
      screen.getByTestId('cover-list-item').getAttribute('aria-pressed'),
    ).toBe('false')
  })
})

describe('Inspector with the cover selected', () => {
  afterEach(() => {
    cleanup()
    setCoverSelected(false)
    resetBookStore()
    resetActiveSpreadIdForTests()
  })

  it('shows the Cover section instead of the frame / spread hints', () => {
    seed()
    render(<Inspector />)
    expect(screen.queryByTestId('insp-cover')).toBeNull()
    expect(screen.getByTestId('inspector-empty')).toBeTruthy()
    act(() => {
      setCoverSelected(true)
    })
    expect(screen.getByTestId('insp-cover')).toBeTruthy()
    expect(screen.queryByTestId('inspector-empty')).toBeNull()
  })

  it('picking Book settings leaves the cover', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setCoverSelected(true)
    })
    act(() => {
      setCoverSelected(false)
      setBookSettingsSelected(true)
    })
    expect(isCoverSelected()).toBe(false)
    expect(screen.queryByTestId('insp-cover')).toBeNull()
  })
})

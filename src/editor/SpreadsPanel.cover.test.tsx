import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { resetBookStore } from './bookStore'
import { isCoverSelected, setCoverSelected } from './coverSelection'
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
    resetBookStore()
    resetActiveSpreadIdForTests()
  })

  it('is one pinned row, outside the pages listbox, pressed when selected', () => {
    seed()
    render(<SpreadsPanel />)
    const row = screen.getByTestId('cover-list-item')
    expect(row.getAttribute('data-item')).toBe('cover')
    expect(row.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('listbox', { name: 'Pages' }).contains(row)).toBe(
      false,
    )
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

  it('picking a tab leaves the cover', () => {
    seed()
    render(<Inspector />)
    act(() => {
      setCoverSelected(true)
    })
    fireEvent.click(screen.getByTestId('inspector-tab-book'))
    expect(isCoverSelected()).toBe(false)
    expect(screen.queryByTestId('insp-cover')).toBeNull()
  })
})

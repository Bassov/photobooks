import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { GridSection } from './GridSection'
import { getGridVisible, setGridVisible } from './gridView'

function seed() {
  resetBookStore({
    book: makeBook({
      spreads: [makeSpread({ id: 's1' }), makeSpread({ id: 's2' })],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function field(name: string) {
  return within(
    screen.getByTestId(`grid-field-${name}`),
  ).getByRole<HTMLInputElement>('textbox')
}

function commit(name: string, value: string) {
  const input = field(name)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

describe('GridSection', () => {
  afterEach(() => {
    cleanup()
    setGridVisible(false)
    resetBookStore()
  })

  it('book: lists the eight fields and updates the cols×rows summary', () => {
    seed()
    render(<GridSection scope="book" />)
    expect(screen.getByText('Layout grid')).toBeTruthy()
    for (const name of [
      'top',
      'bottom',
      'inside',
      'outside',
      'columns',
      'rows',
      'columnGutterMm',
      'rowGutterMm',
    ]) {
      expect(screen.getByTestId(`grid-field-${name}`)).toBeTruthy()
    }
    expect(screen.getByTestId('grid-summary').textContent).toBe('2×2')
    commit('columns', '5')
    expect(screen.getByTestId('grid-summary').textContent).toBe('5×2')
    expect(getBookStoreSnapshot().book.layoutGrid.columns).toBe(5)
    // No source labels or reset on the book scope.
    expect(screen.queryByTestId('grid-source-columns')).toBeNull()
    expect(screen.queryByTestId('grid-reset')).toBeNull()
    expect(
      screen.getByText('Facing pages are mirrored: inside = spine side.'),
    ).toBeTruthy()
  })

  it('clamps columns to 12 and keeps the field at the clamped value', () => {
    seed()
    render(<GridSection scope="book" />)
    commit('columns', '30')
    expect(getBookStoreSnapshot().book.layoutGrid.columns).toBe(12)
    expect(field('columns').value).toBe('12')
  })

  it('one edit is one undo step', () => {
    seed()
    render(<GridSection scope="book" />)
    commit('rows', '4')
    act(() => {
      undoBook()
    })
    expect(getBookStoreSnapshot().book.layoutGrid.rows).toBe(2)
  })

  it('spread: BOOK labels and a disabled reset when clean', () => {
    seed()
    render(<GridSection scope="spread" spreadId="s1" />)
    expect(screen.getByTestId('grid-source-columns').textContent).toBe('book')
    expect(screen.getByTestId<HTMLButtonElement>('grid-reset').disabled).toBe(
      true,
    )
    expect(screen.getByTestId('grid-reset').textContent).toBe(
      'Reset to book grid',
    )
  })

  it('spread: an override flips only that field to SPREAD and enables reset', () => {
    seed()
    render(<GridSection scope="spread" spreadId="s1" />)
    commit('columns', '7')
    expect(screen.getByTestId('grid-summary').textContent).toBe('7×2')
    expect(screen.getByTestId('grid-source-columns').textContent).toBe('spread')
    expect(screen.getByTestId('grid-source-rows').textContent).toBe('book')
    const book = getBookStoreSnapshot().book
    expect(book.layoutGrid.columns).toBe(2)
    expect(book.spreads[1]?.layoutGrid).toBeUndefined()
    const reset = screen.getByTestId<HTMLButtonElement>('grid-reset')
    expect(reset.disabled).toBe(false)
    fireEvent.click(reset)
    expect(screen.getByTestId('grid-summary').textContent).toBe('2×2')
    expect(screen.getByTestId('grid-source-columns').textContent).toBe('book')
    expect(screen.getByTestId<HTMLButtonElement>('grid-reset').disabled).toBe(
      true,
    )
  })

  it('the header toggle shows / hides the grid overlay flag', () => {
    seed()
    render(<GridSection scope="book" />)
    const toggle = screen.getByTestId('grid-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(getGridVisible()).toBe(true)
    expect(screen.getByTestId('grid-toggle').getAttribute('aria-pressed')).toBe(
      'true',
    )
    fireEvent.click(screen.getByTestId('grid-toggle'))
    expect(getGridVisible()).toBe(false)
  })

  it('counts step by 1 and cap at 12; millimetres step by 0.5', () => {
    seed()
    render(<GridSection scope="book" />)
    fireEvent.keyDown(field('columns'), { key: 'ArrowUp' })
    expect(getBookStoreSnapshot().book.layoutGrid.columns).toBe(3)
    commit('rows', '12')
    fireEvent.keyDown(field('rows'), { key: 'ArrowUp' })
    expect(getBookStoreSnapshot().book.layoutGrid.rows).toBe(12)
    fireEvent.keyDown(field('top'), { key: 'ArrowUp' })
    expect(getBookStoreSnapshot().book.layoutGrid.margins.top).toBe(15.5)
  })

  it('shows mm units only on millimetre fields', () => {
    seed()
    render(<GridSection scope="book" />)
    expect(screen.getAllByText('mm')).toHaveLength(6)
    const columns = screen.getByTestId('grid-field-columns')
    expect(within(columns).queryByText('mm')).toBeNull()
  })

  it('ignores a cleared field', () => {
    seed()
    render(<GridSection scope="book" />)
    const before = getBookStoreSnapshot().book
    commit('columns', '')
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('a book section stays a book section even when handed a spread id', () => {
    seed()
    render(<GridSection scope="book" spreadId="s1" />)
    expect(screen.queryByTestId('grid-reset')).toBeNull()
    expect(screen.queryByTestId('grid-source-columns')).toBeNull()
    commit('columns', '6')
    const book = getBookStoreSnapshot().book
    expect(book.layoutGrid.columns).toBe(6)
    expect(book.spreads[0]?.layoutGrid).toBeUndefined()
  })

  it('links each source label to its field for assistive tech', () => {
    seed()
    render(<GridSection scope="spread" spreadId="s1" />)
    const root = field('top')
    const sourceId = screen.getByTestId('grid-source-top').id
    expect(sourceId).not.toBe('')
    expect(root.getAttribute('aria-describedby')).toBe(sourceId)
  })

  it('book fields carry no description link', () => {
    seed()
    render(<GridSection scope="book" />)
    expect(field('top').getAttribute('aria-describedby')).toBeNull()
  })

  it('renders nothing for an unknown spread', () => {
    seed()
    render(<GridSection scope="spread" spreadId="missing" />)
    expect(screen.queryByTestId('grid-section-spread')).toBeNull()
  })
})

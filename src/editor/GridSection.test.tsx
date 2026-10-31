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

/** A "Use master" / "Custom" choice of the spread Grid section. */
function source(name: string) {
  return within(
    screen.getByRole('radiogroup', { name: 'Grid source' }),
  ).getByRole<HTMLInputElement>('radio', { name })
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

  it('spread: kit Grid section inherits the master when clean (no reset left to press)', () => {
    seed()
    render(<GridSection scope="spread" spreadId="s1" />)
    expect(screen.getByText('Grid')).toBeTruthy()
    expect(screen.queryByText('Layout grid')).toBeNull()
    expect(source('Use master').checked).toBe(true)
    expect(source('Custom').checked).toBe(false)
    expect(screen.getByTestId('spread-grid-inherit').textContent).toBe(
      'Master A · 2 × 2 · gutter 5 mm · margins 15/15/15/15 mm',
    )
    expect(screen.queryByTestId('grid-fields')).toBeNull()
    // Custom shows the fields, all still from the book; nothing is written.
    const before = getBookStoreSnapshot().book
    fireEvent.click(source('Custom'))
    expect(screen.getByTestId('grid-source-columns').textContent).toBe('book')
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('spread: an override flips only that field to SPREAD; Use master resets it', () => {
    seed()
    render(<GridSection scope="spread" spreadId="s1" />)
    fireEvent.click(source('Custom'))
    commit('columns', '7')
    expect(screen.getByTestId('grid-source-columns').textContent).toBe('spread')
    expect(screen.getByTestId('grid-source-rows').textContent).toBe('book')
    let book = getBookStoreSnapshot().book
    expect(book.layoutGrid.columns).toBe(2)
    expect(book.spreads[0]?.layoutGrid).toEqual({ columns: 7 })
    expect(book.spreads[1]?.layoutGrid).toBeUndefined()
    expect(source('Custom').checked).toBe(true)
    fireEvent.click(source('Use master'))
    book = getBookStoreSnapshot().book
    expect(book.spreads[0]?.layoutGrid).toBeUndefined()
    expect(source('Use master').checked).toBe(true)
    expect(screen.getByTestId('spread-grid-inherit').textContent).toContain(
      '2 × 2',
    )
    expect(screen.queryByTestId('grid-source-columns')).toBeNull()
  })

  it('spread: an overridden spread opens on Custom', () => {
    resetBookStore({
      book: makeBook({
        spreads: [makeSpread({ id: 's1', layoutGrid: { rows: 3 } })],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<GridSection scope="spread" spreadId="s1" />)
    expect(source('Custom').checked).toBe(true)
    expect(screen.getByTestId('grid-source-rows').textContent).toBe('spread')
  })

  it('spread: with no master the source reads "Use book" and the book grid', () => {
    resetBookStore({
      book: makeBook({
        spreads: [makeSpread({ id: 's1', masterId: 'none' })],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<GridSection scope="spread" spreadId="s1" />)
    expect(source('Use book').checked).toBe(true)
    expect(screen.getByTestId('spread-grid-inherit').textContent).toMatch(
      /^Book grid · 2 × 2 · /,
    )
  })

  it('spread: the Show grid switch drives the shared overlay flag', () => {
    seed()
    render(<GridSection scope="spread" spreadId="s1" />)
    const toggle = screen.getByRole('switch', { name: 'Show grid' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)
    expect(getGridVisible()).toBe(true)
    expect(
      screen
        .getByRole('switch', { name: 'Show grid' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    fireEvent.click(screen.getByRole('switch', { name: 'Show grid' }))
    expect(getGridVisible()).toBe(false)
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
    fireEvent.click(source('Custom'))
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

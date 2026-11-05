import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Book } from '../core'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { BookSettingsSection } from './BookSettingsSection'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { FIELD, SUB, T } from './editorChromeTokens'

/** Two spreads on Master A (no folios until `setParentPageNumbers`). */
function seed(): void {
  const book: Book = makeBook({
    parents: [{ id: 'pa', name: 'Master A', frames: [], guides: [] }],
    spreads: [
      makeSpread({ id: 's0', parentId: 'pa' }),
      makeSpread({ id: 's1', parentId: 'pa' }),
    ],
  })
  resetBookStore({
    book,
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const numbering = () => getBookStoreSnapshot().book.pageNumbering
const start = () => screen.getByTestId<HTMLInputElement>('book-pn-start')
const note = () => screen.getByTestId('book-pn-note').textContent

function type(value: string): void {
  fireEvent.change(start(), { target: { value } })
}

afterEach(() => {
  cleanup()
  resetBookStore()
})

// Designer page-numbers: Book settings owns how the folios count.
describe('Book settings page numbers', () => {
  it('sits between Binding and Print with Start at, format, Skip first page and the note', () => {
    seed()
    render(<BookSettingsSection />)

    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((el) => el.textContent)
    expect(titles.slice(1, 4)).toEqual(['Binding', 'Page numbers', 'Print'])
    const section = screen.getByTestId('book-page-numbers')
    expect(
      Array.from(section.querySelectorAll('.inspector-row')).map(
        (row) => row.firstElementChild?.textContent,
      ),
    ).toEqual(['Start at', 'Skip first page'])
    expect(start().value).toBe('1')
    expect(start().getAttribute('aria-label')).toBe('Start page numbers at')
    expect([start().min, start().max, start().step]).toEqual(['1', '999', '1'])
    expect(start().className).toBe(
      'insp-pages-field rounded-sm px-2 py-1 text-center text-sm',
    )
    expect(start().style.width).toBe('calc(2ch + 1rem)')
    expect(start().style.background.toUpperCase()).toBe(FIELD)
    expect(start().style.color.toUpperCase()).toBe(T)
    const group = screen.getByRole('radiogroup', { name: 'Page number format' })
    expect(
      Array.from(group.querySelectorAll('label')).map((el) => el.textContent),
    ).toEqual(['1, 2, 3', 'i, ii, iii', 'I, II, III'])
    expect(
      screen.getByTestId('book-pn-skip-first').getAttribute('aria-checked'),
    ).toBe('false')
    expect(note()).toBe(
      'No master prints page numbers yet. Turn them on in Masters.',
    )
    expect(screen.getByTestId('book-pn-note').style.color.toUpperCase()).toBe(
      SUB,
    )
  })

  it('commits Start at on Enter and blur, rounded and clamped to 1–999; Esc reverts', () => {
    seed()
    render(<BookSettingsSection />)

    type('12.4')
    expect(start().style.width).toBe('calc(4ch + 1rem)')
    fireEvent.keyDown(start(), { key: 'Enter' })
    expect(numbering()?.start).toBe(12)
    expect(start().value).toBe('12')

    type('5000')
    fireEvent.blur(start())
    expect(numbering()?.start).toBe(999)

    type('0')
    fireEvent.keyDown(start(), { key: 'Enter' })
    expect(numbering()?.start).toBe(1)

    type('40')
    fireEvent.keyDown(start(), { key: 'Escape' })
    expect(start().value).toBe('1')
    fireEvent.blur(start())
    expect(numbering()?.start).toBe(1)
  })

  it('keeps the start on an empty value', () => {
    seed()
    render(<BookSettingsSection />)
    type('7')
    fireEvent.blur(start())
    const before = getBookStoreSnapshot().book

    type('')
    fireEvent.blur(start())
    expect(getBookStoreSnapshot().book).toBe(before)
    expect(start().value).toBe('7')
  })

  it('format and Skip first page write one step each; the note follows', () => {
    seed()
    render(<BookSettingsSection />)
    act(() => {
      dispatchBookOp({
        type: 'setParentPageNumbers',
        parentId: 'pa',
        position: 'outer',
      })
    })
    expect(note()).toBe('Page 1 is 1')

    fireEvent.click(screen.getByRole('radio', { name: 'I, II, III' }))
    expect(numbering()?.format).toBe('upper-roman')
    expect(note()).toBe('Page 1 is I')

    fireEvent.click(screen.getByTestId('book-pn-skip-first'))
    expect(numbering()?.skipFirst).toBe(true)
    expect(
      screen.getByTestId('book-pn-skip-first').getAttribute('aria-checked'),
    ).toBe('true')
    expect(note()).toBe('Page 1 has no number · page 2 is II')

    fireEvent.click(screen.getByRole('radio', { name: 'i, ii, iii' }))
    expect(note()).toBe('Page 1 has no number · page 2 is ii')

    act(() => {
      undoBook()
    })
    expect(numbering()?.format).toBe('upper-roman')
    expect(getHistorySnapshot().canUndo).toBe(true)
  })
})

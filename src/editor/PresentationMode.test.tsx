import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getSpreadIdsSnapshot,
  resetBookStore,
} from './bookStore'
import { EditorShell } from './EditorShell'
import {
  resetActiveSpreadIdForTests,
  setActiveSpreadId,
} from './photoRootSession'

const position = () => screen.getByTestId('pager-position').textContent

describe('PresentationMode', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetActiveSpreadIdForTests()
  })

  it('disables Present when the book has no spreads', () => {
    const { book, sessionMeta } = getBookStoreSnapshot()
    resetBookStore({
      book: { ...book, spreads: [] },
      sessionMeta,
      importRunning: false,
      importExpectedCount: 0,
    })
    render(<EditorShell />)
    expect(screen.getByTestId('present').hasAttribute('disabled')).toBe(true)
  })

  it('opens from Present, pages, and Esc returns to the editor', () => {
    render(<EditorShell />)
    expect(screen.queryByTestId('presentation')).toBeNull()
    fireEvent.click(screen.getByTestId('present'))
    expect(screen.getByTestId('presentation')).toBeTruthy()
    expect(position()).toBe('1 / 3')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(position()).toBe('2 / 3')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('presentation')).toBeNull()
    expect(screen.getByTestId('canvas')).toBeTruthy()
  })

  it('renders the connected spread views of the current window', () => {
    render(<EditorShell />)
    fireEvent.click(screen.getByTestId('present'))
    // First of three: current + next.
    const views = () =>
      within(screen.getByTestId('presentation')).getAllByTestId('spread-view')
    expect(views()).toHaveLength(2)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(views()).toHaveLength(3)
  })

  it('never draws guides, which the editor canvas does draw', () => {
    dispatchBookOp({
      type: 'addGuide',
      spreadId: getSpreadIdsSnapshot()[0] ?? '',
      orientation: 'vertical',
      offsetMm: 40,
    })
    render(<EditorShell />)
    expect(screen.getAllByTestId('guide-line')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('present'))
    expect(
      within(screen.getByTestId('presentation')).queryAllByTestId('guide-line'),
    ).toHaveLength(0)
  })

  it('opens at the active spread', () => {
    const ids = getBookStoreSnapshot().book.spreads.map((s) => s.id)
    render(<EditorShell />)
    act(() => {
      setActiveSpreadId(ids[2] ?? null)
    })
    fireEvent.click(screen.getByTestId('present'))
    expect(position()).toBe('3 / 3')
  })

  it('opens at the first spread when no spread is active', () => {
    render(<EditorShell />)
    act(() => {
      setActiveSpreadId(null)
    })
    fireEvent.click(screen.getByTestId('present'))
    expect(position()).toBe('1 / 3')
  })

  it('clamps to the last spread when spreads are removed while presenting', () => {
    const ids = getBookStoreSnapshot().book.spreads.map((s) => s.id)
    render(<EditorShell />)
    act(() => {
      setActiveSpreadId(ids[2] ?? null)
    })
    fireEvent.click(screen.getByTestId('present'))
    const { book, sessionMeta } = getBookStoreSnapshot()
    act(() => {
      resetBookStore({
        book: { ...book, spreads: book.spreads.slice(0, 2) },
        sessionMeta,
        importRunning: false,
        importExpectedCount: 0,
      })
    })
    expect(position()).toBe('2 / 2')
  })
})

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bookSpineWidthMm } from '../core'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
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
    expect(position()).toBe('Cover')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(position()).toBe('1 / 3')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(position()).toBe('2 / 3')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(position()).toBe('Cover')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('presentation')).toBeNull()
    expect(screen.getByTestId('canvas')).toBeTruthy()
  })

  it('renders the connected spread views of the current window', () => {
    render(<EditorShell />)
    fireEvent.click(screen.getByTestId('present'))
    // The cover, then three spreads: current + neighbours.
    const stage = () => within(screen.getByTestId('presentation'))
    const views = () => stage().getAllByTestId('spread-view')
    expect(stage().getAllByTestId('presentation-cover')).toHaveLength(1)
    expect(views()).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(stage().getAllByTestId('presentation-cover')).toHaveLength(1)
    expect(views()).toHaveLength(2)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(stage().queryAllByTestId('presentation-cover')).toHaveLength(0)
    expect(views()).toHaveLength(3)
  })

  it('draws the cover at the spreads px / mm', () => {
    const { book } = getBookStoreSnapshot()
    render(<EditorShell />)
    fireEvent.click(screen.getByTestId('present'))
    const cover = screen.getByTestId('presentation-cover')
    const widthMm = 2 * book.settings.trim.widthMm + bookSpineWidthMm(book)
    expect(cover.style.width).toBe(`${String(widthMm * SPREAD_PX_PER_MM)}px`)
    expect(cover.querySelector('.cover-spread')).not.toBeNull()
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

  // Owner Must M53 (round 7): Preview opens on the cover, not the active spread.
  it('opens on the cover even with an active spread', () => {
    const ids = getBookStoreSnapshot().book.spreads.map((s) => s.id)
    render(<EditorShell />)
    act(() => {
      setActiveSpreadId(ids[2] ?? null)
    })
    fireEvent.click(screen.getByTestId('present'))
    expect(position()).toBe('Cover')
  })

  it('opens on the cover when no spread is active', () => {
    render(<EditorShell />)
    act(() => {
      setActiveSpreadId(null)
    })
    fireEvent.click(screen.getByTestId('present'))
    expect(position()).toBe('Cover')
  })

  it('clamps to the last spread when spreads are removed while presenting', () => {
    render(<EditorShell />)
    fireEvent.click(screen.getByTestId('present'))
    for (let i = 0; i < 3; i += 1) {
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    }
    expect(position()).toBe('3 / 3')
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

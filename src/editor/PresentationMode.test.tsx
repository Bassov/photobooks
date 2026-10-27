import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { EditorShell } from './EditorShell'

const position = () => screen.getByTestId('pager-position').textContent

describe('PresentationMode', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
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
})

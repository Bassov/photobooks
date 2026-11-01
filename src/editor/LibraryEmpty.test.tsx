import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LibraryEmpty } from './LibraryEmpty'

describe('LibraryEmpty', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows example book, plain credit, and Create book', () => {
    const onCreate = vi.fn()
    render(<LibraryEmpty onCreate={onCreate} />)
    expect(screen.getByTestId('library-empty')).toBeTruthy()
    expect(screen.getByTestId('library-empty').style.gap).toMatch(/clamp/)
    expect(screen.getByTestId('example-book')).toBeTruthy()
    expect(screen.getByTestId('book-object')).toBeTruthy()
    expect(screen.getByTestId('screen-credit')).toBeTruthy()
    expect(screen.queryByText(/0 books/i)).toBeNull()
    fireEvent.click(screen.getByTestId('new-book'))
    expect(onCreate).toHaveBeenCalled()
  })

  it('disables Create book when createDisabled', () => {
    render(<LibraryEmpty onCreate={() => undefined} createDisabled />)
    const btn = screen.getByTestId('new-book')
    expect(
      btn.getAttribute('data-disabled') ??
        btn.getAttribute('aria-disabled') ??
        btn.getAttribute('disabled'),
    ).toBeTruthy()
  })
})

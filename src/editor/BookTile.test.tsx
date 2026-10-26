import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BookTile } from './BookTile'
import type { LibraryGridBook } from './libraryBookFilter'

const book: LibraryGridBook = {
  id: 'b1',
  title: 'Fog',
  displayTitle: 'Fog',
  fmt: 'portrait',
  spreads: 3,
}

describe('BookTile', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens on cover press and shows page meta from spreads', () => {
    const onOpen = vi.fn()
    render(<BookTile book={book} H={236} onOpen={onOpen} />)
    expect(screen.getByTestId('book-meta').textContent).toBe('6 pages')
    expect(
      screen.getByTestId('book-cover-stage').getAttribute('data-stage-height'),
    ).toBe('248')
    expect(
      Number(
        screen.getByTestId('book-caption').getAttribute('data-caption-width'),
      ),
    ).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId('library-book-b1'))
    expect(onOpen).toHaveBeenCalled()
  })

  it('renders custom title and menu slot', () => {
    render(
      <BookTile
        book={{ ...book, fmt: 'landscape', spreads: 1 }}
        title={<span data-testid="custom-title">Renaming</span>}
        menu={
          <button type="button" data-testid="custom-menu">
            …
          </button>
        }
      />,
    )
    expect(screen.getByTestId('custom-title')).toBeTruthy()
    expect(screen.getByTestId('book-menu-slot')).toBeTruthy()
    expect(screen.getByTestId('book-meta').textContent).toBe('2 pages')
  })
})

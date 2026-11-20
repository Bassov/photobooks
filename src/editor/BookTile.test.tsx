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
    // Three spreads list pages 1, 2–3, 4.
    expect(screen.getByTestId('book-meta').textContent).toBe('4 pages')
    expect(
      screen.getByTestId('library-book-b1').getAttribute('aria-label'),
    ).toBe('Open Fog, 4 pages')
    expect(screen.getByTestId('book-object-spine')).toBeTruthy()
    expect(screen.getByTestId('book-object-pages')).toBeTruthy()
    expect(
      screen.getByTestId('book-object-ink').querySelector('em')?.textContent,
    ).toBe('Fog')
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

  it('paints a photo-less cover in its cloth with the Title font and D38 ink', () => {
    render(
      <BookTile book={{ ...book, backFill: '#E8E6E3', titleFont: 'serif' }} />,
    )
    const shell = screen.getByTestId('book-object-cover-shell')
    expect(shell.style.background).toBe('#E8E6E3')
    expect(shell.style.boxShadow).toBe('var(--book-shadow, var(--shadow-book))')
    expect(screen.queryByTestId('book-object-cover')).toBeNull()
    expect(screen.getByTestId('book-object-ink').style.color).toBe('#2E2C2D')
    const em = screen.getByTestId('book-object-ink').querySelector('em')
    expect(em?.style.fontFamily).toContain('Lora Cover')
    expect(em?.style.fontStyle).toBe('normal')
    cleanup()

    // The default dark cloth takes the light ink.
    render(<BookTile book={{ ...book, backFill: '#3E3C3B' }} />)
    expect(screen.getByTestId('book-object-ink').style.color).toBe('#F5F5F5')
    expect(
      screen.getByTestId('book-object-ink').querySelector('em')?.style
        .fontFamily,
    ).toBe('')
  })

  it('includes edited meta when editedAtMs is present', () => {
    const now = Date.UTC(2026, 9, 26, 12, 0, 0)
    render(
      <BookTile book={{ ...book, editedAtMs: now - 3_600_000 }} nowMs={now} />,
    )
    expect(screen.getByTestId('book-meta').textContent).toBe(
      '4 pages · edited 1 hour ago',
    )
  })

  it('draws square trims as vertical book objects', () => {
    render(<BookTile book={{ ...book, fmt: 'square' }} />)
    const obj = screen.getByTestId('book-object')
    expect(obj.getAttribute('data-format')).toBe('portrait')
    expect(Number(obj.getAttribute('data-width'))).toBeLessThan(236)
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
    expect(screen.getByTestId('book-meta').textContent).toBe('1 page')
    expect(
      screen.getByTestId('library-book-b1').getAttribute('aria-label'),
    ).toBe('Open Fog, 1 page')
  })
})

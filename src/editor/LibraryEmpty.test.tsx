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

  it('uses kit line-heights and drops UA figure / paragraph margins (round 10, M64)', () => {
    render(<LibraryEmpty onCreate={() => undefined} />)
    const has = (el: Element | null, cls: string) =>
      (el?.className ?? '').split(/\s+/).includes(cls)
    expect(has(screen.getByTestId('library-empty'), 'pb-kit-type')).toBe(true)
    expect(has(screen.getByTestId('example-book'), 'm-0')).toBe(true)
    expect(has(screen.getByText(/^Create a book, then add/), 'mb-0')).toBe(true)
    const headline = screen.getByRole('heading', { level: 1 })
    expect(has(headline, 'pb-library-headline')).toBe(true)
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

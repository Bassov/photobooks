import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BookObject } from './BookObject'
import { bookObjectLayout } from './bookObjectLayout'

describe('BookObject', () => {
  afterEach(() => {
    cleanup()
  })

  it('exposes layout metrics and optional cover/sub', () => {
    const layout = bookObjectLayout(440, 'portrait')
    render(
      <BookObject
        src="/photos/hi/c18b.jpg"
        title="Fog"
        sub="Autumn · 2025"
        h={440}
      />,
    )
    const root = screen.getByTestId('book-object')
    expect(root.getAttribute('data-format')).toBe('portrait')
    expect(root.getAttribute('data-width')).toBe(String(layout.width))
    expect(root.getAttribute('data-scale')).toBe(String(layout.scale))
    expect(root.style.width).toBe(`${String(layout.width)}px`)
    expect(root.style.height).toBe('440px')
    const pages = screen.getByTestId('book-object-pages')
    expect(Number.parseFloat(pages.style.left)).toBeCloseTo(
      layout.pageBlock.left,
      5,
    )
    expect(pages.style.boxShadow).toBe(layout.pageBlock.boxShadow)
    expect(screen.getByTestId('book-object-cover-shell').style.boxShadow).toBe(
      layout.coverShadow,
    )
    expect(
      screen.getByTestId('book-object-cover').style.backgroundImage,
    ).toContain('c18b.jpg')
    expect(screen.getByTestId('book-object-ink').style.color).toBe('#2E2C2D')
    expect(
      Number.parseFloat(screen.getByTestId('book-object-spine').style.width),
    ).toBeCloseTo(layout.spineWidth, 5)
    const title = screen.getByText('Fog').parentElement
    expect(title?.style.fontSize).toBe(`${String(layout.titleSize)}px`)
    const sub = screen.getByTestId('book-object-sub')
    expect(sub.style.fontSize).toBe(`${String(layout.subSize)}px`)
    expect(sub.style.letterSpacing).toBe('0.3em')
    expect(sub.style.marginTop).toBe('0.6em')
  })

  it('omits cover and subtitle when absent', () => {
    render(<BookObject title="Blank" h={200} fmt="square" />)
    expect(screen.getByTestId('book-object').getAttribute('data-format')).toBe(
      'square',
    )
    expect(screen.queryByTestId('book-object-cover')).toBeNull()
    expect(screen.queryByText('Autumn')).toBeNull()
  })
})

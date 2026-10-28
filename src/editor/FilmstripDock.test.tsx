import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetBookStore } from './bookStore'
import { seedGallery } from './gallery.test-helpers'
import { FilmstripDock } from './FilmstripDock'

describe('FilmstripDock', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('wraps filmstrip and shows gallery count', () => {
    seedGallery(3)
    render(<FilmstripDock />)
    expect(screen.getByTestId('dock')).toBeTruthy()
    expect(screen.getByTestId('placed-count').textContent).toBe(
      'Photos · 3 · 0 used',
    )
    expect(screen.getByTestId('filmstrip')).toBeTruthy()
  })

  it('uses quiet ghost chips and no outline toggle', () => {
    seedGallery(1)
    render(<FilmstripDock />)
    expect(screen.getByTestId('film-sort').className).toContain('film-chip')
    const toggle = screen.getByTestId('film-unplaced-only')
    expect(toggle.className).toContain('film-chip')
    expect(toggle.className).not.toContain('outline')
  })
})

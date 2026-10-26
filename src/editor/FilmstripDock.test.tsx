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
    expect(screen.getByTestId('placed-count').textContent).toBe('Photos · 3')
    expect(screen.getByTestId('filmstrip')).toBeTruthy()
  })
})

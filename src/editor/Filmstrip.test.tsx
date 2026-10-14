import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetAssetPool } from '../photo/assetPool'
import { resetBookStore } from './bookStore'
import { Filmstrip } from './Filmstrip'
import { THUMB_WIDTH } from './FilmstripItem'
import { seedGallery } from './gallery.test-helpers'
import { resetThumbCache } from './thumbCache'

const ITEM_STRIDE = THUMB_WIDTH + 8
const filmstripCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Filmstrip.css'),
  'utf8',
)

describe('Filmstrip viewport containment', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetThumbCache()
    resetAssetPool()
  })

  it('sizes the spacer to the full gallery stride', () => {
    seedGallery(80)
    render(<Filmstrip />)

    const spacer = document.querySelector('.filmstrip-spacer')
    expect(spacer).toBeTruthy()
    expect((spacer as HTMLElement).style.width).toBe(
      `${String(80 * ITEM_STRIDE)}px`,
    )
    expect(
      screen.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    ).toBe('80')
  })

  it('declares CSS containment so a wide spacer cannot grow the page', () => {
    expect(filmstripCss).toMatch(/\.filmstrip\s*\{[^}]*min-width:\s*0/s)
    expect(filmstripCss).toMatch(/\.filmstrip\s*\{[^}]*max-width:\s*100%/s)
    expect(filmstripCss).toMatch(/\.filmstrip\s*\{[^}]*overflow:\s*hidden/s)
    expect(filmstripCss).toMatch(
      /\.filmstrip-scroll\s*\{[^}]*max-width:\s*100%/s,
    )
    expect(filmstripCss).toMatch(/\.filmstrip-scroll\s*\{[^}]*min-width:\s*0/s)
  })
})

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeFrame, makeSpread } from '../core/testing/fixtures'
import { resetAssetPool } from '../photo/assetPool'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
} from './bookStore'
import { Filmstrip } from './Filmstrip'
import { resetFilmstripGridFocus } from './filmstripGridFocus'
import { resetFrameSelection } from './frameSelection'
import { seedGallery } from './gallery.test-helpers'
import { getSelectedAssetIds, resetGallerySelection } from './gallerySelection'
import { endPhotoPick, getPhotoPick, startPhotoPick } from './photoPick'
import { resetThumbCache } from './thumbCache'

const PLACE = { spreadId: 's', frameId: 'f', kind: 'place' } as const

/** Four gallery photos and one empty frame `s/f`, picking for it. */
function setup(): void {
  seedGallery(4)
  const { book, sessionMeta } = getBookStoreSnapshot()
  resetBookStore({
    book: {
      ...book,
      spreads: [makeSpread({ id: 's', frames: [makeFrame({ id: 'f' })] })],
    },
    sessionMeta,
    importRunning: false,
    importExpectedCount: 0,
  })
  render(<Filmstrip />)
  act(() => {
    startPhotoPick(PLACE)
  })
}

function row(id: string): HTMLElement {
  const match = screen
    .getAllByRole('row')
    .find((item) => item.dataset.assetId === id)
  if (match === undefined) {
    throw new Error(`row ${id} not mounted`)
  }
  return match
}

const placed = () => getBookStoreSnapshot().book.spreads[0]?.frames[0]?.assetId

describe('Filmstrip pick mode (FM4)', () => {
  afterEach(() => {
    act(() => {
      endPhotoPick()
    })
    cleanup()
    resetFrameSelection()
    resetBookStore()
    resetThumbCache()
    resetAssetPool()
    resetGallerySelection()
    resetFilmstripGridFocus()
  })

  it('marks the strip data-picking while on', () => {
    setup()
    const strip = screen.getByTestId('filmstrip')
    expect(strip.hasAttribute('data-picking')).toBe(true)
    act(() => {
      endPhotoPick()
    })
    expect(strip.hasAttribute('data-picking')).toBe(false)
  })

  it('a thumb click places that photo, one step, the selection unchanged', () => {
    setup()
    fireEvent.click(row('seed-2'))
    expect(placed()).toBe('seed-2')
    expect(getPhotoPick()).toBeNull()
    expect(getSelectedAssetIds()).toEqual([])
    expect(getHistorySnapshot().undoLabel).toBe('Place photo')
  })

  it('Enter on a focused thumb picks it and stops there', () => {
    setup()
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    let reached = false
    const outer = () => {
      reached = true
    }
    document.addEventListener('keydown', outer)
    row('seed-1').dispatchEvent(event)
    document.removeEventListener('keydown', outer)
    expect(event.defaultPrevented).toBe(true)
    expect(reached).toBe(false)
    expect(placed()).toBe('seed-1')
  })

  it('Space picks as Enter does', () => {
    setup()
    fireEvent.keyDown(row('seed-3'), { key: ' ' })
    expect(placed()).toBe('seed-3')
    expect(getSelectedAssetIds()).toEqual([])
  })

  it('arrows move focus only; other keys do not pick', () => {
    setup()
    fireEvent.keyDown(row('seed-0'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(row('seed-1'))
    expect(getSelectedAssetIds()).toEqual([])
    fireEvent.keyDown(row('seed-1'), { key: 'a' })
    expect(placed()).toBeUndefined()
    expect(getPhotoPick()).toEqual(PLACE)
  })

  it('off, a click selects and Enter does not place', () => {
    setup()
    act(() => {
      endPhotoPick()
    })
    fireEvent.click(row('seed-2'))
    expect(getSelectedAssetIds()).toEqual(['seed-2'])
    fireEvent.keyDown(row('seed-2'), { key: 'Enter' })
    expect(placed()).toBeUndefined()
  })
})

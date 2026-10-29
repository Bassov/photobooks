import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  makeBook,
  makeBookWithAsset,
  makeSpread,
} from '../core/testing/fixtures'
import { resetBookStore } from './bookStore'
import { resetFrameSelection, setFrameSource } from './frameSelection'
import { GridOverlay } from './GridOverlay'
import { setGridVisible } from './gridView'
import { Inspector } from './Inspector'
import { setActiveSpreadId } from './photoRootSession'

function seed() {
  resetBookStore({
    book: makeBook({
      spreads: [makeSpread({ id: 's1' }), makeSpread({ id: 's2' })],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('Inspector layout grid tabs', () => {
  afterEach(() => {
    cleanup()
    setGridVisible(false)
    setActiveSpreadId(null)
    resetBookStore()
  })

  it('Book tab holds the book grid; Spread tab the override section', () => {
    seed()
    act(() => {
      setActiveSpreadId('s1')
    })
    render(<Inspector />)
    fireEvent.click(screen.getByTestId('inspector-tab-spread'))
    expect(screen.getByTestId('grid-section-spread')).toBeTruthy()
    expect(screen.queryByTestId('grid-section-book')).toBeNull()
    fireEvent.click(screen.getByTestId('inspector-tab-book'))
    expect(screen.getByTestId('grid-section-book')).toBeTruthy()
    expect(screen.queryByTestId('grid-section-spread')).toBeNull()
    expect(screen.getByText('Layout grid')).toBeTruthy()
    expect(screen.getByTestId('grid-summary').textContent).toBe('2×2')
  })

  it('switches back from Book to the Spread tab', () => {
    seed()
    act(() => {
      setActiveSpreadId('s1')
    })
    render(<Inspector />)
    fireEvent.click(screen.getByTestId('inspector-tab-book'))
    fireEvent.click(screen.getByTestId('inspector-tab-spread'))
    expect(screen.getByTestId('grid-section-spread')).toBeTruthy()
    expect(screen.queryByTestId('grid-section-book')).toBeNull()
  })

  it('the Book tab does not show the frame fit & crop section', () => {
    resetBookStore({
      book: makeBookWithAsset('a'),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    act(() => {
      setFrameSource({ spreadId: 'spread-1', frameId: 'frame-1' })
    })
    render(<Inspector />)
    expect(screen.getByTestId('inspector-fit-crop')).toBeTruthy()
    fireEvent.click(screen.getByTestId('inspector-tab-book'))
    expect(screen.queryByTestId('inspector-fit-crop')).toBeNull()
    act(() => {
      resetFrameSelection()
    })
  })

  it('shows no spread grid with nothing selected', () => {
    seed()
    render(<Inspector />)
    fireEvent.click(screen.getByTestId('inspector-tab-spread'))
    expect(screen.queryByTestId('grid-section-spread')).toBeNull()
  })
})

describe('GridOverlay', () => {
  afterEach(() => {
    cleanup()
    setGridVisible(false)
    resetBookStore()
  })

  it('paints nothing while hidden and a page grid when shown', () => {
    seed()
    render(<GridOverlay spreadId="s1" pxPerMm={1} />)
    expect(screen.queryByTestId('grid-overlay')).toBeNull()
    act(() => {
      setGridVisible(true)
    })
    expect(screen.getByTestId('grid-overlay').getAttribute('aria-hidden')).toBe(
      'true',
    )
    // Two spreads → both single pages; 2 columns + 2 rows each.
    expect(screen.getAllByTestId('grid-overlay-column')).toHaveLength(2)
    expect(screen.getAllByTestId('grid-overlay-row')).toHaveLength(2)
  })

  it('scales millimetres by pxPerMm and is click-through', () => {
    seed()
    setGridVisible(true)
    render(<GridOverlay spreadId="s1" pxPerMm={2} />)
    const svg = screen.getByTestId('grid-overlay')
    expect(svg.style.pointerEvents).toBe('none')
    expect(svg.style.position).toBe('absolute')
    // Cover page: inside margin 15 mm → x = 30 px, content width 270 mm → 540 px.
    const first = screen.getAllByTestId('grid-overlay-column')[0]
    expect(first?.getAttribute('x')).toBe('30')
    const row = screen.getAllByTestId('grid-overlay-row')[0]
    expect(row?.getAttribute('width')).toBe('540')
  })

  it('paints nothing for an unknown spread', () => {
    seed()
    setGridVisible(true)
    render(<GridOverlay spreadId="missing" pxPerMm={1} />)
    expect(screen.queryByTestId('grid-overlay')).toBeNull()
  })
})

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, assert, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame } from '../core/testing/fixtures'
import { resetBookStore } from './bookStore'
import { getFrameSource, setFrameSource } from './frameSelection'
import { MastersCanvas } from './MastersCanvas'
import { setRulersVisible } from './rulersView'
import {
  resetLeftPanelTabForTests,
  setLeftPanelTab,
  setPickedParentId,
} from './leftPanelTabStore'

function loadParents(ids: readonly string[]): void {
  resetBookStore({
    book: makeBook({
      parents: ids.map((id) => ({
        id,
        name: id,
        frames: [makeFrame({ id: `${id}-logo` })],
        guides: [],
      })),
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

describe('MastersCanvas', () => {
  afterEach(() => {
    cleanup()
    setRulersVisible(false)
    resetBookStore()
    resetLeftPanelTabForTests()
    vi.restoreAllMocks()
  })

  it('renders nothing on Pages and the empty note on Masters without parents', () => {
    loadParents([])
    render(<MastersCanvas />)
    expect(screen.queryByTestId('masters-canvas-empty')).toBeNull()

    act(() => {
      setLeftPanelTab('masters')
    })

    expect(screen.getByTestId('masters-canvas-empty').textContent).toContain(
      'No masters yet',
    )
    expect(screen.queryByTestId('masters-canvas')).toBeNull()
  })

  it('shows the empty note for a book without parents', () => {
    loadParents([])
    setLeftPanelTab('masters')
    render(<MastersCanvas />)
    expect(screen.getByTestId('masters-canvas-empty')).toBeTruthy()
  })

  it('shows the picked parent as an editable spread, else the first', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    loadParents(['p1', 'p2'])
    setLeftPanelTab('masters')
    render(<MastersCanvas />)
    const shown = () =>
      screen.getByTestId('masters-canvas').getAttribute('data-parent-id')
    const first = shown()

    act(() => {
      setPickedParentId('p2')
    })

    expect(first).toBe('p1')
    expect(shown()).toBe('p2')
    expect(screen.getByTestId('master-label').textContent).toBe('p2')
    const view = screen.getByTestId('spread-view')
    expect(view.getAttribute('data-spread-id')).toBe('p2')
    expect(
      view.querySelector('button.spread-frame[data-frame-id="p2-logo"]'),
    ).not.toBeNull()
  })

  it('draws the master grid with the Grid toggle off and labels the spread', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    loadParents(['p1'])
    setLeftPanelTab('masters')
    render(<MastersCanvas />)

    const overlay = screen.getByTestId('grid-overlay')
    expect(overlay.getAttribute('data-variant')).toBe('master')
    // Fixture book grid 2 × 2 on both pages.
    expect(screen.getAllByTestId('grid-overlay-cell')).toHaveLength(8)
    expect(screen.getByTestId('master-label').textContent).toBe('p1')
  })

  it('a press on the empty stage drops the frame selection; a frame press keeps it', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    loadParents(['p1'])
    setLeftPanelTab('masters')
    render(<MastersCanvas />)
    const selected = { spreadId: 'p1', frameId: 'p1-logo' }
    act(() => {
      setFrameSource(selected)
    })
    const frame = screen
      .getByTestId('masters-canvas')
      .querySelector('button.spread-frame')
    assert(frame !== null)

    fireEvent.pointerDown(frame, { button: 0 })
    expect(getFrameSource()).toEqual(selected)
    fireEvent.pointerDown(screen.getByTestId('spread-view'), { button: 2 })
    expect(getFrameSource()).toEqual(selected)

    fireEvent.pointerDown(screen.getByTestId('spread-view'), { button: 0 })
    expect(getFrameSource()).toBeNull()
  })

  it('shows the rulers on the master stage only while rulers are on', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(920)
    loadParents(['p1'])
    setLeftPanelTab('masters')
    render(<MastersCanvas />)
    const stage = screen.getByTestId('masters-canvas')
    expect(stage.dataset.rulers).toBe('false')
    expect(screen.queryByTestId('ruler-x')).toBeNull()

    act(() => {
      setRulersVisible(true)
    })

    expect(stage.dataset.rulers).toBe('true')
    expect(stage.contains(screen.getByTestId('ruler-x'))).toBe(true)
    // They measure the master spread inside the stage's fit area.
    expect(screen.getByTestId('ruler-x').dataset.origin).toBe('0')
    expect(stage.contains(screen.getByTestId('ruler-y'))).toBe(true)
    act(() => {
      setRulersVisible(false)
    })
    expect(screen.queryByTestId('ruler-x')).toBeNull()
  })
})

describe('MastersCanvas fit', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetLeftPanelTabForTests()
    vi.restoreAllMocks()
  })

  // Fixture trim 300 × 300 mm → a 600 × 300 mm parent inside the stage minus
  // its 80 px sides and 104 px top + bottom band.
  it.each([
    ['width-bound', 1000, 600, '920px', '460px'],
    ['height-bound', 2000, 400, '592px', '296px'],
    ['unmeasured', 80, 500, null, null],
    ['too short', 900, 104, null, null],
  ])('%s stage', (_, width, height, cssWidth, cssHeight) => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
      height,
    )
    loadParents(['p1'])
    setLeftPanelTab('masters')

    render(<MastersCanvas />)

    const view = screen.queryByTestId('spread-view')
    expect(view?.style.width ?? null).toBe(cssWidth)
    expect(view?.style.height ?? null).toBe(cssHeight)
  })
})

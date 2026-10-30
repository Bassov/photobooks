import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { dispatchBookOp, resetBookStore } from './bookStore'
import { GuidesOverlay } from './GuidesOverlay'
import { setGuidesVisible } from './guidesView'

const startGuideDrag = vi.hoisted(() => vi.fn())
vi.mock('./guideGesture', () => ({ startGuideDrag }))

function seed(locked = false) {
  resetBookStore({
    book: makeBook({
      spreads: [
        makeSpread({
          id: 's1',
          guides: [
            { id: 'v', orientation: 'vertical', offsetMm: 50 },
            { id: 'h', orientation: 'horizontal', offsetMm: 20, locked },
          ],
        }),
        makeSpread({ id: 's2' }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function renderInSpread(spreadId: string, pxPerMm = 2) {
  return render(
    <div className="pasteboard-stage">
      <div data-testid="spread-view" data-spread-id={spreadId}>
        <GuidesOverlay spreadId={spreadId} pxPerMm={pxPerMm} />
      </div>
      <div data-testid="ruler-x" />
      <div data-testid="ruler-y" />
    </div>,
  )
}

describe('GuidesOverlay', () => {
  afterEach(() => {
    cleanup()
    setGuidesVisible(true)
    startGuideDrag.mockReset()
    resetBookStore()
  })

  it('draws each guide of the spread at its mm offset', () => {
    seed()
    renderInSpread('s1')
    const lines = screen.getAllByTestId('guide-line')
    expect(lines).toHaveLength(2)
    expect(lines[0]?.style.left).toBe('100px')
    expect(lines[0]?.dataset.orientation).toBe('vertical')
    expect(lines[1]?.style.top).toBe('40px')
    expect(screen.getByTestId('guides-layer').getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('draws nothing on a spread without guides or while guides are hidden', () => {
    seed()
    renderInSpread('s2')
    expect(screen.queryAllByTestId('guide-line')).toHaveLength(0)
    cleanup()
    setGuidesVisible(false)
    renderInSpread('s1')
    expect(screen.queryByTestId('guides-layer')).toBeNull()
  })

  it('follows document changes', () => {
    seed()
    renderInSpread('s1')
    act(() => {
      dispatchBookOp({ type: 'removeGuide', spreadId: 's1', guideId: 'v' })
    })
    expect(screen.getAllByTestId('guide-line')).toHaveLength(1)
  })

  it('starts a drag on the matching ruler from the primary button', () => {
    seed()
    renderInSpread('s1')
    const [vertical, horizontal] = screen.getAllByTestId('guide-line')
    fireEvent.pointerDown(vertical as Element, { button: 0 })
    expect(startGuideDrag).toHaveBeenCalledTimes(1)
    const first = startGuideDrag.mock.calls[0]?.[0]
    expect(first.orientation).toBe('vertical')
    expect(first.rulerEl).toBe(screen.getByTestId('ruler-y'))
    expect(first.existing).toMatchObject({ id: 'v', offsetMm: 50 })
    expect(first.spreadEl).toBe(screen.getByTestId('spread-view'))

    fireEvent.pointerDown(horizontal as Element, { button: 0 })
    const second = startGuideDrag.mock.calls[1]?.[0]
    expect(second.orientation).toBe('horizontal')
    expect(second.rulerEl).toBe(screen.getByTestId('ruler-x'))
  })

  it('swallows the press so the pasteboard does not also react', () => {
    seed()
    const parentDown = vi.fn()
    render(
      <div className="pasteboard-stage" onPointerDown={parentDown}>
        <div data-testid="spread-view" data-spread-id="s1">
          <GuidesOverlay spreadId="s1" pxPerMm={2} />
        </div>
      </div>,
    )
    const [vertical] = screen.getAllByTestId('guide-line')
    const notPrevented = fireEvent.pointerDown(vertical as Element, {
      button: 0,
    })
    expect(notPrevented).toBe(false)
    expect(parentDown).not.toHaveBeenCalled()
  })

  it('starts without a ruler when the spread has no stage, and not at all outside a spread', () => {
    seed()
    render(
      <div data-testid="spread-view" data-spread-id="s1">
        <GuidesOverlay spreadId="s1" pxPerMm={2} />
      </div>,
    )
    fireEvent.pointerDown(screen.getAllByTestId('guide-line')[0] as Element, {
      button: 0,
    })
    expect(startGuideDrag.mock.calls[0]?.[0].rulerEl).toBeNull()
    cleanup()
    startGuideDrag.mockReset()
    render(<GuidesOverlay spreadId="s1" pxPerMm={2} />)
    const bare = fireEvent.pointerDown(
      screen.getAllByTestId('guide-line')[0] as Element,
      { button: 0 },
    )
    expect(startGuideDrag).not.toHaveBeenCalled()
    expect(bare).toBe(true)
  })

  it('draws an empty layer for an unknown spread', () => {
    seed()
    renderInSpread('nope')
    expect(screen.getByTestId('guides-layer')).toBeTruthy()
    expect(screen.queryAllByTestId('guide-line')).toHaveLength(0)
  })

  it('ignores other buttons and locked guides', () => {
    seed(true)
    renderInSpread('s1')
    const [vertical, horizontal] = screen.getAllByTestId('guide-line')
    fireEvent.pointerDown(vertical as Element, { button: 2 })
    fireEvent.pointerDown(horizontal as Element, { button: 0 })
    expect(startGuideDrag).not.toHaveBeenCalled()
    expect(horizontal?.getAttribute('data-locked')).toBe('true')
    expect(vertical?.hasAttribute('data-locked')).toBe(false)
  })
})

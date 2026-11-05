import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeSpread } from '../core/testing/fixtures'
import { dispatchBookOp, resetBookStore } from './bookStore'
import { GuidesOverlay } from './GuidesOverlay'
import { setGuidesVisible } from './guidesView'

const startGuideDrag = vi.hoisted(() => vi.fn())
vi.mock('./guideGesture', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./guideGesture')>()),
  startGuideDrag,
}))

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
      parents: [
        {
          id: 'pa',
          name: 'Master A',
          frames: [],
          guides: [{ id: 'pg', orientation: 'horizontal', offsetMm: 30 }],
        },
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

/** Master A (horizontal 30, vertical 400 mm) on `first` and `child`; `none` has no parent. */
function seedChildren() {
  resetBookStore({
    book: makeBook({
      spreads: [
        makeSpread({ id: 'first', parentId: 'pa' }),
        makeSpread({
          id: 'child',
          parentId: 'pa',
          guides: [{ id: 'own', orientation: 'vertical', offsetMm: 50 }],
        }),
        makeSpread({ id: 'none', parentId: null }),
      ],
      parents: [
        {
          id: 'pa',
          name: 'Master A',
          frames: [],
          guides: [
            { id: 'pg', orientation: 'horizontal', offsetMm: 30 },
            { id: 'pv', orientation: 'vertical', offsetMm: 400 },
          ],
        },
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

/** ConnectedSpreadView's stage: the paper with the guides as its sibling. */
function Stage({
  spreadId,
  pxPerMm = 2,
}: {
  spreadId: string
  pxPerMm?: number
}) {
  return (
    <div className="spread-stage">
      <div data-testid="spread-view" data-spread-id={spreadId} />
      <GuidesOverlay spreadId={spreadId} pxPerMm={pxPerMm} />
    </div>
  )
}

function renderInSpread(spreadId: string, pxPerMm = 2) {
  return render(
    <div data-rulers="true">
      <Stage spreadId={spreadId} pxPerMm={pxPerMm} />
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
        <Stage spreadId="s1" />
      </div>,
    )
    const [vertical] = screen.getAllByTestId('guide-line')
    const notPrevented = fireEvent.pointerDown(vertical as Element, {
      button: 0,
    })
    expect(notPrevented).toBe(false)
    expect(parentDown).not.toHaveBeenCalled()
  })

  it('starts without a ruler when the spread has no rulers stage, and not at all outside a spread', () => {
    seed()
    render(<Stage spreadId="s1" />)
    fireEvent.pointerDown(screen.getAllByTestId('guide-line')[0] as Element, {
      button: 0,
    })
    expect(startGuideDrag.mock.calls[0]?.[0].rulerEl).toBeNull()
    cleanup()
    startGuideDrag.mockReset()
    render(<GuidesOverlay spreadId="s1" pxPerMm={2} />)
    // React reports a handler's throw instead of raising it: catch it here.
    const reported: unknown[] = []
    const onError = (event: ErrorEvent) => {
      reported.push(event.error)
      event.preventDefault()
    }
    window.addEventListener('error', onError)
    const bare = fireEvent.pointerDown(
      screen.getAllByTestId('guide-line')[0] as Element,
      { button: 0 },
    )
    window.removeEventListener('error', onError)
    expect(reported).toEqual([])
    expect(startGuideDrag).not.toHaveBeenCalled()
    expect(bare).toBe(true)
    cleanup()
    // A stage without its paper (mid-unmount) starts nothing either.
    render(
      <div className="spread-stage">
        <GuidesOverlay spreadId="s1" pxPerMm={2} />
      </div>,
    )
    fireEvent.pointerDown(screen.getAllByTestId('guide-line')[0] as Element, {
      button: 0,
    })
    expect(startGuideDrag).not.toHaveBeenCalled()
  })

  it('draws and follows a parent’s guides on the Masters canvas', () => {
    seed()
    renderInSpread('pa')
    const [line] = screen.getAllByTestId('guide-line')
    expect(line?.style.top).toBe('60px')
    expect(line?.dataset.guideId).toBe('pg')
    act(() => {
      dispatchBookOp({
        type: 'addGuide',
        spreadId: 'pa',
        orientation: 'vertical',
        offsetMm: 10,
      })
    })
    expect(screen.getAllByTestId('guide-line')).toHaveLength(2)
    fireEvent.pointerDown(line as Element, { button: 0 })
    expect(startGuideDrag.mock.calls[0]?.[0].rulerEl).toBe(
      screen.getByTestId('ruler-x'),
    )
  })

  it('draws an empty layer for an unknown spread', () => {
    seed()
    renderInSpread('nope')
    expect(screen.getByTestId('guides-layer')).toBeTruthy()
    expect(screen.queryAllByTestId('guide-line')).toHaveLength(0)
  })

  it('draws the parent’s guides read-only under the spread’s own, mapped onto a single page', () => {
    seedChildren()
    renderInSpread('child')
    const lines = screen
      .getByTestId('guides-layer')
      .querySelectorAll<HTMLElement>('.guide-line')
    expect([...lines].map((line) => line.dataset.testid)).toEqual([
      'guide-line-parent',
      'guide-line-parent',
      'guide-line',
    ])
    const [across, down] = screen.getAllByTestId('guide-line-parent')
    expect(across?.dataset.layer).toBe('parent')
    expect(across?.style.top).toBe('60px')
    expect(down?.style.left).toBe('800px')
    fireEvent.pointerDown(across as Element, { button: 0 })
    expect(startGuideDrag).not.toHaveBeenCalled()
    cleanup()

    // Page 1 is a right page: the 400 mm guide sits 100 mm into it.
    renderInSpread('first')
    const [, first] = screen.getAllByTestId('guide-line-parent')
    expect(first?.dataset.offsetMm).toBe('100')
    expect(first?.style.left).toBe('200px')
  })

  it('draws an overridden parent guide as an own guide that drags, the parent line gone', () => {
    seedChildren()
    renderInSpread('child')
    act(() => {
      dispatchBookOp({
        type: 'overrideParentGuide',
        spreadId: 'child',
        parentGuideId: 'pg',
      })
    })
    expect(screen.getAllByTestId('guide-line-parent')).toHaveLength(1)
    const [copy, own] = screen.getAllByTestId('guide-line')
    expect(copy?.dataset).toMatchObject({
      layer: 'override',
      guideId: 'copy-1',
      offsetMm: '30',
    })
    expect(own?.dataset.layer).toBe('spread')
    fireEvent.pointerDown(copy as Element, { button: 0 })
    const start = startGuideDrag.mock.calls[0]?.[0]
    expect(start?.orientation).toBe('horizontal')
    expect(start?.rulerEl).toBe(screen.getByTestId('ruler-x'))
    expect(start?.existing).toMatchObject({ id: 'copy-1', offsetMm: 30 })
  })

  it('follows a new spread id', () => {
    seedChildren()
    const view = render(<GuidesOverlay spreadId="none" pxPerMm={2} />)
    expect(screen.queryAllByTestId('guide-line-parent')).toHaveLength(0)
    view.rerender(<GuidesOverlay spreadId="child" pxPerMm={2} />)
    expect(screen.getAllByTestId('guide-line-parent')).toHaveLength(2)
  })

  it('re-renders only the overlays of spreads using an edited parent', () => {
    seedChildren()
    const renders = { child: 0, none: 0 }
    const count = (id: string) => () => {
      renders[id as keyof typeof renders] += 1
    }
    render(
      <>
        <Profiler id="child" onRender={count('child')}>
          <GuidesOverlay spreadId="child" pxPerMm={2} />
        </Profiler>
        <Profiler id="none" onRender={count('none')}>
          <GuidesOverlay spreadId="none" pxPerMm={2} />
        </Profiler>
      </>,
    )
    const before = { ...renders }
    act(() => {
      dispatchBookOp({
        type: 'addGuide',
        spreadId: 'pa',
        orientation: 'horizontal',
        offsetMm: 80,
      })
    })
    expect(renders.none).toBe(before.none)
    expect(renders.child).toBeGreaterThan(before.child)
    expect(screen.getAllByTestId('guide-line-parent')).toHaveLength(3)
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

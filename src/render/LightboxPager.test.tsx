import { useState, type ReactNode } from 'react'
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpreadPager } from './SpreadPager'

function Harness({
  count = 3,
  start = 0,
  onZoomSettle,
  onStep = () => undefined,
  onExit = () => undefined,
  renderSpread = (i) => <div data-testid={`spread-${String(i)}`} />,
}: {
  count?: number
  start?: number
  onZoomSettle?: (z: number, width: number) => void
  onStep?: (next: number) => void
  onExit?: () => void
  renderSpread?: (i: number) => ReactNode
}) {
  const [index, setIndex] = useState(start)
  return (
    <SpreadPager
      variant="lightbox"
      count={count}
      index={index}
      onIndexChange={(next) => {
        onStep(next)
        setIndex(next)
      }}
      onExit={onExit}
      renderSpread={renderSpread}
      onZoomSettle={onZoomSettle}
    />
  )
}

/** Alps 380 × 230 natural in 1440 × 900: box 1301.91 × 788 at (69.04, 64). */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(380)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(230)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1440)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(900)
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const root = () => screen.getByTestId('lightbox')
const zoom = () => root().dataset.zoom
const layer = () => screen.getByTestId('site-fullscreen-layer')
const at = () => screen.getByTestId('site-fullscreen-indicator').textContent

/** translate(x, y) scale(z) of the active layer. */
function transform(): { x: number; y: number; z: number } {
  const match =
    /translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\) scale\(([\d.e-]+)\)/.exec(
      layer().style.transform,
    )
  if (match === null) throw new Error(layer().style.transform)
  return { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) }
}

/** happy-dom's WheelEvent drops the MouseEvent fields: set them by hand. */
function wheel(init: {
  deltaX?: number
  deltaY?: number
  deltaMode?: number
  ctrlKey?: boolean
  metaKey?: boolean
  clientX?: number
  clientY?: number
}) {
  const { ctrlKey = false, metaKey = false, clientX = 0, clientY = 0 } = init
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaX: init.deltaX ?? 0,
    deltaY: init.deltaY ?? 0,
    deltaMode: init.deltaMode ?? 0,
  })
  Object.defineProperties(event, {
    ctrlKey: { value: ctrlKey },
    metaKey: { value: metaKey },
    clientX: { value: clientX },
    clientY: { value: clientY },
  })
  act(() => {
    root().dispatchEvent(event)
  })
  return event.defaultPrevented
}

function drag(
  from: { x: number; y: number },
  to: { x: number; y: number },
  pointerType = 'mouse',
  pointerId = 1,
) {
  fireEvent.pointerDown(root(), {
    pointerId,
    pointerType,
    button: 0,
    clientX: from.x,
    clientY: from.y,
  })
  fireEvent.pointerMove(root(), {
    pointerId,
    pointerType,
    clientX: to.x,
    clientY: to.y,
  })
  fireEvent.pointerUp(root(), {
    pointerId,
    pointerType,
    clientX: to.x,
    clientY: to.y,
  })
}

describe('lightbox gestures', () => {
  it('swipes over 60 px to step on release, mouse or finger', () => {
    render(<Harness />)
    drag({ x: 700, y: 400 }, { x: 640, y: 400 })
    expect(at()).toBe('1 / 3')
    drag({ x: 700, y: 400 }, { x: 580, y: 400 }, 'touch')
    expect(at()).toBe('2 / 3')
    drag({ x: 580, y: 400 }, { x: 700, y: 400 })
    expect(at()).toBe('1 / 3')
    expect(zoom()).toBe('1.00')
  })

  it('stops a native image drag, which would cancel the swipe', () => {
    render(<Harness />)
    expect(fireEvent.dragStart(screen.getByTestId('spread-0'))).toBe(false)
  })

  it('ignores a right-button drag, a cancelled swipe and moves of unknown pointers', () => {
    render(<Harness />)
    fireEvent.pointerDown(root(), {
      pointerId: 1,
      pointerType: 'mouse',
      button: 2,
      clientX: 700,
    })
    fireEvent.pointerMove(root(), { pointerId: 1, clientX: 500 })
    fireEvent.pointerUp(root(), { pointerId: 1, clientX: 500 })
    fireEvent.pointerDown(root(), { pointerId: 2, clientX: 700 })
    fireEvent.pointerCancel(root(), { pointerId: 2, clientX: 500 })
    expect(at()).toBe('1 / 3')
  })

  it('double-click zooms 2× about the point and back to 1', () => {
    render(<Harness />)
    fireEvent.dblClick(root(), { clientX: 720, clientY: 450 })
    expect(zoom()).toBe('2.00')
    const t = transform()
    // The point under the cursor stays put: box origin + pan + offset × z.
    expect(69.04 + t.x + (720 - 69.04) * 2).toBeCloseTo(720, 1)
    expect(64 + t.y + (450 - 64) * 2).toBeCloseTo(450, 5)
    fireEvent.dblClick(root(), { clientX: 100, clientY: 100 })
    expect(zoom()).toBe('1.00')
    expect(transform()).toStrictEqual({ x: 0, y: 0, z: 1 })
  })

  it('does not zoom on a double-click on a control', () => {
    render(<Harness />)
    fireEvent.dblClick(screen.getByTestId('site-fullscreen-close'))
    fireEvent.pointerDown(screen.getByTestId('site-fullscreen-zoom'), {
      pointerId: 1,
      clientX: 1360,
    })
    fireEvent.pointerUp(root(), { pointerId: 1, clientX: 1000 })
    expect(zoom()).toBe('1.00')
    expect(at()).toBe('1 / 3')
  })

  it('pans a zoomed slide with the pointer, clamped to the fit area', () => {
    render(<Harness />)
    fireEvent.click(screen.getByTestId('site-fullscreen-zoom'))
    const start = transform()
    expect(root().style.cursor).toBe('grab')
    fireEvent.pointerDown(root(), {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 700,
      clientY: 400,
    })
    expect(root().style.cursor).toBe('grabbing')
    fireEvent.pointerMove(root(), { pointerId: 1, clientX: 650, clientY: 380 })
    expect(transform().x).toBeCloseTo(start.x - 50, 5)
    expect(transform().y).toBeCloseTo(start.y - 20, 5)
    fireEvent.pointerMove(root(), {
      pointerId: 1,
      clientX: 5000,
      clientY: 5000,
    })
    // Left edge at the fit-area left (64), top edge at the area top (64).
    expect(69.04 + transform().x).toBeCloseTo(64, 1)
    expect(64 + transform().y).toBeCloseTo(64, 5)
    fireEvent.pointerUp(root(), { pointerId: 1, clientX: 5000, clientY: 5000 })
    expect(at()).toBe('1 / 3')
    expect(zoom()).toBe('2.00')
  })

  it('zooms with Ctrl + wheel about the cursor, pans with a plain wheel, snaps near 1', () => {
    render(<Harness />)
    vi.useFakeTimers()
    wheel({ deltaY: 100, clientX: 700, clientY: 400 })
    expect(transform()).toStrictEqual({ x: 0, y: 0, z: 1 })
    wheel({ deltaY: -50, ctrlKey: true, clientX: 700, clientY: 400 })
    expect(zoom()).toBe(Math.exp(0.5).toFixed(2))
    expect(layer().style.willChange).toBe('transform')
    const before = transform()
    wheel({ deltaX: 2, deltaY: 1, deltaMode: 1 })
    expect(transform().x).toBeCloseTo(before.x - 32, 5)
    expect(transform().y).toBeCloseTo(before.y - 16, 5)
    wheel({ deltaY: 49, metaKey: true, clientX: 700, clientY: 400 })
    expect(zoom()).toBe('1.01')
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(zoom()).toBe('1.00')
    expect(layer().style.willChange).toBe('')
  })

  it('pinches about the midpoint and pans on with the finger left', () => {
    render(<Harness />)
    const touch = (
      type: 'pointerDown' | 'pointerMove' | 'pointerUp',
      pointerId: number,
      x: number,
    ) => {
      fireEvent[type](root(), {
        pointerId,
        pointerType: 'touch',
        clientX: x,
        clientY: 450,
      })
    }
    touch('pointerDown', 1, 600)
    touch('pointerDown', 2, 800)
    touch('pointerMove', 2, 1000)
    expect(zoom()).toBe('2.00')
    touch('pointerUp', 2, 1000)
    const before = transform()
    touch('pointerMove', 1, 580)
    expect(transform().x).toBeCloseTo(before.x - 20, 5)
    touch('pointerUp', 1, 580)
    expect(at()).toBe('1 / 3')
  })

  it('double-taps a finger to toggle, not two taps far apart', () => {
    render(<Harness />)
    const tap = (x: number) => {
      drag({ x, y: 450 }, { x, y: 450 }, 'touch')
    }
    tap(300)
    tap(700)
    expect(zoom()).toBe('1.00')
    tap(700)
    expect(zoom()).toBe('2.00')
    drag({ x: 700, y: 450 }, { x: 640, y: 450 }, 'touch')
    tap(640)
    expect(zoom()).toBe('2.00')
  })

  it('zooms with + = - and 0 about the fit-area centre', () => {
    render(<Harness />)
    fireEvent.keyDown(window, { key: '=' })
    fireEvent.keyDown(window, { key: '+' })
    expect(zoom()).toBe('2.25')
    fireEvent.keyDown(window, { key: '-' })
    expect(zoom()).toBe('1.50')
    fireEvent.keyDown(window, { key: '0' })
    expect(zoom()).toBe('1.00')
    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(window, { key: '+' })
    expect(zoom()).toBe('3.00')
  })

  it('reports the settled zoom with the fitted width', () => {
    vi.useFakeTimers()
    const onZoomSettle = vi.fn()
    render(<Harness onZoomSettle={onZoomSettle} />)
    expect(onZoomSettle).toHaveBeenLastCalledWith(1, expect.any(Number))
    expect(onZoomSettle.mock.lastCall?.[1]).toBeCloseTo(1301.91, 2)
    fireEvent.keyDown(window, { key: '+' })
    expect(onZoomSettle).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(onZoomSettle).toHaveBeenLastCalledWith(1.5, expect.any(Number))
  })
})

const slides = () => screen.getAllByTestId('lightbox-slide')
const control = (label: string) => {
  const el = document.querySelector<HTMLElement>(`[aria-label="${label}"]`)
  if (el === null) throw new Error(`no ${label}`)
  return el
}

/** A touch tap at `x` with both events at time `t`. */
function tapAt(x: number, t: number, upX = x) {
  for (const [type, clientX] of [
    ['pointerDown', x],
    ['pointerUp', upX],
  ] as const) {
    const event = createEvent[type](root(), {
      pointerId: 1,
      pointerType: 'touch',
      clientX,
      clientY: 450,
    })
    Object.defineProperty(event, 'timeStamp', { value: t })
    fireEvent(root(), event)
  }
}

describe('lightbox pager details', () => {
  it('mounts only real neighbours, offset by a slide width, inert and hidden', () => {
    const { unmount } = render(<Harness />)
    expect(slides().map((s) => s.dataset.active)).toStrictEqual([
      'true',
      'false',
    ])
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(slides().map((s) => s.style.transform)).toStrictEqual([
      'translateX(-100%)',
      'translateX(0%)',
      'translateX(100%)',
    ])
    const [prev] = slides()
    expect(prev?.getAttribute('aria-hidden')).toBe('true')
    expect(prev?.hasAttribute('inert')).toBe(true)
    expect(
      screen.getByTestId('site-fullscreen-book').dataset.pagerNatural,
    ).toBe('1')
    fireEvent.keyDown(window, { key: 'End' })
    expect(slides()).toHaveLength(2)
    expect(slides()[1]?.hasAttribute('aria-hidden')).toBe(false)
    unmount()
  })

  it('centres the arrows on the fit area; Previous steps back, Next hides at the end', () => {
    const onStep = vi.fn()
    render(<Harness count={2} onStep={onStep} />)
    expect(control('Next spread').style.top).toBe('438px')
    expect(control('Next spread').style.right).toBe('12px')
    expect(control('Previous spread').style.left).toBe('12px')
    fireEvent.click(control('Next spread'))
    expect(control('Next spread').hasAttribute('inert')).toBe(true)
    expect(control('Previous spread').hasAttribute('inert')).toBe(false)
    fireEvent.click(control('Previous spread'))
    expect(onStep.mock.calls).toStrictEqual([[1], [0]])
    expect(at()).toBe('1 / 2')
  })

  it('jumps Home and End and reports no step past the ends', () => {
    const onStep = vi.fn()
    render(<Harness count={5} start={2} onStep={onStep} />)
    fireEvent.keyDown(window, { key: 'End' })
    expect(at()).toBe('5 / 5')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'End' })
    fireEvent.keyDown(window, { key: 'Home' })
    fireEvent.keyDown(window, { key: 'Home' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onStep.mock.calls).toStrictEqual([[4], [0]])
  })

  it('handles its keys before the page and leaves others to it', () => {
    const page = vi.fn()
    window.addEventListener('keydown', page)
    const onExit = vi.fn()
    render(<Harness onExit={onExit} />)
    for (const key of ['Tab', 'ArrowRight', '-', 'Escape']) {
      expect(fireEvent.keyDown(window, { key })).toBe(false)
    }
    expect(page).not.toHaveBeenCalled()
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(fireEvent.keyDown(window, { key: 'a' })).toBe(true)
    for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
      expect(
        fireEvent.keyDown(window, { key: 'ArrowRight', [mod]: true }),
      ).toBe(true)
    }
    expect(page).toHaveBeenCalledTimes(4)
    expect(at()).toBe('2 / 3')
    // Space on a focused control presses it: not a step.
    expect(fireEvent.keyDown(control('Exit fullscreen'), { key: ' ' })).toBe(
      true,
    )
    expect(at()).toBe('2 / 3')
    window.removeEventListener('keydown', page)
  })

  it('has an empty position line and no slides without spreads, and End stays put', () => {
    const onStep = vi.fn()
    render(<Harness count={0} onStep={onStep} />)
    expect(at()).toBe('')
    expect(screen.queryAllByTestId('lightbox-slide')).toHaveLength(0)
    fireEvent.keyDown(window, { key: 'End' })
    expect(onStep).not.toHaveBeenCalled()
  })

  it('scales each slide to its box by CSS zoom; an unlaid slide keeps the fit area', () => {
    render(<Harness />)
    expect(
      Number(screen.getByTestId('site-fullscreen-book').style.zoom),
    ).toBeCloseTo(1301.91 / 380, 4)
    cleanup()
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(0)
    render(<Harness />)
    const style = slides()[0]?.style
    expect([
      style?.left,
      style?.top,
      style?.width,
      style?.height,
    ]).toStrictEqual(['64px', '64px', '1312px', '788px'])
    expect(screen.getByTestId('site-fullscreen-book').style.zoom).toBe('1')
  })

  it('re-measures on resize and on a step, re-rendering only on a change', () => {
    const observers: { cb: () => void; observed: Element[] }[] = []
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observed: Element[] = []
        disconnect = disconnect
        constructor(cb: () => void) {
          observers.push({ cb, observed: this.observed })
        }
        observe(el: Element) {
          this.observed.push(el)
        }
      },
    )
    const renderSpread = vi.fn((i: number) => (
      <div data-testid={`spread-${String(i)}`} />
    ))
    render(<Harness renderSpread={renderSpread} />)
    expect(observers.at(-1)?.observed).toHaveLength(3)
    // React may render once more after a commit before it bails out eagerly.
    act(() => {
      observers.at(-1)?.cb()
    })
    const calls = renderSpread.mock.calls.length
    act(() => {
      observers.at(-1)?.cb()
    })
    expect(renderSpread.mock.calls.length).toBe(calls)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(760)
    act(() => {
      observers.at(-1)?.cb()
    })
    expect(
      Number(screen.getByTestId('site-fullscreen-book').style.zoom),
    ).toBeCloseTo(1312 / 760, 4)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(observers.at(-1)?.observed).toHaveLength(4)
  })

  it('animates only the active layer for a discrete change; will-change only while input runs', () => {
    vi.useFakeTimers()
    render(<Harness />)
    const neighbour = () =>
      slides()[1]?.firstElementChild as HTMLElement | null | undefined
    expect(layer().style.willChange).toBe('')
    expect(root().style.cursor).toBe('default')
    fireEvent.keyDown(window, { key: '+' })
    expect(layer().className).toContain('transition-transform')
    expect(neighbour()?.className).not.toContain('transition-transform')
    expect(layer().style.willChange).toBe('transform')
    act(() => {
      vi.advanceTimersByTime(349)
    })
    expect(layer().className).toContain('transition-transform')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(layer().className).not.toContain('transition-transform')
    expect(layer().style.willChange).toBe('')
    wheel({ deltaY: -10, ctrlKey: true, clientX: 700, clientY: 400 })
    expect(layer().className).not.toContain('transition-transform')
    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(layer().style.willChange).toBe('transform')
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(layer().style.willChange).toBe('')
  })

  it('toggles the Zoom chip between 2× and 1× with its icon', () => {
    render(<Harness />)
    const chip = screen.getByTestId('site-fullscreen-zoom')
    const icon = () => chip.querySelector('svg')?.dataset.icon
    expect(icon()).toBe('zoomIn')
    fireEvent.click(chip)
    expect(zoom()).toBe('2.00')
    expect(icon()).toBe('zoomOut')
    expect(root().style.cursor).toBe('grab')
    fireEvent.click(chip)
    expect(zoom()).toBe('1.00')
    expect(icon()).toBe('zoomIn')
  })

  it('pinches about the midpoint, from a tiny start too', () => {
    const capture = vi.spyOn(HTMLElement.prototype, 'setPointerCapture')
    render(<Harness />)
    const touch = (
      type: 'pointerDown' | 'pointerMove' | 'pointerUp',
      pointerId: number,
      x: number,
    ) => {
      fireEvent[type](root(), {
        pointerId,
        pointerType: 'touch',
        clientX: x,
        clientY: 450,
      })
    }
    touch('pointerDown', 1, 600)
    touch('pointerDown', 2, 800)
    expect(capture).toHaveBeenLastCalledWith(2)
    touch('pointerMove', 2, 1000)
    // 2× about (700, 450), then the midpoint moved 100 right.
    expect(transform().x).toBeCloseTo(-(700 - 69.04) + 100, 1)
    expect(transform().y).toBeCloseTo(-(450 - 64), 5)
    expect(root().style.cursor).toBe('grab')
    touch('pointerUp', 1, 600)
    touch('pointerUp', 2, 1000)
    fireEvent.keyDown(window, { key: '0' })
    touch('pointerDown', 3, 700)
    touch('pointerDown', 4, 700.5)
    touch('pointerMove', 4, 702)
    expect(zoom()).toBe('2.00')
  })

  it('drops the arrows when the pointer stops hovering, and stops listening on close', () => {
    let matches = true
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query === '(hover: hover) and (pointer: fine)' && matches
      },
      addEventListener: (_type: string, f: () => void) => listeners.add(f),
      removeEventListener: (_type: string, f: () => void) =>
        listeners.delete(f),
    }))
    const { unmount } = render(<Harness />)
    expect(document.querySelector('[aria-label="Next spread"]')).not.toBeNull()
    matches = false
    act(() => {
      for (const f of listeners) f()
    })
    expect(document.querySelector('[aria-label="Next spread"]')).toBeNull()
    // Height-bound: 8 px sides centre the spread where 64 px ones did.
    expect(Number.parseFloat(slides()[0]?.style.left ?? '')).toBeCloseTo(
      8 + (1424 - 788 * (380 / 230)) / 2,
      2,
    )
    unmount()
    expect(listeners.size).toBe(0)
  })

  it('reports no settled zoom before the slide is measured', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(0)
    const onZoomSettle = vi.fn()
    render(<Harness onZoomSettle={onZoomSettle} />)
    expect(onZoomSettle).not.toHaveBeenCalled()
  })

  it('pans with a pixel wheel 1:1', () => {
    render(<Harness />)
    fireEvent.click(screen.getByTestId('site-fullscreen-zoom'))
    const before = transform()
    // Prevented: neither the page scrolls nor Ctrl + wheel zooms it.
    expect(wheel({ deltaX: 3, deltaY: 4 })).toBe(true)
    expect(transform().x).toBeCloseTo(before.x - 3, 5)
    expect(transform().y).toBeCloseTo(before.y - 4, 5)
  })

  it('double-taps within 300 ms and 16 px only', () => {
    render(<Harness />)
    tapAt(700, 1000)
    tapAt(700, 1301)
    expect(zoom()).toBe('1.00')
    tapAt(700, 1601)
    expect(zoom()).toBe('2.00')
    tapAt(700, 5000)
    tapAt(716, 5100)
    expect(zoom()).toBe('1.00')
    tapAt(700, 9000)
    tapAt(717, 9100)
    expect(zoom()).toBe('1.00')
    // A 17 px move is no tap: the next tap starts afresh.
    tapAt(700, 12000, 717)
    tapAt(717, 12100)
    expect(zoom()).toBe('1.00')
    // After a touch, a dblclick event is the tap's, not a mouse's.
    fireEvent.dblClick(root(), { clientX: 700, clientY: 450 })
    expect(zoom()).toBe('1.00')
  })
})

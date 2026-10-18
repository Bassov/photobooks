import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchBookOp, resetBookStore } from './bookStore'
import { commitZoom, resetCameraStore } from './cameraStore'
import { Pasteboard } from './Pasteboard'
import { PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME } from './pasteboardWindow'

interface PaceTimeout {
  id: number
  ms: number
  cb: () => void
}

interface PaceFrameHooks {
  rafQueue: FrameRequestCallback[]
  timeouts: PaceTimeout[]
  cancelAnimationFrame: ReturnType<typeof vi.fn>
  clearTimeout: ReturnType<typeof vi.fn>
  cancelledRafIds: Set<number>
  cancelledTimeoutIds: Set<number>
}

function stubPaceFrameHooks(): PaceFrameHooks {
  const rafQueue: FrameRequestCallback[] = []
  const timeouts: PaceTimeout[] = []
  const cancelledRafIds = new Set<number>()
  const cancelledTimeoutIds = new Set<number>()
  let nextRafId = 1
  let nextTimeoutId = 1
  const cancelAnimationFrame = vi.fn((id: number) => {
    cancelledRafIds.add(id)
  })
  const clearTimeoutFn = vi.fn((id: number) => {
    cancelledTimeoutIds.add(id)
  })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextRafId
    nextRafId += 1
    rafQueue.push(cb)
    Object.defineProperty(cb, 'rafId', { value: id, configurable: true })
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
  vi.stubGlobal('setTimeout', (cb: TimerHandler, ms?: number): number => {
    const id = nextTimeoutId
    nextTimeoutId += 1
    if (typeof cb === 'function') {
      const delay = typeof ms === 'number' ? ms : 0
      timeouts.push({
        id,
        ms: delay,
        cb: () => {
          cb()
        },
      })
    }
    return id
  })
  vi.stubGlobal('clearTimeout', clearTimeoutFn)
  return {
    rafQueue,
    timeouts,
    cancelAnimationFrame,
    clearTimeout: clearTimeoutFn,
    cancelledRafIds,
    cancelledTimeoutIds,
  }
}

function stubViewport(width: number, height: number): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly cb: ResizeObserverCallback) {}
      observe(target: Element): void {
        Object.defineProperty(target, 'clientWidth', {
          configurable: true,
          value: width,
        })
        Object.defineProperty(target, 'clientHeight', {
          configurable: true,
          value: height,
        })
        this.cb([], this)
      }
      disconnect(): void {
        /* no-op */
      }
      unobserve(): void {
        /* no-op */
      }
    },
  )
}

function dropInitialPaceCallbacks(hooks: PaceFrameHooks): void {
  hooks.rafQueue.length = 0
  hooks.timeouts.length = 0
  hooks.cancelledRafIds.clear()
  hooks.cancelledTimeoutIds.clear()
}

describe('Pasteboard view wiring', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('coalesces scroll updates onto one animation frame', () => {
    const hooks = stubPaceFrameHooks()
    resetBookStore()
    for (let i = 0; i < 6; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    commitZoom(1, 0, 0)
    stubViewport(500, 200)
    render(<Pasteboard />)
    dropInitialPaceCallbacks(hooks)
    const scroll = screen.getByTestId('pasteboard-scroll')
    let scrollTopValue = 0
    Object.defineProperty(scroll, 'scrollTop', {
      configurable: true,
      get() {
        return scrollTopValue
      },
      set(value: number) {
        scrollTopValue = value
      },
    })

    scroll.scrollTop = 800
    fireEvent.scroll(scroll)
    scroll.scrollTop = 900
    fireEvent.scroll(scroll)

    expect(hooks.rafQueue).toHaveLength(1)
    expect(screen.queryByTestId('pasteboard-lead')).toBeNull()
    act(() => {
      hooks.rafQueue[0]?.(0)
    })
    // rAF body must apply tracked scroll so the virtual window grows a lead.
    expect(
      Number.parseFloat(screen.getByTestId('pasteboard-lead').style.height),
    ).toBeGreaterThan(0)
  })

  it('renders lead and tail spacers when the window is mid-stack', () => {
    resetBookStore()
    // Many spreads + mid camera scroll so the virtual window has both spacers.
    for (let i = 0; i < 8; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    commitZoom(1, 0, 1200)
    stubViewport(500, 240)
    render(<Pasteboard />)
    expect(
      Number.parseFloat(screen.getByTestId('pasteboard-lead').style.height),
    ).toBeGreaterThan(0)
    expect(
      Number.parseFloat(screen.getByTestId('pasteboard-tail').style.height),
    ).toBeGreaterThan(0)
  })

  it('ignores IntersectionObserver entries that are not slot elements', () => {
    resetBookStore()
    const callbacks: IntersectionObserverCallback[] = []
    const disconnect = vi.fn()
    class FakeIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        callbacks.push(cb)
      }
      observe(): void {
        /* no-op */
      }
      unobserve(): void {
        /* no-op */
      }
      disconnect = disconnect
      takeRecords(): IntersectionObserverEntry[] {
        return []
      }
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    const view = render(<Pasteboard />)
    expect(callbacks.length).toBeGreaterThan(0)
    act(() => {
      callbacks[0]?.(
        [
          {
            target: document.createTextNode('x'),
            intersectionRatio: 1,
          } as unknown as IntersectionObserverEntry,
          {
            target: document.createElement('div'),
            intersectionRatio: 1,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      )
    })
    const active = screen
      .getAllByTestId('pasteboard-slot')
      .find((slot) => slot.getAttribute('data-active') === 'true')
    expect(active).toBeTruthy()
    view.unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('skips ResizeObserver setup when the API is missing', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    resetBookStore()
    expect(() => {
      render(<Pasteboard />)
    }).not.toThrow()
  })

  it('skips IntersectionObserver setup when the API is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    resetBookStore()
    expect(() => {
      render(<Pasteboard />)
    }).not.toThrow()
  })

  it('omits lead/tail at the stack start and sets slot chrome attrs', () => {
    resetBookStore()
    commitZoom(1, 0, 0)
    stubViewport(800, 600)
    const hooks = stubPaceFrameHooks()
    render(<Pasteboard />)
    let guarded = 0
    while (hooks.rafQueue.length > 0 && guarded < 20) {
      act(() => {
        const cb = hooks.rafQueue.shift()
        cb?.(0)
      })
      guarded += 1
    }
    expect(screen.queryByTestId('pasteboard-lead')).toBeNull()
    expect(screen.queryByTestId('pasteboard-tail')).toBeNull()
    const world = screen.getByTestId('pasteboard-world')
    expect(world.style.width).not.toBe('')
    const slots = screen.getAllByTestId('pasteboard-slot')
    expect(slots[0]?.getAttribute('data-active')).toBe('true')
    expect(slots[0]?.style.containIntrinsicBlockSize).toMatch(/^auto /)
    const inactive = slots.filter(
      (slot) => slot.getAttribute('data-active') === 'false',
    )
    expect(inactive.length).toBeGreaterThan(0)
    for (const slot of inactive) {
      expect(slot.getAttribute('data-active')).toBe('false')
    }
  })

  it('paces newly mounted slots across frames when zoom-out grows the window', () => {
    const hooks = stubPaceFrameHooks()
    resetBookStore()
    for (let i = 0; i < 20; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    commitZoom(4, 0, 0)
    stubViewport(500, 400)
    render(<Pasteboard />)
    const slotsAtZoom = screen.getAllByTestId('pasteboard-slot').length
    expect(slotsAtZoom).toBeGreaterThan(0)

    act(() => {
      commitZoom(0.25, 0, 0)
    })
    let slots = screen.getAllByTestId('pasteboard-slot').length
    expect(slots).toBeGreaterThanOrEqual(slotsAtZoom)
    expect(slots).toBeLessThanOrEqual(
      slotsAtZoom + PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
    )
    expect(slots).toBeLessThan(23)
    expect(hooks.rafQueue.length).toBeGreaterThan(0)

    const beforeFrame = slots
    act(() => {
      const cb = hooks.rafQueue.shift()
      cb?.(0)
    })
    slots = screen.getAllByTestId('pasteboard-slot').length
    expect(slots).toBeGreaterThan(beforeFrame)
    expect(slots).toBeLessThanOrEqual(
      beforeFrame + PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
    )
  })

  it('runs only one pace step when the watchdog fires before a stale rAF', () => {
    const hooks = stubPaceFrameHooks()
    resetBookStore()
    for (let i = 0; i < 20; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    commitZoom(4, 0, 0)
    stubViewport(500, 400)
    render(<Pasteboard />)
    dropInitialPaceCallbacks(hooks)

    act(() => {
      commitZoom(0.25, 0, 0)
    })
    const afterCommit = screen.getAllByTestId('pasteboard-slot').length
    expect(hooks.rafQueue.length).toBe(1)
    expect(hooks.timeouts.some((entry) => entry.ms === 32)).toBe(true)

    const staleRaf = hooks.rafQueue[0]
    expect(staleRaf).toBeTruthy()
    const staleRafId = (staleRaf as FrameRequestCallback & { rafId?: number })
      .rafId
    expect(typeof staleRafId).toBe('number')
    const watchdog = hooks.timeouts.find(
      (entry) => entry.ms === 32 && !hooks.cancelledTimeoutIds.has(entry.id),
    )
    expect(watchdog).toBeTruthy()

    act(() => {
      watchdog?.cb()
    })
    const afterWatchdog = screen.getAllByTestId('pasteboard-slot').length
    expect(afterWatchdog).toBeGreaterThan(afterCommit)
    expect(afterWatchdog).toBeLessThanOrEqual(
      afterCommit + PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
    )
    if (typeof staleRafId !== 'number') {
      throw new Error('expected stale rAF id')
    }
    expect(hooks.cancelledRafIds.has(staleRafId)).toBe(true)
    expect(hooks.cancelAnimationFrame).toHaveBeenCalledWith(staleRafId)

    const pendingAfterWatchdog = hooks.rafQueue.length
    act(() => {
      staleRaf?.(0)
    })
    expect(screen.getAllByTestId('pasteboard-slot').length).toBe(afterWatchdog)
    expect(hooks.rafQueue.length).toBe(pendingAfterWatchdog)
  })

  it('clears add-spread force-mount so later pace steps stay capped', () => {
    const hooks = stubPaceFrameHooks()
    resetBookStore()
    for (let i = 0; i < 12; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    commitZoom(4, 0, 0)
    stubViewport(500, 400)
    render(<Pasteboard />)
    dropInitialPaceCallbacks(hooks)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
    })
    const afterAdd = screen.getAllByTestId('pasteboard-slot').length
    expect(afterAdd).toBeGreaterThan(0)

    act(() => {
      commitZoom(0.2, 0, 0)
    })
    const afterZoomOut = screen.getAllByTestId('pasteboard-slot').length
    expect(afterZoomOut).toBeLessThanOrEqual(
      afterAdd + PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
    )

    if (hooks.rafQueue.length > 0) {
      const beforeStep = afterZoomOut
      act(() => {
        const cb = hooks.rafQueue.shift()
        cb?.(0)
      })
      const afterStep = screen.getAllByTestId('pasteboard-slot').length
      expect(afterStep).toBeLessThanOrEqual(
        beforeStep + PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME,
      )
    }
  })

  it('cancels pending pace rAF and watchdog on unmount', () => {
    const hooks = stubPaceFrameHooks()
    resetBookStore()
    for (let i = 0; i < 20; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    commitZoom(4, 0, 0)
    stubViewport(500, 400)
    const view = render(<Pasteboard />)
    dropInitialPaceCallbacks(hooks)

    act(() => {
      commitZoom(0.25, 0, 0)
    })
    expect(hooks.rafQueue.length).toBeGreaterThan(0)
    const pendingRafId = (
      hooks.rafQueue[0] as FrameRequestCallback & { rafId?: number }
    ).rafId
    const pendingWatchdog = hooks.timeouts.find((entry) => entry.ms === 32)
    expect(pendingRafId).toBeTypeOf('number')
    expect(pendingWatchdog).toBeTruthy()

    view.unmount()
    expect(hooks.cancelAnimationFrame).toHaveBeenCalledWith(pendingRafId)
    expect(hooks.clearTimeout).toHaveBeenCalledWith(pendingWatchdog?.id)
  })

  it('cancels a pending scroll frame on unmount', () => {
    const hooks = stubPaceFrameHooks()
    resetBookStore()
    const view = render(<Pasteboard />)
    dropInitialPaceCallbacks(hooks)
    const scroll = screen.getByTestId('pasteboard-scroll')
    fireEvent.scroll(scroll, { target: { scrollTop: 50 } })
    expect(hooks.rafQueue).toHaveLength(1)
    const scrollRafId = (
      hooks.rafQueue[0] as FrameRequestCallback & { rafId?: number }
    ).rafId
    view.unmount()
    expect(hooks.cancelAnimationFrame).toHaveBeenCalledWith(scrollRafId)
  })
})

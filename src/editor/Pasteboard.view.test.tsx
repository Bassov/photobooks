import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchBookOp, resetBookStore } from './bookStore'
import { commitZoom, resetCameraStore } from './cameraStore'
import { Pasteboard } from './Pasteboard'

describe('Pasteboard view wiring', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('coalesces scroll updates onto one animation frame', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    resetBookStore()
    for (let i = 0; i < 6; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    commitZoom(1, 0, 0)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly cb: ResizeObserverCallback) {}
        observe(target: Element): void {
          Object.defineProperty(target, 'clientWidth', {
            configurable: true,
            value: 500,
          })
          Object.defineProperty(target, 'clientHeight', {
            configurable: true,
            value: 200,
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
    render(<Pasteboard />)
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

    expect(rafQueue).toHaveLength(1)
    expect(screen.queryByTestId('pasteboard-lead')).toBeNull()
    act(() => {
      rafQueue[0]?.(0)
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
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly cb: ResizeObserverCallback) {}
        observe(target: Element): void {
          Object.defineProperty(target, 'clientWidth', {
            configurable: true,
            value: 500,
          })
          Object.defineProperty(target, 'clientHeight', {
            configurable: true,
            value: 240,
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
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly cb: ResizeObserverCallback) {}
        observe(target: Element): void {
          Object.defineProperty(target, 'clientWidth', {
            configurable: true,
            value: 800,
          })
          Object.defineProperty(target, 'clientHeight', {
            configurable: true,
            value: 600,
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
    render(<Pasteboard />)
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

  it('cancels a pending scroll frame on unmount', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return 42
    })
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame')
    resetBookStore()
    const view = render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    fireEvent.scroll(scroll, { target: { scrollTop: 50 } })
    expect(rafQueue).toHaveLength(1)
    view.unmount()
    expect(cancel).toHaveBeenCalledWith(42)
  })
})

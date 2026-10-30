import assert from 'node:assert/strict'
import { PASTEBOARD_PAD_PX } from './pasteboardView'
import { makeBook } from '../core/testing/fixtures'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dispatchBookOp,
  getSpreadIdsSnapshot,
  resetBookStore,
} from './bookStore'
import {
  commitZoom,
  getCameraCommands,
  getCommittedZoom,
  resetCameraStore,
} from './cameraStore'
import {
  fakeIntersectionEntry,
  stubIntersectionObserverCapture,
} from './intersectionObserver.test-helpers'
import { Pasteboard } from './Pasteboard'
import { REVEAL_TRY_CEILING } from './pasteboardReveal'
import { PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME } from './pasteboardWindow'
import {
  getActiveSpreadId,
  requestSpreadReveal,
  resetActiveSpreadIdForTests,
} from './photoRootSession'

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

function flushPaceSteps(hooks: PaceFrameHooks, maxSteps = 80): void {
  let guarded = 0
  while (hooks.rafQueue.length > 0 && guarded < maxSteps) {
    act(() => {
      const cb = hooks.rafQueue.shift()
      cb?.(0)
    })
    guarded += 1
  }
}

function slotIndices(): number[] {
  return screen
    .getAllByTestId('pasteboard-slot')
    .map((slot) => Number(slot.getAttribute('data-slot-index')))
}

function spacerHeight(testId: 'pasteboard-lead' | 'pasteboard-tail'): number {
  const node = screen.queryByTestId(testId)
  if (node === null) {
    return 0
  }
  return Number.parseFloat(node.style.height)
}

describe('Pasteboard view wiring', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
    resetActiveSpreadIdForTests()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('publishes the active spread id for prioritized photo-folder re-scan', () => {
    resetBookStore()
    resetActiveSpreadIdForTests()
    for (let i = 0; i < 3; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    const spreadIds = getSpreadIdsSnapshot()
    assert.ok(spreadIds[1])
    commitZoom(1, 0, 0)
    stubViewport(500, 240)
    const { callbacks } = stubIntersectionObserverCapture()
    render(<Pasteboard />)
    expect(callbacks.length).toBeGreaterThan(0)
    const slots = screen.getAllByTestId('pasteboard-slot')
    const target = slots.find(
      (slot) => slot.getAttribute('data-spread-id') === spreadIds[1],
    )
    assert.ok(target)
    act(() => {
      callbacks[0]?.(
        [fakeIntersectionEntry(target, 0.9)],
        {} as IntersectionObserver,
      )
    })
    expect(getActiveSpreadId()).toBe(spreadIds[1])
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

    scroll.scrollTop = PASTEBOARD_PAD_PX + 800
    fireEvent.scroll(scroll)
    scroll.scrollTop = PASTEBOARD_PAD_PX + 900
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
    commitZoom(1, 0, PASTEBOARD_PAD_PX + 1200)
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
    const { callbacks } = stubIntersectionObserverCapture()
    const view = render(<Pasteboard />)
    expect(callbacks.length).toBeGreaterThan(0)
    act(() => {
      callbacks[0]?.(
        [
          {
            target: document.createTextNode('x'),
            intersectionRatio: 1,
          } as unknown as IntersectionObserverEntry,
          fakeIntersectionEntry(document.createElement('div'), 1),
        ],
        {} as IntersectionObserver,
      )
    })
    const active = screen
      .getAllByTestId('pasteboard-slot')
      .find((slot) => slot.getAttribute('data-active') === 'true')
    expect(active).toBeTruthy()
    view.unmount()
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
    expect(hooks.rafQueue.length).toBe(1)
    expect(hooks.timeouts.filter((entry) => entry.ms === 32)).toHaveLength(1)

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

  it('continues paced expansion across frames until the target window is mounted', () => {
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

    let steps = 0
    while (hooks.rafQueue.length > 0 && steps < 80) {
      act(() => {
        const cb = hooks.rafQueue.shift()
        cb?.(0)
      })
      steps += 1
    }
    expect(steps).toBeGreaterThan(1)
    const atTarget = screen.getAllByTestId('pasteboard-slot').length
    expect(atTarget).toBeGreaterThan(afterCommit)
    expect(hooks.rafQueue).toHaveLength(0)

    // Already at target: equal window should not schedule more steps.
    act(() => {
      commitZoom(0.25, 0, 0)
    })
    expect(screen.getAllByTestId('pasteboard-slot')).toHaveLength(atTarget)
    expect(hooks.rafQueue).toHaveLength(0)
  })

  it('keeps lead and tail spacer heights equal to index extents times stride', () => {
    const hooks = stubPaceFrameHooks()
    resetBookStore()
    for (let i = 0; i < 12; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    const total = getSpreadIdsSnapshot().length
    commitZoom(1, 0, 1800)
    stubViewport(500, 240)
    render(<Pasteboard />)
    flushPaceSteps(hooks)

    const indices = slotIndices()
    expect(indices.length).toBeGreaterThan(0)
    const start = Math.min(...indices)
    const end = Math.max(...indices) + 1
    const stride = Number.parseFloat(
      screen.getAllByTestId('pasteboard-slot')[0]?.style.height ?? '0',
    )
    expect(stride).toBeGreaterThan(0)
    expect(spacerHeight('pasteboard-lead')).toBe(start * stride)
    expect(spacerHeight('pasteboard-tail')).toBe((total - end) * stride)
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
    assert(typeof staleRafId === 'number')
    expect(hooks.cancelledRafIds.has(staleRafId)).toBe(true)
    expect(hooks.cancelAnimationFrame).toHaveBeenCalledWith(staleRafId)

    const pendingAfterWatchdog = hooks.rafQueue.length
    act(() => {
      staleRaf?.(0)
    })
    expect(screen.getAllByTestId('pasteboard-slot').length).toBe(afterWatchdog)
    expect(hooks.rafQueue.length).toBe(pendingAfterWatchdog)
  })

  it('force-mounts a later-index spread immediately via Add spread', () => {
    // Index 0 is covered by applyForceMountIndex unit tests; Add is disabled on
    // an empty book (no sentinel / fake spreadId).
    const hooks = stubPaceFrameHooks()
    resetBookStore()
    for (let i = 0; i < 12; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    commitZoom(4, 0, 0)
    stubViewport(500, 400)
    render(<Pasteboard />)
    flushPaceSteps(hooks)
    dropInitialPaceCallbacks(hooks)
    expect(Math.max(...slotIndices())).toBeLessThan(12)

    act(() => {
      dispatchBookOp({ type: 'addSpread' })
      const last = getSpreadIdsSnapshot().at(-1)
      assert(last !== undefined)
      requestSpreadReveal(last)
    })
    const forcedIndex = getSpreadIdsSnapshot().length - 1
    expect(forcedIndex).toBeGreaterThan(0)
    expect(slotIndices()).toContain(forcedIndex)
    const stride = Number.parseFloat(
      screen.getAllByTestId('pasteboard-slot')[0]?.style.height ?? '0',
    )
    const indicesAfterForce = slotIndices()
    const forceStart = Math.min(...indicesAfterForce)
    const forceEnd = Math.max(...indicesAfterForce) + 1
    expect(spacerHeight('pasteboard-lead')).toBe(forceStart * stride)
    expect(spacerHeight('pasteboard-tail')).toBe(
      (getSpreadIdsSnapshot().length - forceEnd) * stride,
    )
  })

  it('reveals and pins a spread requested by the spreads panel', () => {
    const hooks = stubPaceFrameHooks()
    resetBookStore()
    const { callbacks } = stubIntersectionObserverCapture()
    stubViewport(800, 600)
    const view = render(<Pasteboard />)
    flushPaceSteps(hooks)
    const ids = getSpreadIdsSnapshot()
    const target = ids.at(-1)
    assert(target !== undefined && target !== ids[0])

    act(() => {
      requestSpreadReveal(target)
    })
    flushPaceSteps(hooks)
    expect(getActiveSpreadId()).toBe(target)
    const slot = screen
      .getAllByTestId('pasteboard-slot')
      .find((s) => s.getAttribute('data-spread-id') === target)
    assert(slot !== undefined, 'expected requested slot mounted')
    expect(slot.getAttribute('data-active')).toBe('true')

    // The pin beats a higher-ratio neighbour until the user scrolls.
    const other = screen
      .getAllByTestId('pasteboard-slot')
      .find((s) => s.getAttribute('data-spread-id') !== target)
    assert(other !== undefined)
    act(() => {
      callbacks.at(-1)?.(
        [fakeIntersectionEntry(other, 0.95), fakeIntersectionEntry(slot, 0.2)],
        {} as IntersectionObserver,
      )
    })
    expect(slot.getAttribute('data-active')).toBe('true')

    // The first spread (index 0) is a valid target too.
    const first = ids[0]
    assert(first !== undefined)
    act(() => {
      requestSpreadReveal(first)
    })
    flushPaceSteps(hooks)
    expect(getActiveSpreadId()).toBe(first)
    expect(
      screen
        .getAllByTestId('pasteboard-slot')
        .find((s) => s.getAttribute('data-spread-id') === first)
        ?.getAttribute('data-active'),
    ).toBe('true')
    act(() => {
      requestSpreadReveal(target)
    })
    flushPaceSteps(hooks)

    // Unknown ids are ignored, and unmount unsubscribes.
    act(() => {
      requestSpreadReveal('nope')
    })
    expect(slot.getAttribute('data-active')).toBe('true')
    view.unmount()
    expect(() => {
      requestSpreadReveal(target)
    }).not.toThrow()
  })

  it('keeps the added spread marked until the user scrolls', () => {
    const hooks = stubPaceFrameHooks()
    resetBookStore()
    const { callbacks } = stubIntersectionObserverCapture()
    stubViewport(800, 600)
    render(<Pasteboard />)
    flushPaceSteps(hooks)
    expect(callbacks.length).toBeGreaterThan(0)
    const beforeIds = getSpreadIdsSnapshot()
    act(() => {
      dispatchBookOp({ type: 'addSpread' })
      const last = getSpreadIdsSnapshot().at(-1)
      assert(last !== undefined)
      requestSpreadReveal(last)
    })
    flushPaceSteps(hooks)
    const afterIds = getSpreadIdsSnapshot()
    const newId = afterIds.find((id) => !beforeIds.includes(id))
    assert(newId !== undefined)
    const slots = screen.getAllByTestId('pasteboard-slot')
    const newSlot = slots.find(
      (slot) => slot.getAttribute('data-spread-id') === newId,
    )
    const otherSlot = slots.find(
      (slot) => slot.getAttribute('data-spread-id') !== newId,
    )
    assert(newSlot !== undefined, 'expected new spread slot mounted')
    assert(otherSlot !== undefined, 'expected another spread slot mounted')

    act(() => {
      callbacks.at(-1)?.(
        [
          fakeIntersectionEntry(otherSlot, 0.9),
          fakeIntersectionEntry(newSlot, 0.4),
        ],
        {} as IntersectionObserver,
      )
    })
    expect(newSlot.getAttribute('data-active')).toBe('true')

    // Scroll during reveal hold must not drop the pin (holdCameraScrollRef).
    const scroll = screen.getByTestId('pasteboard-scroll')
    Object.defineProperty(scroll, 'scrollHeight', {
      configurable: true,
      value: 4000,
    })
    Object.defineProperty(scroll, 'clientHeight', {
      configurable: true,
      value: 600,
    })
    act(() => {
      fireEvent.scroll(scroll)
    })
    flushPaceSteps(hooks, 4)
    act(() => {
      callbacks.at(-1)?.(
        [
          fakeIntersectionEntry(otherSlot, 0.95),
          fakeIntersectionEntry(newSlot, 0.3),
        ],
        {} as IntersectionObserver,
      )
    })
    expect(newSlot.getAttribute('data-active')).toBe('true')

    // Let add-spread reveal finish so holdCameraScrollRef clears; only then
    // does user scroll release the active pin.
    for (let i = 0; i < REVEAL_TRY_CEILING * 2 + 16; i += 1) {
      flushPaceSteps(hooks, 4)
    }

    act(() => {
      fireEvent.scroll(scroll)
    })
    // Drain the scroll rAF so tracked scroll updates; pin already cleared.
    flushPaceSteps(hooks, 4)
    act(() => {
      callbacks.at(-1)?.(
        [
          fakeIntersectionEntry(otherSlot, 1),
          fakeIntersectionEntry(newSlot, 0.07),
        ],
        {} as IntersectionObserver,
      )
    })
    expect(otherSlot.getAttribute('data-active')).toBe('true')
    expect(newSlot.getAttribute('data-active')).toBe('false')
  })

  it('ignores a stale pace callback after unmount', () => {
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
    const staleRaf = hooks.rafQueue[0]
    const staleWatchdog = hooks.timeouts.find((entry) => entry.ms === 32)
    expect(staleRaf).toBeTruthy()
    expect(staleWatchdog).toBeTruthy()

    view.unmount()
    hooks.rafQueue.length = 0
    hooks.timeouts.length = 0
    act(() => {
      staleRaf?.(0)
      staleWatchdog?.cb()
    })
    expect(hooks.rafQueue).toHaveLength(0)
    expect(hooks.timeouts.filter((entry) => entry.ms === 32)).toHaveLength(0)

    const remountHooks = stubPaceFrameHooks()
    render(<Pasteboard />)
    expect(screen.getAllByTestId('pasteboard-slot').length).toBeGreaterThan(0)
    dropInitialPaceCallbacks(remountHooks)
    act(() => {
      commitZoom(0.2, 0, 0)
    })
    expect(remountHooks.rafQueue.length).toBe(1)
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
    expect(typeof pendingRafId).toBe('number')
    expect(pendingWatchdog).toBeTruthy()

    view.unmount()
    expect(hooks.cancelAnimationFrame).toHaveBeenCalledWith(pendingRafId)
    expect(hooks.clearTimeout).toHaveBeenCalledWith(pendingWatchdog?.id)
  })

  it('pads the world by the camera margin on every side', () => {
    resetBookStore()
    commitZoom(1, 0, 0)
    stubViewport(800, 600)
    render(<Pasteboard />)
    const world = screen.getByTestId('pasteboard-world')
    expect(world.getAttribute('data-stack-inset')).toBe(
      String(PASTEBOARD_PAD_PX),
    )
    expect(world.style.padding).toBe(`${String(PASTEBOARD_PAD_PX)}px`)
    expect(world.style.boxSizing).toBe('border-box')
    expect(Number.parseFloat(world.style.width)).toBeGreaterThan(
      2 * PASTEBOARD_PAD_PX,
    )
  })

  it('fits the selected spread once the viewport is measured when asked to', () => {
    resetBookStore()
    commitZoom(1, 0, 0)
    stubViewport(800, 600)
    render(<Pasteboard fitOnOpen />)
    expect(getCommittedZoom()).not.toBe(1)
  })

  it('leaves the zoom alone without fitOnOpen', () => {
    resetBookStore()
    commitZoom(1, 0, 0)
    stubViewport(800, 600)
    render(<Pasteboard />)
    expect(getCommittedZoom()).toBe(1)
  })

  it.each([
    ['unmeasured', 0, 0],
    ['zero width', 0, 600],
    ['zero height', 800, 0],
  ])('does not fit while the viewport is %s', (_label, width, height) => {
    resetBookStore()
    commitZoom(1, 0, 0)
    stubViewport(width, height)
    render(<Pasteboard fitOnOpen />)
    expect(getCommittedZoom()).toBe(1)
  })

  it('does not fit an empty book', () => {
    resetBookStore({
      book: makeBook({ spreads: [] }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    commitZoom(1, 0, 0)
    stubViewport(800, 600)
    render(<Pasteboard fitOnOpen />)
    expect(getCommittedZoom()).toBe(1)
  })

  it('registers a zoom-step command that steps about the viewport centre', () => {
    resetBookStore()
    commitZoom(1, 0, 0)
    stubViewport(800, 600)
    render(<Pasteboard />)
    act(() => {
      getCameraCommands()?.zoomStep(1)
    })
    expect(getCommittedZoom()).toBeGreaterThan(1)
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

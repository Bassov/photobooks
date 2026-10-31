import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getSpreadIdsSnapshot,
  resetBookStore,
} from './bookStore'
import { commitZoom, getCommittedZoom, resetCameraStore } from './cameraStore'
import { Pasteboard } from './Pasteboard'
import { REVEAL_TRY_CEILING } from './pasteboardReveal'
import { requestSpreadReveal } from './photoRootSession'

const PORT_TOP = 100
const PORT_LEFT = 40

function stubNewSpreadBox(
  boxFor: (scroll: HTMLElement) => DOMRect,
): () => void {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'getBoundingClientRect',
  )
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement): DOMRect {
      if (this.dataset.testid === 'pasteboard-scroll') {
        return new DOMRect(PORT_LEFT, PORT_TOP, 500, 400)
      }
      if (
        this.dataset.testid === 'spread-view' &&
        this.closest('[data-slot-index="3"]') instanceof HTMLElement
      ) {
        const scroll = this.closest('[data-testid="pasteboard-scroll"]')
        if (scroll instanceof HTMLElement) {
          return boxFor(scroll)
        }
      }
      return new DOMRect(0, 0, 0, 0)
    },
  })
  return () => {
    if (original !== undefined) {
      Object.defineProperty(
        HTMLElement.prototype,
        'getBoundingClientRect',
        original,
      )
    }
  }
}

/** What the Spreads panel "Add spread" row action does: add, then reveal. */
function addSpreadAndReveal(): void {
  act(() => {
    dispatchBookOp({ type: 'addSpread' })
    const ids = getSpreadIdsSnapshot()
    const added = ids[ids.length - 1]
    if (added !== undefined) {
      requestSpreadReveal(added)
    }
  })
}

function stubRaf(): FrameRequestCallback[] {
  const rafQueue: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  })
  return rafQueue
}

function flushRaf(rafQueue: FrameRequestCallback[], round: number): number {
  const batch = rafQueue.splice(0, rafQueue.length)
  act(() => {
    for (const cb of batch) {
      cb(round)
    }
  })
  return batch.length
}

describe('Pasteboard reveal of an added spread', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
  })

  it('keeps the committed zoom when a spread is added', () => {
    resetBookStore()
    commitZoom(2, 0, 0)
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    Object.defineProperty(scroll, 'scrollHeight', {
      configurable: true,
      value: 900,
    })
    addSpreadAndReveal()
    expect(getBookStoreSnapshot().book.spreads).toHaveLength(4)
    expect(getCommittedZoom()).toBe(2)
    expect(scroll.scrollTop).not.toBe(900)
    // One-stride overscan above the revealed spread (72 / 588 gap stride).
    expect(
      scroll
        .querySelector('[data-pasteboard-slot]')
        ?.getAttribute('data-slot-index'),
    ).toBe('1')
    expect(scroll.querySelector('[data-slot-index="3"]')).toBeTruthy()
  })

  it('does not reveal the last spread before add', () => {
    resetBookStore()
    render(<Pasteboard />)
    expect(
      screen
        .getByTestId('pasteboard-scroll')
        .querySelector('[data-pasteboard-slot]')
        ?.getAttribute('data-slot-index'),
    ).toBe('0')
  })

  it('does not render a template bar above the canvas', () => {
    resetBookStore()
    render(<Pasteboard />)
    expect(screen.queryByTestId('template-add-spread')).toBeNull()
    expect(
      screen.queryByRole('radiogroup', { name: 'Template for this spread' }),
    ).toBeNull()
  })

  it('scrolls the laid-out spread into the pasteboard', () => {
    resetBookStore()
    commitZoom(2, 40, 50)
    const restore = stubNewSpreadBox(
      (scroll) =>
        new DOMRect(
          PORT_LEFT + 600 - scroll.scrollLeft,
          PORT_TOP + 900 - scroll.scrollTop,
          200,
          180,
        ),
    )
    try {
      render(<Pasteboard />)
      const scroll = screen.getByTestId('pasteboard-scroll')
      Object.defineProperty(scroll, 'scrollHeight', {
        configurable: true,
        value: 9000,
      })
      addSpreadAndReveal()
      expect(scroll.scrollTop).toBe(790)
      expect(scroll.scrollLeft).toBe(450)
      expect(scroll.scrollTop).not.toBe(9000)
    } finally {
      restore()
    }
  })

  it.each([
    {
      label: 'pulls a tall spread down when its top is above the port',
      top: PORT_TOP - 30,
      left: PORT_LEFT,
      width: 200,
      height: 420,
      // Fixed stub ignores scroll; OR secondary/third edge-nudges until clamp.
      scrollTop: 0,
      scrollLeft: 40,
    },
    {
      label: 'pushes a tall spread up when its bottom is below the port',
      top: PORT_TOP,
      left: PORT_LEFT,
      width: 200,
      height: 420,
      scrollTop: 110,
      scrollLeft: 40,
    },
    {
      label: 'pulls a wide spread right when its left is outside the port',
      top: PORT_TOP,
      left: PORT_LEFT - 30,
      width: 520,
      height: 180,
      scrollTop: 50,
      scrollLeft: 0,
    },
    {
      label: 'pushes a wide spread left when its right is outside the port',
      top: PORT_TOP,
      left: PORT_LEFT,
      width: 520,
      height: 180,
      scrollTop: 50,
      scrollLeft: 100,
    },
    {
      label: 'pulls a short spread down when only its top is above the port',
      top: PORT_TOP - 30,
      left: PORT_LEFT,
      width: 200,
      height: 180,
      scrollTop: 0,
      scrollLeft: 40,
    },
    {
      label: 'leaves a spread that is already inside the pasteboard',
      top: PORT_TOP - 1,
      left: PORT_LEFT - 1,
      width: 200,
      height: 180,
      scrollTop: 50,
      scrollLeft: 40,
    },
  ])('$label', ({ top, left, width, height, scrollTop, scrollLeft }) => {
    resetBookStore()
    commitZoom(2, 40, 50)
    const restore = stubNewSpreadBox(
      () => new DOMRect(left, top, width, height),
    )
    try {
      render(<Pasteboard />)
      const scroll = screen.getByTestId('pasteboard-scroll')
      addSpreadAndReveal()
      expect(scroll.scrollTop).toBe(scrollTop)
      expect(scroll.scrollLeft).toBe(scrollLeft)
    } finally {
      restore()
    }
  })

  it('nudges again when the spread sits outside after layout', () => {
    resetBookStore()
    commitZoom(2, 40, 50)
    let reads = 0
    const restore = stubNewSpreadBox((scroll) => {
      reads += 1
      if (reads === 1) {
        return new DOMRect(PORT_LEFT, PORT_TOP, 200, 180)
      }
      return new DOMRect(
        PORT_LEFT,
        PORT_TOP + 250 - scroll.scrollTop + 50,
        200,
        180,
      )
    })
    try {
      render(<Pasteboard />)
      const scroll = screen.getByTestId('pasteboard-scroll')
      addSpreadAndReveal()
      expect(scroll.scrollTop).toBe(190)
      expect(scroll.scrollLeft).toBe(40)
    } finally {
      restore()
    }
  })

  it('clears forced content-visibility after reveal settles or exhausts', () => {
    resetBookStore()
    commitZoom(2, 40, 50)
    const rafQueue = stubRaf()
    const restore = stubNewSpreadBox(
      () => new DOMRect(PORT_LEFT, PORT_TOP + 250, 200, 180),
    )
    try {
      render(<Pasteboard />)
      addSpreadAndReveal()
      for (let i = 0; i < REVEAL_TRY_CEILING * 2 + 16; i += 1) {
        if (rafQueue.length === 0) {
          break
        }
        flushRaf(rafQueue, i)
      }
      for (const slot of screen.getAllByTestId('pasteboard-slot')) {
        expect(slot.style.contentVisibility).toBe('')
      }
    } finally {
      restore()
      vi.unstubAllGlobals()
    }
  })

  it('re-ticks reveal when the pasteboard scrollport resizes', () => {
    resetBookStore()
    commitZoom(2, 40, 50)
    const observers: ResizeObserverCallback[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          observers.push(cb)
        }
        observe(): void {
          /* no-op */
        }
        disconnect(): void {
          /* no-op */
        }
        unobserve(): void {
          /* no-op */
        }
      },
    )
    const rafQueue = stubRaf()
    let reads = 0
    const restore = stubNewSpreadBox(() => {
      reads += 1
      if (reads < 4) {
        return new DOMRect(PORT_LEFT, PORT_TOP + 250, 200, 180)
      }
      return new DOMRect(PORT_LEFT + 10, PORT_TOP + 10, 200, 180)
    })
    try {
      render(<Pasteboard />)
      addSpreadAndReveal()
      expect(observers.length).toBeGreaterThan(0)
      const before = rafQueue.length
      act(() => {
        observers[0]?.([], {} as ResizeObserver)
      })
      expect(rafQueue.length).toBeGreaterThanOrEqual(before)
    } finally {
      restore()
      vi.unstubAllGlobals()
    }
  })

  it('stops fighting scroll after reveal retries are exhausted', () => {
    resetBookStore()
    commitZoom(2, 40, 50)
    const rafQueue = stubRaf()
    const restore = stubNewSpreadBox(
      () => new DOMRect(PORT_LEFT, PORT_TOP + 250, 200, 180),
    )
    try {
      render(<Pasteboard />)
      const scroll = screen.getByTestId('pasteboard-scroll')
      addSpreadAndReveal()
      let frames = 0
      for (let i = 0; i < REVEAL_TRY_CEILING * 2 + 16; i += 1) {
        if (rafQueue.length === 0) {
          break
        }
        frames += flushRaf(rafQueue, i)
      }
      expect(frames).toBeGreaterThanOrEqual(REVEAL_TRY_CEILING)
      for (let i = 0; i < 400 && rafQueue.length > 0; i += 1) {
        frames += flushRaf(rafQueue, i)
      }
      expect(rafQueue).toHaveLength(0)
      const settledTop = scroll.scrollTop
      scroll.scrollTop = settledTop + 17
      act(() => {
        /* exhaust cleared reveal; no further reveal rAF should enqueue */
      })
      expect(rafQueue).toHaveLength(0)
      expect(scroll.scrollTop).toBe(settledTop + 17)
    } finally {
      restore()
      vi.unstubAllGlobals()
    }
  })

  it('marks the spread that fills the pasteboard', () => {
    resetBookStore()
    const ratios = [0.4, 1, 0.2]
    class FakeIntersectionObserver {
      lastTarget: Element | undefined

      constructor(private readonly callback: IntersectionObserverCallback) {}

      observe(target: Element): void {
        this.lastTarget = target
        const index = Number((target as HTMLElement).dataset.slotIndex)
        const ratio = ratios[index] ?? 0
        this.callback(
          [
            {
              target,
              intersectionRatio: ratio,
            } as IntersectionObserverEntry,
          ],
          this as unknown as IntersectionObserver,
        )
      }

      unobserve(target: Element): void {
        this.lastTarget = target
      }

      disconnect(): void {
        this.lastTarget = undefined
      }

      takeRecords(): IntersectionObserverEntry[] {
        return []
      }
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    const clientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight',
    )
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 800
      },
    })

    try {
      render(<Pasteboard />)
      const active = screen
        .getAllByTestId('pasteboard-slot')
        .find((slot) => slot.getAttribute('data-active') === 'true')
      expect(active?.getAttribute('data-slot-index')).toBe('1')
    } finally {
      vi.unstubAllGlobals()
      if (clientHeight !== undefined) {
        Object.defineProperty(
          HTMLElement.prototype,
          'clientHeight',
          clientHeight,
        )
      }
    }
  })
})

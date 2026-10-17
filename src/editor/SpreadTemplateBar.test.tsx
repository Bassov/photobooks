import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { commitZoom, getCommittedZoom, resetCameraStore } from './cameraStore'
import { Pasteboard } from './Pasteboard'
import { REVEAL_TRY_CEILING } from './pasteboardReveal'
import { SpreadTemplateBar } from './SpreadTemplateBar'

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

const editorShellCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'EditorShell.css'),
  'utf8',
)

describe('SpreadTemplateBar', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
  })

  it('applies 4-grid to the marked spread only', () => {
    resetBookStore()
    render(<Pasteboard />)

    expect(
      screen.getByRole('radiogroup', { name: 'Spread template' }),
    ).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Full bleed' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'One per page' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '2-up' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '4-grid' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add spread' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'One per page' })).toHaveProperty(
      'checked',
      true,
    )
    expect(editorShellCss).toMatch(
      /\.spread-template-bar input:focus-visible[\s\S]*outline:\s*2px solid var\(--accent\)/,
    )
    expect(editorShellCss).toMatch(
      /\.spread-template-bar button:focus-visible[\s\S]*outline:\s*2px solid var\(--accent\)/,
    )

    const before = getBookStoreSnapshot().book.spreads.map(
      (spread) => spread.frames.length,
    )
    const middle = before[1]
    const last = before[2]
    if (middle === undefined || last === undefined) {
      throw new Error('expected session spreads')
    }
    fireEvent.click(screen.getByRole('radio', { name: '4-grid' }))

    const after = getBookStoreSnapshot().book.spreads
    expect(after[0]?.frames).toHaveLength(4)
    expect(after[1]?.frames).toHaveLength(middle)
    expect(after[2]?.frames).toHaveLength(last)
    expect(screen.getAllByTestId('spread-frame-placeholder')).toHaveLength(4)
  })

  it('ignores a template change when no spread is marked', () => {
    resetBookStore()
    const before = getBookStoreSnapshot().book
    render(<SpreadTemplateBar spreadId={null} onAddSpread={() => undefined} />)
    const radio = screen.getByRole('radio', { name: '4-grid' })
    expect(radio).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Add spread' })).toHaveProperty(
      'disabled',
      true,
    )
    fireEvent.change(radio)
    expect(getBookStoreSnapshot().book).toBe(before)
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
    fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
    expect(getBookStoreSnapshot().book.spreads).toHaveLength(4)
    expect(getCommittedZoom()).toBe(2)
    expect(scroll.scrollTop).not.toBe(900)
    expect(
      scroll
        .querySelector('[data-pasteboard-slot]')
        ?.getAttribute('data-slot-index'),
    ).toBe('2')
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
      fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
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
      scrollTop: 20,
      scrollLeft: 40,
    },
    {
      label: 'pushes a tall spread up when its bottom is below the port',
      top: PORT_TOP,
      left: PORT_LEFT,
      width: 200,
      height: 420,
      scrollTop: 70,
      scrollLeft: 40,
    },
    {
      label: 'pulls a wide spread right when its left is outside the port',
      top: PORT_TOP,
      left: PORT_LEFT - 30,
      width: 520,
      height: 180,
      scrollTop: 50,
      scrollLeft: 10,
    },
    {
      label: 'pushes a wide spread left when its right is outside the port',
      top: PORT_TOP,
      left: PORT_LEFT,
      width: 520,
      height: 180,
      scrollTop: 50,
      scrollLeft: 60,
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
      fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
      expect(scroll.scrollTop).toBe(scrollTop)
      expect(scroll.scrollLeft).toBe(scrollLeft)
    } finally {
      restore()
    }
  })

  it('pulls a short spread down when only its top is above the port', () => {
    resetBookStore()
    commitZoom(2, 40, 50)
    const restore = stubNewSpreadBox(
      () => new DOMRect(PORT_LEFT, PORT_TOP - 30, 200, 180),
    )
    try {
      render(<Pasteboard />)
      const scroll = screen.getByTestId('pasteboard-scroll')
      fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
      expect(scroll.scrollTop).toBe(0)
      expect(scroll.scrollLeft).toBe(40)
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
      fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
      expect(scroll.scrollTop).toBe(190)
      expect(scroll.scrollLeft).toBe(40)
    } finally {
      restore()
    }
  })

  it('clears forced content-visibility after reveal settles or exhausts', () => {
    resetBookStore()
    commitZoom(2, 40, 50)
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const restore = stubNewSpreadBox(
      () => new DOMRect(PORT_LEFT, PORT_TOP + 250, 200, 180),
    )
    try {
      render(<Pasteboard />)
      fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
      for (let i = 0; i < REVEAL_TRY_CEILING * 2 + 16; i += 1) {
        if (rafQueue.length === 0) {
          break
        }
        const batch = rafQueue.splice(0, rafQueue.length)
        act(() => {
          for (const cb of batch) {
            cb(i)
          }
        })
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
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
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
      fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
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
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    const restore = stubNewSpreadBox(
      () => new DOMRect(PORT_LEFT, PORT_TOP + 250, 200, 180),
    )
    try {
      render(<Pasteboard />)
      const scroll = screen.getByTestId('pasteboard-scroll')
      fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
      let frames = 0
      for (let i = 0; i < REVEAL_TRY_CEILING * 2 + 16; i += 1) {
        if (rafQueue.length === 0) {
          break
        }
        frames += rafQueue.length
        const batch = rafQueue.splice(0, rafQueue.length)
        act(() => {
          for (const cb of batch) {
            cb(i)
          }
        })
      }
      expect(frames).toBeGreaterThanOrEqual(REVEAL_TRY_CEILING)
      for (let i = 0; i < 400 && rafQueue.length > 0; i += 1) {
        frames += rafQueue.length
        const batch = rafQueue.splice(0, rafQueue.length)
        act(() => {
          for (const cb of batch) {
            cb(i)
          }
        })
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

  it('leaves a spread that is already inside the pasteboard', () => {
    resetBookStore()
    commitZoom(2, 40, 50)
    const restore = stubNewSpreadBox(
      () => new DOMRect(PORT_LEFT - 1, PORT_TOP - 1, 200, 180),
    )
    try {
      render(<Pasteboard />)
      const scroll = screen.getByTestId('pasteboard-scroll')
      fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
      expect(scroll.scrollTop).toBe(50)
      expect(scroll.scrollLeft).toBe(40)
    } finally {
      restore()
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

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookStore from './bookStore'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import { commitZoom, getCommittedZoom, resetCameraStore } from './cameraStore'
import { Pasteboard } from './Pasteboard'
import { REVEAL_TRY_CEILING } from './pasteboardReveal'
import { applyMarkedSpreadTemplate } from './applyMarkedSpreadTemplate'
import { SpreadTemplateBar } from './SpreadTemplateBar'
import assert from 'node:assert/strict'

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
      screen.getByRole('radiogroup', { name: 'Template for this spread' }),
    ).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Full bleed' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'One per page' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '2-up' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '4-grid' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add spread' })).toBeTruthy()
    expect(
      screen
        .getByRole('radio', { name: 'One per page' })
        .getAttribute('data-selected'),
    ).toBe('true')
    expect(editorShellCss).toMatch(/\.spread-template-bar/)

    const before = getBookStoreSnapshot().book.spreads.map(
      (spread) => spread.frames.length,
    )
    const middle = before[1]
    const last = before[2]
    assert(
      middle !== undefined && last !== undefined,
      'expected session spreads',
    )
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
    expect(radio.hasAttribute('disabled')).toBe(true)
    expect(
      screen
        .getByRole('button', { name: 'Add spread' })
        .hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.click(radio)
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('shows the marked spread template when a spread id is set', () => {
    resetBookStore()
    const marked = getBookStoreSnapshot().book.spreads[0]?.id
    assert(marked !== undefined)
    applyMarkedSpreadTemplate(marked, '4-grid')
    render(
      <SpreadTemplateBar spreadId={marked} onAddSpread={() => undefined} />,
    )
    expect(
      screen
        .getByRole('radio', { name: '4-grid' })
        .getAttribute('data-selected'),
    ).toBe('true')
    expect(
      screen
        .getByRole('radio', { name: 'One per page' })
        .getAttribute('data-selected'),
    ).toBeNull()
    expect(
      screen.getByRole('radio', { name: '4-grid' }).hasAttribute('disabled'),
    ).toBe(false)
  })

  it('does not read a template id when no spread is marked', () => {
    resetBookStore()
    const getTemplate = vi.spyOn(bookStore, 'getSpreadTemplateId')
    render(<SpreadTemplateBar spreadId={null} onAddSpread={() => undefined} />)
    // Snapshot read runs; null spread must not call getSpreadTemplateId.
    expect(getTemplate).not.toHaveBeenCalled()
    expect(
      screen.getByRole('radio', { name: '4-grid' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('applyMarkedSpreadTemplate no-ops without a marked spread', () => {
    resetBookStore()
    const before = getBookStoreSnapshot().book
    const dispatch = vi.spyOn(bookStore, 'dispatchBookOp')
    applyMarkedSpreadTemplate(null, '4-grid')
    expect(dispatch).not.toHaveBeenCalled()
    expect(getBookStoreSnapshot().book).toBe(before)
    const marked = getBookStoreSnapshot().book.spreads[0]?.id
    assert(marked !== undefined)
    applyMarkedSpreadTemplate(marked, '2-up')
    expect(getBookStoreSnapshot().book.spreads[0]?.templateId).toBe('2-up')
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('applies a contact sheet from the Columns / Rows inputs', () => {
    resetBookStore()
    render(<Pasteboard />)
    fireEvent.change(screen.getByLabelText('Columns'), {
      target: { value: '3' },
    })
    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Contact sheet' }))
    const first = getBookStoreSnapshot().book.spreads[0]
    expect(first?.templateId).toBe('contact-3x4')
    expect(first?.frames).toHaveLength(12)
    expect(
      screen
        .getAllByRole('radio')
        .some((r) => r.getAttribute('data-selected') === 'true'),
    ).toBe(false)
  })

  it('prefills the inputs from a contact-sheet spread', () => {
    resetBookStore()
    const marked = getBookStoreSnapshot().book.spreads[0]?.id
    assert(marked !== undefined)
    applyMarkedSpreadTemplate(marked, 'contact-2x3')
    render(
      <SpreadTemplateBar spreadId={marked} onAddSpread={() => undefined} />,
    )
    expect(screen.getByLabelText<HTMLInputElement>('Columns').value).toBe('2')
    expect(screen.getByLabelText<HTMLInputElement>('Rows').value).toBe('3')
  })

  it('disables Apply for out-of-range or empty values', () => {
    resetBookStore()
    const marked = getBookStoreSnapshot().book.spreads[0]?.id
    assert(marked !== undefined)
    render(
      <SpreadTemplateBar spreadId={marked} onAddSpread={() => undefined} />,
    )
    const apply = screen.getByRole('button', { name: 'Contact sheet' })
    expect(apply.hasAttribute('disabled')).toBe(false)
    for (const [label, value] of [
      ['Columns', '6'],
      ['Columns', ''],
      ['Rows', '5'],
      ['Rows', '0'],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
      expect(apply.hasAttribute('disabled')).toBe(true)
      fireEvent.change(screen.getByLabelText(label), { target: { value: '2' } })
      expect(apply.hasAttribute('disabled')).toBe(false)
    }
  })

  it('disables the contact-sheet controls without a marked spread', () => {
    render(<SpreadTemplateBar spreadId={null} onAddSpread={() => undefined} />)
    expect(screen.getByLabelText('Columns').hasAttribute('disabled')).toBe(true)
    expect(
      screen
        .getByRole('button', { name: 'Contact sheet' })
        .hasAttribute('disabled'),
    ).toBe(true)
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

  it('Add spread copies the active spread 4-grid template', () => {
    resetBookStore()
    render(<Pasteboard />)
    fireEvent.click(screen.getByRole('radio', { name: '4-grid' }))
    expect(getBookStoreSnapshot().book.spreads[0]?.templateId).toBe('4-grid')
    fireEvent.click(screen.getByRole('button', { name: 'Add spread' }))
    const spreads = getBookStoreSnapshot().book.spreads
    expect(spreads).toHaveLength(4)
    const added = spreads[3]
    expect(added?.templateId).toBe('4-grid')
    expect(added?.frames).toHaveLength(4)
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

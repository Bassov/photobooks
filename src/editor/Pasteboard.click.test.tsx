import assert from 'node:assert/strict'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSpreadSizeMm } from '../core'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getSpreadIdsSnapshot,
  resetBookStore,
} from './bookStore'
import { commitZoom, resetCameraStore } from './cameraStore'
import { resetEditorToolForTests, setEditorTool } from './editorToolStore'
import { installFrameGesture } from './frameGesture'
import {
  getFrameSelection,
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import { Pasteboard } from './Pasteboard'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
} from './photoRootSession'

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

function activeSlotId(): string | null {
  const slot = screen
    .getAllByTestId('pasteboard-slot')
    .find((el) => el.getAttribute('data-active') === 'true')
  return slot?.getAttribute('data-spread-id') ?? null
}

describe('Pasteboard click selects the spread', () => {
  let ids: readonly string[]

  beforeEach(() => {
    resetBookStore()
    resetFrameSelection()
    for (let i = 0; i < 2; i += 1) {
      dispatchBookOp({ type: 'addSpread' })
    }
    ids = getSpreadIdsSnapshot()
    commitZoom(1, 0, 0)
    stubViewport(500, 2000)
    render(<Pasteboard />)
  })

  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
    resetFrameSelection()
    resetActiveSpreadIdForTests()
    vi.unstubAllGlobals()
  })

  function slotFor(id: string | undefined): HTMLElement {
    const slot = screen
      .getAllByTestId('pasteboard-slot')
      .find((el) => el.getAttribute('data-spread-id') === id)
    assert.ok(slot)
    return slot
  }

  it('activates the clicked spread with the primary button', () => {
    const second = ids[1]
    assert.ok(second)
    act(() => {
      fireEvent.pointerDown(slotFor(second), { button: 0 })
    })
    expect(activeSlotId()).toBe(second)
    expect(getActiveSpreadId()).toBe(second)
    const first = ids[0]
    assert.ok(first)
    act(() => {
      fireEvent.pointerDown(slotFor(first), { button: 0 })
    })
    expect(activeSlotId()).toBe(first)
    expect(getActiveSpreadId()).toBe(first)
  })

  it('ignores non-primary buttons', () => {
    const second = ids[1]
    assert.ok(second)
    const before = activeSlotId()
    act(() => {
      fireEvent.pointerDown(slotFor(second), { button: 1 })
      fireEvent.pointerDown(slotFor(second), { button: 2 })
    })
    expect(activeSlotId()).toBe(before)
    expect(before).not.toBe(second)
  })

  it('ignores a pointerdown whose target is not an Element', () => {
    const second = ids[1]
    assert.ok(second)
    const before = activeSlotId()
    const scroll = screen.getByTestId('pasteboard-scroll')
    act(() => {
      const event = new Event('pointerdown', { bubbles: true })
      Object.defineProperty(event, 'button', { value: 0 })
      Object.defineProperty(event, 'target', { value: window })
      scroll.dispatchEvent(event)
    })
    expect(activeSlotId()).toBe(before)
  })

  it('maps the gray beside a spread to its row and keeps the active one on empty gray', () => {
    const second = ids[1]
    assert.ok(second)
    const before = activeSlotId()
    slotFor(second).getBoundingClientRect = () =>
      ({ top: 100, bottom: 200 }) as DOMRect
    const scroll = screen.getByTestId('pasteboard-scroll')
    act(() => {
      fireEvent.pointerDown(scroll, { button: 0, clientY: 500 })
    })
    expect(activeSlotId()).toBe(before)
    act(() => {
      fireEvent.pointerDown(scroll, { button: 0, clientY: 150 })
    })
    expect(activeSlotId()).toBe(second)
  })

  it('clears the frame move source after selecting a spread', () => {
    const first = ids[0]
    const second = ids[1]
    assert.ok(first && second)
    act(() => {
      setFrameSource({ spreadId: first, frameId: 'f1' })
    })
    expect(getFrameSource()).not.toBeNull()
    act(() => {
      fireEvent.pointerDown(slotFor(second), { button: 0 })
    })
    expect(getFrameSource()).toBeNull()
  })

  it('keeps the frame source when the click resolves no spread', () => {
    const first = ids[0]
    assert.ok(first)
    act(() => {
      setFrameSource({ spreadId: first, frameId: 'f1' })
    })
    act(() => {
      fireEvent.pointerDown(screen.getByTestId('pasteboard-scroll'), {
        button: 0,
        clientY: 9999,
      })
    })
    expect(getFrameSource()).toEqual({ spreadId: first, frameId: 'f1' })
  })
})

describe('Pasteboard marquee from the gray', () => {
  /** Spread 2 at 1 client px per mm, its left edge 50 px into the port. */
  const LEFT = 50
  const TOP = 100
  let ids: readonly string[]
  let stop: () => void
  let target: string
  let frameIds: string[]
  let topLeft: { id: string; cx: number; cy: number }

  beforeEach(() => {
    resetBookStore()
    resetFrameSelection()
    dispatchBookOp({ type: 'addSpread' })
    dispatchBookOp({ type: 'addSpread' })
    ids = getSpreadIdsSnapshot()
    const second = ids[1]
    assert.ok(second)
    target = second
    dispatchBookOp({
      type: 'applyTemplate',
      spreadId: target,
      templateId: '4-grid',
    })
    commitZoom(1, 0, 0)
    stubViewport(500, 2000)
    render(<Pasteboard />)
    const book = getBookStoreSnapshot().book
    const { widthMm, heightMm } = getSpreadSizeMm(book, 1)
    const frames = book.spreads[1]?.frames ?? []
    frameIds = frames.map((frame) => frame.id)
    const first = [...frames].sort(
      (a, b) => a.rect.x + a.rect.y - (b.rect.x + b.rect.y),
    )[0]
    assert.ok(first)
    topLeft = {
      id: first.id,
      cx: LEFT + first.rect.x + first.rect.width / 2,
      cy: TOP + first.rect.y + first.rect.height / 2,
    }
    const slot = screen
      .getAllByTestId('pasteboard-slot')
      .find((el) => el.getAttribute('data-spread-id') === target)
    assert.ok(slot)
    slot.getBoundingClientRect = () =>
      ({ top: TOP, bottom: TOP + heightMm + 40 }) as DOMRect
    const view = slot.querySelector<HTMLElement>('[data-testid="spread-view"]')
    assert.ok(view)
    view.getBoundingClientRect = () =>
      ({ left: LEFT, top: TOP, width: widthMm, height: heightMm }) as DOMRect
    stop = installFrameGesture()
  })

  afterEach(() => {
    stop()
    cleanup()
    resetBookStore()
    resetCameraStore()
    resetFrameSelection()
    resetActiveSpreadIdForTests()
    resetEditorToolForTests()
    vi.unstubAllGlobals()
  })

  function port(): HTMLElement {
    return screen.getByTestId('pasteboard-scroll')
  }

  function fire(type: string, x: number, y: number, init = {}): Event {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: x,
      clientY: y,
      ...init,
    })
    Object.defineProperty(event, 'pointerId', { value: 1 })
    act(() => {
      ;(type === 'pointerdown' ? port() : window).dispatchEvent(event)
    })
    return event
  }

  const box = () => document.querySelector<HTMLElement>('.marquee-box')
  const pressed = () =>
    screen
      .getAllByTestId('spread-frame')
      .filter((el) => el.getAttribute('aria-pressed') === 'true')
      .map((el) => el.getAttribute('data-frame-id'))

  it('a press under 3 px stays the spread click: active spread, selection cleared', () => {
    act(() => {
      setFrameSource({ spreadId: target, frameId: topLeft.id })
    })
    fire('pointerdown', 10, topLeft.cy)
    fire('pointermove', 12, topLeft.cy)
    fire('pointerup', 12, topLeft.cy)
    expect(box()).toBeNull()
    expect(getActiveSpreadId()).toBe(target)
    expect(getFrameSource()).toBeNull()
  })

  it('a drag from the gray beside the spread selects the frames it touches', () => {
    fire('pointerdown', 10, topLeft.cy)
    fire('pointermove', topLeft.cx, topLeft.cy + 1)
    expect(box()?.style.width).toBe(`${String(topLeft.cx - 10)}px`)
    fire('pointerup', topLeft.cx, topLeft.cy + 1)
    expect(getActiveSpreadId()).toBe(target)
    expect(getFrameSelection()).toEqual({
      spreadId: target,
      frameIds: [topLeft.id],
    })
    expect(pressed()).toEqual([topLeft.id])

    // Over the whole spread: every frame (count = the template's four).
    fire('pointerdown', 10, TOP + 1)
    fire('pointermove', 490, 1990)
    fire('pointerup', 490, 1990)
    expect(frameIds).toHaveLength(4)
    expect([...(getFrameSelection()?.frameIds ?? [])].sort()).toEqual(
      [...frameIds].sort(),
    )
  })

  it('Shift unions with the previous set; Esc mid-drag restores it', () => {
    fire('pointerdown', 10, topLeft.cy)
    fire('pointermove', topLeft.cx, topLeft.cy + 1)
    fire('pointerup', topLeft.cx, topLeft.cy + 1)
    fire('pointerdown', 10, TOP + 1, { shiftKey: true })
    fire('pointermove', 490, 1990)
    fire('pointerup', 490, 1990)
    const all = getFrameSelection()?.frameIds ?? []
    expect(all).toHaveLength(4)
    expect(all[0]).toBe(topLeft.id)

    fire('pointerdown', 10, topLeft.cy)
    fire('pointermove', topLeft.cx, topLeft.cy + 1)
    // The click part already cleared it; the marquee shows only its hits.
    expect(getFrameSelection()).toBeNull()
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    expect(getFrameSelection()?.frameIds).toEqual(all)
    expect(box()).toBeNull()
    fire('pointerup', topLeft.cx, topLeft.cy + 1)
    expect(getFrameSelection()?.frameIds).toEqual(all)
  })

  it('keeps the box inside the scrollport; scrollbars and empty gray start none', () => {
    // Client box: borders 4 / 6 px, 500 × 300 inside, so x 4..504, y 6..306.
    for (const [key, value] of Object.entries({
      clientLeft: 4,
      clientTop: 6,
      clientWidth: 500,
      clientHeight: 300,
    })) {
      Object.defineProperty(port(), key, { configurable: true, value })
    }
    fire('pointerdown', 10, topLeft.cy)
    fire('pointermove', -50, 0)
    expect(box()?.style.cssText).toBe(
      `left: 4px; top: 6px; width: 6px; height: ${String(topLeft.cy - 6)}px;`,
    )
    fire('pointermove', 900, 900)
    expect(box()?.style.width).toBe('494px')
    expect(box()?.style.height).toBe(`${String(306 - topLeft.cy)}px`)
    fire('pointerup', 900, 900)
    // The scrollbars (x ≥ 504 or y ≥ 306) and gray outside every row.
    for (const [x, y] of [
      [504, topLeft.cy],
      [300, 306],
      [300, 50],
    ] as const) {
      fire('pointerdown', x, y)
      fire('pointermove', 200, y - 40)
      expect(box()).toBeNull()
      fire('pointerup', 200, y - 40)
    }
  })

  it('pans with the Hand tool instead', () => {
    act(() => {
      setEditorTool('hand')
    })
    port().setPointerCapture = vi.fn()
    fire('pointerdown', 10, topLeft.cy)
    fire('pointermove', topLeft.cx, topLeft.cy + 40)
    expect(box()).toBeNull()
    fire('pointerup', topLeft.cx, topLeft.cy + 40)
    expect(getFrameSelection()).toBeNull()
  })
})

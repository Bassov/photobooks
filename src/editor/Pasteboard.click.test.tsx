import assert from 'node:assert/strict'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dispatchBookOp,
  getSpreadIdsSnapshot,
  resetBookStore,
} from './bookStore'
import { commitZoom, resetCameraStore } from './cameraStore'
import {
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

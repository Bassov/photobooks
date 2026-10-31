import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dispatchBookOp,
  getSpreadIdsSnapshot,
  resetBookStore,
} from './bookStore'
import { requestSpreadReveal } from './photoRootSession'
import { commitZoom, getCommittedZoom, resetCameraStore } from './cameraStore'
import {
  isEditorGestureActive,
  resetEditorGestureForTests,
} from './editorGesture'
import { PasteboardWithCameraBar as Pasteboard } from './testing/PasteboardWithCameraBar'

async function flushGesture(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100)
    })
  })
}

function wheel(
  target: HTMLElement,
  input: { deltaY: number; ctrlKey?: boolean; metaKey?: boolean },
): void {
  const event = new WheelEvent('wheel', {
    clientX: 48,
    clientY: 36,
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, 'deltaY', { value: input.deltaY })
  Object.defineProperty(event, 'ctrlKey', { value: input.ctrlKey ?? false })
  Object.defineProperty(event, 'metaKey', { value: input.metaKey ?? false })
  target.dispatchEvent(event)
}

describe('pasteboard camera gestures', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetCameraStore()
    resetEditorGestureForTests()
  })

  it('pans with Space+drag while a toolbar button holds focus', async () => {
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    Object.defineProperty(scroll, 'scrollWidth', {
      configurable: true,
      get: () => 800,
    })
    Object.defineProperty(scroll, 'scrollHeight', {
      configurable: true,
      get: () => 800,
    })
    Object.defineProperty(scroll, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    Object.defineProperty(scroll, 'clientHeight', {
      configurable: true,
      get: () => 400,
    })
    scroll.scrollLeft = 120
    scroll.scrollTop = 160

    const chrome = screen.getByRole('button', { name: 'Fit width' })
    chrome.focus()
    expect(document.activeElement).toBe(chrome)

    fireEvent.pointerEnter(scroll)
    fireEvent.keyDown(chrome, { key: ' ', code: 'Space' })
    fireEvent.pointerDown(scroll, { pointerId: 7, clientX: 80, clientY: 90 })
    fireEvent.pointerMove(scroll, { pointerId: 7, clientX: 40, clientY: 40 })
    await flushGesture()
    fireEvent.pointerUp(scroll, { pointerId: 7, clientX: 40, clientY: 40 })
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })

    expect(scroll.scrollLeft).toBe(160)
    expect(scroll.scrollTop).toBe(210)
  })

  it('pans with Space+drag after a Space-consuming filmstrip-like focus', async () => {
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    Object.defineProperty(scroll, 'scrollWidth', {
      configurable: true,
      get: () => 800,
    })
    Object.defineProperty(scroll, 'scrollHeight', {
      configurable: true,
      get: () => 800,
    })
    Object.defineProperty(scroll, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    Object.defineProperty(scroll, 'clientHeight', {
      configurable: true,
      get: () => 400,
    })
    scroll.scrollLeft = 120
    scroll.scrollTop = 160

    // Mimic react-aria GridListItem: Space on the focused row would toggle
    // selection unless capture-phase pan arming stops propagation (PB-04).
    const tile = document.createElement('div')
    tile.setAttribute('role', 'row')
    tile.tabIndex = 0
    let tileSpaceHandled = false
    let tileClicked = false
    tile.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.key === ' ') {
        tileSpaceHandled = true
        event.preventDefault()
        event.stopPropagation()
      }
    })
    tile.addEventListener('click', () => {
      tileClicked = true
    })
    document.body.append(tile)
    tile.focus()
    expect(document.activeElement).toBe(tile)

    fireEvent.pointerEnter(scroll)
    fireEvent.keyDown(tile, { key: ' ', code: 'Space' })
    fireEvent.pointerDown(scroll, { pointerId: 11, clientX: 80, clientY: 90 })
    fireEvent.pointerMove(scroll, { pointerId: 11, clientX: 40, clientY: 40 })
    await flushGesture()
    fireEvent.pointerUp(scroll, { pointerId: 11, clientX: 40, clientY: 40 })
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })
    tile.remove()

    expect(tileSpaceHandled).toBe(false)
    expect(tileClicked).toBe(false)
    expect(scroll.scrollLeft).toBe(160)
    expect(scroll.scrollTop).toBe(210)
  })

  it('activates filmstrip-like focus with Space alone while pointer is over pasteboard', () => {
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    scroll.scrollLeft = 40
    scroll.scrollTop = 50

    const tile = document.createElement('div')
    tile.setAttribute('role', 'row')
    tile.tabIndex = 0
    let tileClicked = false
    tile.addEventListener('click', () => {
      tileClicked = true
    })
    document.body.append(tile)
    tile.focus()
    expect(document.activeElement).toBe(tile)

    fireEvent.pointerEnter(scroll)
    fireEvent.keyDown(tile, { key: ' ', code: 'Space' })
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })
    tile.remove()

    expect(tileClicked).toBe(true)
    expect(scroll.scrollLeft).toBe(40)
    expect(scroll.scrollTop).toBe(50)
  })

  it('does not arm Space pan while a text input holds focus', async () => {
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    scroll.scrollLeft = 40
    scroll.scrollTop = 50

    const input = document.createElement('input')
    input.type = 'text'
    document.body.append(input)
    input.focus()

    fireEvent.pointerEnter(scroll)
    fireEvent.keyDown(input, { key: ' ', code: 'Space' })
    fireEvent.pointerDown(scroll, { pointerId: 8, clientX: 80, clientY: 90 })
    fireEvent.pointerMove(scroll, { pointerId: 8, clientX: 40, clientY: 40 })
    fireEvent.pointerUp(scroll, { pointerId: 8, clientX: 40, clientY: 40 })
    await flushGesture()
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })
    input.remove()

    expect(scroll.scrollLeft).toBe(40)
    expect(scroll.scrollTop).toBe(50)
  })

  it('does not arm Space pan while a radio holds focus off the pasteboard', async () => {
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    scroll.scrollLeft = 40
    scroll.scrollTop = 50

    const radio = document.createElement('input')
    radio.type = 'radio'
    document.body.append(radio)
    radio.focus()
    expect(document.activeElement).toBe(radio)

    fireEvent.pointerLeave(scroll)
    fireEvent.keyDown(radio, { key: ' ', code: 'Space' })
    fireEvent.pointerDown(scroll, { pointerId: 9, clientX: 80, clientY: 90 })
    fireEvent.pointerMove(scroll, { pointerId: 9, clientX: 40, clientY: 40 })
    fireEvent.pointerUp(scroll, { pointerId: 9, clientX: 40, clientY: 40 })
    await flushGesture()
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })
    radio.remove()

    expect(scroll.scrollLeft).toBe(40)
    expect(scroll.scrollTop).toBe(50)
  })

  it('zooms from wheel, keys, and pinch, then pans with space', async () => {
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const indicator = screen.getByTestId('zoom-indicator')
    expect(indicator.textContent).toBe('13%')

    // Kit hard-no: plain wheel zooms (Ctrl/Cmd optional).
    wheel(scroll, { deltaY: -80 })
    expect(isEditorGestureActive()).toBe(true)
    await flushGesture()
    expect(isEditorGestureActive()).toBe(false)
    expect(indicator.textContent).not.toBe('13%')

    const afterPlain = indicator.textContent
    wheel(scroll, { deltaY: -240, ctrlKey: true })
    expect(isEditorGestureActive()).toBe(true)
    await flushGesture()
    expect(isEditorGestureActive()).toBe(false)
    expect(indicator.textContent).not.toBe(afterPlain)

    const afterWheel = indicator.textContent
    fireEvent.keyDown(window, { key: '+', code: 'Equal' })
    expect(indicator.textContent).not.toBe(afterWheel)

    const input = document.createElement('input')
    document.body.append(input)
    fireEvent.keyDown(input, { key: '+', code: 'Equal' })
    const held = indicator.textContent
    expect(indicator.textContent).toBe(held)
    input.remove()

    fireEvent.keyDown(window, { key: '-', code: 'Minus' })
    fireEvent.keyDown(window, { key: '=', code: 'NumpadAdd' })
    fireEvent.keyDown(window, { key: '_', code: 'NumpadSubtract' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    const beforePinch = indicator.textContent
    fireEvent.pointerDown(scroll, {
      pointerId: 1,
      clientX: 20,
      clientY: 40,
      pointerType: 'touch',
    })
    fireEvent.pointerDown(scroll, {
      pointerId: 2,
      clientX: 80,
      clientY: 40,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(scroll, {
      pointerId: 2,
      clientX: 140,
      clientY: 40,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(scroll, { pointerId: 1, clientX: 20, clientY: 40 })
    fireEvent.pointerUp(scroll, { pointerId: 2, clientX: 140, clientY: 40 })
    await flushGesture()
    expect(indicator.textContent).not.toBe(beforePinch)

    scroll.focus()
    fireEvent.pointerEnter(scroll)
    fireEvent.keyDown(scroll, { key: ' ', code: 'Space' })
    fireEvent.keyDown(scroll, { key: ' ', code: 'Space', repeat: true })
    fireEvent.pointerDown(scroll, { pointerId: 4, clientX: 50, clientY: 90 })
    fireEvent.pointerMove(scroll, { pointerId: 4, clientX: 50, clientY: 20 })
    fireEvent.pointerUp(scroll, { pointerId: 4, clientX: 50, clientY: 20 })
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })

    fireEvent.click(screen.getByRole('button', { name: 'Fit width' }))
    fireEvent.click(screen.getByRole('button', { name: /Fit spread/ }))
    fireEvent.pointerEnter(scroll)
    fireEvent.keyDown(screen.getByRole('button', { name: '100%' }), {
      key: ' ',
      code: 'Space',
    })

    scroll.scrollTop = 12
    fireEvent.scroll(scroll)
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    })
  })

  it('applies delayed fit zoom-out after chrome settle and cancels on fit width', () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    try {
      render(<Pasteboard />)
      const scroll = screen.getByTestId('pasteboard-scroll')
      Object.defineProperty(scroll, 'clientWidth', {
        configurable: true,
        get: () => 640,
      })
      let height = 520
      Object.defineProperty(scroll, 'clientHeight', {
        configurable: true,
        get: () => height,
      })
      fireEvent.click(screen.getByRole('button', { name: /Fit spread/ }))
      const afterImmediate = screen.getByTestId('zoom-indicator').textContent
      height = 400
      const batch1 = rafQueue.splice(0, rafQueue.length)
      act(() => {
        for (const cb of batch1) {
          cb(0)
        }
      })
      const batch2 = rafQueue.splice(0, rafQueue.length)
      act(() => {
        for (const cb of batch2) {
          cb(1)
        }
      })
      const afterDelayed = screen.getByTestId('zoom-indicator').textContent
      expect(afterDelayed).not.toBe(afterImmediate)

      fireEvent.click(screen.getByRole('button', { name: /Fit spread/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Fit width' }))
      const pending = rafQueue.splice(0, rafQueue.length)
      act(() => {
        for (const cb of pending) {
          cb(2)
        }
      })
      // Fit width cancelled follow; draining stale rAF must not throw.
      expect(screen.getByTestId('zoom-indicator').textContent).toBeTruthy()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('holds camera scroll restore while add-spread reveal is pending', () => {
    const restoreRect = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'getBoundingClientRect',
    )
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value(this: HTMLElement): DOMRect {
        if (this.dataset.testid === 'pasteboard-scroll') {
          return new DOMRect(40, 100, 500, 400)
        }
        if (
          this.dataset.testid === 'spread-view' &&
          this.closest('[data-slot-index="3"]') instanceof HTMLElement
        ) {
          return new DOMRect(40, 350, 200, 180)
        }
        return new DOMRect(0, 0, 0, 0)
      },
    })
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    try {
      render(<Pasteboard />)
      const scroll = screen.getByTestId('pasteboard-scroll')
      act(() => {
        dispatchBookOp({ type: 'addSpread' })
        const last = getSpreadIdsSnapshot().at(-1)
        if (last !== undefined) {
          requestSpreadReveal(last)
        }
      })
      const nudged = scroll.scrollTop
      expect(nudged).toBeGreaterThan(0)
      // Epoch bump would restore scrollTop from the camera store; hold skips it.
      act(() => {
        commitZoom(getCommittedZoom(), 0, 0)
      })
      expect(scroll.scrollTop).toBe(nudged)
    } finally {
      vi.unstubAllGlobals()
      if (restoreRect !== undefined) {
        Object.defineProperty(
          HTMLElement.prototype,
          'getBoundingClientRect',
          restoreRect,
        )
      }
    }
  })

  it('coalesces a same-task wheel burst into one zoom apply before settle', async () => {
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const indicator = screen.getByTestId('zoom-indicator')
    const before = indicator.textContent

    for (let index = 0; index < 24; index += 1) {
      wheel(scroll, { deltaY: -300, ctrlKey: true })
    }
    // Still in the burst task: live indicator updates only after paint.
    expect(indicator.textContent).toBe(before)
    expect(isEditorGestureActive()).toBe(true)

    await flushGesture()
    expect(isEditorGestureActive()).toBe(false)
    expect(indicator.textContent).not.toBe(before)
  })

  it('exposes the live gesture frame as --cam-* vars and clears them on settle', async () => {
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const world = screen.getByTestId('pasteboard-world')

    wheel(scroll, { deltaY: -240, ctrlKey: true })
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    })
    expect(world.dataset.gesture).toBe('zoom')
    const scale = Number(scroll.style.getPropertyValue('--cam-scale'))
    expect(scale).toBeGreaterThan(1)
    const tx = scroll.style.getPropertyValue('--cam-tx')
    const ty = scroll.style.getPropertyValue('--cam-ty')
    expect(world.style.transform).toBe(
      `translate(${tx}, ${ty}) scale(${String(scale)})`,
    )

    await flushGesture()
    expect(world.dataset.gesture).toBeUndefined()
    for (const name of ['--cam-tx', '--cam-ty', '--cam-scale']) {
      expect(scroll.style.getPropertyValue(name)).toBe('')
    }
  })

  it('ignores zoom keys on text fields and commits nothing when unmounted mid-gesture', async () => {
    const view = render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    const fields = [
      document.createElement('textarea'),
      document.createElement('select'),
      editable,
    ]
    const email = document.createElement('input')
    email.type = 'email'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    fields.push(email, checkbox)
    for (const field of fields) {
      document.body.append(field)
      fireEvent.keyDown(field, { key: '+', code: 'Equal' })
      field.remove()
    }

    wheel(scroll, { deltaY: -200, metaKey: true })
    view.unmount()
    await flushGesture()
    expect(screen.queryByTestId('zoom-indicator')).toBeNull()
  })
})

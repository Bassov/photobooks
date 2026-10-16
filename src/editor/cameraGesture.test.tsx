import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetBookStore } from './bookStore'
import { resetCameraStore } from './cameraStore'
import {
  isEditorGestureActive,
  resetEditorGestureForTests,
} from './editorGesture'
import { Pasteboard } from './Pasteboard'

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

  it('zooms from wheel, keys, and pinch, then pans with space', async () => {
    render(<Pasteboard />)
    const scroll = screen.getByTestId('pasteboard-scroll')
    const indicator = screen.getByTestId('zoom-indicator')
    expect(indicator.textContent).toBe('13%')

    wheel(scroll, { deltaY: -80 })
    expect(indicator.textContent).toBe('13%')

    wheel(scroll, { deltaY: -240, ctrlKey: true })
    expect(isEditorGestureActive()).toBe(true)
    await flushGesture()
    expect(isEditorGestureActive()).toBe(false)
    expect(indicator.textContent).not.toBe('13%')

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
    fireEvent.keyDown(scroll, { key: ' ', code: 'Space' })
    fireEvent.keyDown(scroll, { key: ' ', code: 'Space', repeat: true })
    fireEvent.pointerDown(scroll, { pointerId: 4, clientX: 50, clientY: 90 })
    fireEvent.pointerMove(scroll, { pointerId: 4, clientX: 50, clientY: 20 })
    fireEvent.pointerUp(scroll, { pointerId: 4, clientX: 50, clientY: 20 })
    fireEvent.keyUp(window, { key: ' ', code: 'Space' })

    fireEvent.click(screen.getByRole('button', { name: 'Fit width' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fit spread' }))
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

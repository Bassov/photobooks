import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
} from './bookStore'
import { resetCameraStore } from './cameraStore'
import { ConnectedSpreadView } from './ConnectedSpreadView'
import {
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import { installEditorKeys } from './galleryDrop'
import {
  getTextEdit,
  isTextOverflowing,
  resetTextEditForTests,
  startTextEdit,
} from './textEditStore'

const at = { spreadId: 's1', frameId: 't' }

function label(rect: Frame['rect'], text = 'Hi'): Frame {
  return {
    id: 't',
    rect,
    z: 2,
    kind: 'text',
    content: { type: 'static', text },
  }
}

function load(text: Frame) {
  resetBookStore({
    book: makeBook({
      spreads: [
        makeSpread({ id: 's1', frames: [makeFrame({ id: 'a' }), text] }),
      ],
    }),
    sessionMeta: new Map(),
    previewUrls: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const textFrame = () =>
  getBookStoreSnapshot().book.spreads[0]?.frames.find((item) => item.id === 't')
const frameButton = () => screen.getByRole('button', { name: 'Text frame' })
const editBox = () => screen.queryByTestId<HTMLTextAreaElement>('text-edit')
const theEditBox = () => screen.getByTestId<HTMLTextAreaElement>('text-edit')

/** Pretend layout: `scrollHeight` of the matching nodes. */
function mockScrollHeight(match: string, height: number) {
  const proto = HTMLElement.prototype
  const original = Object.getOwnPropertyDescriptor(proto, 'scrollHeight')
  Object.defineProperty(proto, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.matches(match) ? height : 0
    },
  })
  return () => {
    if (original === undefined) {
      Reflect.deleteProperty(proto, 'scrollHeight')
    } else {
      Object.defineProperty(proto, 'scrollHeight', original)
    }
  }
}

describe('TextEditOverlay', () => {
  let restore: (() => void) | null = null

  beforeEach(() => {
    load(label({ x: 10, y: 10, width: 60, height: 14 }))
  })

  afterEach(() => {
    restore?.()
    restore = null
    cleanup()
    resetTextEditForTests()
    resetFrameSelection()
    resetBookStore()
    resetCameraStore()
  })

  it('double-click edits in place: caret at the end, 1 px chrome, no handles', () => {
    render(<ConnectedSpreadView spreadId="s1" />)
    fireEvent.doubleClick(frameButton())
    const box = theEditBox()
    expect(box.value).toBe('Hi')
    expect(document.activeElement).toBe(box)
    expect(box.selectionStart).toBe(2)
    expect(box.placeholder).toBe('Type text')
    expect(box.style.fontSize).toBe(`${String(3.1 * SPREAD_PX_PER_MM)}px`)
    expect(frameButton().getAttribute('data-editing')).toBe('true')
    expect(screen.queryAllByTestId('sel-handle')).toHaveLength(0)
    expect(getFrameSource()).toEqual(at)
  })

  it('Esc commits one "Edit text" step and keeps the frame selected', () => {
    render(<ConnectedSpreadView spreadId="s1" />)
    act(() => {
      setFrameSource(at)
      startTextEdit(at)
    })
    const box = theEditBox()
    fireEvent.input(box, { target: { value: 'Hello' } })
    const escape = fireEvent.keyDown(box, { key: 'Escape' })
    expect(escape).toBe(false)
    expect(editBox()).toBeNull()
    expect(textFrame()?.content).toEqual({ type: 'static', text: 'Hello' })
    expect(getHistorySnapshot().undoLabel).toBe('Edit text')
    expect(getFrameSource()).toEqual(at)
  })

  it('Ctrl+Enter and a click elsewhere commit; plain Enter types', () => {
    render(<ConnectedSpreadView spreadId="s1" />)
    act(() => {
      startTextEdit(at)
    })
    const first = theEditBox()
    expect(fireEvent.keyDown(first, { key: 'Enter' })).toBe(true)
    fireEvent.input(first, { target: { value: 'One' } })
    fireEvent.keyDown(first, { key: 'Enter', ctrlKey: true })
    expect(textFrame()?.content).toEqual({ type: 'static', text: 'One' })

    act(() => {
      startTextEdit(at)
    })
    const second = theEditBox()
    fireEvent.input(second, { target: { value: 'Two' } })
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    fireEvent.blur(second)
    expect(textFrame()?.content).toEqual({ type: 'static', text: 'Two' })
    expect(getTextEdit()).toBeNull()
  })

  it('typing grows the box to whole lines, capped at the paper; the commit keeps it', () => {
    render(<ConnectedSpreadView spreadId="s1" />)
    act(() => {
      startTextEdit(at)
    })
    const box = theEditBox()
    // 5 caption lines (4.34 mm each) of content.
    restore = mockScrollHeight(
      '.text-edit-box',
      5 * 4.34 * SPREAD_PX_PER_MM + 0.5,
    )
    fireEvent.input(box, { target: { value: 'a\nb\nc\nd\ne' } })
    expect(Number.parseFloat(box.style.height)).toBeCloseTo(
      5 * 4.34 * SPREAD_PX_PER_MM,
      3,
    )
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(textFrame()?.rect.height).toBeCloseTo(5 * 4.34, 6)
  })

  it('a frame that goes away mid-edit drops the edit', () => {
    render(<ConnectedSpreadView spreadId="s1" />)
    act(() => {
      startTextEdit(at)
    })
    act(() => {
      dispatchBookOp({ type: 'removeFrames', spreadId: 's1', frameIds: ['t'] })
    })
    expect(getTextEdit()).toBeNull()
    expect(editBox()).toBeNull()
  })

  it('shows the Overflow chip under an overflowing frame, inside near the paper bottom, never while edited', async () => {
    restore = mockScrollHeight('.spread-frame-text', 400)
    render(<ConnectedSpreadView spreadId="s1" />)
    const chip = await screen.findByTestId('text-overflow-chip')
    expect(chip.textContent).toBe('Overflow')
    expect(chip.getAttribute('title')).toBe("Text doesn't fit the frame")
    expect(chip.hasAttribute('data-inside')).toBe(false)
    expect(isTextOverflowing('s1', 't')).toBe(true)

    act(() => {
      startTextEdit(at)
    })
    expect(screen.queryByTestId('text-overflow-chip')).toBeNull()
    act(() => {
      editBox()?.blur()
    })

    const paper = getBookStoreSnapshot().book.settings.trim.heightMm
    act(() => {
      dispatchBookOp({
        type: 'setFrameRect',
        spreadId: 's1',
        frameId: 't',
        rect: { x: 10, y: paper - 15, width: 60, height: 14 },
      })
    })
    const inside = await screen.findByTestId('text-overflow-chip')
    expect(inside.getAttribute('data-inside')).toBe('true')
  })

  it('an empty frame never counts as overflowing', async () => {
    cleanup()
    load(label({ x: 10, y: 10, width: 60, height: 14 }, ''))
    restore = mockScrollHeight('.spread-frame-text', 400)
    render(<ConnectedSpreadView spreadId="s1" />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByTestId('text-overflow-chip')).toBeNull()
    expect(isTextOverflowing('s1', 't')).toBe(false)
  })
})

describe('Enter edits the selected text frame', () => {
  afterEach(() => {
    cleanup()
    resetTextEditForTests()
    resetFrameSelection()
    resetBookStore()
  })

  it('edits on a bare Enter; modifiers, fields and other buttons keep theirs', () => {
    load(label({ x: 10, y: 10, width: 60, height: 14 }))
    const stop = installEditorKeys()
    const other = document.createElement('button')
    const field = document.createElement('input')
    document.body.append(other, field)
    try {
      fireEvent.keyDown(document.body, { key: 'Enter' })
      expect(getTextEdit()).toBeNull()

      setFrameSource({ spreadId: 's1', frameId: 'a' })
      fireEvent.keyDown(document.body, { key: 'Enter' })
      expect(getTextEdit()).toBeNull()

      setFrameSource(at)
      fireEvent.keyDown(document.body, { key: 'Enter', shiftKey: true })
      fireEvent.keyDown(field, { key: 'Enter' })
      fireEvent.keyDown(other, { key: 'Enter' })
      expect(getTextEdit()).toBeNull()

      const handled = fireEvent.keyDown(document.body, { key: 'Enter' })
      expect(handled).toBe(false)
      expect(getTextEdit()).toMatchObject({ frameId: 't', created: false })
    } finally {
      stop()
      other.remove()
      field.remove()
    }
  })
})

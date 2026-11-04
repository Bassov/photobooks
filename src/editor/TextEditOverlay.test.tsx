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

function load(...texts: Frame[]) {
  resetBookStore({
    book: makeBook({
      spreads: [
        makeSpread({ id: 's1', frames: [makeFrame({ id: 'a' }), ...texts] }),
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
function frameById(id: string): HTMLElement {
  const found = document.querySelector(`[data-frame-id="${id}"]`)
  if (!(found instanceof HTMLElement)) {
    throw new Error(`no frame ${id}`)
  }
  return found
}
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
    vi.restoreAllMocks()
    cleanup()
    resetTextEditForTests()
    resetFrameSelection()
    resetBookStore()
    resetCameraStore()
  })

  it('double-click edits in place: caret at the end, 1 px chrome, no handles', () => {
    const focus = vi.spyOn(HTMLTextAreaElement.prototype, 'focus')
    render(<ConnectedSpreadView spreadId="s1" />)
    fireEvent.doubleClick(frameButton())
    const box = theEditBox()
    expect(box.value).toBe('Hi')
    expect(document.activeElement).toBe(box)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(box.selectionStart).toBe(2)
    expect(box.placeholder).toBe('Type text')
    expect(box.getAttribute('spellcheck')).toBe('false')
    const px = (mm: number) => `${String(mm * SPREAD_PX_PER_MM)}px`
    expect(box.style).toMatchObject({
      left: px(10),
      top: px(10),
      width: px(60),
    })
    expect(box.style.fontSize).toBe(`${String(3.1 * SPREAD_PX_PER_MM)}px`)
    expect(frameButton().getAttribute('data-editing')).toBe('true')
    expect(screen.queryAllByTestId('sel-handle')).toHaveLength(0)
    expect(getFrameSource()).toEqual(at)
  })

  it('only the edited frame wears edit chrome; Shift+double-click and an empty photo never edit', () => {
    cleanup()
    load(label({ x: 10, y: 10, width: 60, height: 14 }), {
      ...label({ x: 10, y: 40, width: 60, height: 14 }),
      id: 'u',
    })
    render(<ConnectedSpreadView spreadId="s1" />)
    fireEvent.doubleClick(frameById('a'))
    fireEvent.doubleClick(frameById('t'), { shiftKey: true })
    expect(getTextEdit()).toBeNull()
    act(() => {
      startTextEdit(at)
    })
    expect(frameById('t').getAttribute('data-editing')).toBe('true')
    expect(frameById('u').hasAttribute('data-editing')).toBe(false)
    expect(frameById('a').hasAttribute('data-editing')).toBe(false)
  })

  it('Esc commits one "Edit text" step and keeps the frame selected', () => {
    const stop = installEditorKeys()
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
    stop()
  })

  it('⌘+Enter commits; Shift+Enter types; leaving the window keeps the edit', () => {
    render(<ConnectedSpreadView spreadId="s1" />)
    act(() => {
      startTextEdit(at)
    })
    const box = theEditBox()
    expect(fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })).toBe(true)
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    fireEvent.blur(box)
    expect(getTextEdit()).toMatchObject(at)
    fireEvent.input(box, { target: { value: 'Mac' } })
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true })
    expect(textFrame()?.content).toEqual({ type: 'static', text: 'Mac' })
    expect(getTextEdit()).toBeNull()
  })

  it('a restyle while editing re-fits the box', () => {
    render(<ConnectedSpreadView spreadId="s1" />)
    act(() => {
      startTextEdit(at)
    })
    const before = theEditBox().style.height
    act(() => {
      dispatchBookOp({ type: 'setTextStyle', ...at, styleId: 'title' })
    })
    expect(theEditBox().style.height).not.toBe(before)
  })

  it('growth stops at the paper bottom', () => {
    const paper = getBookStoreSnapshot().book.settings.trim.heightMm
    cleanup()
    load(label({ x: 10, y: paper - 20, width: 60, height: 14 }))
    render(<ConnectedSpreadView spreadId="s1" />)
    act(() => {
      startTextEdit(at)
    })
    restore = mockScrollHeight('.text-edit-box', 400 * SPREAD_PX_PER_MM)
    const box = theEditBox()
    fireEvent.input(box, { target: { value: 'long' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    const height = textFrame()?.rect.height ?? 0
    expect(height).toBeGreaterThan(14)
    expect(height).toBeLessThanOrEqual(20)
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
    const px = (mm: number) => `${String(mm * SPREAD_PX_PER_MM)}px`
    expect(chip.parentElement?.style).toMatchObject({
      left: px(10),
      top: px(10),
      width: px(60),
      height: px(14),
    })

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

  it('the chip goes inside under 18 px of paper below the frame', async () => {
    restore = mockScrollHeight('.spread-frame-text', 400)
    const paper = getBookStoreSnapshot().book.settings.trim.heightMm
    const { unmount } = render(<ConnectedSpreadView spreadId="s1" />)
    /** Move the frame `gapMm` above the paper bottom; the measured chip. */
    const place = async (gapMm: number) => {
      await act(async () => {
        dispatchBookOp({
          type: 'setFrameRect',
          spreadId: 's1',
          frameId: 't',
          rect: { x: 10, y: paper - 14 - gapMm, width: 60, height: 14 },
        })
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      return screen.queryByTestId('text-overflow-chip')
    }
    // 18 px of room (36 mm at 0.5 px/mm) still fits below.
    expect((await place(36))?.hasAttribute('data-inside')).toBe(false)
    expect((await place(20))?.getAttribute('data-inside')).toBe('true')

    // 1 px over the box still fits; the re-measure drops the chip.
    restore()
    restore = mockScrollHeight('.spread-frame-text', 1)
    expect(await place(30)).toBeNull()
    expect(isTextOverflowing('s1', 't')).toBe(false)

    restore()
    restore = mockScrollHeight('.spread-frame-text', 400)
    expect(await place(36)).not.toBeNull()
    unmount()
    expect(isTextOverflowing('s1', 't')).toBe(false)
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
    const own = document.createElement('button')
    own.dataset.frameId = 't'
    const field = document.createElement('input')
    document.body.append(other, own, field)
    try {
      expect(fireEvent.keyDown(document.body, { key: 'Enter' })).toBe(true)
      expect(getTextEdit()).toBeNull()

      setFrameSource({ spreadId: 's1', frameId: 'a' })
      fireEvent.keyDown(document.body, { key: 'Enter' })
      setFrameSource({ spreadId: 's1', frameId: 'gone' })
      fireEvent.keyDown(document.body, { key: 'Enter' })
      expect(getTextEdit()).toBeNull()

      setFrameSource(at)
      fireEvent.keyDown(document.body, { key: 'Enter', shiftKey: true })
      fireEvent.keyDown(document.body, { key: 'q' })
      fireEvent.keyDown(field, { key: 'Enter' })
      expect(fireEvent.keyDown(other, { key: 'Enter' })).toBe(true)
      expect(getTextEdit()).toBeNull()

      const handled = fireEvent.keyDown(document.body, { key: 'Enter' })
      expect(handled).toBe(false)
      expect(getTextEdit()).toMatchObject({ frameId: 't', addKey: undefined })

      resetTextEditForTests()
      expect(fireEvent.keyDown(own, { key: 'Enter' })).toBe(false)
      expect(getTextEdit()).toMatchObject(at)
    } finally {
      stop()
      other.remove()
      own.remove()
      field.remove()
    }
  })
})

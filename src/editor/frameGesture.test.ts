import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import {
  getEditorTool,
  resetEditorToolForTests,
  setEditorTool,
} from './editorToolStore'
import { getFrameSource, resetFrameSelection } from './frameSelection'
import { installFrameGesture } from './frameGesture'

/** 300 × 300 mm spread laid out at 1 client px per mm. */
const SIZE = 300

function load(frames = [makeFrame({ id: 'a', rect: rect(100, 100, 50, 50) })]) {
  resetBookStore({
    book: makeBook({
      guides: [{ id: 'g', orientation: 'vertical', offsetMm: 200 }],
      spreads: [makeSpread({ templateId: 'one-per-page', frames })],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function rect(x: number, y: number, width: number, height: number) {
  return { x, y, width, height }
}

function frames() {
  return getBookStoreSnapshot().book.spreads[0]?.frames ?? []
}

function mount(): { spread: HTMLElement; buttons: HTMLElement[] } {
  const spread = document.createElement('div')
  spread.setAttribute('data-testid', 'spread-view')
  spread.setAttribute('data-spread-id', 'spread-1')
  spread.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: SIZE, height: SIZE }) as DOMRect
  const buttons = frames().map((frame) => {
    const button = document.createElement('button')
    button.className = 'spread-frame'
    button.setAttribute('data-frame-id', frame.id)
    button.setAttribute('data-filled', frame.assetId ? 'true' : 'false')
    spread.append(button)
    return button
  })
  document.body.append(spread)
  return { spread, buttons }
}

function pointer(
  type: string,
  target: Element | Window,
  x: number,
  y: number,
  init: MouseEventInit = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
    ...init,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
}

describe('frameGesture · draw', () => {
  let stop: () => void
  let spread: HTMLElement

  beforeEach(() => {
    load()
    spread = mount().spread
    stop = installFrameGesture()
    setEditorTool('frame')
  })

  afterEach(() => {
    stop()
    spread.remove()
    resetEditorToolForTests()
    resetFrameSelection()
    resetBookStore()
  })

  function draw(
    from: [number, number],
    to: [number, number],
    init: MouseEventInit = {},
  ) {
    pointer('pointerdown', spread, ...from, init)
    pointer('pointermove', window, ...to, init)
    pointer('pointerup', window, ...to, init)
  }

  it('commits a frame, selects it and returns to Select', () => {
    draw([10, 10], [60, 40])
    const created = frames()[1]
    expect(created?.rect).toEqual(rect(10, 10, 50, 30))
    expect(getBookStoreSnapshot().book.spreads[0]?.templateId).toBeUndefined()
    expect(getFrameSource()).toEqual({
      spreadId: 'spread-1',
      frameId: created?.id,
    })
    expect(getEditorTool()).toBe('select')
    expect(spread.querySelector('.frame-draft')).toBeNull()
  })

  it('normalizes a drag toward the top-left and is one undo step', () => {
    draw([60, 40], [10, 10])
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 50, 30))
    undoBook()
    expect(frames()).toHaveLength(1)
  })

  it.each([
    [
      [10, 10],
      [14, 60],
    ],
    [
      [10, 10],
      [60, 14],
    ],
  ] as const)('commits nothing under 5 mm: %j → %j', (from, to) => {
    draw([...from], [...to])
    expect(frames()).toHaveLength(1)
    expect(getEditorTool()).toBe('frame')
    expect(getFrameSource()).toBeNull()
  })

  it('shows the draft while dragging and snap lines near a frame edge', () => {
    pointer('pointerdown', spread, 10, 10)
    pointer('pointermove', window, 97, 40)
    expect(spread.querySelector('.frame-draft')).not.toBeNull()
    const line = spread.querySelector('.snap-line')
    expect(line?.getAttribute('data-axis')).toBe('x')
    expect(line?.textContent).toBe('snap · frame edge')
    pointer('pointerup', window, 97, 40)
    // The corner snapped from 97 to the frame's left edge at 100.
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 90, 30))
    expect(spread.querySelector('.snap-line')).toBeNull()
  })

  it('Alt suppresses snapping: no line, raw rect', () => {
    pointer('pointerdown', spread, 10, 10, { altKey: true })
    pointer('pointermove', window, 97, 40, { altKey: true })
    expect(spread.querySelector('.snap-line')).toBeNull()
    pointer('pointerup', window, 97, 40, { altKey: true })
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 87, 30))
  })

  it('snaps to a guide', () => {
    pointer('pointerdown', spread, 160, 200)
    pointer('pointermove', window, 197, 260)
    expect(spread.querySelector('.snap-line')?.textContent).toBe('snap · guide')
    pointer('pointerup', window, 197, 260)
    expect(frames()[1]?.rect.width).toBe(40)
  })

  it('clamps to the spread', () => {
    draw([250, 250], [900, 900], { altKey: true })
    expect(frames()[1]?.rect).toEqual(rect(250, 250, 50, 50))
  })

  it('Escape cancels the draft', () => {
    pointer('pointerdown', spread, 10, 10)
    pointer('pointermove', window, 60, 60)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    pointer('pointerup', window, 60, 60)
    expect(frames()).toHaveLength(1)
    expect(spread.querySelector('.frame-draft')).toBeNull()
  })

  it('does not start on an existing frame or with the Select tool', () => {
    const onFrame = spread.querySelector('button')
    assert(onFrame !== null, 'expected a frame button')
    pointer('pointerdown', onFrame, 110, 110)
    pointer('pointermove', window, 200, 200)
    pointer('pointerup', window, 200, 200)
    expect(frames()).toHaveLength(1)
    setEditorTool('select')
    draw([10, 10], [80, 80])
    expect(frames()).toHaveLength(1)
  })

  it('ignores non-primary buttons', () => {
    draw([10, 10], [80, 80], { button: 2 })
    expect(frames()).toHaveLength(1)
  })

  it('swallows the click that follows a commit', () => {
    const onClick = vi.fn()
    spread.addEventListener('click', onClick)
    draw([10, 10], [80, 80])
    spread.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('frameGesture · move', () => {
  let stop: () => void
  let spread: HTMLElement
  let button: HTMLElement

  beforeEach(() => {
    load([
      makeFrame({ id: 'a', rect: rect(100, 100, 50, 50) }),
      makeFrame({ id: 'b', rect: rect(10, 10, 40, 40), z: 1 }),
    ])
    const mounted = mount()
    spread = mounted.spread
    const second = mounted.buttons[1]
    assert(second !== undefined, 'expected a second frame')
    button = second
    stop = installFrameGesture()
  })

  afterEach(() => {
    stop()
    spread.remove()
    resetFrameSelection()
    resetBookStore()
  })

  it('moves an empty frame, snapping to a neighbour, and keeps it selected', () => {
    pointer('pointerdown', button, 20, 20)
    pointer('pointermove', window, 20 + 98, 20 + 5)
    // b.right = 148 → snaps to a.right (150).
    expect(spread.querySelector('.snap-line')).not.toBeNull()
    pointer('pointerup', window, 20 + 98, 20 + 5)
    const moved = frames()[1]
    expect(moved?.rect.x).toBe(110)
    expect(moved?.rect.y).toBe(15)
    expect(getBookStoreSnapshot().book.spreads[0]?.templateId).toBeUndefined()
    expect(getFrameSource()).toEqual({ spreadId: 'spread-1', frameId: 'b' })
  })

  it('Alt moves without snapping', () => {
    pointer('pointerdown', button, 20, 20, { altKey: true })
    pointer('pointermove', window, 115, 25, { altKey: true })
    expect(spread.querySelector('.snap-line')).toBeNull()
    pointer('pointerup', window, 115, 25, { altKey: true })
    expect(frames()[1]?.rect.x).toBe(105)
  })

  it('a press below the slop is a click, not a move', () => {
    pointer('pointerdown', button, 20, 20)
    pointer('pointermove', window, 21, 21)
    pointer('pointerup', window, 21, 21)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
    expect(getFrameSource()).toBeNull()
  })

  it('leaves Space-drag to the pasteboard pan', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    pointer('pointerdown', button, 20, 20)
    pointer('pointermove', window, 90, 90)
    pointer('pointerup', window, 90, 90)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
    expect(getFrameSource()).toBeNull()
  })

  it('does not drag a filled frame (HTML drag swaps photos)', () => {
    button.setAttribute('data-filled', 'true')
    pointer('pointerdown', button, 20, 20)
    pointer('pointermove', window, 90, 90)
    pointer('pointerup', window, 90, 90)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
  })

  it('keeps the frame inside the spread', () => {
    pointer('pointerdown', button, 20, 20, { altKey: true })
    pointer('pointermove', window, 900, -900, { altKey: true })
    pointer('pointerup', window, 900, -900, { altKey: true })
    expect(frames()[1]?.rect).toEqual(rect(260, 0, 40, 40))
  })

  it('Escape restores the preview position', () => {
    pointer('pointerdown', button, 20, 20)
    pointer('pointermove', window, 90, 90)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(button.style.left).toBe('')
    expect(frames()[1]?.rect.x).toBe(10)
  })
})

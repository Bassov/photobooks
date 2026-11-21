import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { resetEditorToolForTests, setEditorTool } from './editorToolStore'
import { duplicateSelectedFrames, resetFrameClipboard } from './frameClipboard'
import { DUPLICATE_DRAG_STATUS } from './frameDuplicate'
import {
  getFrameSelection,
  resetFrameSelection,
  setFrameSelection,
  setFrameSource,
} from './frameSelection'
import { installFrameGesture } from './frameGesture'
import { setGuidesVisible } from './guidesView'

/** 300 × 300 mm spread laid out at 2 client px per mm, offset on the page. */
const SIZE_MM = 300
const SCALE = 2
const ORIGIN = { x: 40, y: 30 }
const ALT = { altKey: true }

function rect(x: number, y: number, width: number, height: number) {
  return { x, y, width, height }
}

function load() {
  resetBookStore({
    book: makeBook({
      // A vertical guide at 200 mm: the snap target of the latch tests.
      guides: [{ id: 'g', orientation: 'vertical', offsetMm: 200 }],
      spreads: [
        makeSpread({
          templateId: 'one-per-page',
          frames: [
            makeFrame({ id: 'a', rect: rect(100, 100, 50, 50) }),
            makeFrame({ id: 'b', rect: rect(20, 220, 30, 30), locked: true }),
          ],
        }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

const frames = () => getBookStoreSnapshot().book.spreads[0]?.frames ?? []
const frameRect = (id: string) => frames().find((f) => f.id === id)?.rect

function mount(): { spread: HTMLElement; buttons: HTMLElement[] } {
  const spread = document.createElement('div')
  spread.setAttribute('data-testid', 'spread-view')
  spread.setAttribute('data-spread-id', 'spread-1')
  spread.getBoundingClientRect = () =>
    ({
      left: ORIGIN.x,
      top: ORIGIN.y,
      width: SIZE_MM * SCALE,
      height: SIZE_MM * SCALE,
    }) as DOMRect
  const buttons = frames().map((frame) => {
    const button = document.createElement('button')
    button.className = 'spread-frame'
    button.setAttribute('data-testid', 'spread-frame')
    button.setAttribute('data-frame-id', frame.id)
    button.setAttribute('data-filled', 'true')
    button.setAttribute('aria-pressed', 'true')
    const handle = document.createElement('span')
    handle.setAttribute('data-handle', 'nw')
    button.append(handle)
    spread.append(button)
    return button
  })
  document.body.append(spread)
  return { spread, buttons }
}

/** Pointer event at a spread position given in mm. */
function pointer(
  type: string,
  target: Element | Window,
  xMm: number,
  yMm: number,
  init: MouseEventInit = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: ORIGIN.x + xMm * SCALE,
    clientY: ORIGIN.y + yMm * SCALE,
    ...init,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
  return event
}

const clones = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-testid="frame-duplicate-clone"]',
    ),
  )

describe('frameGesture · Alt-press duplicate (FC5)', () => {
  let stop: () => void
  let spread: HTMLElement
  let a: HTMLElement

  beforeEach(() => {
    load()
    const mounted = mount()
    spread = mounted.spread
    const first = mounted.buttons[0]
    assert(first !== undefined, 'expected a frame button')
    a = first
    stop = installFrameGesture()
  })

  afterEach(() => {
    stop()
    spread.remove()
    resetEditorToolForTests()
    resetFrameSelection()
    resetFrameClipboard()
    resetBookStore()
    setEditorStatus('')
    setGuidesVisible(true)
  })

  it('below the slop is a plain press: nothing is added or painted', () => {
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 111, 110, ALT)
    pointer('pointerup', window, 111, 110, ALT)
    expect(frames()).toHaveLength(2)
    expect(clones()).toHaveLength(0)
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('paints a ringed clone over the unchanged original, then adds one selected frame at the delta', () => {
    pointer('pointerdown', a, 110, 110, ALT)
    const down = pointer('dragstart', a, 110, 110)
    pointer('pointermove', window, 150, 140, ALT)
    const [clone, ...more] = clones()
    assert(clone !== undefined, 'expected a clone')
    expect(more).toHaveLength(0)
    expect(clone.style.opacity).toBe('0.85')
    expect(clone.style.boxShadow).toBe('0 0 0 2px var(--select)')
    expect(clone.style.transform).toBe('translate(80px, 60px)')
    expect(clone.hasAttribute('aria-pressed')).toBe(false)
    expect(clone.hasAttribute('data-frame-id')).toBe(false)
    expect(clone.querySelector('[data-handle]')).toBeNull()
    expect(clone.getAttribute('aria-hidden')).toBe('true')
    expect(clone.tabIndex).toBe(-1)
    expect(a.style.transform).toBe('')
    expect(spread.hasAttribute('data-alt-duplicating')).toBe(true)
    expect(getEditorStatus()).toBe(DUPLICATE_DRAG_STATUS)
    expect(down.defaultPrevented).toBe(true)

    pointer('pointerup', window, 150, 140, ALT)
    expect(clones()).toHaveLength(0)
    expect(spread.hasAttribute('data-alt-duplicating')).toBe(false)
    expect(getEditorStatus()).toBe('')
    expect(frames()).toHaveLength(3)
    const added = frames()[2]
    expect(added?.rect).toEqual(rect(140, 130, 50, 50))
    expect(frameRect('a')).toEqual(rect(100, 100, 50, 50))
    expect(getFrameSelection()).toEqual({
      spreadId: 'spread-1',
      frameIds: [added?.id],
    })
    expect(getHistorySnapshot().undoLabel).toBe('Duplicate frame')
    // the release must not click through and reselect the original
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    a.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    undoBook()
    expect(frames()).toHaveLength(2)
  })

  it('starts at the 3 px slop and paints one clone set however often it moves', () => {
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 111.5, 110, ALT)
    expect(clones()).toHaveLength(1)
    pointer('pointermove', window, 120, 110, ALT)
    pointer('pointermove', window, 130, 110, ALT)
    expect(clones()).toHaveLength(1)
    pointer('pointerup', window, 130, 110, ALT)
  })

  it('shows snap lines while the copy snaps', () => {
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 159, 110, ALT)
    expect(spread.querySelectorAll('.snap-line').length).toBeGreaterThan(0)
    pointer('pointerup', window, 159, 110, ALT)
    expect(spread.querySelectorAll('.snap-line')).toHaveLength(0)
  })

  it('translates the clones in the frames’ own layout px, before the camera scale', () => {
    // laid out 300 px wide (1 px per mm), shown at 2 client px per mm
    Object.defineProperty(spread, 'offsetWidth', { value: SIZE_MM })
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 150, 140, ALT)
    expect(clones()[0]?.style.transform).toBe('translate(40px, 30px)')
    pointer('pointerup', window, 150, 140, ALT)
  })

  it('keeps a status set by someone else mid-drag', () => {
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 150, 140, ALT)
    setEditorStatus('Other')
    pointer('pointerup', window, 150, 140, ALT)
    expect(getEditorStatus()).toBe('Other')
  })

  it('Ctrl or ⌘ with Alt at the press starts no duplicate', () => {
    for (const init of [
      { altKey: true, ctrlKey: true },
      { altKey: true, metaKey: true },
    ]) {
      pointer('pointerdown', a, 110, 110, init)
      pointer('pointermove', window, 150, 140, init)
      expect(clones()).toHaveLength(0)
      pointer('pointerup', window, 150, 140, init)
    }
    expect(frames()).toHaveLength(2)
  })

  it('a button without a frame id or a Masters parent starts no duplicate', () => {
    a.removeAttribute('data-frame-id')
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 150, 140, ALT)
    expect(clones()).toHaveLength(0)
    pointer('pointerup', window, 150, 140, ALT)
    a.setAttribute('data-frame-id', 'a')
    // A parent edits like a spread (Masters canvas) but is not an interior spread.
    const { book } = getBookStoreSnapshot()
    resetBookStore({
      book: {
        ...book,
        parents: [{ id: 'p1', name: 'A', frames: [...frames()], guides: [] }],
      },
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    spread.setAttribute('data-spread-id', 'p1')
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 150, 140, ALT)
    expect(clones()).toHaveLength(0)
    pointer('pointerup', window, 150, 140, ALT)
  })

  it('a following Ctrl+D repeats the drag offset (D8)', () => {
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 150, 140, ALT)
    pointer('pointerup', window, 150, 140, ALT)
    expect(duplicateSelectedFrames()).toBe(true)
    expect(frames()[3]?.rect).toEqual(rect(180, 160, 50, 50))
  })

  it('a press on a member duplicates the whole selection, locked frames too', () => {
    setFrameSelection({ spreadId: 'spread-1', frameIds: ['a', 'b'] })
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 120, 90, ALT)
    expect(clones()).toHaveLength(2)
    pointer('pointerup', window, 120, 90, ALT)
    expect(frames()).toHaveLength(4)
    expect(
      frames()
        .slice(2)
        .map((f) => f.rect),
    ).toEqual([rect(110, 80, 50, 50), rect(30, 200, 30, 30)])
    expect(getFrameSelection()?.frameIds).toHaveLength(2)
    expect(getHistorySnapshot().undoLabel).toBe('Duplicate 2 frames')
  })

  it('a press on an unselected frame duplicates only that frame', () => {
    setFrameSource({ spreadId: 'spread-1', frameId: 'b' })
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 150, 140, ALT)
    pointer('pointerup', window, 150, 140, ALT)
    expect(frames()).toHaveLength(3)
    expect(frames()[2]?.rect).toEqual(rect(140, 130, 50, 50))
  })

  it('Shift locks the dominant axis', () => {
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 150, 120, { altKey: true, shiftKey: true })
    pointer('pointerup', window, 150, 120, { altKey: true, shiftKey: true })
    expect(frames()[2]?.rect).toEqual(rect(140, 100, 50, 50))
    // a tie keeps the horizontal travel
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 140, 140, { altKey: true, shiftKey: true })
    pointer('pointerup', window, 140, 140, { altKey: true, shiftKey: true })
    expect(frames()[3]?.rect.y).toBe(100)
  })

  it('Esc drops the clones and adds nothing; the release does not click through', () => {
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 150, 140, ALT)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    expect(clones()).toHaveLength(0)
    expect(spread.hasAttribute('data-alt-duplicating')).toBe(false)
    pointer('pointerup', window, 150, 140, ALT)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    a.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(frames()).toHaveLength(2)
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('the press Alt keeps snapping: the copy snaps to the guide', () => {
    // Right edge 150 + 49 = 199 mm, 1 mm from the 200 mm guide.
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 159, 110, ALT)
    pointer('pointerup', window, 159, 110, ALT)
    expect(frames()[2]?.rect.x).toBe(150)
  })

  it('Alt released, then pressed again mid-drag bypasses snapping', () => {
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 130, 110)
    pointer('pointermove', window, 159, 110, ALT)
    pointer('pointerup', window, 159, 110, ALT)
    expect(frames()[2]?.rect.x).toBe(149)
  })

  it('a plain press (no Alt) still moves the frame without a copy', () => {
    a.setAttribute('data-filled', 'false')
    pointer('pointerdown', a, 110, 110)
    pointer('pointermove', window, 150, 140)
    expect(clones()).toHaveLength(0)
    pointer('pointerup', window, 150, 140)
    expect(frames()).toHaveLength(2)
    expect(frameRect('a')).toEqual(rect(140, 130, 50, 50))
  })

  it('an Alt press on a handle, on bare paper or with another tool starts no duplicate', () => {
    const handle = a.querySelector('[data-handle]')
    assert(handle !== null, 'expected a handle')
    for (const target of [handle, spread]) {
      pointer('pointerdown', target, 110, 110, ALT)
      pointer('pointermove', window, 150, 140, ALT)
      expect(clones()).toHaveLength(0)
      pointer('pointerup', window, 150, 140, ALT)
    }
    setEditorTool('hand')
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 150, 140, ALT)
    pointer('pointerup', window, 150, 140, ALT)
    expect(frames()).toHaveLength(2)
  })

  it('an Alt press off the interior spreads keeps today’s press', () => {
    spread.setAttribute('data-spread-id', 'cover')
    pointer('pointerdown', a, 110, 110, ALT)
    pointer('pointermove', window, 150, 140, ALT)
    pointer('pointerup', window, 150, 140, ALT)
    expect(clones()).toHaveLength(0)
    expect(frames()).toHaveLength(2)
  })

  it('marks the workspace while Alt is held (copy cursor)', () => {
    // no workspace mounted: Alt does nothing
    expect(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }))
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }))
    }).not.toThrow()
    const workspace = document.createElement('div')
    workspace.className = 'editor-workspace'
    document.body.append(workspace)
    const key = (type: string, k: string) =>
      window.dispatchEvent(new KeyboardEvent(type, { key: k }))
    key('keydown', 'Shift')
    expect(workspace.hasAttribute('data-alt-duplicate')).toBe(false)
    key('keydown', 'Alt')
    expect(workspace.getAttribute('data-alt-duplicate')).toBe('true')
    key('keyup', 'Shift')
    expect(workspace.hasAttribute('data-alt-duplicate')).toBe(true)
    key('keyup', 'Alt')
    expect(workspace.hasAttribute('data-alt-duplicate')).toBe(false)
    key('keydown', 'Alt')
    window.dispatchEvent(new Event('blur'))
    expect(workspace.hasAttribute('data-alt-duplicate')).toBe(false)
    key('keydown', 'Alt')
    stop()
    expect(workspace.hasAttribute('data-alt-duplicate')).toBe(false)
    stop = installFrameGesture()
    workspace.remove()
  })
})

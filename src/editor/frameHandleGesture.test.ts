import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { resetEditorToolForTests } from './editorToolStore'
import {
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import { installFrameHandleGesture } from './frameHandleGesture'

const SIZE_MM = 300
const SCALE = 2
const ORIGIN = { x: 40, y: 30 }

function load(extra: { locked?: true } = {}) {
  resetBookStore({
    book: makeBook({
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              id: 'a',
              rect: { x: 100, y: 100, width: 50, height: 50 },
              ...extra,
            }),
          ],
        }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function frame() {
  const found = getBookStoreSnapshot().book.spreads[0]?.frames[0]
  assert(found !== undefined, 'expected a frame')
  return found
}

function mount() {
  const spread = document.createElement('div')
  spread.setAttribute('data-testid', 'spread-view')
  spread.setAttribute(
    'data-spread-id',
    getBookStoreSnapshot().book.spreads[0]?.id ?? '',
  )
  spread.getBoundingClientRect = () =>
    ({
      left: ORIGIN.x,
      top: ORIGIN.y,
      width: SIZE_MM * SCALE,
      height: SIZE_MM * SCALE,
    }) as DOMRect
  const button = document.createElement('button')
  button.className = 'spread-frame'
  button.setAttribute('data-frame-id', 'a')
  const tag = document.createElement('span')
  tag.setAttribute('data-testid', 'frame-size-tag')
  button.append(tag)
  const handles = new Map<string, HTMLElement>()
  for (const id of ['nw', 'se', 'rotate']) {
    const el = document.createElement('span')
    el.setAttribute('data-handle', id)
    button.append(el)
    handles.set(id, el)
  }
  spread.append(button)
  const pasteboard = document.createElement('div')
  pasteboard.setAttribute('data-testid', 'pasteboard')
  pasteboard.append(spread)
  document.body.append(pasteboard)
  return { pasteboard, spread, button, handles }
}

const px = (mm: number, axis: 'x' | 'y') => ORIGIN[axis] + mm * SCALE

function fire(
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
    clientX: px(xMm, 'x'),
    clientY: px(yMm, 'y'),
    ...init,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
  return event
}

function key(k: string, init: KeyboardEventInit = {}) {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, ...init }),
  )
}

describe('frameHandleGesture', () => {
  let stop: () => void
  let dom: ReturnType<typeof mount>

  function setup(extra: { locked?: true } = {}) {
    load(extra)
    dom = mount()
    stop = installFrameHandleGesture()
    setFrameSource({
      spreadId: getBookStoreSnapshot().book.spreads[0]?.id ?? '',
      frameId: 'a',
    })
  }

  afterEach(() => {
    stop()
    dom.pasteboard.remove()
    resetFrameSelection()
    resetEditorToolForTests()
    setEditorStatus('')
    resetBookStore()
  })

  describe('unlocked', () => {
    beforeEach(() => {
      setup()
    })

    it('resizes by the se handle in one undo step and previews live', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 170, 160)
      expect(dom.button.style.width).not.toBe('')
      expect(
        dom.button.querySelector('[data-testid="frame-size-tag"]')?.textContent,
      ).toBe('70 × 60 mm')
      fire('pointerup', window, 170, 160)
      expect(frame().rect).toEqual({ x: 100, y: 100, width: 70, height: 60 })
      undoBook()
      expect(frame().rect.width).toBe(50)
    })

    it('stops a corner resize at 5 mm', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 0, 0)
      fire('pointerup', window, 0, 0)
      expect(frame().rect).toEqual({ x: 100, y: 100, width: 5, height: 5 })
    })

    it('rotates by the rotate handle, Shift snaps to 15°', () => {
      const rot = dom.handles.get('rotate')
      assert(rot !== undefined)
      // Centre (125,125); press due east, move to ~due south-east (sweep 40°).
      fire('pointerdown', rot, 225, 125)
      fire(
        'pointermove',
        window,
        125 + 100 * Math.cos(0.7),
        125 + 100 * Math.sin(0.7),
        { shiftKey: true },
      )
      fire('pointerup', window, 0, 0)
      expect(frame().rotationDeg).toBe(45)
    })

    it('a handle press without movement changes nothing', () => {
      const nw = dom.handles.get('nw')
      assert(nw !== undefined)
      fire('pointerdown', nw, 100, 100)
      fire('pointerup', window, 100, 100)
      expect(frame().rect.width).toBe(50)
    })

    it('Escape during a gesture restores the frame without an op', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 170, 170)
      key('Escape')
      fire('pointerup', window, 170, 170)
      expect(frame().rect.width).toBe(50)
    })

    it('arrow keys nudge 1 mm, Shift 10 mm', () => {
      key('ArrowRight')
      expect(frame().rect.x).toBe(101)
      key('ArrowDown', { shiftKey: true })
      expect(frame().rect.y).toBe(110)
    })

    it('arrow keys do nothing without a selection', () => {
      setFrameSource(null)
      key('ArrowRight')
      expect(frame().rect.x).toBe(100)
    })

    it('a click on bare pasteboard clears the selection', () => {
      dom.pasteboard.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(getFrameSource()).toBeNull()
    })

    it('a click on the frame keeps the selection', () => {
      dom.button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(getFrameSource()).not.toBeNull()
    })
  })

  describe('locked', () => {
    beforeEach(() => {
      setup({ locked: true })
    })

    it('a handle press reports the lock and changes nothing', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 170, 170)
      fire('pointerup', window, 170, 170)
      expect(frame().rect.width).toBe(50)
      expect(getEditorStatus()).toMatch(/locked/i)
    })

    it('arrow keys report the lock and do not move', () => {
      key('ArrowRight')
      expect(frame().rect.x).toBe(100)
      expect(getEditorStatus()).toMatch(/locked/i)
    })
  })
})

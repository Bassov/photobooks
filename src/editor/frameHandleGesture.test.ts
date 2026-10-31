import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MIN_FRAME_EDGE_MM, type Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { enterCropMode, exitCropMode, getCropTarget } from './cropMode'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import { resetEditorToolForTests, setEditorTool } from './editorToolStore'
import {
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
} from './frameSelection'
import { installFrameHandleGesture } from './frameHandleGesture'
import { setGridVisible, setSnapOn } from './gridView'
import { clearLiveGeometry, getLiveGeometry } from './liveGeometry'
import { getSnapHint, setSnapHint } from './snapHint'

const SIZE_MM = 300
const SCALE = 2
const ORIGIN = { x: 40, y: 30 }

interface FrameExtra {
  locked?: true
  rotationDeg?: number
  assetId?: string
}

function load(extra: FrameExtra = {}, neighbour?: Frame['rect']) {
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
            ...(neighbour === undefined
              ? []
              : [makeFrame({ id: 'n', rect: neighbour })]),
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
  const handles = new Map<string, HTMLElement>()
  for (const id of ['nw', 'se', 'rotate', 'bogus']) {
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
  pointerId = 1,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: px(xMm, 'x'),
    clientY: px(yMm, 'y'),
    ...init,
  })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  target.dispatchEvent(event)
  return event
}

function key(
  k: string,
  init: KeyboardEventInit = {},
  target: Element = document.body,
) {
  const event = new KeyboardEvent('keydown', {
    key: k,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

describe('frameHandleGesture', () => {
  let stop: () => void
  let dom: ReturnType<typeof mount>

  function setup(extra: FrameExtra = {}, neighbour?: Frame['rect']) {
    // Gesture maths assert raw pointer travel; snapping has its own suite.
    setSnapOn(false)
    load(extra, neighbour)
    dom = mount()
    stop = installFrameHandleGesture()
    setFrameSource({
      spreadId: getBookStoreSnapshot().book.spreads[0]?.id ?? '',
      frameId: 'a',
    })
  }

  afterEach(() => {
    stop()
    setSnapOn(true)
    dom.pasteboard.remove()
    resetFrameSelection()
    resetEditorToolForTests()
    setEditorStatus('')
    resetBookStore()
  })

  describe('snapping', () => {
    beforeEach(() => {
      setup()
      setSnapOn(true)
    })

    const dragSe = (init: MouseEventInit = {}) => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 147, 147, init)
      return se
    }
    const lines = () => dom.spread.querySelectorAll('.snap-line')

    it('pulls a dragged edge onto the page center and labels it', () => {
      dragSe()
      expect([...lines()].map((line) => line.textContent)).toEqual([
        'snap · center',
        'snap · center',
      ])
      fire('pointerup', window, 147, 147)
      expect(frame().rect).toMatchObject({ width: 50, height: 50 })
      expect(lines()).toHaveLength(0)
    })

    it('Alt leaves the pointer result and draws no line', () => {
      dragSe({ altKey: true })
      expect(lines()).toHaveLength(0)
    })

    it('snap off draws no line and keeps the raw rect', () => {
      setSnapOn(false)
      dragSe()
      expect(lines()).toHaveLength(0)
      fire('pointerup', window, 147, 147)
      expect(frame().rect.width).toBe(47)
    })

    describe('grid', () => {
      beforeEach(() => {
        setGridVisible(true)
      })

      afterEach(() => {
        setGridVisible(false)
        setSnapHint(null)
      })

      const dragNw = (toX: number, toY: number, init: MouseEventInit = {}) => {
        const nw = dom.handles.get('nw')
        assert(nw !== undefined)
        fire('pointerdown', nw, 100, 100)
        fire('pointermove', window, toX, toY, init)
      }

      it('snaps a resized edge to the column and labels it', () => {
        dragNw(20, 60)
        expect(getSnapHint()).toBe('snap · column 1')
        expect(dom.spread.querySelectorAll('.snap-line')).toHaveLength(1)
        fire('pointerup', window, 20, 60)
        expect(frame().rect).toMatchObject({ x: 15, width: 135 })
        expect(getSnapHint()).toBeNull()
      })

      it('snaps a resized edge to the row and labels it', () => {
        dragNw(60, 20)
        expect(getSnapHint()).toBe('snap · row 1')
        fire('pointerup', window, 60, 20)
        expect(frame().rect).toMatchObject({ y: 15, height: 135 })
      })

      it('hidden grid: no grid snap', () => {
        setGridVisible(false)
        dragNw(20, 60)
        expect(getSnapHint()).toBeNull()
        fire('pointerup', window, 20, 60)
        expect(frame().rect.x).toBe(20)
      })

      it('Alt: no grid snap', () => {
        dragNw(20, 60, { altKey: true })
        expect(getSnapHint()).toBeNull()
      })

      it('snap off: no grid snap', () => {
        setSnapOn(false)
        dragNw(20, 60)
        expect(getSnapHint()).toBeNull()
        expect(dom.spread.querySelectorAll('.snap-line')).toHaveLength(0)
      })

      it('clears the pill when the gesture is cancelled', () => {
        dragNw(20, 60)
        fire('pointercancel', window, 20, 60)
        expect(getSnapHint()).toBeNull()
      })
    })

    it('clears the lines when the gesture is cancelled', () => {
      dragSe()
      fire('pointercancel', window, 147, 147)
      expect(lines()).toHaveLength(0)
    })

    it('never snaps an edge past the minimum frame size', () => {
      stop()
      dom.pasteboard.remove()
      // A neighbour edge at 104 would pull the clamped right edge (105) to a 4 mm width.
      setup({}, { x: 102, y: 0, width: 2, height: 10 })
      setSnapOn(true)
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 104, 104)
      expect(lines()).toHaveLength(0)
      fire('pointerup', window, 104, 104)
      expect(frame().rect.width).toBe(MIN_FRAME_EDGE_MM)
    })

    function withNeighbour(neighbour: Frame['rect']) {
      stop()
      dom.pasteboard.remove()
      setup({}, neighbour)
      setSnapOn(true)
    }

    function drag(handle: string, fromMm: number, toX: number, toY: number) {
      const el = dom.handles.get(handle)
      assert(el !== undefined)
      fire('pointerdown', el, fromMm, fromMm)
      fire('pointermove', window, toX, toY)
      const count = lines().length
      fire('pointerup', window, toX, toY)
      return count
    }

    it('keeps the pull distance: an edge far from every anchor stays put', () => {
      withNeighbour({ x: 0, y: 0, width: 10, height: 10 })
      expect(drag('se', 150, 120, 120)).toBe(0)
      expect(frame().rect).toMatchObject({ width: 20, height: 20 })
    })

    it('snaps a nw drag: the near edges move, the far corner stays', () => {
      withNeighbour({ x: 90, y: 90, width: 5, height: 5 })
      drag('nw', 100, 97, 97)
      expect(frame().rect).toEqual({ x: 95, y: 95, width: 55, height: 55 })
    })

    it('allows a snap that lands exactly on the minimum width', () => {
      withNeighbour({ x: 50, y: 50, width: 55, height: 55 })
      drag('se', 150, 107, 150)
      expect(frame().rect.width).toBe(MIN_FRAME_EDGE_MM)
    })

    it('allows a snap that lands exactly on the minimum height', () => {
      withNeighbour({ x: 50, y: 50, width: 55, height: 55 })
      drag('se', 150, 150, 107)
      expect(frame().rect.height).toBe(MIN_FRAME_EDGE_MM)
    })

    it('refuses a snap that would shrink only the height below the minimum', () => {
      withNeighbour({ x: 0, y: 50, width: 10, height: 54 })
      expect(drag('se', 150, 150, 104)).toBe(0)
      expect(frame().rect.height).toBe(MIN_FRAME_EDGE_MM)
    })

    it('does not snap a rotated frame', () => {
      stop()
      dom.pasteboard.remove()
      setup({ rotationDeg: 30 })
      setSnapOn(true)
      dragSe()
      expect(lines()).toHaveLength(0)
    })
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
      // Owner design change (round 7, M52): the preview writes no size tag.
      expect(dom.button.textContent).toBe('')
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

  describe('press guards', () => {
    beforeEach(() => {
      setup()
    })

    function untouched(): boolean {
      return dom.button.style.width === '' && frame().rect.width === 50
    }

    it('ignores a press that is not the primary button', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      const down = fire('pointerdown', se, 150, 150, { button: 2 })
      fire('pointermove', window, 170, 170)
      fire('pointerup', window, 170, 170)
      expect(down.defaultPrevented).toBe(false)
      expect(frame().rect.width).toBe(50)
    })

    it('ignores a press off the handles', () => {
      const down = fire('pointerdown', dom.button, 130, 130)
      fire('pointermove', window, 170, 170)
      fire('pointerup', window, 170, 170)
      expect(down.defaultPrevented).toBe(false)
      expect(untouched()).toBe(true)
    })

    it('ignores an unknown handle id', () => {
      const bogus = dom.handles.get('bogus')
      assert(bogus !== undefined)
      const down = fire('pointerdown', bogus, 150, 150)
      fire('pointermove', window, 170, 170)
      fire('pointerup', window, 170, 170)
      expect(down.defaultPrevented).toBe(false)
      expect(untouched()).toBe(true)
    })

    it('ignores a handle outside a frame button', () => {
      const stray = document.createElement('span')
      stray.setAttribute('data-handle', 'se')
      dom.spread.append(stray)
      const down = fire('pointerdown', stray, 150, 150)
      expect(down.defaultPrevented).toBe(false)
    })

    it('ignores a handle whose frame is gone', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      dom.button.setAttribute('data-frame-id', 'missing')
      const down = fire('pointerdown', se, 150, 150)
      expect(down.defaultPrevented).toBe(false)
    })

    it('ignores a handle press while another tool is active', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      setEditorTool('frame')
      const down = fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 170, 170)
      fire('pointerup', window, 170, 170)
      expect(down.defaultPrevented).toBe(false)
      expect(frame().rect.width).toBe(50)
    })

    it('claims the press so the frame neither moves nor toggles', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      const down = fire('pointerdown', se, 150, 150)
      expect(down.defaultPrevented).toBe(true)
    })

    it('ignores a second press while a gesture runs', () => {
      const se = dom.handles.get('se')
      const nw = dom.handles.get('nw')
      assert(se !== undefined && nw !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointerdown', nw, 100, 100)
      fire('pointermove', window, 170, 170)
      fire('pointerup', window, 170, 170)
      expect(frame().rect).toEqual({ x: 100, y: 100, width: 70, height: 70 })
    })

    it('ignores moves and releases of another pointer', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 170, 170, {}, 2)
      expect(dom.button.style.width).toBe('')
      fire('pointermove', window, 160, 160)
      fire('pointerup', window, 160, 160, {}, 2)
      expect(frame().rect.width).toBe(50)
      fire('pointerup', window, 160, 160)
      expect(frame().rect.width).toBe(60)
    })

    it('stops listening once uninstalled', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      stop()
      const down = fire('pointerdown', se, 150, 150)
      expect(down.defaultPrevented).toBe(false)
      stop = installFrameHandleGesture()
    })

    it('drops a running gesture when uninstalled', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      stop()
      fire('pointermove', window, 170, 170)
      fire('pointerup', window, 170, 170)
      expect(dom.button.style.width).toBe('')
      expect(frame().rect.width).toBe(50)
      stop = installFrameHandleGesture()
    })
  })

  describe('gesture details', () => {
    beforeEach(() => {
      setup()
    })

    it('needs 2 px of travel before it starts', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 150.5, 150)
      expect(dom.button.style.width).toBe('')
      fire('pointermove', window, 151, 150)
      expect(dom.button.style.width).not.toBe('')
      fire('pointerup', window, 151, 150)
      expect(frame().rect.width).toBe(51)
    })

    it('measures the slop on both axes', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 150, 150.5)
      expect(dom.button.style.width).toBe('')
      fire('pointermove', window, 150, 151)
      expect(dom.button.style.width).not.toBe('')
    })

    it('Shift keeps the proportions', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 170, 155, { shiftKey: true })
      fire('pointerup', window, 170, 155, { shiftKey: true })
      expect(frame().rect).toEqual({ x: 100, y: 100, width: 70, height: 70 })
    })

    it('Alt resizes around the centre', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 160, 160, { altKey: true })
      fire('pointerup', window, 160, 160, { altKey: true })
      expect(frame().rect).toEqual({ x: 90, y: 90, width: 70, height: 70 })
    })

    it('resizes by the nw handle and keeps the far corner', () => {
      const nw = dom.handles.get('nw')
      assert(nw !== undefined)
      fire('pointerdown', nw, 100, 100)
      fire('pointermove', window, 90, 80)
      fire('pointerup', window, 90, 80)
      expect(frame().rect).toEqual({ x: 90, y: 80, width: 60, height: 70 })
    })

    it('rounds the committed rect to 0.1 mm', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 173.37, 161.14)
      fire('pointerup', window, 173.37, 161.14)
      expect(frame().rect).toEqual({
        x: 100,
        y: 100,
        width: 73.4,
        height: 61.1,
      })
    })

    it('hands the inline styles back to React after a resize', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      dom.button.style.left = '10%'
      dom.button.style.top = '20%'
      dom.button.style.width = '30%'
      dom.button.style.height = '40%'
      dom.button.style.transform = 'rotate(5deg)'
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 170, 170)
      expect(dom.button.style.width).not.toBe('30%')
      fire('pointerup', window, 170, 170)
      expect(dom.button.style.left).toBe('10%')
      expect(dom.button.style.top).toBe('20%')
      expect(dom.button.style.width).toBe('30%')
      expect(dom.button.style.height).toBe('40%')
      expect(dom.button.style.transform).toBe('rotate(5deg)')
    })

    it('previews the live rotation and restores it after', () => {
      const rot = dom.handles.get('rotate')
      assert(rot !== undefined)
      fire('pointerdown', rot, 225, 125)
      fire('pointermove', window, 125, 225)
      expect(dom.button.style.transform).toBe('rotate(90deg)')
      fire('pointerup', window, 125, 225)
      expect(dom.button.style.transform).toBe('')
      expect(frame().rotationDeg).toBe(90)
    })

    it('rounds the committed rotation to 0.1°', () => {
      const rot = dom.handles.get('rotate')
      assert(rot !== undefined)
      fire('pointerdown', rot, 225, 125)
      fire(
        'pointermove',
        window,
        125 + 100 * Math.cos(0.2),
        125 + 100 * Math.sin(0.2),
      )
      fire(
        'pointerup',
        window,
        125 + 100 * Math.cos(0.2),
        125 + 100 * Math.sin(0.2),
      )
      expect(frame().rotationDeg).toBe(11.5)
    })

    it('rotation follows a free sweep without Shift', () => {
      const rot = dom.handles.get('rotate')
      assert(rot !== undefined)
      fire('pointerdown', rot, 225, 125)
      fire(
        'pointermove',
        window,
        125 + 100 * Math.cos(0.7),
        125 + 100 * Math.sin(0.7),
      )
      fire('pointerup', window, 0, 0)
      expect(frame().rotationDeg).toBe(40.1)
    })

    it('Escape restores the styles', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      dom.button.style.width = '30%'
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 170, 170)
      expect(dom.button.style.width).not.toBe('30%')
      const seen = vi.fn()
      document.addEventListener('keydown', seen)
      key('Escape')
      document.removeEventListener('keydown', seen)
      expect(dom.button.style.width).toBe('30%')
      expect(seen).not.toHaveBeenCalled()
    })

    it('pointercancel restores a started gesture', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      dom.button.style.width = '30%'
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 170, 170)
      fire('pointercancel', window, 170, 170)
      expect(dom.button.style.width).toBe('30%')
      fire('pointerup', window, 170, 170)
      expect(frame().rect.width).toBe(50)
    })

    it('pointercancel before any movement leaves the styles alone', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      dom.button.style.width = '30%'
      fire('pointerdown', se, 150, 150)
      dom.button.style.width = '33%'
      fire('pointercancel', window, 150, 150)
      expect(dom.button.style.width).toBe('33%')
    })

    it('Escape with no gesture does not swallow the key', () => {
      const seen = vi.fn()
      document.addEventListener('keydown', seen)
      key('Escape')
      document.removeEventListener('keydown', seen)
      expect(seen).toHaveBeenCalledTimes(1)
    })

    it('a released handle press swallows exactly the next click', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 170, 170)
      fire('pointerup', window, 170, 170)
      const first = new MouseEvent('click', { bubbles: true, cancelable: true })
      dom.pasteboard.dispatchEvent(first)
      expect(first.defaultPrevented).toBe(true)
      expect(getFrameSource()).not.toBeNull()
      const second = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
      dom.pasteboard.dispatchEvent(second)
      expect(second.defaultPrevented).toBe(false)
      expect(getFrameSource()).toBeNull()
    })

    it('a press without movement still swallows the click', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointerup', window, 150, 150)
      const click = new MouseEvent('click', { bubbles: true, cancelable: true })
      dom.pasteboard.dispatchEvent(click)
      expect(click.defaultPrevented).toBe(true)
    })

    it('the swallowed click expires with the tick', () => {
      vi.useFakeTimers()
      try {
        const se = dom.handles.get('se')
        assert(se !== undefined)
        fire('pointerdown', se, 150, 150)
        fire('pointerup', window, 150, 150)
        vi.advanceTimersByTime(1)
        const click = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        })
        dom.pasteboard.dispatchEvent(click)
        expect(click.defaultPrevented).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('rotates from the frame rotation it already has', () => {
      stop()
      dom.pasteboard.remove()
      resetFrameSelection()
      setup({ rotationDeg: 30 })
      const rot = dom.handles.get('rotate')
      assert(rot !== undefined)
      fire('pointerdown', rot, 225, 125)
      fire('pointermove', window, 125, 225)
      fire('pointerup', window, 125, 225)
      expect(frame().rotationDeg).toBe(120)
    })

    it('resizes along the axes of a rotated frame', () => {
      stop()
      dom.pasteboard.remove()
      resetFrameSelection()
      setup({ rotationDeg: 90 })
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      fire('pointermove', window, 150, 160)
      fire('pointerup', window, 150, 160)
      expect(frame().rect.width).toBe(60)
      expect(frame().rect.height).toBe(50)
    })

    it('ignores a handle press while cropping', () => {
      stop()
      dom.pasteboard.remove()
      resetFrameSelection()
      setup({ assetId: 'asset-1' })
      enterCropMode(getBookStoreSnapshot().book.spreads[0]?.id ?? '', 'a')
      try {
        const se = dom.handles.get('se')
        assert(se !== undefined)
        const down = fire('pointerdown', se, 150, 150)
        expect(getCropTarget()).not.toBeNull()
        expect(down.defaultPrevented).toBe(false)
      } finally {
        exitCropMode()
      }
    })
  })

  describe('keyboard and click edges', () => {
    beforeEach(() => {
      setup()
    })

    it.each([
      ['ArrowLeft', 'x', 99],
      ['ArrowRight', 'x', 101],
      ['ArrowUp', 'y', 99],
      ['ArrowDown', 'y', 101],
    ] as const)('%s nudges 1 mm', (arrow, axis, expected) => {
      const event = key(arrow)
      expect(frame().rect[axis]).toBe(expected)
      expect(event.defaultPrevented).toBe(true)
    })

    it.each([
      ['ArrowLeft', 'x', 90],
      ['ArrowUp', 'y', 90],
    ] as const)('Shift+%s nudges 10 mm', (arrow, axis, expected) => {
      key(arrow, { shiftKey: true })
      expect(frame().rect[axis]).toBe(expected)
    })

    it('ignores other keys', () => {
      const event = key('a')
      expect(event.defaultPrevented).toBe(false)
      expect(frame().rect.x).toBe(100)
    })

    it.each([
      ['Ctrl', { ctrlKey: true }],
      ['Meta', { metaKey: true }],
      ['Alt', { altKey: true }],
    ] as const)('%s+arrow is not a nudge', (_name, init) => {
      const event = key('ArrowRight', init)
      expect(event.defaultPrevented).toBe(false)
      expect(frame().rect.x).toBe(100)
    })

    it('does not nudge while typing', () => {
      const input = document.createElement('input')
      dom.pasteboard.append(input)
      const event = key('ArrowRight', {}, input)
      expect(event.defaultPrevented).toBe(false)
      expect(frame().rect.x).toBe(100)
    })

    it('does not nudge from an unrelated focused element', () => {
      const event = key('ArrowRight', {}, dom.pasteboard)
      expect(event.defaultPrevented).toBe(false)
      expect(frame().rect.x).toBe(100)
    })

    it('nudges when the frame button has focus', () => {
      key('ArrowRight', {}, dom.button)
      expect(frame().rect.x).toBe(101)
    })

    it('does not nudge a selection that points at nothing', () => {
      setFrameSource({
        spreadId: getBookStoreSnapshot().book.spreads[0]?.id ?? '',
        frameId: 'ghost',
      })
      const event = key('ArrowRight')
      expect(event.defaultPrevented).toBe(false)
      expect(frame().rect.x).toBe(100)
    })

    it('does not nudge in the middle of a gesture', () => {
      const se = dom.handles.get('se')
      assert(se !== undefined)
      fire('pointerdown', se, 150, 150)
      key('ArrowRight')
      expect(frame().rect.x).toBe(100)
    })

    it('does not nudge while cropping', () => {
      stop()
      dom.pasteboard.remove()
      resetFrameSelection()
      setup({ assetId: 'asset-1' })
      enterCropMode(getBookStoreSnapshot().book.spreads[0]?.id ?? '', 'a')
      try {
        key('ArrowRight')
        expect(frame().rect.x).toBe(100)
      } finally {
        exitCropMode()
      }
    })

    it('a click on bare pasteboard also clears the status', () => {
      setEditorStatus('hello')
      dom.pasteboard.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(getEditorStatus()).toBe('')
    })

    it('a click on the frame leaves the status alone', () => {
      setEditorStatus('hello')
      dom.button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(getEditorStatus()).toBe('hello')
    })

    it('a click on a frame descendant keeps the selection', () => {
      const child = dom.handles.get('se')
      assert(child !== undefined)
      child.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(getFrameSource()).not.toBeNull()
    })

    it('a click outside the pasteboard keeps the selection', () => {
      const outside = document.createElement('div')
      document.body.append(outside)
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      outside.remove()
      expect(getFrameSource()).not.toBeNull()
    })

    it('a click with another tool active keeps the selection', () => {
      setEditorTool('frame')
      dom.pasteboard.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(getFrameSource()).not.toBeNull()
    })

    it('a click without a selection stays quiet', () => {
      setFrameSource(null)
      setEditorStatus('hello')
      dom.pasteboard.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(getEditorStatus()).toBe('hello')
    })

    it('a click in a text field keeps the selection', () => {
      const input = document.createElement('input')
      dom.pasteboard.append(input)
      input.dispatchEvent(new MouseEvent('click', { bubbles: true }))
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

describe('frameHandleGesture · live geometry', () => {
  let stop: () => void
  let dom: ReturnType<typeof mount>

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    setSnapOn(false)
    load({ rotationDeg: 30 })
    dom = mount()
    stop = installFrameHandleGesture()
    setFrameSource({
      spreadId: getBookStoreSnapshot().book.spreads[0]?.id ?? '',
      frameId: 'a',
    })
  })

  afterEach(() => {
    stop()
    setSnapOn(true)
    dom.pasteboard.remove()
    clearLiveGeometry()
    resetFrameSelection()
    resetEditorToolForTests()
    resetBookStore()
    vi.unstubAllGlobals()
  })

  it('mirrors a rotate drag and clears on release', () => {
    const rot = dom.handles.get('rotate')
    assert(rot !== undefined)
    fire('pointerdown', rot, 225, 125)
    fire('pointermove', window, 125, 225)
    const live = getLiveGeometry()
    expect(live?.frameId).toBe('a')
    expect(live?.rotationDeg).toBe(120)
    expect(live?.rect).toEqual(frame().rect)
    fire('pointerup', window, 125, 225)
    expect(getLiveGeometry()).toBeNull()
  })

  it('mirrors a resize drag and clears on Escape', () => {
    stop()
    dom.pasteboard.remove()
    resetFrameSelection()
    load()
    dom = mount()
    stop = installFrameHandleGesture()
    setFrameSource({
      spreadId: getBookStoreSnapshot().book.spreads[0]?.id ?? '',
      frameId: 'a',
    })
    const se = dom.handles.get('se')
    assert(se !== undefined)
    fire('pointerdown', se, 150, 150)
    fire('pointermove', window, 170, 170)
    expect(getLiveGeometry()?.rect.width).toBeGreaterThan(50)
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    expect(getLiveGeometry()).toBeNull()
  })
})

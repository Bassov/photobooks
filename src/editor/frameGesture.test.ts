import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { getEditorStatus, setEditorStatus } from './editorStatus'
import {
  getEditorTool,
  resetEditorToolForTests,
  setEditorTool,
} from './editorToolStore'
import {
  getFrameSelection,
  getFrameSource,
  resetFrameSelection,
  setFrameSource,
  toggleFrameSelection,
} from './frameSelection'
import { installFrameGesture } from './frameGesture'
import { setGridVisible, setSnapOn } from './gridView'
import { setGuidesVisible } from './guidesView'
import {
  clearLiveGeometry,
  getLiveGeometry,
  publishLiveGeometry,
} from './liveGeometry'
import { getSnapHint, setSnapHint } from './snapHint'

/** 300 × 300 mm spread laid out at 2 client px per mm, offset on the page. */
const SIZE_MM = 300
const SCALE = 2
const ORIGIN = { x: 40, y: 30 }

function rect(x: number, y: number, width: number, height: number) {
  return { x, y, width, height }
}

interface TestGuide {
  id: string
  orientation: 'horizontal' | 'vertical'
  offsetMm: number
}

/** `parentGuides` puts the spread on master `p1` carrying them (two-page mm). */
function load(
  frames = [makeFrame({ id: 'a', rect: rect(100, 100, 50, 50) })],
  spreadGuides: TestGuide[] = [],
  parentGuides: TestGuide[] = [],
) {
  const parented = parentGuides.length > 0
  resetBookStore({
    book: makeBook({
      guides: [{ id: 'g', orientation: 'vertical', offsetMm: 200 }],
      ...(parented
        ? {
            parents: [
              { id: 'p1', name: 'A', frames: [], guides: parentGuides },
            ],
          }
        : {}),
      spreads: [
        makeSpread({
          templateId: 'one-per-page',
          frames,
          ...(spreadGuides.length > 0 ? { guides: spreadGuides } : {}),
          ...(parented ? { parentId: 'p1' } : {}),
        }),
      ],
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function frames() {
  return getBookStoreSnapshot().book.spreads[0]?.frames ?? []
}

function mount(options: { id?: string; width?: number } = {}): {
  spread: HTMLElement
  buttons: HTMLElement[]
} {
  const { id = 'spread-1', width = SIZE_MM * SCALE } = options
  const spread = document.createElement('div')
  spread.setAttribute('data-testid', 'spread-view')
  spread.setAttribute('data-spread-id', id)
  spread.getBoundingClientRect = () =>
    ({
      left: ORIGIN.x,
      top: ORIGIN.y,
      width,
      height: SIZE_MM * SCALE,
    }) as DOMRect
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

const px = (mm: number, axis: 'x' | 'y') => ORIGIN[axis] + mm * SCALE

function fire(
  type: string,
  target: Element | Window,
  clientX: number,
  clientY: number,
  init: MouseEventInit = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX,
    clientY,
    ...init,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
  return event
}

/** A pointermove / pointerup from a second pointer, at a spread position in mm. */
function secondPointer(type: string, xMm: number, yMm: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: px(xMm, 'x'),
    clientY: px(yMm, 'y'),
  })
  Object.defineProperty(event, 'pointerId', { value: 2 })
  window.dispatchEvent(event)
}

/** Pointer event at a spread position given in mm. */
function pointer(
  type: string,
  target: Element | Window,
  xMm: number,
  yMm: number,
  init: MouseEventInit = {},
) {
  return fire(type, target, px(xMm, 'x'), px(yMm, 'y'), init)
}

const ALT = { altKey: true }

const escape = () =>
  new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })

describe('frameGesture · draw', () => {
  let stop: () => void
  let spread: HTMLElement
  let button: HTMLElement

  beforeEach(() => {
    load()
    const mounted = mount()
    spread = mounted.spread
    const first = mounted.buttons[0]
    assert(first !== undefined, 'expected a frame button')
    button = first
    stop = installFrameGesture()
    setEditorTool('frame')
  })

  afterEach(() => {
    stop()
    spread.remove()
    resetEditorToolForTests()
    resetFrameSelection()
    resetBookStore()
    setGuidesVisible(true)
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

  it('maps pointer px to mm through the spread origin and scale', () => {
    draw([10, 20], [70, 90], ALT)
    expect(frames()[1]?.rect).toEqual(rect(10, 20, 60, 70))
  })

  it('prevents the default action of the press that starts a draw', () => {
    const down = pointer('pointerdown', spread, 10, 10)
    expect(down.defaultPrevented).toBe(true)
    pointer('pointerup', window, 10, 10)
  })

  it('normalizes a drag toward the top-left and is one undo step', () => {
    draw([60, 40], [10, 10])
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 50, 30))
    undoBook()
    expect(frames()).toHaveLength(1)
  })

  it('commits at exactly 5 mm and refuses just under it on either edge', () => {
    draw([10, 10], [15, 15], ALT)
    expect(frames()).toHaveLength(2)
    setEditorTool('frame')
    draw([200, 200], [204.9, 260], ALT)
    draw([200, 200], [260, 204.9], ALT)
    expect(frames()).toHaveLength(2)
    expect(getEditorTool()).toBe('frame')
    expect(getFrameSource()).not.toBeNull()
  })

  it('a press and release without a move commits nothing', () => {
    pointer('pointerdown', spread, 10, 10)
    pointer('pointerup', window, 10, 10)
    expect(frames()).toHaveLength(1)
    expect(getEditorTool()).toBe('frame')
  })

  it('shows the draft box at the dragged rect while dragging', () => {
    pointer('pointerdown', spread, 30, 60, ALT)
    pointer('pointermove', window, 90, 150, ALT)
    const draft = spread.querySelector<HTMLElement>('.frame-draft')
    assert(draft !== null, 'expected a draft')
    expect(draft.getAttribute('data-testid')).toBe('frame-draft')
    expect(draft.getAttribute('aria-hidden')).toBe('true')
    expect(draft.dataset.sizeMm).toBe('60x90')
    expect(parseFloat(draft.style.left)).toBeCloseTo(10)
    expect(parseFloat(draft.style.top)).toBeCloseTo(20)
    expect(parseFloat(draft.style.width)).toBeCloseTo(20)
    expect(parseFloat(draft.style.height)).toBeCloseTo(30)
    expect(draft.style.left.endsWith('%')).toBe(true)
    pointer('pointerup', window, 90, 150, ALT)
  })

  it('snaps the corner, shows an x line and commits the snapped rect', () => {
    pointer('pointerdown', spread, 10, 10)
    pointer('pointermove', window, 97, 40)
    const line = spread.querySelector<HTMLElement>('.snap-line')
    assert(line !== null, 'expected a snap line')
    expect(line.getAttribute('data-axis')).toBe('x')
    expect(line.getAttribute('data-testid')).toBe('snap-line')
    expect(line.getAttribute('aria-hidden')).toBe('true')
    expect(parseFloat(line.style.left)).toBeCloseTo((100 / 300) * 100)
    expect(line.style.top).toBe('')
    expect(line.querySelector('.snap-line-label')?.textContent).toBe(
      'snap · frame',
    )
    pointer('pointerup', window, 97, 40)
    // The corner snapped from 97 to the frame's left edge at 100.
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 90, 30))
    expect(spread.querySelector('.snap-line')).toBeNull()
  })

  it('shows a y line positioned by top', () => {
    pointer('pointerdown', spread, 10, 10)
    pointer('pointermove', window, 40, 97)
    const line = spread.querySelector<HTMLElement>('.snap-line')
    assert(line !== null, 'expected a snap line')
    expect(line.getAttribute('data-axis')).toBe('y')
    expect(parseFloat(line.style.top)).toBeCloseTo((100 / 300) * 100)
    expect(line.style.left).toBe('')
    pointer('pointerup', window, 40, 97)
  })

  it('snaps the starting corner too', () => {
    pointer('pointerdown', spread, 97, 98)
    pointer('pointermove', window, 200, 250, ALT)
    pointer('pointerup', window, 200, 250, ALT)
    expect(frames()[1]?.rect).toEqual(rect(100, 100, 100, 150))
  })

  it('Alt suppresses snapping: no line, raw rect', () => {
    pointer('pointerdown', spread, 10, 10, ALT)
    pointer('pointermove', window, 97, 40, ALT)
    expect(spread.querySelector('.snap-line')).toBeNull()
    pointer('pointerup', window, 97, 40, ALT)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 87, 30))
  })

  it('snaps to a book guide', () => {
    pointer('pointerdown', spread, 160, 200)
    pointer('pointermove', window, 197, 260)
    expect(spread.querySelector('.snap-line-label')?.textContent).toBe(
      'snap · guide',
    )
    pointer('pointerup', window, 197, 260)
    expect(frames()[1]?.rect.width).toBe(40)
  })

  it('clamps to the spread', () => {
    draw([250, 250], [900, 900], ALT)
    expect(frames()[1]?.rect).toEqual(rect(250, 250, 50, 50))
    setEditorTool('frame')
    draw([-50, -50], [20, 20], ALT)
    expect(frames()[2]?.rect).toEqual(rect(0, 0, 20, 20))
  })

  it('Escape cancels the draft and does not reach document key handlers', () => {
    const onDocumentKey = vi.fn()
    document.addEventListener('keydown', onDocumentKey)
    pointer('pointerdown', spread, 10, 10)
    pointer('pointermove', window, 60, 60)
    document.body.dispatchEvent(escape())
    document.removeEventListener('keydown', onDocumentKey)
    expect(onDocumentKey).not.toHaveBeenCalled()
    pointer('pointerup', window, 60, 60)
    expect(frames()).toHaveLength(1)
    expect(spread.querySelector('.frame-draft')).toBeNull()
  })

  it('Escape without a gesture is left alone', () => {
    const onDocumentKey = vi.fn()
    document.addEventListener('keydown', onDocumentKey)
    document.body.dispatchEvent(escape())
    document.removeEventListener('keydown', onDocumentKey)
    expect(onDocumentKey).toHaveBeenCalledOnce()
  })

  it('follows only the pointer that started the draw', () => {
    pointer('pointerdown', spread, 10, 10, ALT)
    pointer('pointermove', window, 60, 60, ALT)
    secondPointer('pointermove', 200, 200)
    secondPointer('pointerup', 200, 200)
    expect(frames()).toHaveLength(1)
    pointer('pointerup', window, 60, 60, ALT)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 50, 50))
  })

  it('pointercancel drops the draft', () => {
    pointer('pointerdown', spread, 10, 10)
    pointer('pointermove', window, 60, 60)
    pointer('pointercancel', window, 60, 60)
    expect(spread.querySelector('.frame-draft')).toBeNull()
    pointer('pointerup', window, 60, 60)
    expect(frames()).toHaveLength(1)
  })

  it('stops listening once the gesture ends', () => {
    const removed = vi.spyOn(window, 'removeEventListener')
    draw([10, 10], [60, 60])
    const types = removed.mock.calls.map(([type]) => type)
    removed.mockRestore()
    expect(types).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']),
    )
  })

  it('draws through the selection handles of a frame', () => {
    const handle = document.createElement('span')
    handle.setAttribute('data-handle', 'se')
    button.append(handle)
    pointer('pointerdown', handle, 110, 110)
    pointer('pointermove', window, 200, 200)
    pointer('pointerup', window, 200, 200)
    expect(frames()).toHaveLength(2)
  })

  it('does not start on an existing frame or with another tool', () => {
    pointer('pointerdown', button, 110, 110)
    pointer('pointermove', window, 200, 200)
    pointer('pointerup', window, 200, 200)
    expect(frames()).toHaveLength(1)
    for (const tool of ['select', 'text', 'hand'] as const) {
      setEditorTool(tool)
      draw([10, 10], [80, 80])
    }
    expect(frames()).toHaveLength(1)
  })

  it('ignores non-primary buttons, typing targets and a second pointer', () => {
    draw([10, 10], [80, 80], { button: 2 })
    expect(frames()).toHaveLength(1)

    const input = document.createElement('input')
    spread.append(input)
    pointer('pointerdown', input, 10, 10)
    pointer('pointerup', window, 10, 10)
    expect(spread.querySelector('.frame-draft')).toBeNull()

    pointer('pointerdown', spread, 10, 10)
    pointer('pointerdown', spread, 120, 120)
    pointer('pointermove', window, 60, 60)
    expect(spread.querySelectorAll('.frame-draft')).toHaveLength(1)
    pointer('pointerup', window, 60, 60)
    expect(frames()).toHaveLength(2)
  })

  it('ignores a spread without layout and an unknown spread id', () => {
    spread.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 0, height: 600 }) as DOMRect
    draw([10, 10], [80, 80])
    spread.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 600, height: 0 }) as DOMRect
    draw([10, 10], [80, 80])
    spread.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 600, height: 600 }) as DOMRect
    spread.setAttribute('data-spread-id', 'ghost')
    draw([10, 10], [80, 80])
    expect(frames()).toHaveLength(1)
    expect(spread.querySelector('.frame-draft')).toBeNull()
  })

  it('draws on the spread under the pointer when the book has several', () => {
    resetBookStore({
      book: makeBook({
        spreads: [
          makeSpread({ id: 'spread-1', frames: [] }),
          makeSpread({ id: 'spread-2', frames: [] }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    const second = mount({ id: 'spread-2' })
    draw([10, 10], [60, 60])
    // `draw` presses on the first spread; press on the second explicitly.
    setEditorTool('frame')
    pointer('pointerdown', second.spread, 20, 20)
    pointer('pointermove', window, 70, 70)
    pointer('pointerup', window, 70, 70)
    const spreads = getBookStoreSnapshot().book.spreads
    expect(spreads[0]?.frames).toHaveLength(1)
    expect(spreads[1]?.frames).toHaveLength(1)
    expect(getFrameSource()?.spreadId).toBe('spread-2')
    second.spread.remove()
  })

  it('snaps to a guide that lives on the spread', () => {
    stop()
    spread.remove()
    load([], [{ id: 'sg', orientation: 'horizontal', offsetMm: 120 }])
    spread = mount().spread
    stop = installFrameGesture()
    setEditorTool('frame')
    pointer('pointerdown', spread, 10, 10, ALT)
    pointer('pointermove', window, 60, 117)
    expect(spread.querySelector('.snap-line-label')?.textContent).toBe(
      'snap · guide',
    )
    pointer('pointerup', window, 60, 117)
    expect(frames()[0]?.rect.height).toBe(110)
  })

  function reload(spreadGuides: TestGuide[], parentGuides: TestGuide[]) {
    stop()
    spread.remove()
    load([], spreadGuides, parentGuides)
    spread = mount().spread
    stop = installFrameGesture()
    setEditorTool('frame')
  }

  it('snaps to the parent guides the spread shows, verticals on its page', () => {
    // The lone spread is the first single (right) page: 360 mm shows at 60.
    reload(
      [],
      [
        { id: 'ph', orientation: 'horizontal', offsetMm: 120 },
        { id: 'pv', orientation: 'vertical', offsetMm: 360 },
      ],
    )
    pointer('pointerdown', spread, 10, 10, ALT)
    pointer('pointermove', window, 57, 117)
    expect(
      [...spread.querySelectorAll('.snap-line-label')].map(
        (label) => label.textContent,
      ),
    ).toEqual(['snap · guide', 'snap · guide'])
    pointer('pointerup', window, 57, 117)
    expect(frames()[0]?.rect).toEqual(rect(10, 10, 50, 110))
  })

  it('hidden guides never snap: book, own or parent', () => {
    reload(
      [{ id: 'sg', orientation: 'horizontal', offsetMm: 120 }],
      [{ id: 'pv', orientation: 'vertical', offsetMm: 360 }],
    )
    setGuidesVisible(false)
    pointer('pointerdown', spread, 10, 10, ALT)
    pointer('pointermove', window, 197, 117)
    expect(spread.querySelector('.snap-line')).toBeNull()
    pointer('pointerup', window, 197, 117)
    expect(frames()[0]?.rect).toEqual(rect(10, 10, 187, 107))
    setEditorTool('frame')
    pointer('pointerdown', spread, 10, 150, ALT)
    pointer('pointermove', window, 57, 190)
    expect(spread.querySelector('.snap-line')).toBeNull()
    pointer('pointerup', window, 57, 190)
    expect(frames()[1]?.rect).toEqual(rect(10, 150, 47, 40))
  })

  it('swallows only the click that follows a commit', () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    spread.addEventListener('click', onClick)
    draw([10, 10], [80, 80])
    const first = new MouseEvent('click', { bubbles: true, cancelable: true })
    spread.dispatchEvent(first)
    expect(first.defaultPrevented).toBe(true)
    expect(onClick).not.toHaveBeenCalled()
    const second = new MouseEvent('click', { bubbles: true, cancelable: true })
    spread.dispatchEvent(second)
    expect(second.defaultPrevented).toBe(false)
    expect(onClick).toHaveBeenCalledOnce()

    draw([200, 200], [260, 260])
    vi.runAllTimers()
    spread.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('does not swallow a click when nothing was drawn', () => {
    const onClick = vi.fn()
    spread.addEventListener('click', onClick)
    draw([10, 10], [11, 11])
    spread.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('works when an ancestor stops pointerdown from bubbling', () => {
    document.body.addEventListener(
      'pointerdown',
      (event) => {
        event.stopPropagation()
      },
      { once: true },
    )
    draw([10, 10], [80, 80])
    expect(frames()).toHaveLength(2)
  })

  it('stands down for Space-drag and resumes after Space, blur or other keys', () => {
    const key = (type: 'keydown' | 'keyup', code: string) =>
      window.dispatchEvent(new KeyboardEvent(type, { code }))
    key('keydown', 'Space')
    draw([10, 10], [80, 80])
    expect(frames()).toHaveLength(1)
    key('keyup', 'Space')
    draw([10, 10], [80, 80])
    expect(frames()).toHaveLength(2)

    setEditorTool('frame')
    key('keydown', 'Space')
    window.dispatchEvent(new Event('blur'))
    draw([200, 10], [260, 80])
    expect(frames()).toHaveLength(3)

    setEditorTool('frame')
    key('keydown', 'KeyA')
    draw([200, 200], [260, 260])
    key('keyup', 'KeyA')
    expect(frames()).toHaveLength(4)
  })

  it('lets go of a half-drawn frame when uninstalled', () => {
    pointer('pointerdown', spread, 10, 10)
    pointer('pointermove', window, 60, 60)
    stop()
    expect(spread.querySelector('.frame-draft')).toBeNull()
    pointer('pointerup', window, 60, 60)
    expect(frames()).toHaveLength(1)
    // And a fresh press starts nothing any more.
    pointer('pointerdown', spread, 10, 10)
    expect(spread.querySelector('.frame-draft')).toBeNull()
    stop = installFrameGesture()
  })

  it('stands down while crop mode is active', async () => {
    const { enterCropMode, exitCropMode } = await import('./cropMode')
    resetBookStore({
      book: makeBook({
        assets: { x: {} },
        gallery: ['x'],
        spreads: [
          makeSpread({
            frames: [
              makeFrame({
                id: 'a',
                rect: rect(100, 100, 50, 50),
                assetId: 'x',
              }),
            ],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    enterCropMode('spread-1', 'a')
    draw([10, 10], [80, 80])
    exitCropMode()
    expect(frames()).toHaveLength(1)
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

  /** Press inside frame b (at its mm center) and drag by (dx, dy) mm. */
  function drag(dx: number, dy: number, init: MouseEventInit = {}) {
    pointer('pointerdown', button, 30, 30, init)
    pointer('pointermove', window, 30 + dx, 30 + dy, init)
    pointer('pointerup', window, 30 + dx, 30 + dy, init)
  }

  it('snaps the moved top edge onto a parent guide', () => {
    stop()
    spread.remove()
    load(
      [
        makeFrame({ id: 'a', rect: rect(100, 100, 50, 50) }),
        makeFrame({ id: 'b', rect: rect(10, 10, 40, 40), z: 1 }),
      ],
      [],
      [{ id: 'ph', orientation: 'horizontal', offsetMm: 120 }],
    )
    const mounted = mount()
    spread = mounted.spread
    const second = mounted.buttons[1]
    assert(second !== undefined, 'expected a second frame')
    button = second
    stop = installFrameGesture()
    drag(0, 107)
    expect(frames()[1]?.rect).toEqual(rect(10, 120, 40, 40))
  })

  it('moves an empty frame by the pointer travel in mm', () => {
    drag(40, 25, ALT)
    expect(frames()[1]?.rect).toEqual(rect(50, 35, 40, 40))
    expect(getBookStoreSnapshot().book.spreads[0]?.templateId).toBeUndefined()
  })

  it('never snaps back to its own start edges', () => {
    drag(2, 0)
    expect(frames()[1]?.rect.x).toBe(12)
  })

  describe('grid snap', () => {
    beforeEach(() => {
      setGridVisible(true)
      setSnapOn(true)
    })

    afterEach(() => {
      setGridVisible(false)
      setSnapOn(true)
      setSnapHint(null)
    })

    /** Press frame b, move it by (dx, dy) mm and stay mid-gesture. */
    function dragHold(dx: number, dy: number, init: MouseEventInit = {}) {
      pointer('pointerdown', button, 30, 30)
      pointer('pointermove', window, 30 + dx, 30 + dy, init)
    }

    it('snaps the left edge to the column edge with the column pill', () => {
      // left edge 10 + 10 = 20 -> column 1 at 15 (5 mm away)
      dragHold(10, 200)
      expect(getSnapHint()).toBe('snap · column 1')
      expect(button.style.left).toBe(`${String((15 / SIZE_MM) * 100)}%`)
      expect(spread.querySelectorAll('.snap-line[data-axis="x"]')).toHaveLength(
        1,
      )
      pointer('pointerup', window, 40, 230)
      expect(frames()[1]?.rect.x).toBe(15)
      expect(getSnapHint()).toBeNull()
    })

    it('snaps the top edge to the row edge with the row pill', () => {
      dragHold(200, 10)
      expect(getSnapHint()).toBe('snap · row 1')
      expect(button.style.top).toBe(`${String((15 / SIZE_MM) * 100)}%`)
      pointer('pointerup', window, 230, 40)
      expect(frames()[1]?.rect.y).toBe(15)
    })

    it('draws no inline label on the grid line (the pill carries it)', () => {
      dragHold(10, 200)
      expect(spread.querySelector('.snap-line')).not.toBeNull()
      expect(spread.querySelector('.snap-line-label')).toBeNull()
    })

    it('hidden grid: no grid snap and no pill', () => {
      setGridVisible(false)
      dragHold(10, 200)
      expect(getSnapHint()).toBeNull()
      expect(button.style.left).toBe(`${String((20 / SIZE_MM) * 100)}%`)
      pointer('pointerup', window, 40, 230)
    })

    it('Alt: no grid snap and no pill', () => {
      dragHold(10, 200, ALT)
      expect(getSnapHint()).toBeNull()
      pointer('pointerup', window, 40, 230, ALT)
      expect(frames()[1]?.rect.x).toBe(20)
    })

    it('snap off: no grid snap and no snap lines', () => {
      setSnapOn(false)
      dragHold(10, 200)
      expect(getSnapHint()).toBeNull()
      expect(spread.querySelectorAll('.snap-line')).toHaveLength(0)
      pointer('pointerup', window, 40, 230)
    })

    it('clears the pill when the gesture is cancelled', () => {
      dragHold(10, 200)
      expect(getSnapHint()).not.toBeNull()
      pointer('pointercancel', window, 40, 230)
      expect(getSnapHint()).toBeNull()
    })
  })

  it('leaves a selected filled frame to photo drag-and-drop (kit step 17)', () => {
    button.setAttribute('data-filled', 'true')
    button.setAttribute('aria-pressed', 'true')
    drag(40, 25, ALT)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
  })

  it('moves a selected empty frame by its body', () => {
    button.setAttribute('aria-pressed', 'true')
    drag(40, 25, ALT)
    expect(frames()[1]?.rect).toEqual(rect(50, 35, 40, 40))
  })

  it('leaves an unselected filled frame to photo drag-and-drop', () => {
    button.setAttribute('data-filled', 'true')
    drag(40, 25, ALT)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
  })

  it('a locked frame reports the lock and does not move', () => {
    load([
      makeFrame({ id: 'a', rect: rect(100, 100, 50, 50) }),
      makeFrame({ id: 'b', rect: rect(10, 10, 40, 40), z: 1, locked: true }),
    ])
    drag(40, 25, ALT)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
    expect(getEditorStatus()).toMatch(/locked/i)
  })

  it('an unlocked move stays quiet in the status line', () => {
    setEditorStatus('')
    drag(40, 25, ALT)
    expect(getEditorStatus()).toBe('')
  })

  it('a locked move reports once, never previews and commits nothing', () => {
    load([
      makeFrame({ id: 'a', rect: rect(100, 100, 50, 50) }),
      makeFrame({ id: 'b', rect: rect(10, 10, 40, 40), z: 1, locked: true }),
    ])
    const before = getBookStoreSnapshot().book
    pointer('pointerdown', button, 30, 30, ALT)
    pointer('pointermove', window, 50, 40, ALT)
    expect(getEditorStatus()).toMatch(/locked/i)
    expect(button.style.left).toBe('')
    setEditorStatus('')
    pointer('pointermove', window, 60, 50, ALT)
    expect(getEditorStatus()).toBe('')
    expect(button.style.left).toBe('')
    pointer('pointerup', window, 60, 50, ALT)
    expect(getBookStoreSnapshot().book).toBe(before)
    const onClick = vi.fn()
    spread.addEventListener('click', onClick)
    spread.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not move a frame by its selection handle', () => {
    const handle = document.createElement('span')
    handle.setAttribute('data-handle', 'se')
    button.append(handle)
    button.setAttribute('aria-pressed', 'true')
    pointer('pointerdown', handle, 30, 30, ALT)
    pointer('pointermove', window, 70, 55, ALT)
    pointer('pointerup', window, 70, 55, ALT)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
  })

  it('selects while dragging, snaps to a neighbour and keeps it selected', () => {
    pointer('pointerdown', button, 30, 30)
    pointer('pointermove', window, 30 + 98, 30 + 5)
    // b.right = 148 → snaps to a.right (150).
    expect(getFrameSource()).toEqual({ spreadId: 'spread-1', frameId: 'b' })
    const line = spread.querySelector('.snap-line')
    assert(line !== null, 'expected a snap line')
    expect(line.getAttribute('data-axis')).toBe('x')
    pointer('pointerup', window, 30 + 98, 30 + 5)
    expect(frames()[1]?.rect).toEqual(rect(110, 15, 40, 40))
    expect(getFrameSource()).toEqual({ spreadId: 'spread-1', frameId: 'b' })
    expect(spread.querySelector('.snap-line')).toBeNull()
  })

  it('snaps on y as well, away from the pointer-travel sign', () => {
    drag(60, 98)
    // b.bottom = 148 → a.bottom (150); b.left = 70 stays unsnapped.
    expect(frames()[1]?.rect.y).toBe(110)
    expect(frames()[1]?.rect.x).toBeCloseTo(70)
  })

  it('the preview left / top follow the pointer in percent', () => {
    pointer('pointerdown', button, 30, 30, ALT)
    pointer('pointermove', window, 30 + 60, 30 + 30, ALT)
    expect(parseFloat(button.style.left)).toBeCloseTo((70 / 300) * 100)
    expect(parseFloat(button.style.top)).toBeCloseTo((40 / 300) * 100)
    pointer('pointerup', window, 90, 60, ALT)
  })

  it('Alt moves without snapping', () => {
    pointer('pointerdown', button, 30, 30, ALT)
    pointer('pointermove', window, 30 + 98, 30 + 5, ALT)
    expect(spread.querySelector('.snap-line')).toBeNull()
    pointer('pointerup', window, 30 + 98, 30 + 5, ALT)
    expect(frames()[1]?.rect.x).toBe(108)
  })

  it('snap off moves without snapping', () => {
    setSnapOn(false)
    pointer('pointerdown', button, 30, 30)
    pointer('pointermove', window, 30 + 98, 30 + 5)
    expect(spread.querySelector('.snap-line')).toBeNull()
    pointer('pointerup', window, 30 + 98, 30 + 5)
    setSnapOn(true)
    expect(frames()[1]?.rect.x).toBe(108)
  })

  it('snaps the frame to the trim edge', () => {
    pointer('pointerdown', button, 30, 30)
    pointer('pointermove', window, 30 - 8, 30 + 60)
    expect(spread.querySelector('.snap-line-label')?.textContent).toBe(
      'snap · trim',
    )
    pointer('pointerup', window, 30 - 8, 30 + 60)
    expect(frames()[1]?.rect.x).toBe(0)
  })

  it('starts at the slop distance (3 px) and not before', () => {
    pointer('pointerdown', button, 30, 30, ALT)
    fire('pointermove', window, px(30, 'x') + 2, px(30, 'y'), ALT)
    expect(getFrameSource()).toBeNull()
    fire('pointerup', window, px(30, 'x') + 2, px(30, 'y'), ALT)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))

    pointer('pointerdown', button, 30, 30, ALT)
    fire('pointermove', window, px(30, 'x') + 3, px(30, 'y'), ALT)
    expect(getFrameSource()).not.toBeNull()
    fire('pointerup', window, px(30, 'x') + 3, px(30, 'y'), ALT)
    expect(frames()[1]?.rect.x).toBe(11.5)
  })

  it('a press below the slop is a click, not a move', () => {
    const onClick = vi.fn()
    spread.addEventListener('click', onClick)
    pointer('pointerdown', button, 30, 30)
    fire('pointermove', window, px(30, 'x') + 1, px(30, 'y') + 1)
    fire('pointerup', window, px(30, 'x') + 1, px(30, 'y') + 1)
    spread.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
    expect(getFrameSource()).toBeNull()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('swallows the click after a move', () => {
    const onClick = vi.fn()
    spread.addEventListener('click', onClick)
    drag(40, 25, ALT)
    spread.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not move with another tool', () => {
    setEditorTool('text')
    drag(40, 25, ALT)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
    resetEditorToolForTests()
  })

  it('leaves Space-drag to the pasteboard pan', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    drag(60, 60)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
    expect(getFrameSource()).toBeNull()
  })

  it('does not drag a filled frame (HTML drag swaps photos)', () => {
    button.setAttribute('data-filled', 'true')
    drag(60, 60)
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
  })

  it('keeps the frame inside the spread on every side', () => {
    drag(900, -900, ALT)
    expect(frames()[1]?.rect).toEqual(rect(260, 0, 40, 40))
    pointer('pointerdown', button, 280, 20, ALT)
    pointer('pointermove', window, -900, 900, ALT)
    pointer('pointerup', window, -900, 900, ALT)
    expect(frames()[1]?.rect).toEqual(rect(0, 260, 40, 40))
  })

  it('Escape and pointercancel restore the preview position', () => {
    pointer('pointerdown', button, 30, 30)
    pointer('pointermove', window, 90, 90)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(button.style.left).toBe('')
    expect(button.style.top).toBe('')
    expect(frames()[1]?.rect.x).toBe(10)

    pointer('pointerdown', button, 30, 30, ALT)
    pointer('pointermove', window, 90, 90, ALT)
    pointer('pointercancel', window, 90, 90, ALT)
    expect(button.style.left).toBe('')
    pointer('pointerup', window, 90, 90, ALT)
    expect(frames()[1]?.rect.x).toBe(10)
  })

  it('releasing the button after Escape does not click through', async () => {
    const onClick = vi.fn()
    document.addEventListener('click', onClick)
    pointer('pointerdown', button, 30, 30)
    pointer('pointermove', window, 90, 90)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    pointer('pointerup', window, 90, 90)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).not.toHaveBeenCalled()

    // Only that one release is swallowed; a later plain click goes through.
    await new Promise((resolve) => setTimeout(resolve, 5))
    pointer('pointerup', window, 90, 90)
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.removeEventListener('click', onClick)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('a press that never became a move leaves the inline style alone', () => {
    button.style.left = '12px'
    pointer('pointerdown', button, 30, 30)
    pointer('pointercancel', window, 30, 30)
    expect(button.style.left).toBe('12px')
  })

  it('follows only the pointer that started the move', () => {
    pointer('pointerdown', button, 30, 30, ALT)
    pointer('pointermove', window, 70, 55, ALT)
    secondPointer('pointermove', 200, 200)
    secondPointer('pointerup', 200, 200)
    expect(frames()[1]?.rect.x).toBe(10)
    pointer('pointerup', window, 70, 55, ALT)
    expect(frames()[1]?.rect).toEqual(rect(50, 35, 40, 40))
  })

  it('is one undo step', () => {
    drag(40, 25, ALT)
    undoBook()
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 40))
  })

  it('ignores a frame whose spread or book entry is gone', () => {
    spread.setAttribute('data-spread-id', 'ghost')
    drag(60, 60)
    spread.setAttribute('data-spread-id', 'spread-1')
    button.setAttribute('data-frame-id', 'ghost')
    drag(60, 60)
    expect(frames().map((f) => f.rect.x)).toEqual([100, 10])
  })
})

describe('frameGesture · live geometry', () => {
  let stop: () => void
  let spread: HTMLElement
  let button: HTMLElement

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    load([
      makeFrame({ id: 'a', rect: rect(100, 100, 50, 50) }),
      makeFrame({ id: 'b', rect: rect(10, 10, 40, 40), z: 1, rotationDeg: 30 }),
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
    clearLiveGeometry()
    resetFrameSelection()
    resetBookStore()
    vi.unstubAllGlobals()
  })

  it('mirrors the dragged frame to the inspector and clears on release', () => {
    pointer('pointerdown', button, 30, 30)
    pointer('pointermove', window, 70, 55, ALT)
    expect(getLiveGeometry()).toEqual({
      spreadId: 'spread-1',
      frameId: 'b',
      rect: rect(50, 35, 40, 40),
      rotationDeg: 30,
    })
    pointer('pointerup', window, 70, 55, ALT)
    expect(getLiveGeometry()).toBeNull()
  })

  it('clears the live values when a draw ends', () => {
    publishLiveGeometry({
      spreadId: 'spread-1',
      frameId: 'a',
      rect: rect(1, 1, 1, 1),
      rotationDeg: 0,
    })
    expect(getLiveGeometry()).not.toBeNull()
    setEditorTool('frame')
    pointer('pointerdown', spread, 200, 200)
    pointer('pointerup', window, 200, 200)
    expect(getLiveGeometry()).toBeNull()
    resetEditorToolForTests()
  })
})

describe('frameGesture · group move', () => {
  let stop: () => void
  let spread: HTMLElement
  let buttons: HTMLElement[]
  let box: HTMLElement
  const BOX_CSS = 'left: 1px; top: 2px; width: 3px; height: 4px;'

  /** a filled, b empty and turned 90°, c locked; d outside the set. */
  function setup(
    locked: readonly string[] = ['c'],
    picked: readonly string[] = ['a', 'b', 'c'],
    spreadGuides: Parameters<typeof load>[1] = [],
  ) {
    load(
      [
        makeFrame({ id: 'a', rect: rect(100, 100, 50, 50), assetId: 'p' }),
        makeFrame({
          id: 'b',
          rect: rect(10, 10, 40, 20),
          z: 1,
          rotationDeg: 90,
        }),
        makeFrame({ id: 'c', rect: rect(200, 50, 30, 30), z: 2 }),
        makeFrame({ id: 'd', rect: rect(250, 200, 20, 20), z: 3 }),
      ].map((frame) =>
        locked.includes(frame.id) ? { ...frame, locked: true } : frame,
      ),
      spreadGuides,
    )
    const mounted = mount()
    spread = mounted.spread
    buttons = mounted.buttons
    button(1).style.transform = 'rotate(90deg)'
    box = document.createElement('div')
    box.className = 'spread-group-box'
    box.style.cssText = BOX_CSS
    spread.append(box)
    setFrameSource(null)
    for (const frameId of picked) {
      toggleFrameSelection({ spreadId: 'spread-1', frameId })
    }
    stop = installFrameGesture()
  }

  function button(index: number): HTMLElement {
    const found = buttons[index]
    assert(found !== undefined, `expected frame ${String(index)}`)
    return found
  }

  afterEach(() => {
    stop()
    spread.remove()
    resetFrameSelection()
    resetBookStore()
    setEditorStatus('')
  })

  /** Press inside frame a (filled) and move by (dx, dy) mm, still pressed. */
  function press(dx: number, dy: number, init: MouseEventInit = {}) {
    pointer('pointerdown', button(0), 120, 120, init)
    pointer('pointermove', window, 120 + dx, 120 + dy, init)
  }

  it('moves every unlocked selected frame by one delta in one undo step', () => {
    setup()
    press(20, 15, ALT)
    pointer('pointerup', window, 140, 135, ALT)
    expect(frames().map((frame) => frame.rect)).toEqual([
      rect(120, 115, 50, 50),
      rect(30, 25, 40, 20),
      rect(200, 50, 30, 30),
      rect(250, 200, 20, 20),
    ])
    expect(getHistorySnapshot().undoLabel).toBe('Move 2 frames')
    expect(getFrameSelection()?.frameIds).toEqual(['a', 'b', 'c'])
    undoBook()
    expect(frames()[0]?.rect).toEqual(rect(100, 100, 50, 50))
    expect(frames()[1]?.rect).toEqual(rect(10, 10, 40, 20))
  })

  it('previews with one translate per moving frame and the group box, no commit', () => {
    setup()
    const before = getBookStoreSnapshot().book
    press(20, 15, ALT)
    expect(button(0).style.transform).toBe('translate(40px, 30px)')
    expect(button(1).style.transform).toBe(
      'translate(40px, 30px) rotate(90deg)',
    )
    expect(button(2).style.transform).toBe('')
    // Painted union: b turned spans x 20–40, y 0–40; c stays at 200–230.
    expect([
      box.style.left,
      box.style.top,
      box.style.width,
      box.style.height,
    ]).toEqual(['80px', '30px', '380px', '300px'])
    expect(getBookStoreSnapshot().book).toBe(before)

    pointer('pointerup', window, 140, 135, ALT)
    expect(button(0).style.transform).toBe('')
    expect(button(1).style.transform).toBe('rotate(90deg)')
    expect(box.style.cssText).toBe(BOX_CSS)
  })

  it('Escape puts every frame back, keeps the set and swallows the release', () => {
    setup()
    const onClick = vi.fn()
    document.addEventListener('click', onClick)
    press(20, 15, ALT)
    window.dispatchEvent(escape())
    expect(button(0).style.transform).toBe('')
    expect(button(1).style.transform).toBe('rotate(90deg)')
    expect(box.style.cssText).toBe(BOX_CSS)
    pointer('pointerup', window, 140, 135, ALT)
    button(0).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.removeEventListener('click', onClick)
    expect(onClick).not.toHaveBeenCalled()
    expect(frames()[0]?.rect).toEqual(rect(100, 100, 50, 50))
    expect(getFrameSelection()?.frameIds).toEqual(['a', 'b', 'c'])
  })

  it('pointercancel restores the preview and commits nothing', () => {
    setup()
    press(20, 15, ALT)
    pointer('pointercancel', window, 140, 135, ALT)
    expect(button(0).style.transform).toBe('')
    expect(frames()[0]?.rect).toEqual(rect(100, 100, 50, 50))
  })

  it('all locked: no preview, no op, the locked status', () => {
    setup(['a', 'b', 'c'])
    const before = getBookStoreSnapshot().book
    press(20, 15, ALT)
    expect(getEditorStatus()).toMatch(/locked/i)
    expect(button(0).style.transform).toBe('')
    pointer('pointerup', window, 140, 135, ALT)
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('Shift locks the dominant axis', () => {
    setup()
    press(20, 4, { altKey: true, shiftKey: true })
    pointer('pointerup', window, 140, 124, { altKey: true, shiftKey: true })
    expect(frames()[0]?.rect).toEqual(rect(120, 100, 50, 50))
    press(3, -8, { altKey: true, shiftKey: true })
    pointer('pointerup', window, 123, 112, { altKey: true, shiftKey: true })
    expect(frames()[0]?.rect).toEqual(rect(120, 92, 50, 50))
  })

  it('keeps the union of the moving frames inside the spread', () => {
    setup()
    press(-200, 500, ALT)
    pointer('pointerup', window, -80, 620, ALT)
    // Union x 10–150, y 10–150 on a 300 mm square spread.
    expect(frames()[0]?.rect).toEqual(rect(90, 250, 50, 50))
    expect(frames()[1]?.rect).toEqual(rect(0, 160, 40, 20))
  })

  it('snaps the union, with anchors that skip the selection', () => {
    setup()
    // Union right edge 150 + 48.5 lands next to the 200 mm guide.
    press(48.5, 0)
    pointer('pointerup', window, 168.5, 120)
    expect(frames()[0]?.rect.x).toBe(150)
  })

  it('a locked frame of the set stays a snap anchor', () => {
    setup()
    // Union top 10 + 38.5 lands next to locked c's top edge at 50.
    press(0, 38.5)
    expect(
      spread.querySelector('[data-axis="y"] .snap-line-label')?.textContent,
    ).toBe('snap · frame')
    pointer('pointerup', window, 120, 158.5)
    expect(frames()[1]?.rect.y).toBe(50)
    expect(frames()[2]?.rect).toEqual(rect(200, 50, 30, 30))
  })

  it('blocks the native drag of a filled frame while the set moves', () => {
    setup()
    // The frame's own drag handler stops the bubble: the block runs in capture.
    button(0).addEventListener('dragstart', (event) => {
      event.stopPropagation()
    })
    press(20, 15, ALT)
    const drag = new Event('dragstart', { bubbles: true, cancelable: true })
    button(0).dispatchEvent(drag)
    expect(drag.defaultPrevented).toBe(true)
    pointer('pointerup', window, 140, 135, ALT)
    const later = new Event('dragstart', { bubbles: true, cancelable: true })
    button(0).dispatchEvent(later)
    expect(later.defaultPrevented).toBe(false)
  })

  it('a frame outside the set moves alone; a set elsewhere moves nothing here', () => {
    setup()
    // d is empty: today's single move, the set stays put.
    pointer('pointerdown', button(3), 260, 210, ALT)
    pointer('pointermove', window, 280, 210, ALT)
    pointer('pointerup', window, 280, 210, ALT)
    expect(frames().map((frame) => frame.rect.x)).toEqual([100, 10, 200, 270])
    const before = getBookStoreSnapshot().book
    setFrameSource({ spreadId: 'spread-2', frameId: 'x' })
    toggleFrameSelection({ spreadId: 'spread-2', frameId: 'a' })
    press(20, 0, ALT)
    pointer('pointerup', window, 140, 120, ALT)
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  it('a press below the slop is a click, not a move', () => {
    setup()
    const onClick = vi.fn()
    document.addEventListener('click', onClick)
    press(0.5, 0, ALT)
    pointer('pointerup', window, 120.5, 120, ALT)
    button(0).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.removeEventListener('click', onClick)
    expect(onClick).toHaveBeenCalledOnce()
    expect(frames()[0]?.rect.x).toBe(100)
  })

  it('starts at the slop distance (3 px) and swallows the click after the move', () => {
    setup()
    const onClick = vi.fn()
    document.addEventListener('click', onClick)
    press(1.5, 0, ALT)
    pointer('pointerup', window, 121.5, 120, ALT)
    button(0).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.removeEventListener('click', onClick)
    expect(onClick).not.toHaveBeenCalled()
    expect(frames()[0]?.rect.x).toBe(101.5)
    expect(getEditorStatus()).toBe('')
  })

  it('a set of two moves too; one selected frame keeps its photo drag', () => {
    setup([], ['a', 'b'])
    press(20, 0, ALT)
    pointer('pointerup', window, 140, 120, ALT)
    expect(frames().map((frame) => frame.rect.x)).toEqual([120, 30, 200, 250])
    setFrameSource({ spreadId: 'spread-1', frameId: 'a' })
    const before = getBookStoreSnapshot().book
    press(20, 0, ALT)
    pointer('pointerup', window, 140, 120, ALT)
    expect(getBookStoreSnapshot().book).toBe(before)
    expect(button(0).style.transform).toBe('')
  })

  it('translates in the frames’ own layout px, before the camera scale', () => {
    setup()
    // 300 layout px over 300 mm (client box: 600 px).
    Object.defineProperty(spread, 'offsetWidth', { value: 300 })
    press(20, 15, ALT)
    expect(button(0).style.transform).toBe('translate(20px, 15px)')
    expect(box.style.left).toBe('40px')
  })

  it('moves without a group box element', () => {
    setup()
    box.remove()
    press(20, 15, ALT)
    expect(button(0).style.transform).toBe('translate(40px, 30px)')
    window.dispatchEvent(escape())
    expect(button(0).style.transform).toBe('')
    press(20, 15, ALT)
    pointer('pointerup', window, 140, 135, ALT)
    expect(frames()[0]?.rect.x).toBe(120)
  })

  it('reports the lock once per gesture', () => {
    setup(['a', 'b', 'c'])
    press(20, 15, ALT)
    setEditorStatus('')
    pointer('pointermove', window, 150, 140, ALT)
    expect(getEditorStatus()).toBe('')
  })

  it('stands down with the Frame tool, for a spread missing from the book and for a non-button frame', () => {
    setup()
    const before = getBookStoreSnapshot().book
    setEditorTool('frame')
    press(20, 15, ALT)
    pointer('pointerup', window, 140, 135, ALT)
    resetEditorToolForTests()
    expect(button(0).style.transform).toBe('')

    const stray = document.createElement('div')
    stray.className = 'spread-frame'
    stray.setAttribute('data-frame-id', 'a')
    spread.append(stray)
    pointer('pointerdown', stray, 120, 120, ALT)
    pointer('pointermove', window, 140, 120, ALT)
    pointer('pointerup', window, 140, 120, ALT)
    expect(button(0).style.transform).toBe('')

    spread.setAttribute('data-spread-id', 'gone')
    setFrameSource({ spreadId: 'gone', frameId: 'a' })
    toggleFrameSelection({ spreadId: 'gone', frameId: 'b' })
    press(20, 15, ALT)
    pointer('pointerup', window, 140, 135, ALT)
    expect(button(0).style.transform).toBe('')
    expect(getBookStoreSnapshot().book).toBe(before)
  })

  // A guide 2 mm off the union's top / left edge (both at 10 mm).
  it.each([
    ['y', 'horizontal', 20, 1, { x: 120, y: 100 }],
    ['x', 'vertical', 1, 20, { x: 100, y: 120 }],
  ] as const)(
    'Shift keeps snapping off the locked %s axis',
    (axis, orientation, dx, dy, at) => {
      setup(['c'], ['a', 'b', 'c'], [{ id: 'g', orientation, offsetMm: 12 }])
      press(dx, dy, { shiftKey: true })
      expect(spread.querySelector(`[data-axis="${axis}"]`)).toBeNull()
      pointer('pointerup', window, 120 + dx, 120 + dy, { shiftKey: true })
      expect(frames()[0]?.rect).toEqual(rect(at.x, at.y, 50, 50))
    },
  )

  it('snaps the union top onto a spread guide', () => {
    setup(
      ['c'],
      ['a', 'b', 'c'],
      [{ id: 'g', orientation: 'horizontal', offsetMm: 32 }],
    )
    press(0, 21.5)
    expect(spread.querySelector('[data-axis="y"]')).not.toBeNull()
    pointer('pointerup', window, 120, 141.5)
    expect(frames()[0]?.rect.y).toBe(122)
    expect(frames()[1]?.rect.y).toBe(32)
  })

  it('draws the snap line of the union', () => {
    setup()
    press(48.5, 0)
    expect(spread.querySelector('[data-axis="x"]')).not.toBeNull()
    pointer('pointerup', window, 168.5, 120)
    expect(spread.querySelector('[data-axis="x"]')).toBeNull()
  })
})

describe('frameGesture · marquee on the paper', () => {
  let stop: () => void
  let spread: HTMLElement

  /**
   * a plain, b 40×20 turned 90° (painted x 20..40, y 0..40), c locked, d far;
   * spread-1 follows parent p, whose full-page item never hits.
   */
  beforeEach(() => {
    resetBookStore({
      book: makeBook({
        parents: [
          {
            id: 'p',
            name: 'Master A',
            frames: [makeFrame({ id: 'pf', rect: rect(0, 0, 300, 300) })],
            guides: [],
          },
        ],
        spreads: [
          makeSpread({
            parentId: 'p',
            frames: [
              makeFrame({ id: 'a', rect: rect(100, 100, 50, 50) }),
              makeFrame({
                id: 'b',
                rect: rect(10, 10, 40, 20),
                rotationDeg: 90,
              }),
              makeFrame({ id: 'c', rect: rect(200, 50, 30, 30), locked: true }),
              makeFrame({ id: 'd', rect: rect(250, 200, 20, 20) }),
            ],
          }),
          makeSpread({
            id: 'spread-2',
            frames: [makeFrame({ id: 'z', rect: rect(0, 0, 300, 300) })],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
    spread = mount().spread
    // The parent item paints inert under the own frames: a press there is paper.
    const parentItem = document.createElement('div')
    parentItem.className = 'spread-frame'
    spread.prepend(parentItem)
    resetFrameSelection()
    stop = installFrameGesture()
  })

  afterEach(() => {
    stop()
    spread.remove()
    resetFrameSelection()
    resetBookStore()
    resetEditorToolForTests()
  })

  const marked = () =>
    Array.from(
      spread.querySelectorAll('[data-marquee-hit="true"]'),
      (el) => el.getAttribute('data-frame-id') ?? '',
    ).sort()
  const box = () => document.querySelector<HTMLElement>('.marquee-box')

  it('selects every own frame its box touches past 3 px, rotated by its painted box and locked ones too', () => {
    pointer('pointerdown', spread, 35, 35)
    pointer('pointermove', window, 36, 35)
    expect(box()).toBeNull()
    pointer('pointermove', window, 210, 120)
    // Live: outlines through the hit index, box in screen px; nothing selected yet.
    expect(marked()).toEqual(['a', 'b', 'c'])
    expect(box()?.style.cssText).toBe(
      'left: 110px; top: 100px; width: 350px; height: 170px;',
    )
    expect(box()?.getAttribute('data-testid')).toBe('marquee')
    expect(box()?.getAttribute('aria-hidden')).toBe('true')
    expect(getFrameSelection()).toBeNull()
    // Shallow: y 35..60 mm stops above a (from y 100).
    pointer('pointermove', window, 120, 60)
    expect(marked()).toEqual(['b'])
    // A hit that leaves and comes back is outlined again.
    pointer('pointermove', window, 210, 120)
    expect(marked()).toEqual(['a', 'b', 'c'])
    pointer('pointermove', window, 120, 120)
    expect(marked()).toEqual(['a', 'b'])
    pointer('pointerup', window, 120, 120)
    expect(getFrameSelection()).toEqual({
      spreadId: 'spread-1',
      frameIds: ['b', 'a'],
    })
    expect(box()).toBeNull()
    expect(marked()).toEqual([])
    // The release click does not land on the paper.
    const click = fire('click', spread, 0, 0)
    expect(click.defaultPrevented).toBe(true)
  })

  it('starts on a parent item and never hits it or another spread', () => {
    const parentItem = spread.querySelector('div.spread-frame')
    assert(parentItem !== null)
    pointer('pointerdown', parentItem, 1, 1)
    pointer('pointermove', window, 299, 299)
    pointer('pointerup', window, 299, 299)
    expect(getFrameSelection()?.frameIds).toEqual(['b', 'a', 'c', 'd'])
  })

  it('starts at exactly 3 px, and with Shift over no selection', () => {
    pointer('pointerdown', spread, 35, 35, { shiftKey: true })
    // 3 client px = 1.5 mm at 2 px / mm.
    pointer('pointermove', window, 36.5, 35)
    expect(box()).not.toBeNull()
    pointer('pointerup', window, 36.5, 35)
    expect(getFrameSelection()?.frameIds).toEqual(['b'])
  })

  it('selects a frame whose button is not mounted', () => {
    spread.querySelector('button[data-frame-id="c"]')?.remove()
    pointer('pointerdown', spread, 190, 40)
    pointer('pointermove', window, 210, 60)
    expect(marked()).toEqual([])
    pointer('pointermove', window, 290, 60)
    pointer('pointermove', window, 210, 60)
    pointer('pointerup', window, 210, 60)
    expect(getFrameSelection()?.frameIds).toEqual(['c'])
  })

  it('starts nothing (no listeners) off the paper or on a spread it cannot read', () => {
    const added = vi.spyOn(window, 'addEventListener')
    const outside = document.createElement('div')
    document.body.append(outside)
    pointer('pointerdown', outside, 35, 35)
    const unknown = document.createElement('div')
    unknown.setAttribute('data-testid', 'spread-view')
    unknown.setAttribute('data-spread-id', 'nope')
    unknown.getBoundingClientRect = () => new DOMRect(40, 30, 600, 600)
    document.body.append(unknown)
    pointer('pointerdown', unknown, 35, 35)
    spread.getBoundingClientRect = () => new DOMRect(40, 30, 0, 600)
    pointer('pointerdown', spread, 35, 35)
    // A filled-frame body press with Select is the photo drag's.
    const frame = spread.querySelector<HTMLElement>('button[data-frame-id="a"]')
    assert(frame !== null)
    frame.setAttribute('data-filled', 'true')
    pointer('pointerdown', frame, 120, 120)
    const types = added.mock.calls.map(([type]) => type)
    added.mockRestore()
    outside.remove()
    unknown.remove()
    expect(types).not.toContain('pointermove')
    pointer('pointermove', window, 120, 120)
    expect(box()).toBeNull()
  })

  it('leaves a press under 3 px to the click', () => {
    setFrameSource({ spreadId: 'spread-1', frameId: 'd' })
    pointer('pointerdown', spread, 35, 35)
    pointer('pointermove', window, 36, 36)
    pointer('pointerup', window, 36, 36)
    expect(box()).toBeNull()
    expect(getFrameSelection()?.frameIds).toEqual(['d'])
    expect(fire('click', spread, 0, 0).defaultPrevented).toBe(false)
  })

  it('a marquee over nothing clears the selection', () => {
    setFrameSource({ spreadId: 'spread-1', frameId: 'd' })
    pointer('pointerdown', spread, 160, 5)
    pointer('pointermove', window, 190, 40)
    pointer('pointerup', window, 190, 40)
    expect(getFrameSelection()).toBeNull()
  })

  it('Shift at the press unions with the set on that spread', () => {
    setFrameSource({ spreadId: 'spread-1', frameId: 'd' })
    pointer('pointerdown', spread, 35, 35, { shiftKey: true })
    pointer('pointermove', window, 120, 120)
    expect(marked()).toEqual(['a', 'b', 'd'])
    pointer('pointerup', window, 120, 120)
    expect(getFrameSelection()?.frameIds).toEqual(['d', 'b', 'a'])
  })

  it('Shift with the set on another spread selects the hits alone', () => {
    setFrameSource({ spreadId: 'spread-2', frameId: 'z' })
    pointer('pointerdown', spread, 35, 35, { shiftKey: true })
    pointer('pointermove', window, 120, 120)
    pointer('pointerup', window, 120, 120)
    expect(getFrameSelection()).toEqual({
      spreadId: 'spread-1',
      frameIds: ['b', 'a'],
    })
  })

  it('Esc and pointercancel restore the previous selection', () => {
    setFrameSource({ spreadId: 'spread-1', frameId: 'd' })
    pointer('pointerdown', spread, 35, 35)
    pointer('pointermove', window, 120, 120)
    setFrameSource(null)
    const key = escape()
    window.dispatchEvent(key)
    expect(getFrameSelection()?.frameIds).toEqual(['d'])
    expect(box()).toBeNull()
    expect(marked()).toEqual([])
    pointer('pointermove', window, 210, 120)
    pointer('pointerup', window, 210, 120)
    expect(getFrameSelection()?.frameIds).toEqual(['d'])
    expect(fire('click', spread, 0, 0).defaultPrevented).toBe(true)

    pointer('pointerdown', spread, 35, 35)
    pointer('pointermove', window, 120, 120)
    setFrameSource(null)
    pointer('pointercancel', window, 120, 120)
    expect(getFrameSelection()?.frameIds).toEqual(['d'])
    expect(box()).toBeNull()
  })

  it('cancels native drags and text selection while it runs', () => {
    const drag = new Event('dragstart', { bubbles: true, cancelable: true })
    const select = new Event('selectstart', { bubbles: true, cancelable: true })
    pointer('pointerdown', spread, 35, 35)
    spread.dispatchEvent(drag)
    // Capture: a target that stops the bubble cannot let the selection start.
    spread.addEventListener('selectstart', (event) => {
      event.stopPropagation()
    })
    spread.dispatchEvent(select)
    expect(drag.defaultPrevented).toBe(true)
    expect(select.defaultPrevented).toBe(true)
    pointer('pointerup', window, 35, 35)
    const later = new Event('selectstart', { bubbles: true, cancelable: true })
    spread.dispatchEvent(later)
    expect(later.defaultPrevented).toBe(false)
  })

  it('never starts on a frame, a guide, or with the Hand tool', () => {
    const guide = document.createElement('div')
    guide.className = 'guide-line'
    spread.append(guide)
    const frame = spread.querySelector('button[data-frame-id="d"]')
    assert(frame !== null)
    for (const target of [guide, frame]) {
      pointer('pointerdown', target, 35, 35)
      pointer('pointermove', window, 120, 120)
      expect(box()).toBeNull()
      pointer('pointerup', window, 120, 120)
    }
    // The empty frame moved instead and is selected.
    expect(getFrameSelection()?.frameIds).toEqual(['d'])
    setEditorTool('hand')
    pointer('pointerdown', spread, 35, 35)
    pointer('pointermove', window, 120, 120)
    expect(box()).toBeNull()
    pointer('pointerup', window, 120, 120)
    expect(getFrameSelection()?.frameIds).toEqual(['d'])
  })
})

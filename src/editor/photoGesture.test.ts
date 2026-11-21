import assert from 'node:assert/strict'
import { afterEach, describe, expect, it } from 'vitest'
import type { Frame } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  resetBookStore,
  undoBook,
} from './bookStore'
import { enterCropMode, exitCropMode } from './cropMode'
import { resetEditorToolForTests, setEditorTool } from './editorToolStore'
import { installPhotoGesture } from './photoGesture'

const SIZE_MM = 300
const SCALE = 2
const ORIGIN = { x: 40, y: 30 }
/** Frame `a`: 50 mm square at (100, 100). */
const RECT = { x: 100, y: 100, width: 50, height: 50 }

function load(aspect: number, extra: Partial<Frame> = {}) {
  resetBookStore({
    book: makeBook({
      assets: { p: {} },
      gallery: ['p'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({ id: 'a', rect: RECT, assetId: 'p', ...extra }),
            // Another photo frame, for crop mode pinned elsewhere.
            makeFrame({ id: 'b', rect: RECT, assetId: 'p' }),
          ],
        }),
      ],
    }),
    sessionMeta: new Map([
      [
        'p',
        {
          name: 'p.jpg',
          correctedWidth: 100 * aspect,
          correctedHeight: 100,
          orientation: 1,
          aspect,
        },
      ],
    ]),
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
  const img = document.createElement('img')
  img.className = 'spread-frame-image'
  const grabber = document.createElement('span')
  grabber.setAttribute('data-photo-pan', '')
  const tag = document.createElement('span')
  tag.setAttribute('data-testid', 'photo-crop-tag')
  const corners = new Map<string, HTMLElement>()
  for (const id of ['nw', 'se', 'bogus']) {
    const el = document.createElement('span')
    el.setAttribute('data-photo-handle', id)
    button.append(el)
    corners.set(id, el)
  }
  button.append(img, grabber, tag)
  spread.append(button)
  document.body.append(spread)
  return { spread, button, img, grabber, tag, corners }
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

describe('photoGesture', () => {
  let stop: () => void = () => undefined
  let dom: ReturnType<typeof mount>

  function setup(aspect: number, extra: Partial<Frame> = {}) {
    load(aspect, extra)
    dom = mount()
    stop = installPhotoGesture()
  }

  function corner(id: string): HTMLElement {
    const el = dom.corners.get(id)
    assert(el !== undefined)
    return el
  }

  afterEach(() => {
    stop()
    exitCropMode()
    dom.spread.remove()
    resetEditorToolForTests()
    resetBookStore()
  })

  it('the grabber pans the photo with a live preview, one undo step', () => {
    // A 2:1 photo covers the square frame at 100 × 50 mm: 50 mm to pan.
    setup(2)
    const down = fire('pointerdown', dom.grabber, 125, 125)
    expect(down.defaultPrevented).toBe(true)
    fire('pointermove', window, 115, 125)
    expect(dom.button.getAttribute('data-photo-gesture')).toBe('pan')
    expect(dom.tag.textContent).toBe('Crop · 100%')
    expect(dom.img.style.left).toBe('-70%')
    fire('pointerup', window, 115, 125)
    expect(dom.button.hasAttribute('data-photo-gesture')).toBe(false)
    expect(dom.img.style.left).toBe('')
    expect(frame().crop?.zoom).toBe(1)
    expect(frame().crop?.center.x).toBeCloseTo(0.6)
    expect(frame().crop?.center.y).toBeCloseTo(0.5)
    undoBook()
    expect(frame().crop).toBeUndefined()
  })

  it('a corner scales about the opposite corner, the handle active', () => {
    setup(2)
    // se photo corner at (175, 150); the nw corner (75, 100) stays.
    fire('pointerdown', corner('se'), 175, 150)
    fire('pointermove', window, 225, 175)
    expect(dom.button.getAttribute('data-photo-gesture')).toBe('se')
    expect(corner('se').getAttribute('data-active')).toBe('true')
    expect(dom.tag.textContent).toBe('Crop · 150%')
    fire('pointerup', window, 225, 175)
    expect(corner('se').hasAttribute('data-active')).toBe(false)
    const crop = frame().crop
    expect(crop?.zoom).toBeCloseTo(1.5)
    // Window 1/3 wide from the left edge of the photo.
    expect(crop?.center.x).toBeCloseTo(0.25 / 1.5 + 1 / 6)
    expect(crop?.center.y).toBeCloseTo(1 / 3)
  })

  it('Alt scales about the photo centre', () => {
    setup(2)
    fire('pointerdown', corner('nw'), 75, 100)
    fire('pointermove', window, 50, 87.5, { altKey: true })
    fire('pointerup', window, 50, 87.5, { altKey: true })
    expect(frame().crop?.zoom).toBeCloseTo(1.5)
    expect(frame().crop?.center.x).toBeCloseTo(0.5)
    expect(frame().crop?.center.y).toBeCloseTo(0.5)
  })

  it('a Fit photo grown past cover becomes Fill in one undo step', () => {
    // Fit: the 2:1 photo is 50 × 25 mm, top 112.5; cover at Fit zoom 2.
    setup(2, { fit: 'fit' })
    fire('pointerdown', corner('se'), 150, 137.5)
    fire('pointermove', window, 250, 187.5)
    fire('pointerup', window, 250, 187.5)
    expect(frame().fit).toBeUndefined()
    expect(frame().crop?.zoom).toBeCloseTo(1.5)
    undoBook()
    expect(getHistorySnapshot().canUndo).toBe(false)
    expect(frame().fit).toBe('fit')
    expect(frame().crop).toBeUndefined()
  })

  it('a Fit photo below cover stays Fit', () => {
    setup(2, { fit: 'fit' })
    fire('pointerdown', corner('se'), 150, 137.5)
    fire('pointermove', window, 175, 150)
    fire('pointerup', window, 175, 150)
    expect(frame().fit).toBe('fit')
    expect(frame().crop?.zoom).toBeCloseTo(1.5)
  })

  it('two gestures are two undo steps', () => {
    setup(2)
    for (const to of [115, 120]) {
      fire('pointerdown', dom.grabber, 125, 125)
      fire('pointermove', window, to, 125)
      fire('pointerup', window, to, 125)
    }
    expect(frame().crop?.center.x).toBeCloseTo(0.65)
    undoBook()
    expect(frame().crop?.center.x).toBeCloseTo(0.6)
    undoBook()
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('a press without travel, a clamped pan and Escape change nothing', () => {
    setup(1)
    fire('pointerdown', dom.grabber, 125, 125)
    fire('pointerup', window, 125, 125)
    // A square photo at cover has nowhere to pan.
    fire('pointerdown', dom.grabber, 125, 125)
    fire('pointermove', window, 140, 140)
    fire('pointerup', window, 140, 140)
    fire('pointerdown', corner('se'), 150, 150)
    fire('pointermove', window, 170, 170)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(dom.button.hasAttribute('data-photo-gesture')).toBe(false)
    expect(dom.img.style.width).toBe('')
    fire('pointerup', window, 170, 170)
    expect(frame().crop).toBeUndefined()
    expect(getHistorySnapshot().canUndo).toBe(false)
  })

  it('swallows the click that ends a gesture only', () => {
    setup(2)
    let clicks = 0
    dom.button.addEventListener('click', () => {
      clicks += 1
    })
    fire('pointerdown', dom.grabber, 125, 125)
    fire('pointermove', window, 115, 125)
    fire('pointerup', window, 115, 125)
    fire('click', dom.grabber, 115, 125)
    fire('click', dom.grabber, 115, 125)
    expect(clicks).toBe(1)
  })

  it('stops swallowing once the gesture task is over', async () => {
    setup(2)
    let clicks = 0
    dom.button.addEventListener('click', () => {
      clicks += 1
    })
    fire('pointerdown', dom.grabber, 125, 125)
    fire('pointermove', window, 115, 125)
    fire('pointerup', window, 115, 125)
    await new Promise((resolve) => setTimeout(resolve, 0))
    fire('click', dom.grabber, 115, 125)
    expect(clicks).toBe(1)
  })

  it('pans in the frame axes of a rotated frame and along a tall photo', () => {
    // Turned 90°, a screen move up is a move left in the frame.
    setup(2, { rotationDeg: 90 })
    fire('pointerdown', dom.grabber, 125, 125)
    fire('pointermove', window, 125, 115)
    fire('pointerup', window, 125, 115)
    expect(frame().crop?.center.x).toBeCloseTo(0.6)
    expect(frame().crop?.center.y).toBeCloseTo(0.5)
    stop()
    dom.spread.remove()
    setup(0.5)
    fire('pointerdown', dom.grabber, 125, 125)
    fire('pointermove', window, 125, 115)
    fire('pointerup', window, 125, 115)
    expect(frame().crop?.center.x).toBeCloseTo(0.5)
    expect(frame().crop?.center.y).toBeCloseTo(0.6)
  })

  it('keeps the press, Escape and the swallowed click from later listeners', () => {
    setup(2)
    const seen: string[] = []
    const spy = (event: Event) => {
      seen.push(event.type)
    }
    for (const type of ['pointerdown', 'keydown', 'click']) {
      document.addEventListener(type, spy, true)
    }
    try {
      fire('pointerdown', dom.grabber, 125, 125)
      fire('pointermove', window, 115, 125)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      fire('pointerup', window, 115, 125)
      expect(seen).toEqual([])
      fire('pointerdown', dom.grabber, 125, 125)
      fire('pointermove', window, 115, 125)
      fire('pointerup', window, 115, 125)
      expect(fire('click', dom.grabber, 115, 125).defaultPrevented).toBe(true)
      expect(seen).toEqual([])
      dom.grabber.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
      expect(seen).toEqual(['keydown'])
    } finally {
      for (const type of ['pointerdown', 'keydown', 'click']) {
        document.removeEventListener(type, spy, true)
      }
    }
  })

  it('starts past a 2 px slop and follows its own pointer only', () => {
    setup(2)
    fire('pointerdown', dom.grabber, 125, 125)
    // 1 client px: still a press.
    fire('pointermove', window, 124.5, 125)
    expect(dom.button.hasAttribute('data-photo-gesture')).toBe(false)
    fire('pointermove', window, 115, 125, {}, 2)
    fire('pointerup', window, 115, 125, {}, 2)
    expect(dom.button.hasAttribute('data-photo-gesture')).toBe(false)
    // 2 client px: the gesture starts.
    fire('pointermove', window, 124, 125)
    expect(dom.button.getAttribute('data-photo-gesture')).toBe('pan')
    fire('pointerup', window, 124, 125)
    expect(frame().crop?.center.x).toBeCloseTo(0.51)
  })

  it('previews a turned photo in layout px', () => {
    setup(2, { crop: { zoom: 1, center: { x: 0.5, y: 0.5 }, quarterTurns: 1 } })
    Object.defineProperty(dom.button, 'offsetWidth', { value: 100 })
    fire('pointerdown', corner('se'), 150, 150)
    fire('pointermove', window, 175, 175)
    expect(dom.img.style.width).toMatch(/px$/)
    expect(Number.parseFloat(dom.img.style.width)).toBeGreaterThan(100)
    expect(dom.img.style.transform).toContain('rotate(90deg)')
    fire('pointerup', window, 175, 175)
    expect(dom.img.style.transform).toBe('')
  })

  it('ignores frames it cannot resolve', () => {
    setup(2)
    dom.button.setAttribute('data-frame-id', 'missing')
    expect(fire('pointerdown', dom.grabber, 125, 125).defaultPrevented).toBe(
      false,
    )
    dom.button.setAttribute('data-frame-id', 'a')
    dom.spread.setAttribute('data-spread-id', 'missing')
    expect(fire('pointerdown', dom.grabber, 125, 125).defaultPrevented).toBe(
      false,
    )
  })

  it('takes corner presses on the pinned frame (crop mode); pans stay with crop mode', () => {
    setup(2)
    const spreadId = getBookStoreSnapshot().book.spreads[0]?.id ?? ''
    enterCropMode(spreadId, 'b')
    expect(fire('pointerdown', corner('se'), 125, 125).defaultPrevented).toBe(
      false,
    )
    enterCropMode(spreadId, 'a')
    expect(fire('pointerdown', dom.grabber, 125, 125).defaultPrevented).toBe(
      false,
    )
    const down = fire('pointerdown', corner('se'), 125, 125)
    expect(down.defaultPrevented).toBe(true)
    fire('pointerup', window, 125, 125)
  })

  it('ignores locked frames, other tools and unknown handles', () => {
    setup(2, { locked: true })
    expect(fire('pointerdown', dom.grabber, 125, 125).defaultPrevented).toBe(
      false,
    )
    stop()
    dom.spread.remove()
    setup(2)
    setEditorTool('text')
    expect(fire('pointerdown', dom.grabber, 125, 125).defaultPrevented).toBe(
      false,
    )
    setEditorTool('select')
    expect(
      fire('pointerdown', corner('bogus'), 125, 125).defaultPrevented,
    ).toBe(false)
    expect(
      fire('pointerdown', dom.grabber, 125, 125, { button: 2 })
        .defaultPrevented,
    ).toBe(false)
  })
})

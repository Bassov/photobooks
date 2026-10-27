import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { installCropGesture } from './cropGesture'
import { enterCropMode, exitCropMode, getCropTarget } from './cropMode'

const ZOOMED = { zoom: 2, center: { x: 0.5, y: 0.5 } }

function loadZoomed(): void {
  resetBookStore({
    book: makeBook({
      assets: { a: {} },
      gallery: ['a'],
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              rect: { x: 0, y: 0, width: 100, height: 100 },
              assetId: 'a',
              crop: ZOOMED,
            }),
          ],
        }),
      ],
    }),
    sessionMeta: new Map([
      [
        'a',
        {
          name: 'a.jpg',
          correctedWidth: 100,
          correctedHeight: 100,
          orientation: 1,
          aspect: 1,
        },
      ],
    ]),
    importRunning: false,
    importExpectedCount: 0,
  })
}

function crop() {
  return getBookStoreSnapshot().book.spreads[0]?.frames[0]?.crop
}

function mountFrame(): HTMLElement {
  const frame = document.createElement('button')
  frame.setAttribute('data-crop-active', 'true')
  Object.defineProperty(frame, 'offsetWidth', { value: 200 })
  Object.defineProperty(frame, 'offsetHeight', { value: 200 })
  frame.getBoundingClientRect = () => ({ width: 200 }) as DOMRect
  const img = document.createElement('img')
  frame.append(img)
  document.body.append(frame)
  return frame
}

function pointer(type: string, init: PointerEventInit & { target: Element }) {
  const { target, ...rest } = init
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...rest,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
}

describe('cropGesture', () => {
  let stop: () => void
  let frame: HTMLElement

  beforeEach(() => {
    vi.useFakeTimers()
    loadZoomed()
    frame = mountFrame()
    enterCropMode('spread-1', 'frame-1')
    stop = installCropGesture()
  })

  afterEach(() => {
    stop()
    exitCropMode()
    frame.remove()
    resetBookStore()
    vi.useRealTimers()
  })

  it('previews a drag as a transform and commits one pan on pointerup', () => {
    pointer('pointerdown', { target: frame, clientX: 100, clientY: 100 })
    pointer('pointermove', { target: frame, clientX: 150, clientY: 100 })
    vi.advanceTimersToNextFrame()
    expect(frame.querySelector('img')?.style.transform).toBe(
      'translate(50px, 0px)',
    )
    expect(crop()).toEqual(ZOOMED)
    pointer('pointerup', { target: frame, clientX: 150, clientY: 100 })
    // 50 of 200 px with a 0.5 window → center moves left by 0.125
    expect(crop()?.center.x).toBeCloseTo(0.375)
    expect(crop()?.center.y).toBeCloseTo(0.5)
    undoBook()
    expect(crop()).toEqual(ZOOMED)
  })

  it('treats a tiny movement as a click and does not commit', () => {
    pointer('pointerdown', { target: frame, clientX: 100, clientY: 100 })
    pointer('pointermove', { target: frame, clientX: 101, clientY: 100 })
    pointer('pointerup', { target: frame, clientX: 101, clientY: 100 })
    expect(crop()).toEqual(ZOOMED)
  })

  it('swallows the click that follows a drag', () => {
    const onClick = vi.fn()
    frame.addEventListener('click', onClick)
    pointer('pointerdown', { target: frame, clientX: 0, clientY: 0 })
    pointer('pointermove', { target: frame, clientX: 40, clientY: 0 })
    pointer('pointerup', { target: frame, clientX: 40, clientY: 0 })
    frame.click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('zooms with the wheel and commits after it settles', () => {
    const event = new WheelEvent('wheel', {
      deltaY: -300,
      bubbles: true,
      cancelable: true,
    })
    frame.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    vi.advanceTimersToNextFrame()
    expect(frame.querySelector('img')?.style.transform).toMatch(/^scale\(/)
    expect(crop()?.zoom).toBe(2)
    vi.advanceTimersByTime(200)
    expect(crop()?.zoom).toBeGreaterThan(2)
  })

  it('never zooms below cover', () => {
    frame.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: 5000,
        bubbles: true,
        cancelable: true,
      }),
    )
    vi.advanceTimersByTime(200)
    expect(crop()?.zoom).toBe(1)
  })

  it('nudges with arrows (Shift ×10) and ignores inputs', () => {
    const arrow = (init: KeyboardEventInit, target: EventTarget = frame) =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ...init,
        }),
      )
    arrow({ key: 'ArrowRight' })
    // 1 of 200 px, 0.5 window → 0.0025
    expect(crop()?.center.x).toBeCloseTo(0.4975)
    arrow({ key: 'ArrowLeft', shiftKey: true })
    expect(crop()?.center.x).toBeCloseTo(0.5225)
    const input = document.createElement('input')
    document.body.append(input)
    arrow({ key: 'ArrowRight' }, input)
    expect(crop()?.center.x).toBeCloseTo(0.5225)
    input.remove()
  })

  it('exits on Escape and on a press outside the frame', () => {
    frame.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    expect(getCropTarget()).toBeNull()

    enterCropMode('spread-1', 'frame-1')
    const keep = document.createElement('div')
    keep.setAttribute('data-crop-keep', '')
    document.body.append(keep)
    pointer('pointerdown', { target: keep })
    expect(getCropTarget()).not.toBeNull()
    pointer('pointerdown', { target: document.body })
    expect(getCropTarget()).toBeNull()
    keep.remove()
  })
})

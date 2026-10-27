import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_CROP_ZOOM } from '../core'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { cropWheelFactor } from './cropMath'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore, undoBook } from './bookStore'
import { installCropGesture } from './cropGesture'
import { enterCropMode, exitCropMode, getCropTarget } from './cropMode'

const ZOOMED = { zoom: 2, center: { x: 0.5, y: 0.5 } }

function loadZoomed(frameCrop: typeof ZOOMED = ZOOMED): void {
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
              crop: frameCrop,
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

function mountFrame(
  layout: {
    offset?: number
    client?: number
    imgOffset?: [number, number]
  } = {},
): HTMLElement {
  const { offset = 200, client = 200, imgOffset = [0, 0] } = layout
  const frame = document.createElement('button')
  frame.setAttribute('data-crop-active', 'true')
  Object.defineProperty(frame, 'offsetWidth', { value: offset })
  Object.defineProperty(frame, 'offsetHeight', { value: offset })
  frame.getBoundingClientRect = () => ({ width: client }) as DOMRect
  const img = document.createElement('img')
  Object.defineProperty(img, 'offsetLeft', { value: imgOffset[0] })
  Object.defineProperty(img, 'offsetTop', { value: imgOffset[1] })
  frame.append(img)
  document.body.append(frame)
  return frame
}

function pointer(
  type: string,
  init: PointerEventInit & { target: Element; pointerId?: number },
) {
  const { target, pointerId = 1, ...rest } = init
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...rest,
  })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  target.dispatchEvent(event)
  return event
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

describe('cropGesture details', () => {
  let stop: () => void
  let frame: HTMLElement | null = null

  function setup(
    layout: Parameters<typeof mountFrame>[0] = {},
    frameCrop: typeof ZOOMED = ZOOMED,
  ): HTMLElement {
    loadZoomed(frameCrop)
    const mounted = mountFrame(layout)
    frame = mounted
    enterCropMode('spread-1', 'frame-1')
    stop = installCropGesture()
    return mounted
  }

  const wheel = (target: Element, deltaY: number) =>
    target.dispatchEvent(
      new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }),
    )
  const key = (target: EventTarget, init: KeyboardEventInit) =>
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    )

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    stop()
    exitCropMode()
    frame?.remove()
    frame = null
    resetBookStore()
    vi.useRealTimers()
  })

  it('maps client px to layout px through the camera zoom', () => {
    const el = setup({ client: 100 })
    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    pointer('pointermove', { target: el, clientX: 25, clientY: 10 })
    vi.advanceTimersToNextFrame()
    expect(el.querySelector('img')?.style.transform).toBe(
      'translate(50px, 20px)',
    )
    pointer('pointerup', { target: el, clientX: 25, clientY: 10 })
    expect(crop()?.center.x).toBeCloseTo(0.375)
    expect(crop()?.center.y).toBeCloseTo(0.45)
  })

  it.each([{ client: 0 }, { offset: 0, client: 100 }])(
    'uses layout px 1:1 without a usable client / layout width (%o)',
    (layout) => {
      const el = setup(layout)
      pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
      pointer('pointermove', { target: el, clientX: 30, clientY: 0 })
      vi.advanceTimersToNextFrame()
      expect(el.querySelector('img')?.style.transform).toBe(
        'translate(30px, 0px)',
      )
    },
  )

  it('falls back to the mm size when the frame has no layout box', () => {
    const el = setup({ offset: 0, client: 0 })
    const px = 100 * SPREAD_PX_PER_MM
    key(el, { key: 'ArrowRight' })
    expect(crop()?.center.x).toBeCloseTo(0.5 - 0.5 / px)
    key(el, { key: 'ArrowDown' })
    expect(crop()?.center.y).toBeCloseTo(0.5 - 0.5 / px)
  })

  it('nudges in every arrow direction and ignores other keys / modifiers', () => {
    const el = setup()
    key(el, { key: 'ArrowUp' })
    expect(crop()?.center.y).toBeCloseTo(0.5025)
    expect(crop()?.center.x).toBe(0.5)
    key(el, { key: 'ArrowDown' })
    expect(crop()?.center.y).toBeCloseTo(0.5)
    key(el, { key: 'ArrowLeft' })
    expect(crop()?.center.x).toBeCloseTo(0.5025)
    key(el, { key: 'ArrowRight' })
    expect(crop()?.center.x).toBeCloseTo(0.5)
    const before = crop()
    key(el, { key: 'a' })
    key(el, { key: 'ArrowRight', ctrlKey: true })
    key(el, { key: 'ArrowRight', metaKey: true })
    key(el, { key: 'ArrowRight', altKey: true })
    const area = document.createElement('textarea')
    document.body.append(area)
    key(area, { key: 'ArrowRight' })
    area.remove()
    expect(crop()).toEqual(before)
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('does not commit or leave a preview when nothing changes', () => {
    const el = setup({}, { zoom: 1, center: { x: 0.5, y: 0.5 } })
    const img = el.querySelectorAll('img').item(0)
    img.style.transform = 'scale(2)'
    img.style.transformOrigin = '1px 1px'
    wheel(el, 5000)
    vi.advanceTimersByTime(200)
    expect(img.style.transform).toBe('')
    expect(img.style.transformOrigin).toBe('')
    expect(crop()).toEqual({ zoom: 1, center: { x: 0.5, y: 0.5 } })
  })

  it('commits when only the vertical center changes', () => {
    const el = setup()
    key(el, { key: 'ArrowDown' })
    expect(crop()?.center.y).toBeCloseTo(0.4975)
    expect(crop()?.zoom).toBe(2)
    undoBook()
    expect(crop()).toEqual(ZOOMED)
  })

  it('previews wheel zoom with clamped scale around the frame center', () => {
    const el = setup({ imgOffset: [20, 10] })
    const img = el.querySelector('img')
    wheel(el, -300)
    vi.advanceTimersToNextFrame()
    expect(img?.style.transformOrigin).toBe('80px 90px')
    expect(img?.style.transform).toBe(`scale(${String(cropWheelFactor(-300))})`)
    vi.advanceTimersByTime(200)

    wheel(el, -100000)
    vi.advanceTimersToNextFrame()
    const zoom = crop()?.zoom ?? 0
    expect(img?.style.transform).toBe(`scale(${String(MAX_CROP_ZOOM / zoom)})`)
    vi.advanceTimersByTime(200)

    wheel(el, 100000)
    vi.advanceTimersToNextFrame()
    const zoomed = crop()?.zoom ?? 0
    expect(img?.style.transform).toBe(`scale(${String(1 / zoomed)})`)
  })

  it('settles the wheel only after the last notch', () => {
    const el = setup()
    wheel(el, -100)
    vi.advanceTimersByTime(100)
    wheel(el, -100)
    vi.advanceTimersByTime(100)
    expect(crop()).toEqual(ZOOMED)
    vi.advanceTimersByTime(100)
    expect(crop()?.zoom).toBeCloseTo(2 * cropWheelFactor(-100) ** 2)
  })

  it('ignores wheel outside the frame or outside crop mode', () => {
    const el = setup()
    const outside = document.createElement('div')
    document.body.append(outside)
    const event = new WheelEvent('wheel', {
      deltaY: -300,
      bubbles: true,
      cancelable: true,
    })
    outside.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    exitCropMode()
    const inside = new WheelEvent('wheel', {
      deltaY: -300,
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(inside)
    expect(inside.defaultPrevented).toBe(false)
    outside.remove()
  })

  it('keeps wheel events away from other listeners', () => {
    const el = setup()
    const seen = vi.fn()
    el.addEventListener('wheel', seen)
    wheel(el, -300)
    expect(seen).not.toHaveBeenCalled()
  })

  it('commits a pending wheel zoom on press, outside press and Escape', () => {
    const el = setup()
    wheel(el, -300)
    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    expect(crop()?.zoom).toBeGreaterThan(2)
    pointer('pointerup', { target: el, clientX: 0, clientY: 0 })

    const zoomed = crop()?.zoom ?? 0
    wheel(el, -300)
    pointer('pointerdown', { target: document.body })
    expect(crop()?.zoom).toBeGreaterThan(zoomed)

    enterCropMode('spread-1', 'frame-1')
    const again = crop()?.zoom ?? 0
    wheel(el, -300)
    key(el, { key: 'Escape' })
    expect(crop()?.zoom).toBeGreaterThan(again)
    expect(getCropTarget()).toBeNull()
  })

  it('does not paint a cancelled frame after the gesture ends', () => {
    const el = setup()
    const img = el.querySelector('img')
    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    pointer('pointermove', { target: el, clientX: 40, clientY: 0 })
    pointer('pointerup', { target: el, clientX: 40, clientY: 0 })
    vi.advanceTimersToNextFrame()
    expect(img?.style.transform).toBe('')

    wheel(el, -300)
    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    vi.advanceTimersToNextFrame()
    expect(img?.style.transform).toBe('')
  })

  it('cancels a pan on pointercancel and on Escape without committing', () => {
    const el = setup()
    const img = el.querySelector('img')
    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    pointer('pointermove', { target: el, clientX: 40, clientY: 0 })
    vi.advanceTimersToNextFrame()
    expect(img?.style.transform).toBe('translate(40px, 0px)')
    pointer('pointercancel', { target: el, clientX: 40, clientY: 0 })
    expect(img?.style.transform).toBe('')
    expect(crop()).toEqual(ZOOMED)

    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    pointer('pointermove', { target: el, clientX: 40, clientY: 0 })
    vi.advanceTimersToNextFrame()
    key(el, { key: 'Escape' })
    expect(img?.style.transform).toBe('')
    expect(crop()).toEqual(ZOOMED)
  })

  it('pans on a drag of exactly the slop distance', () => {
    const el = setup()
    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    pointer('pointermove', { target: el, clientX: 3, clientY: 0 })
    pointer('pointerup', { target: el, clientX: 3, clientY: 0 })
    expect(crop()?.center.x).toBeLessThan(0.5)
  })

  it('only follows the pointer that started the pan', () => {
    const el = setup()
    const down = pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    expect(down.defaultPrevented).toBe(true)
    pointer('pointermove', {
      target: el,
      clientX: 40,
      clientY: 0,
      pointerId: 2,
    })
    pointer('pointerup', { target: el, clientX: 40, clientY: 0, pointerId: 2 })
    expect(crop()).toEqual(ZOOMED)
    pointer('pointermove', { target: el, clientX: 40, clientY: 0 })
    pointer('pointerup', { target: el, clientX: 40, clientY: 0 })
    expect(crop()?.center.x).toBeCloseTo(0.4)
  })

  it('ignores non-primary presses and moves without a press', () => {
    const el = setup()
    const down = pointer('pointerdown', {
      target: el,
      button: 2,
      clientX: 0,
      clientY: 0,
    })
    expect(down.defaultPrevented).toBe(false)
    pointer('pointermove', { target: el, clientX: 40, clientY: 0 })
    pointer('pointerup', { target: el, clientX: 40, clientY: 0 })
    expect(crop()).toEqual(ZOOMED)
    pointer('pointerdown', { target: document.body, button: 2 })
    expect(getCropTarget()).not.toBeNull()
  })

  it('swallows exactly one click after a drag and resets on a new press', () => {
    const el = setup()
    const onClick = vi.fn()
    el.addEventListener('click', onClick)
    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    pointer('pointermove', { target: el, clientX: 40, clientY: 0 })
    pointer('pointerup', { target: el, clientX: 40, clientY: 0 })
    const swallowed = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(swallowed)
    expect(swallowed.defaultPrevented).toBe(true)
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)

    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    pointer('pointermove', { target: el, clientX: 40, clientY: 0 })
    pointer('pointerup', { target: el, clientX: 40, clientY: 0 })
    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    pointer('pointerup', { target: el, clientX: 0, clientY: 0 })
    el.click()
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('does not swallow a click after a pointercancel', () => {
    const el = setup()
    const onClick = vi.fn()
    el.addEventListener('click', onClick)
    pointer('pointerdown', { target: el, clientX: 0, clientY: 0 })
    pointer('pointermove', { target: el, clientX: 40, clientY: 0 })
    pointer('pointercancel', { target: el, clientX: 40, clientY: 0 })
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import {
  clearPhotoPreview,
  paintPhotoPreview,
  PHOTO_LAYER_ATTR,
  turnedPhotoStyle,
} from './photoLayout'

const FRAME = { width: 200, height: 100 }
const FULL = { x: 0, y: 0, width: 1, height: 1 }

describe('turnedPhotoStyle', () => {
  it('centers an unshifted photo on the frame and rotates by turns + angle', () => {
    expect(turnedPhotoStyle(FRAME, FULL, 0, 2.5)).toEqual({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      transform: 'rotate(2.5deg) translate(0px, 0px)',
    })
  })

  it('swaps frame axes for odd turns', () => {
    const style = turnedPhotoStyle(
      FRAME,
      { x: 0, y: 0, width: 1, height: 1 },
      1,
      0,
    )
    expect(style.width).toBe(100)
    expect(style.height).toBe(200)
    expect(style.left).toBe(50)
    expect(style.top).toBe(-50)
    expect(style.transform).toBe('rotate(90deg) translate(0px, 0px)')
  })

  it('shifts so the window center lands on the frame center', () => {
    const style = turnedPhotoStyle(
      FRAME,
      { x: 0.25, y: 0, width: 0.5, height: 0.5 },
      0,
      0,
    )
    expect(style.width).toBe(400)
    expect(style.height).toBe(200)
    expect(style.transform).toBe('rotate(0deg) translate(0px, 50px)')
  })
})

describe('photo preview helpers', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('paints layers with the transform and bare images with a pixel origin', () => {
    const frame = document.createElement('div')
    frame.innerHTML = `<div ${PHOTO_LAYER_ATTR}=""><img id="a"></div><img id="b">`
    document.body.append(frame)
    paintPhotoPreview(frame, 'rotate(3deg)')
    const layer = frame.querySelector<HTMLElement>(`[${PHOTO_LAYER_ATTR}]`)
    const bare = frame.querySelector<HTMLElement>('#b')
    expect(layer?.style.transform).toBe('rotate(3deg)')
    expect(layer?.style.transformOrigin).toBe('')
    expect(frame.querySelector<HTMLElement>('#a')?.style.transform).toBe('')
    expect(bare?.style.transform).toBe('rotate(3deg)')
    expect(bare?.style.transformOrigin).toMatch(/px/)
    clearPhotoPreview(frame)
    expect(layer?.style.transform).toBe('')
    expect(bare?.style.transform).toBe('')
    expect(bare?.style.transformOrigin).toBe('')
  })
})

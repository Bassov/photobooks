import { afterEach, describe, expect, it } from 'vitest'
import { sourceCropRect } from '../core'
import { turnedPhotoStyle } from '../render/photoLayout'
import { photoBoxPainter } from './photoBoxPaint'

/** A 50 × 25 mm frame; a 2:1 photo covers it at zoom 1. */
const RECT = { x: 0, y: 0, width: 50, height: 25 }
const PX_PER_MM = 2

function mount() {
  const button = document.createElement('button')
  const img = document.createElement('img')
  img.className = 'spread-frame-image'
  img.style.cssText = 'left: 1%; transform: scale(2);'
  const ghost = document.createElement('span')
  ghost.setAttribute('data-photo-box', '')
  const other = document.createElement('span')
  button.append(img, ghost, other)
  document.body.append(button)
  return { button, img, ghost, other }
}

describe('photoBoxPainter', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('writes the plain photo box to the photo and the layer boxes, then restores', () => {
    const { button, img, ghost, other } = mount()
    const painter = photoBoxPainter(button, 2, PX_PER_MM)
    painter.paint({ rect: RECT, crop: undefined, fit: undefined })
    for (const el of [img, ghost]) {
      expect(el.style.left).toBe('0%')
      expect(el.style.width).toBe('100%')
    }
    expect(img.style.transform).toBe('scale(2)')
    expect(other.style.cssText).toBe('')
    painter.restore()
    expect(img.style.cssText).toBe('left: 1%; transform: scale(2);')
    expect(ghost.style.cssText).toBe('')
  })

  it.each([
    { quarterTurns: 1 },
    { straightenDeg: 5 },
    { flipH: true },
    { flipV: true },
  ])('lays a turned photo out in layout px: %o', (turn) => {
    const { button, img } = mount()
    const crop = { zoom: 1, center: { x: 0.5, y: 0.5 }, ...turn }
    photoBoxPainter(button, 2, PX_PER_MM).paint({
      rect: RECT,
      crop,
      fit: undefined,
    })
    const expected = turnedPhotoStyle(
      { width: RECT.width * PX_PER_MM, height: RECT.height * PX_PER_MM },
      sourceCropRect(RECT, crop, 2, undefined),
      crop.quarterTurns ?? 0,
      crop.straightenDeg ?? 0,
      { h: crop.flipH === true, v: crop.flipV === true },
    )
    expect(img.style.width).toBe(`${String(expected.width)}px`)
    expect(img.style.height).toBe(`${String(expected.height)}px`)
    expect(img.style.transform).toBe(expected.transform)
    expect(img.style.transform).not.toBe('scale(2)')
  })
})

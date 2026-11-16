import { describe, expect, it } from 'vitest'
import { paperBox, paperLayers, stripSlide, tapStep } from './slidesGeo'

describe('paperLayers', () => {
  it('lays grain then sheen over the whole face', () => {
    const [grain, sheen] = paperLayers()
    expect(grain).toStrictEqual({
      position: 'absolute',
      top: 0,
      bottom: 0,
      pointerEvents: 'none',
      left: 0,
      right: 0,
      backgroundImage: expect.stringMatching(
        /^url\("data:image\/svg\+xml;utf8,<svg .*feTurbulence type='fractalNoise' baseFrequency='\.85'.*<\/svg>"\)$/,
      ) as unknown,
      backgroundSize: '160px',
      mixBlendMode: 'multiply',
      opacity: 0.03,
    })
    expect(sheen).toStrictEqual({
      position: 'absolute',
      top: 0,
      bottom: 0,
      pointerEvents: 'none',
      left: 0,
      right: 0,
      background:
        'linear-gradient(100deg, rgb(255 255 255/.08), rgb(255 255 255/0) 40%)',
    })
  })

  it('places both under a strip at x, w wide', () => {
    for (const layer of paperLayers(-120, 300)) {
      expect(layer.left).toBe(-120)
      expect(layer.width).toBe(300)
      expect(layer).not.toHaveProperty('right')
    }
    expect(paperLayers(undefined, 300)[0].left).toBe(0)
  })
})

describe('paperBox', () => {
  it('centres a whole spread at its own height in the slot', () => {
    expect(paperBox('spread', 360, 450, 1.6, false)).toStrictEqual({
      top: 112.5,
      width: 360,
      height: 225,
      borderRadius: undefined,
    })
  })

  it('fills the slot with a page, with rounded corners on the cover', () => {
    expect(paperBox('page', 360, 450, 1.6, false)).toStrictEqual({
      top: 0,
      width: 360,
      height: 450,
      borderRadius: undefined,
    })
    expect(paperBox('cover', 360, 450, 1.6, false).borderRadius).toBe(2)
  })

  it('keeps the sheet whole and flat at its origin on the page turn', () => {
    expect(paperBox('spread', 360, 450, 1.6, true)).toStrictEqual({
      top: 0,
      width: 360,
      height: 450,
      borderRadius: undefined,
      left: 0,
      boxShadow: 'none',
    })
  })
})

describe('stripSlide', () => {
  it('rounds the scroll to the nearest slide within the strip', () => {
    expect(stripSlide(0, 376, 5)).toBe(0)
    expect(stripSlide(187, 376, 5)).toBe(0)
    expect(stripSlide(188, 376, 5)).toBe(1)
    expect(stripSlide(4 * 376, 376, 5)).toBe(4)
    expect(stripSlide(9 * 376, 376, 5)).toBe(4)
    expect(stripSlide(-400, 376, 5)).toBe(0)
  })
})

describe('tapStep', () => {
  const at = (x: number, y = 100, t = 0) => ({ x, y, t })

  it('steps back on the left half and on at the right', () => {
    expect(tapStep(at(30), at(30), 10, 380)).toBe(-1)
    expect(tapStep(at(198), at(198), 10, 380)).toBe(-1)
    expect(tapStep(at(200), at(200), 10, 380)).toBe(1)
    expect(tapStep(at(389), at(389), 10, 380)).toBe(1)
  })

  it('takes a wobble under 8 px within 350 ms as a tap', () => {
    expect(tapStep(at(300, 100, 0), at(307, 93, 350), 0, 380)).toBe(1)
    expect(tapStep(at(300, 100, 0), at(293, 107, 1), 0, 380)).toBe(1)
  })

  it('drops a drag of 8 px either way and a press over 350 ms', () => {
    expect(tapStep(at(300), at(308), 0, 380)).toBeNull()
    expect(tapStep(at(300), at(292), 0, 380)).toBeNull()
    expect(tapStep(at(300, 100), at(300, 108), 0, 380)).toBeNull()
    expect(tapStep(at(300, 100), at(300, 92), 0, 380)).toBeNull()
    expect(tapStep(at(300, 100, 0), at(300, 100, 351), 0, 380)).toBeNull()
  })
})

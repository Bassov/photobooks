import { describe, expect, it } from 'vitest'
import { percentStyle, thumbPaperBox, thumbSlots } from './layoutThumb'

describe('thumbPaperBox (kit TemplateThumb 2:1 box)', () => {
  it('fills the box for an exact 2:1 spread', () => {
    expect(thumbPaperBox(400, 200)).toEqual({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    })
  })

  it('letterboxes a wider spread top and bottom', () => {
    expect(thumbPaperBox(400, 100)).toEqual({
      left: 0,
      top: 25,
      width: 100,
      height: 50,
    })
  })

  it('pillarboxes a narrower spread left and right', () => {
    expect(thumbPaperBox(200, 200)).toEqual({
      left: 25,
      top: 0,
      width: 50,
      height: 100,
    })
  })
})

describe('thumbSlots', () => {
  it('maps a slot inside the trim to paper percentages', () => {
    expect(
      thumbSlots(200, 100, [{ x: 20, y: 10, width: 100, height: 50 }]),
    ).toEqual([{ left: 10, top: 10, width: 50, height: 50 }])
  })

  it('clips a bleed slot to the paper edges (Full bleed)', () => {
    expect(
      thumbSlots(200, 100, [{ x: -3, y: -3, width: 206, height: 106 }]),
    ).toEqual([{ left: 0, top: 0, width: 100, height: 100 }])
  })

  it('clips only the overflowing sides', () => {
    expect(
      thumbSlots(200, 100, [{ x: 100, y: 50, width: 150, height: 80 }]),
    ).toEqual([{ left: 50, top: 50, width: 50, height: 50 }])
  })

  it('drops slots wholly outside the trim or with no area', () => {
    expect(
      thumbSlots(200, 100, [
        { x: 200, y: 0, width: 10, height: 10 },
        { x: 0, y: 100, width: 10, height: 10 },
        { x: -10, y: 0, width: 10, height: 10 },
        { x: 0, y: -10, width: 10, height: 10 },
        { x: 10, y: 10, width: 0, height: 10 },
      ]),
    ).toEqual([])
  })
})

describe('percentStyle', () => {
  it('formats a box as CSS percentages', () => {
    expect(percentStyle({ left: 1.5, top: 0, width: 50, height: 100 })).toEqual(
      { left: '1.5%', top: '0%', width: '50%', height: '100%' },
    )
  })
})

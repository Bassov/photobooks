import { describe, expect, it } from 'vitest'
import { COVER_CROP } from '../core'
import { cropWheelFactor, panCrop, zoomCrop } from './cropMath'

const RECT = { x: 0, y: 0, width: 100, height: 100 }
const PX = { width: 200, height: 200 }

describe('panCrop', () => {
  it('cover on a square image cannot pan', () => {
    expect(panCrop(RECT, COVER_CROP, 1, PX, 50, 50)).toEqual(COVER_CROP)
  })

  it('dragging right reveals the left part of a zoomed photo', () => {
    const zoomed = { zoom: 2, center: { x: 0.5, y: 0.5 } }
    const next = panCrop(RECT, zoomed, 1, PX, 100, 0)
    // window width 0.5, 100 of 200 px => center moves left by 0.25
    expect(next.center.x).toBeCloseTo(0.25)
    expect(next.center.y).toBeCloseTo(0.5)
  })

  it('stops at the image edge', () => {
    const zoomed = { zoom: 2, center: { x: 0.5, y: 0.5 } }
    expect(panCrop(RECT, zoomed, 1, PX, 9999, -9999).center).toEqual({
      x: 0.25,
      y: 0.75,
    })
  })

  it('pans a wide photo in a square frame along x at zoom 1', () => {
    const next = panCrop(RECT, COVER_CROP, 2, PX, -100, 0)
    expect(next.center.x).toBeGreaterThan(0.5)
    expect(next.center.y).toBe(0.5)
  })
})

describe('zoomCrop', () => {
  it('never goes below cover', () => {
    expect(zoomCrop(RECT, COVER_CROP, 1, 0.1)).toEqual(COVER_CROP)
  })

  it('multiplies zoom and keeps the center in bounds', () => {
    const next = zoomCrop(RECT, { zoom: 1, center: { x: 0.5, y: 0.5 } }, 1, 2)
    expect(next).toEqual({ zoom: 2, center: { x: 0.5, y: 0.5 } })
  })
})

describe('cropWheelFactor', () => {
  it('zooms in on negative delta and out on positive', () => {
    expect(cropWheelFactor(-100)).toBeGreaterThan(1)
    expect(cropWheelFactor(100)).toBeLessThan(1)
    expect(cropWheelFactor(0)).toBe(1)
  })
})

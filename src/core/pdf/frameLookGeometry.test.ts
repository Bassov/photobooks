import { describe, expect, it } from 'vitest'
import type { ResolvedFrameStyle } from '../geometry/types'
import {
  frameLook,
  insetPhotoMatrix,
  roundedRectPath,
} from './frameLookGeometry'
import { applyMatrix } from './pdfGeometry'

function style(patch: Partial<ResolvedFrameStyle>): ResolvedFrameStyle {
  return { strokeMm: 0, matMm: 0, cornerRadiusMm: 0, ...patch }
}

const SIZE = { width: 100, height: 80 }

describe('frameLook', () => {
  it('draws nothing without a style or with an all-zero one', () => {
    expect(frameLook(SIZE, undefined)).toBeUndefined()
    expect(frameLook(SIZE, style({}))).toBeUndefined()
  })

  it('insets the photo by the mat and centres the stroke inside the frame edge', () => {
    const look = frameLook(
      SIZE,
      style({
        strokeMm: 0.3,
        strokeColor: '#1c1b1a',
        matMm: 3,
        matColor: '#fafafa',
        cornerRadiusMm: 4,
      }),
    )

    expect(look).toEqual({
      outer: { rect: { x: 0, y: 0, width: 100, height: 80 }, radiusMm: 4 },
      matColor: '#fafafa',
      photo: { rect: { x: 3, y: 3, width: 94, height: 74 }, radiusMm: 1 },
      stroke: {
        rect: { x: 0.15, y: 0.15, width: 99.7, height: 79.7 },
        radiusMm: 3.85,
        widthMm: 0.3,
        color: '#1c1b1a',
      },
    })
  })

  it('falls back to the canvas colours', () => {
    const look = frameLook(SIZE, style({ strokeMm: 1, matMm: 2 }))

    expect(look?.matColor).toBe('#ffffff')
    expect(look?.stroke?.color).toBe('#1c1b1a')
  })

  it('keeps the photo on the whole frame without a mat, and square corners past the radius', () => {
    expect(frameLook(SIZE, style({ cornerRadiusMm: 4 }))).toEqual({
      outer: { rect: { x: 0, y: 0, width: 100, height: 80 }, radiusMm: 4 },
      photo: { rect: { x: 0, y: 0, width: 100, height: 80 }, radiusMm: 4 },
    })
    const wideMat = frameLook(SIZE, style({ matMm: 6, cornerRadiusMm: 4 }))
    expect(wideMat?.photo.radiusMm).toBe(0)
  })

  it('clamps mat, stroke and radius to half of the shorter side', () => {
    const look = frameLook(
      SIZE,
      style({ strokeMm: 90, matMm: 60, cornerRadiusMm: 50 }),
    )

    expect(look?.outer.radiusMm).toBe(40)
    expect(look?.photo.rect).toEqual({ x: 40, y: 40, width: 20, height: 0 })
    expect(look?.stroke?.widthMm).toBe(40)
    expect(look?.stroke?.rect).toEqual({ x: 20, y: 20, width: 60, height: 40 })
  })
})

describe('roundedRectPath', () => {
  it('outlines a square-cornered rect with lines only', () => {
    expect(
      roundedRectPath({
        rect: { x: 1, y: 2, width: 10, height: 6 },
        radiusMm: 0,
      }),
    ).toEqual([
      { op: 'move', to: { x: 1, y: 2 } },
      { op: 'line', to: { x: 11, y: 2 } },
      { op: 'line', to: { x: 11, y: 8 } },
      { op: 'line', to: { x: 1, y: 8 } },
      { op: 'line', to: { x: 1, y: 2 } },
      { op: 'close' },
    ])
  })

  it('rounds each corner with a quarter-circle curve', () => {
    const segments = roundedRectPath({
      rect: { x: 0, y: 0, width: 10, height: 6 },
      radiusMm: 2,
    })

    expect(segments.map((segment) => segment.op)).toEqual([
      'move',
      'line',
      'curve',
      'line',
      'curve',
      'line',
      'curve',
      'line',
      'curve',
      'close',
    ])
    expect(segments[0]).toEqual({ op: 'move', to: { x: 2, y: 0 } })
    expect(segments[1]).toEqual({ op: 'line', to: { x: 8, y: 0 } })
    const k = 2 * 0.5522847498
    expect(segments[2]).toEqual({
      op: 'curve',
      c1: { x: 8 + k, y: 0 },
      c2: { x: 10, y: 2 - k },
      to: { x: 10, y: 2 },
    })
    expect(segments[5]).toEqual({ op: 'line', to: { x: 2, y: 6 } })
    expect(segments[8]).toEqual({
      op: 'curve',
      c1: { x: 0, y: 2 - k },
      c2: { x: 2 - k, y: 0 },
      to: { x: 2, y: 0 },
    })
  })
})

describe('insetPhotoMatrix', () => {
  it('shrinks the frame about its centre just enough to cover the inset box', () => {
    const m = insetPhotoMatrix(SIZE, { x: 3, y: 3, width: 94, height: 74 })

    expect(applyMatrix(m, { x: 0, y: 0 })).toEqual({
      x: expect.closeTo(3, 9) as number,
      y: expect.closeTo(2.4, 9) as number,
    })
    expect(applyMatrix(m, { x: 100, y: 80 })).toEqual({
      x: expect.closeTo(97, 9) as number,
      y: expect.closeTo(77.6, 9) as number,
    })
  })
})

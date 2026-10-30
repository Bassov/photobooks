import { afterEach, describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { COVER_CROP, shownCropRect } from '../core'
import { makeBook, makeFrame, makeSpread } from '../core/testing/fixtures'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
import {
  straightenedCrop,
  straightenPhoto,
  straightenPreviewTransform,
  turnedCrop,
  turnPhoto,
} from './photoRotate'

const RECT = { x: 0, y: 0, width: 100, height: 60 }
const FRAME_PX = { width: 200, height: 120 }

describe('turnedCrop', () => {
  it('cycles quarter turns both ways and resets zoom and pan', () => {
    const start = { zoom: 2, center: { x: 0.3, y: 0.6 } }
    const right = turnedCrop(RECT, start, 1.5, undefined, 1)
    expect(right).toEqual({
      zoom: 1,
      center: { x: 0.5, y: 0.5 },
      quarterTurns: 1,
    })
    expect(turnedCrop(RECT, right, 1.5, undefined, -1).quarterTurns).toBe(0)
    expect(
      turnedCrop(RECT, { ...COVER_CROP }, 1.5, undefined, -1).quarterTurns,
    ).toBe(3)
  })

  it('keeps the straighten angle', () => {
    const next = turnedCrop(
      RECT,
      { ...COVER_CROP, straightenDeg: 6 },
      1.5,
      undefined,
      1,
    )
    expect(next.straightenDeg).toBe(6)
  })
})

describe('straightenedCrop', () => {
  it('limits the angle to ±45° and pulls the center inside the photo', () => {
    const next = straightenedCrop(
      RECT,
      { zoom: 1, center: { x: 0.99, y: 0.5 } },
      1.2,
      undefined,
      60,
    )
    expect(next.straightenDeg).toBe(45)
    expect(next.center.x).toBeLessThan(0.99)
  })
})

/** Frame-center-relative px of image point `p` for a crop. */
function place(
  crop: Parameters<typeof shownCropRect>[1],
  aspect: number,
  p: { x: number; y: number },
) {
  const win = shownCropRect(RECT, crop, aspect)
  const rad = ((crop?.straightenDeg ?? 0) * Math.PI) / 180
  const dx = (p.x - (win.x + win.width / 2)) * (FRAME_PX.width / win.width)
  const dy = (p.y - (win.y + win.height / 2)) * (FRAME_PX.height / win.height)
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad),
    y: dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

/** Apply `translate rotate scale` (origin 0,0) to a point. */
function apply(transform: string, point: { x: number; y: number }) {
  const m =
    /translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\) rotate\((-?[\d.e-]+)deg\) scale\((-?[\d.e-]+)\)/.exec(
      transform,
    )
  if (m === null) throw new Error(transform)
  const [tx, ty, deg, scale] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
  ]
  const rad = (deg * Math.PI) / 180
  const x = point.x * scale
  const y = point.y * scale
  return {
    x: tx + x * Math.cos(rad) - y * Math.sin(rad),
    y: ty + x * Math.sin(rad) + y * Math.cos(rad),
  }
}

describe('straightenPreviewTransform', () => {
  test.prop(
    [
      fc.double({ min: -45, max: 45, noNaN: true }),
      fc.double({ min: -45, max: 45, noNaN: true }),
      fc.double({ min: 0.5, max: 2.5, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ],
    { numRuns: 150, seed: 20261030 },
  )(
    'moves every photo point from the committed layout to the new one',
    (from, to, aspect, cx, cy, px, py) => {
      const a = straightenedCrop(
        RECT,
        { zoom: 1.3, center: { x: cx, y: cy } },
        aspect,
        undefined,
        from,
      )
      const b = straightenedCrop(RECT, a, aspect, undefined, to)
      const transform = straightenPreviewTransform(
        { rect: RECT, aspect, fit: undefined, framePx: FRAME_PX },
        a,
        b,
      )
      const moved = apply(transform, place(a, aspect, { x: px, y: py }))
      const want = place(b, aspect, { x: px, y: py })
      expect(moved.x).toBeCloseTo(want.x, 4)
      expect(moved.y).toBeCloseTo(want.y, 4)
    },
  )
})

describe('turnPhoto / straightenPhoto', () => {
  afterEach(() => {
    resetBookStore()
  })
  function seed(assetId?: string) {
    resetBookStore({
      book: makeBook({
        assets: { a: {} },
        gallery: ['a'],
        spreads: [
          makeSpread({
            id: 's1',
            frames: [
              makeFrame({
                id: 'f1',
                ...(assetId === undefined ? {} : { assetId }),
                rect: RECT,
              }),
            ],
          }),
        ],
      }),
      sessionMeta: new Map(),
      importRunning: false,
      importExpectedCount: 0,
    })
  }
  const crop = () => getBookStoreSnapshot().book.spreads[0]?.frames[0]?.crop

  it('writes the turn and the angle to the frame crop', () => {
    seed('a')
    turnPhoto({ spreadId: 's1', frameId: 'f1' }, 1)
    straightenPhoto({ spreadId: 's1', frameId: 'f1' }, 3.5)
    expect(crop()?.quarterTurns).toBe(1)
    expect(crop()?.straightenDeg).toBe(3.5)
  })

  it('ignores empty frames and unknown targets', () => {
    seed()
    turnPhoto({ spreadId: 's1', frameId: 'f1' }, 1)
    straightenPhoto({ spreadId: 's1', frameId: 'f1' }, 3)
    turnPhoto({ spreadId: 'x', frameId: 'y' }, 1)
    expect(crop()).toBeUndefined()
  })
})

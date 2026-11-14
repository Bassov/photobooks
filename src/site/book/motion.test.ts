import { describe, expect, it } from 'vitest'
import type { RoomSlide } from '../siteModel'
import {
  EASE,
  fromDrag,
  scripted,
  sheetOf,
  TURN,
  xmEnd,
  xmStart,
  type Curl,
} from './motion'

const rad = (d: number) => (d * Math.PI) / 180

/** a CSS cubic-bezier point at parameter u, in Bernstein form */
function bezierAt(p1: number, p2: number, u: number) {
  const v = 1 - u
  return 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u
}

describe('the easings', () => {
  it.each([0.05, 0.2, 0.5, 0.8, 0.95])(
    'TURN is cubic-bezier(0.45, 0.05, 0.25, 1) at u = %s',
    (u) => {
      const x = bezierAt(0.45, 0.25, u)

      expect(TURN(x)).toBeCloseTo(bezierAt(0.05, 1, u), 12)
    },
  )

  it.each([0.05, 0.2, 0.5, 0.8, 0.95])(
    'EASE is cubic-bezier(0.2, 0.7, 0.2, 1) at u = %s',
    (u) => {
      const x = bezierAt(0.2, 0.2, u)

      expect(EASE(x)).toBeCloseTo(bezierAt(0.7, 1, u), 12)
    },
  )

  it('starts at 0 and ends at 1', () => {
    expect(TURN(0)).toBeCloseTo(0, 12)
    expect(TURN(1)).toBeCloseTo(1, 12)
    expect(EASE(0)).toBeCloseTo(0, 12)
    expect(EASE(1)).toBeCloseTo(1, 12)
  })
})

/** the distance from the grabbed point C to the curl axis through (xm, ph/2), along the lean */
function axisDistance(s: Curl, C: { x: number; y: number }, ph: number) {
  return (C.x - s.xm) * Math.cos(s.beta) + (C.y - ph / 2) * Math.sin(s.beta)
}

describe('the curl model ends', () => {
  it('starts where the axis touches the leading corner', () => {
    expect(xmStart(300, 400, rad(10))).toBeCloseTo(
      300 + 200 * Math.tan(rad(10)),
      10,
    )
    expect(xmStart(300, 400, 0)).toBe(300)
  })

  it('ends with the curl off the screen', () => {
    expect(xmEnd(27)).toBe(-45)
    expect(xmEnd(0)).toBe(-18)
  })

  it('runs a scripted turn linearly in the eased progress, the lean easing out', () => {
    const start = xmStart(300, 400, rad(15))

    const mid = scripted(300, 400, 27, 0.25)

    expect(mid.xm).toBeCloseTo(start + (-45 - start) * 0.25, 10)
    expect(mid.beta).toBeCloseTo(rad(15) * 0.75, 12)
    expect(mid.r).toBe(27)
  })
})

describe('a forward drag', () => {
  const bottom = { x: 300, y: 400 }
  const top = { x: 300, y: 0 }

  it('leans along the drag, plus the corner lead easing out with progress', () => {
    const s = fromDrag(300, 400, 27, bottom, true, -60, -10)

    expect(s.beta).toBeCloseTo(Math.atan2(10, 60) + rad(15) * 0.8, 12)
    expect(axisDistance(s, bottom, 400)).toBeCloseTo(
      60 * Math.cos(s.beta) + 10 * Math.sin(s.beta),
      10,
    )
  })

  it('mirrors the lead for the top corner', () => {
    const s = fromDrag(300, 400, 27, top, true, -60, 10)

    expect(s.beta).toBeCloseTo(-Math.atan2(10, 60) - rad(15) * 0.8, 12)
    expect(axisDistance(s, top, 400)).toBeCloseTo(
      60 * Math.cos(s.beta) - 10 * Math.sin(s.beta),
      10,
    )
  })

  it('leans up from a corner grabbed exactly at mid-height', () => {
    const s = fromDrag(300, 400, 27, { x: 300, y: 200 }, true, -60, 0)

    expect(s.beta).toBeCloseTo(-rad(12), 12)
  })

  it('caps the lean at 25° and folds the corner past πr under the finger', () => {
    const s = fromDrag(300, 400, 27, bottom, true, -60, -80)
    const L = 60 * Math.cos(rad(25)) + 80 * Math.sin(rad(25))

    expect(s.beta).toBeCloseTo(rad(25), 12)
    expect(axisDistance(s, bottom, 400)).toBeCloseTo((L + Math.PI * 27) / 2, 10)
  })

  it('holds the axis at the finger distance before πr', () => {
    const s = fromDrag(300, 400, 27, bottom, true, -30, -40)
    const L = 30 * Math.cos(rad(25)) + 40 * Math.sin(rad(25))

    expect(axisDistance(s, bottom, 400)).toBeCloseTo(L, 10)
    expect(s.xm).toBeCloseTo(
      xmStart(300, 400, rad(25)) - L / Math.cos(rad(25)),
      10,
    )
  })

  it('ignores the drag direction under 1 px, takes it from 1 px', () => {
    const under = fromDrag(300, 400, 27, bottom, true, 0, -0.5)
    const at = fromDrag(300, 400, 27, bottom, true, 0, -1)

    expect(under.beta).toBeCloseTo(rad(15), 12)
    expect(at.beta).toBeCloseTo(rad(25), 12)
  })

  it('drops the corner lead once the drag spans the page', () => {
    const s = fromDrag(300, 400, 27, bottom, true, -400, 0)

    expect(s.beta).toBe(0)
    expect(s.xm).toBeCloseTo(300 - (400 + Math.PI * 27) / 2, 10)
  })
})

describe('sheetOf', () => {
  const s = (page: RoomSlide['page']): RoomSlide => ({
    view: 1,
    label: '',
    ...(page && { page }),
  })

  it('maps spread 0 to the first page on either side', () => {
    expect(sheetOf(s({ spread: 0, side: 'left' }))).toStrictEqual({
      kind: 'page',
      page: 0,
    })
    expect(sheetOf(s(undefined))).toStrictEqual({ kind: 'cover' })
  })
})

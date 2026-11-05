import { describe, expect, it } from 'vitest'
import {
  clampPan,
  fitArea,
  fitBox,
  fitInsets,
  settle,
  wheelFactor,
  FIT_INSETS,
  ZOOM_MAX,
  ZOOM_SNAP,
  ZOOM_STEP,
  ZOOM_TOGGLE,
  zoomAt,
  type Rect,
} from './pagerZoom'

const alps = { w: 380, h: 230 }
const sea = { w: 560, h: 210 }
const desktop = { w: 1440, h: 900 }

/** Spec §2 values are truncated to 2 dp; the brief allows ±0.01. */
function expectRect(actual: Rect, expected: Rect): void {
  for (const key of ['x', 'y', 'w', 'h'] as const) {
    expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(0.01)
  }
}

describe('constants (spec §3–§4)', () => {
  it('pins the zoom steps, range and insets', () => {
    expect([ZOOM_MAX, ZOOM_STEP, ZOOM_TOGGLE, ZOOM_SNAP]).toEqual([
      3, 1.5, 2, 1.02,
    ])
    expect(FIT_INSETS).toEqual({ top: 64, bottom: 48, side: 64, sideTouch: 8 })
  })
})

describe('fitInsets', () => {
  it('keeps 64 px sides for the arrows on hover devices', () => {
    expect(fitInsets(true)).toEqual({ top: 64, bottom: 48, side: 64 })
  })

  it('uses 8 px sides on touch', () => {
    expect(fitInsets(false)).toEqual({ top: 64, bottom: 48, side: 8 })
  })
})

describe('fitArea', () => {
  it('is the viewport minus the insets', () => {
    expect(fitArea(desktop, fitInsets(true))).toEqual({
      x: 64,
      y: 64,
      w: 1312,
      h: 788,
    })
  })

  it('never goes negative in a tiny viewport', () => {
    expect(fitArea({ w: 100, h: 100 }, fitInsets(true))).toEqual({
      x: 64,
      y: 64,
      w: 0,
      h: 0,
    })
  })
})

describe('fitBox (spec §2 table)', () => {
  it('fits the Alps spread by height at 1440 × 900', () => {
    expectRect(fitBox(alps, desktop, fitInsets(true)), {
      x: 69.04,
      y: 64,
      w: 1301.91,
      h: 788,
    })
  })

  it('fits the Sea spread by width at 1440 × 900', () => {
    expectRect(fitBox(sea, desktop, fitInsets(true)), {
      x: 64,
      y: 212,
      w: 1312,
      h: 492,
    })
  })

  it('fits Alps on a 390 × 844 phone with touch sides', () => {
    expectRect(fitBox(alps, { w: 390, h: 844 }, fitInsets(false)), {
      x: 8,
      y: 316.82,
      w: 374,
      h: 226.36,
    })
  })

  it('fits Alps on an 844 × 390 phone with touch sides', () => {
    expectRect(fitBox(alps, { w: 844, h: 390 }, fitInsets(false)), {
      x: 192.35,
      y: 64,
      w: 459.3,
      h: 278,
    })
  })
})

describe('clampPan', () => {
  const area = fitArea(desktop, fitInsets(true))
  const box = fitBox(alps, desktop, fitInsets(true))

  it('centres an axis that still fits the area', () => {
    // 1301.91 × 1.005 < 1312 wide: centred; 788 × 1.005 > 788 tall.
    const next = clampPan({ z: 1.005, x: 500, y: 0 }, box, area)
    expect(next.x).toBeCloseTo((box.w * -0.005) / 2, 6)
  })

  it('keeps an in-range pan when zoomed past the area', () => {
    expect(clampPan({ z: 2, x: -500, y: -300 }, box, area)).toEqual({
      z: 2,
      x: -500,
      y: -300,
    })
  })

  it('stops the left edge at the fit-area left', () => {
    const next = clampPan({ z: 2, x: 100, y: 0 }, box, area)
    expect(next.x).toBeCloseTo(area.x - box.x, 6)
    expect(next.y).toBe(0)
  })

  it('stops the right and bottom edges at the fit-area edges', () => {
    const next = clampPan({ z: 2, x: -5000, y: -5000 }, box, area)
    expect(box.x + next.x + box.w * 2).toBeCloseTo(area.x + area.w, 6)
    expect(box.y + next.y + box.h * 2).toBeCloseTo(area.y + area.h, 6)
  })

  it('has no pan at z = 1', () => {
    expect(clampPan({ z: 1, x: 40, y: -40 }, box, area)).toEqual({
      z: 1,
      x: 0,
      y: 0,
    })
  })
})

describe('zoomAt', () => {
  const area = fitArea(desktop, fitInsets(true))
  const box = fitBox(alps, desktop, fitInsets(true))
  const fit = { z: 1, x: 0, y: 0 }

  const cx = area.x + area.w / 2
  const cy = area.y + area.h / 2

  it('toggles to 2× about the fit-area centre and keeps it centred', () => {
    const next = zoomAt(fit, ZOOM_TOGGLE, cx, cy, box, area)
    expect(next.z).toBe(2)
    expect(next.x).toBeCloseTo(-(cx - box.x), 6)
    expect(next.y).toBeCloseTo(-(cy - box.y), 6)
  })

  it('steps back to the fitted view with ÷ ZOOM_STEP from 1.5×', () => {
    const zoomed = zoomAt(fit, ZOOM_STEP, cx, cy, box, area)
    expect(zoomed.z).toBe(1.5)
    expect(zoomAt(zoomed, 1 / ZOOM_STEP, cx, cy, box, area)).toEqual(fit)
  })

  it('keeps the content point under the cursor from a zoomed state', () => {
    const from = { z: 2, x: -400, y: -200 }
    const px = 500
    const py = 350
    const u = (px - box.x - from.x) / from.z
    const v = (py - box.y - from.y) / from.z
    const next = zoomAt(from, 1.25, px, py, box, area)
    expect(next.z).toBe(2.5)
    expect(box.x + next.x + u * next.z).toBeCloseTo(px, 6)
    expect(box.y + next.y + v * next.z).toBeCloseTo(py, 6)
  })

  it('stops at ZOOM_MAX', () => {
    expect(zoomAt({ z: 2.5, x: 0, y: 0 }, 2, 700, 400, box, area).z).toBe(
      ZOOM_MAX,
    )
  })

  it('does not zoom out past the fitted view', () => {
    expect(
      zoomAt({ z: 2, x: -300, y: -200 }, 0.1, 700, 400, box, area),
    ).toEqual({ z: 1, x: 0, y: 0 })
  })
})

describe('wheelFactor', () => {
  it('zooms in on a negative pixel delta', () => {
    expect(wheelFactor(-100, 0)).toBeCloseTo(Math.E, 9)
  })

  it('zooms out on a positive pixel delta', () => {
    expect(wheelFactor(100, 0)).toBeCloseTo(1 / Math.E, 9)
  })

  it('counts a line as 16 px', () => {
    expect(wheelFactor(-1, 1)).toBeCloseTo(Math.exp(0.16), 9)
  })

  it('treats page mode as pixels', () => {
    expect(wheelFactor(-1, 2)).toBeCloseTo(Math.exp(0.01), 9)
  })
})

describe('settle', () => {
  it('snaps a near-1 zoom back to the fitted view', () => {
    expect(settle({ z: 1.019, x: -3, y: 2 })).toEqual({ z: 1, x: 0, y: 0 })
  })

  it('keeps a zoom at the snap threshold', () => {
    const zoom = { z: ZOOM_SNAP, x: -3, y: 2 }
    expect(settle(zoom)).toBe(zoom)
  })
})

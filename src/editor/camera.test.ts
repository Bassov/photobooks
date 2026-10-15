import { describe, expect, it } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import {
  centerSpreadScroll,
  clampZoom,
  fitStackZoom,
  fitZoom,
  formatZoomPercent,
  physicalZoom,
  pinchZoom,
  stepZoom,
  wheelZoomFactor,
  ZOOM_STEP,
  zoomAtPoint,
  zoomLimits,
  zoomPercent,
  type ZoomFrame,
} from './camera'

function blankFrame(): ZoomFrame {
  return {
    zoom: 0,
    scrollLeft: 0,
    scrollTop: 0,
    translateX: 0,
    translateY: 0,
    scale: 0,
  }
}

describe('physical zoom', () => {
  it('reads 100% at physical size and 13% at the layout scale', () => {
    expect(zoomPercent(physicalZoom())).toBe(100)
    expect(formatZoomPercent(1)).toBe('13%')
    expect(zoomPercent(Number.NaN)).toBe(0)
  })
})

describe('clampZoom', () => {
  it('clamps to the finite range and replaces a non-finite zoom with the minimum', () => {
    expect(clampZoom(5, 1, 4)).toBe(4)
    expect(clampZoom(0.2, 1, 4)).toBe(1)
    expect(clampZoom(Number.NaN, 1, 4)).toBe(1)
    expect(clampZoom(2, 3, 1)).toBe(3)
  })
})

describe('zoomLimits', () => {
  it('keeps the stack fit as the minimum and 400% physical as a maximum floor', () => {
    const limits = zoomLimits({ fitSpread: 2, fitWidth: 3, fitStack: 0.4 })
    expect(limits.minZoom).toBe(0.4)
    expect(limits.maxZoom).toBeGreaterThanOrEqual(physicalZoom() * 4)
    expect(limits.maxZoom).toBeGreaterThanOrEqual(3)
  })

  it('raises the maximum when fit width exceeds 400% physical', () => {
    const limits = zoomLimits({ fitSpread: 1, fitWidth: 80, fitStack: 0.2 })
    expect(limits.maxZoom).toBe(80)
  })
})

describe('zoomAtPoint', () => {
  it('keeps the anchor on the same content point', () => {
    const frame = zoomAtPoint(
      {
        zoom: 2,
        scrollLeft: 10,
        scrollTop: 20,
        anchorX: 30,
        anchorY: 40,
        factor: 1.5,
        minZoom: 0.1,
        maxZoom: 40,
      },
      blankFrame(),
    )
    expect(frame.zoom).toBe(3)
    expect(frame.scale).toBe(1.5)
    expect(frame.scrollLeft + 30).toBeCloseTo((10 + 30) * 1.5)
    expect(frame.scrollTop + 40).toBeCloseTo((20 + 40) * 1.5)
    expect(frame.translateX).toBeCloseTo((10 + 30) * (1 - 1.5))
  })

  it('ignores a non-positive factor', () => {
    const frame = zoomAtPoint(
      {
        zoom: 2,
        scrollLeft: 0,
        scrollTop: 0,
        anchorX: 0,
        anchorY: 0,
        factor: 0,
        minZoom: 0.1,
        maxZoom: 40,
      },
      blankFrame(),
    )
    expect(frame.zoom).toBe(2)
    expect(frame.scale).toBe(1)
  })
})

describe('pinchZoom', () => {
  it('matches zoomAtPoint for a two-pointer pinch', () => {
    const shared = {
      zoom: 2,
      scrollLeft: 5,
      scrollTop: 6,
      minZoom: 0.1,
      maxZoom: 40,
    }
    const pinched = pinchZoom(
      {
        ...shared,
        startA: { x: 10, y: 20 },
        startB: { x: 50, y: 20 },
        currentA: { x: 0, y: 20 },
        currentB: { x: 80, y: 20 },
      },
      blankFrame(),
    )
    const direct = zoomAtPoint(
      {
        ...shared,
        anchorX: 40,
        anchorY: 20,
        factor: 2,
      },
      blankFrame(),
    )
    expect(pinched).toEqual(direct)
  })

  it('does not zoom when the pointers start together', () => {
    const frame = pinchZoom(
      {
        zoom: 2,
        scrollLeft: 0,
        scrollTop: 0,
        startA: { x: 4, y: 4 },
        startB: { x: 4, y: 4 },
        currentA: { x: 0, y: 0 },
        currentB: { x: 20, y: 0 },
        minZoom: 0.1,
        maxZoom: 40,
      },
      blankFrame(),
    )
    expect(frame.zoom).toBe(2)
  })
})

describe('fitZoom', () => {
  it('fits width without using height', () => {
    expect(
      fitZoom({
        contentWidthPx: 100,
        contentHeightPx: 400,
        viewportWidth: 250,
        viewportHeight: 100,
        mode: 'width',
      }),
    ).toBe(2.5)
  })

  it('contains by the tighter axis', () => {
    expect(
      fitZoom({
        contentWidthPx: 100,
        contentHeightPx: 200,
        viewportWidth: 300,
        viewportHeight: 100,
        mode: 'contain',
      }),
    ).toBe(0.5)
  })

  it('uses width when contain has no height', () => {
    expect(
      fitZoom({
        contentWidthPx: 100,
        contentHeightPx: 0,
        viewportWidth: 250,
        viewportHeight: 0,
        mode: 'contain',
      }),
    ).toBe(2.5)
  })

  it('returns 1 when the viewport has no width', () => {
    expect(
      fitZoom({
        contentWidthPx: 100,
        contentHeightPx: 100,
        viewportWidth: 0,
        viewportHeight: 100,
        mode: 'contain',
      }),
    ).toBe(1)
  })
})

describe('fitStackZoom', () => {
  it('contains the whole stack', () => {
    expect(
      fitStackZoom({
        stackWidthPx: 400,
        stackHeightPx: 800,
        viewportWidth: 200,
        viewportHeight: 200,
      }),
    ).toBe(0.25)
  })
})

describe('stepZoom', () => {
  it('multiplies by the quarter-stop and divides on zoom out', () => {
    expect(stepZoom(1, 1, 0.1, 10)).toBeCloseTo(ZOOM_STEP)
    expect(stepZoom(ZOOM_STEP, -1, 0.1, 10)).toBeCloseTo(1)
  })
})

describe('wheelZoomFactor', () => {
  it('zooms in when the wheel delta is negative', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1)
    expect(wheelZoomFactor(0)).toBe(1)
    expect(wheelZoomFactor(Number.NaN)).toBe(1)
  })
})

describe('centerSpreadScroll', () => {
  it('centers the spread and clamps to the content', () => {
    expect(
      centerSpreadScroll({
        spreadLeftPx: 0,
        spreadTopPx: 0,
        spreadWidthPx: 100,
        spreadHeightPx: 80,
        viewportWidth: 40,
        viewportHeight: 20,
        contentWidth: 100,
        contentHeight: 80,
      }),
    ).toEqual({ scrollLeft: 30, scrollTop: 30 })

    expect(
      centerSpreadScroll({
        spreadLeftPx: 0,
        spreadTopPx: 0,
        spreadWidthPx: 10,
        spreadHeightPx: 10,
        viewportWidth: 40,
        viewportHeight: 40,
        contentWidth: 10,
        contentHeight: 10,
      }),
    ).toEqual({ scrollLeft: 0, scrollTop: 0 })

    expect(
      centerSpreadScroll({
        spreadLeftPx: 80,
        spreadTopPx: 70,
        spreadWidthPx: 40,
        spreadHeightPx: 40,
        viewportWidth: 20,
        viewportHeight: 20,
        contentWidth: 100,
        contentHeight: 90,
      }),
    ).toEqual({ scrollLeft: 80, scrollTop: 70 })
  })
})

test.prop(
  [
    fc.double({ min: 0.25, max: 8, noNaN: true }),
    fc.double({ min: 0, max: 400, noNaN: true }),
    fc.double({ min: 0, max: 400, noNaN: true }),
    fc.double({ min: 0, max: 200, noNaN: true }),
    fc.double({ min: 0, max: 200, noNaN: true }),
    fc.double({ min: 0.5, max: 2, noNaN: true }),
  ],
  { numRuns: 100 },
)(
  'zoom at a point keeps that viewport anchor on the same content point',
  (zoom, scrollLeft, scrollTop, anchorX, anchorY, factor) => {
    const frame = zoomAtPoint(
      {
        zoom,
        scrollLeft,
        scrollTop,
        anchorX,
        anchorY,
        factor,
        minZoom: 0.05,
        maxZoom: 40,
      },
      blankFrame(),
    )
    const scale = frame.zoom / zoom
    expect(frame.scrollLeft + anchorX).toBeCloseTo(
      (scrollLeft + anchorX) * scale,
    )
    expect(frame.scrollTop + anchorY).toBeCloseTo((scrollTop + anchorY) * scale)
    expect(frame.zoom).toBeGreaterThanOrEqual(0.05)
    expect(frame.zoom).toBeLessThanOrEqual(40)
  },
)

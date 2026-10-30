import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { DPI_MIN, DPI_WARN, frameDpi, lowDpi, resolveSpread } from '../index'
import { makeBook, makeFrame, makeSpread } from '../testing/fixtures'

const FULL = { x: 0, y: 0, width: 1, height: 1 }
const rect = (width: number, height = width) => ({ x: 0, y: 0, width, height })

describe('frameDpi', () => {
  it('is source pixels per inch across the frame width', () => {
    // 2540 px over 254 mm (10 in) = 254 dpi
    expect(frameDpi(rect(254), FULL, 0, 2540, 1000)).toBeCloseTo(254)
  })

  it('uses the source height when the photo is turned a quarter', () => {
    expect(frameDpi(rect(254), FULL, 1, 5000, 2540)).toBeCloseTo(254)
    expect(frameDpi(rect(254), FULL, 3, 5000, 2540)).toBeCloseTo(254)
    expect(frameDpi(rect(254), FULL, 2, 2540, 5000)).toBeCloseTo(254)
  })

  test.prop([
    fc.double({ min: 10, max: 500, noNaN: true }),
    fc.double({ min: 0.05, max: 1, noNaN: true }),
    fc.integer({ min: 100, max: 9000 }),
  ])('zooming in (smaller window) never raises dpi', (mm, w, px) => {
    const full = frameDpi(rect(mm), FULL, 0, px, px)
    const zoomed = frameDpi(rect(mm), { ...FULL, width: w }, 0, px, px)
    expect(zoomed).toBeLessThanOrEqual(full + 1e-9)
  })
})

describe('lowDpi', () => {
  it('is undefined at or above the warn threshold', () => {
    expect(lowDpi(DPI_WARN)).toBeUndefined()
    expect(lowDpi(300)).toBeUndefined()
    expect(lowDpi(Number.NaN)).toBeUndefined()
  })

  it('warns between min and warn, min below min', () => {
    expect(lowDpi(DPI_WARN - 0.4)).toEqual({ dpi: 200, level: 'warn' })
    expect(lowDpi(DPI_MIN)).toEqual({ dpi: 150, level: 'warn' })
    expect(lowDpi(DPI_MIN - 1)).toEqual({ dpi: 149, level: 'min' })
  })

  test.prop([fc.double({ min: 0, max: 1000, noNaN: true })])(
    'level matches the thresholds',
    (dpi) => {
      const low = lowDpi(dpi)
      if (dpi >= DPI_WARN) {
        expect(low).toBeUndefined()
      } else {
        expect(low?.level).toBe(dpi < DPI_MIN ? 'min' : 'warn')
      }
    },
  )
})

describe('resolveSpread lowDpi', () => {
  const book = (zoom: number, widthPx?: number) =>
    makeBook({
      assets: {
        a: widthPx === undefined ? {} : { widthPx, heightPx: widthPx },
      },
      spreads: [
        makeSpread({
          frames: [
            makeFrame({
              rect: { x: 0, y: 0, width: 254, height: 254 },
              assetId: 'a',
              crop: { zoom, center: { x: 0.5, y: 0.5 } },
            }),
          ],
        }),
      ],
    })

  it('flags a frame only once zoom pushes it below the warn threshold', () => {
    // 2540 px over 10 in = 254 dpi at zoom 1, 127 dpi at zoom 2.
    const at = (zoom: number) =>
      resolveSpread(book(zoom, 2540), 'spread-1')?.items[0]?.lowDpi
    expect(at(1)).toBeUndefined()
    expect(at(1.2)).toBeUndefined()
    expect(at(1.5)).toEqual({ dpi: 169, level: 'warn' })
    expect(at(2)).toEqual({ dpi: 127, level: 'min' })
  })

  it('needs both asset dimensions and omits the key when not low', () => {
    const only = (a: { widthPx?: number; heightPx?: number }) =>
      resolveSpread({ ...book(4), assets: { a } }, 'spread-1')?.items[0]
    expect(only({ widthPx: 100 })?.lowDpi).toBeUndefined()
    expect(only({ heightPx: 100 })?.lowDpi).toBeUndefined()
    expect(only({ widthPx: 100, heightPx: 100 })?.lowDpi).toBeDefined()
    const sharp = resolveSpread(book(1, 2540), 'spread-1')?.items[0]
    expect(sharp !== undefined && 'lowDpi' in sharp).toBe(false)
  })

  it('prefers the session pixel size over the asset record', () => {
    const items = (size: { widthPx: number; heightPx: number } | undefined) =>
      resolveSpread(book(1, 2540), 'spread-1', { getPixelSize: () => size })
        ?.items[0]
    expect(items({ widthPx: 1000, heightPx: 1000 })?.lowDpi?.dpi).toBe(100)
    expect(items(undefined)?.lowDpi).toBeUndefined()
  })

  it('stays silent without asset pixel dimensions', () => {
    expect(resolveSpread(book(4), 'spread-1')?.items[0]?.lowDpi).toBeUndefined()
  })
})

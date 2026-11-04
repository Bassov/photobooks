import { describe, expect, it } from 'vitest'
import { DPI_MIN, DPI_WARN, type DpiThresholds } from '../core'
import { pageFillLowRes as pageFillLowResWith } from './pageFillLowRes'

// One inch square page: the page-fill resolution is the short side in px.
const INCH = { widthMm: 25.4, heightMm: 25.4 }
const DEFAULTS: DpiThresholds = { warn: DPI_WARN, min: DPI_MIN }

const pageFillLowRes = (
  trim: { widthMm: number; heightMm: number },
  size: { widthPx: number; heightPx: number },
) => pageFillLowResWith(trim, size, DEFAULTS)

describe('pageFillLowRes', () => {
  it('flags a photo just below the canvas badge threshold', () => {
    expect(
      pageFillLowRes(INCH, { widthPx: DPI_WARN - 1, heightPx: DPI_WARN - 1 }),
    ).toBe(true)
  })

  it('passes a photo exactly at the threshold', () => {
    expect(
      pageFillLowRes(INCH, { widthPx: DPI_WARN, heightPx: DPI_WARN }),
    ).toBe(false)
  })

  it("uses the profile's warn threshold, not the default", () => {
    const size = { widthPx: 250, heightPx: 250 }
    expect(pageFillLowResWith(INCH, size, { warn: 300, min: 200 })).toBe(true)
    expect(pageFillLowResWith(INCH, size, { warn: 250, min: 200 })).toBe(false)
  })

  it('fills the page: the short side of a landscape photo decides', () => {
    expect(
      pageFillLowRes(INCH, { widthPx: 4 * DPI_WARN, heightPx: DPI_WARN - 1 }),
    ).toBe(true)
    expect(
      pageFillLowRes(INCH, { widthPx: 4 * DPI_WARN, heightPx: DPI_WARN }),
    ).toBe(false)
  })

  it('fills the page: the narrow side of a portrait photo decides', () => {
    expect(
      pageFillLowRes(INCH, { widthPx: DPI_WARN - 1, heightPx: 4 * DPI_WARN }),
    ).toBe(true)
    expect(
      pageFillLowRes(INCH, { widthPx: DPI_WARN, heightPx: 4 * DPI_WARN }),
    ).toBe(false)
  })

  it('follows the page size: a larger page lowers the resolution', () => {
    const size = { widthPx: 1600, heightPx: 2000 }
    // 19 × 23 cm: min(1600 / 7.48, 2000 / 9.06) in ≈ 214 dpi.
    expect(pageFillLowRes({ widthMm: 190, heightMm: 230 }, size)).toBe(false)
    // 21 × 29.7 cm: 2000 px over 11.69 in ≈ 171 dpi.
    expect(pageFillLowRes({ widthMm: 210, heightMm: 297 }, size)).toBe(true)
  })

  it('a wide page is limited by the photo width', () => {
    // 2 in × 1 in page, 399 × 1000 px photo: 399 / 2 = 199.5 dpi.
    expect(
      pageFillLowRes(
        { widthMm: 50.8, heightMm: 25.4 },
        { widthPx: 399, heightPx: 1000 },
      ),
    ).toBe(true)
    expect(
      pageFillLowRes(
        { widthMm: 50.8, heightMm: 25.4 },
        { widthPx: 400, heightPx: 1000 },
      ),
    ).toBe(false)
  })
})

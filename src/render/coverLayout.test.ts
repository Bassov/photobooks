import { describe, expect, it } from 'vitest'
import { coverGeometry } from '../core/print/coverGeometry'
import { genericPrintProfile } from '../core/print/genericProfile'
import { makeBook } from '../core/testing/fixtures'
import { coverLayout, coverPanelPpi, sameCoverGeometry } from './coverLayout'

/** Generic-profile geometry of a `w × h` cm book with `pages` pages. */
function geometryOf(widthMm: number, heightMm: number, pages: number) {
  const book = makeBook()
  const spreads = Array.from(
    { length: pages / 2 + 1 },
    (_, index) => book.spreads[index % book.spreads.length],
  )
  return coverGeometry(genericPrintProfile(), {
    ...book,
    spreads: spreads.filter((spread) => spread !== undefined),
    settings: { ...book.settings, trim: { widthMm, heightMm } },
  })
}

/** Px at Designer Fit: the sheet is 848 px wide in the 1440 × 900 band. */
const FIT_W = 848

describe('coverLayout', () => {
  it('matches the Designer Fit numbers at 20 pages (19 × 23 cm)', () => {
    const layout = coverLayout(geometryOf(190, 230, 20))
    const px = (pct: number) => (pct / 100) * FIT_W
    expect(layout.sheetAspectRatio).toBe('422 / 260')
    expect(layout.sheetFitWidth).toBe(
      `min(100cqw, 100cqh * ${String(422 / 260)})`,
    )
    expect(px(layout.cover.width)).toBeCloseTo(787.73, 1)
    expect(px(layout.cover.left)).toBeCloseTo(30.14, 1)
    expect(px(layout.spineToPct - layout.spineFromPct)).toBeCloseTo(24.11, 1)
    expect(px(layout.bandXPct)).toBeCloseTo(30.14, 1)
    expect(px(layout.hingeBack.width)).toBeCloseTo(16.08, 1)
    expect(px(layout.safeBack.left)).toBeCloseTo(292.19 - 252, 1)
    expect(px(layout.safeFront.left)).toBeCloseTo(704.13 - 252, 1)
    expect(px(layout.safeFront.width)).toBeCloseTo(355.68, 1)
    // Vertical shares of the 522.47 px sheet (top at 136.76).
    const py = (pct: number) => (pct / 100) * 522.47
    expect(py(layout.cover.top)).toBeCloseTo(30.14, 1)
    expect(py(layout.safeFront.top)).toBeCloseTo(176.96 - 136.76, 1)
    expect(py(layout.safeFront.height)).toBeCloseTo(442.08, 1)
    expect(px(layout.hingeFront.left)).toBeCloseTo(688.05 - 252, 1)
    expect(px(layout.hingeBack.left + layout.hingeBack.width)).toBeCloseTo(
      663.94 - 252,
      1,
    )
    expect(layout.bandYPct).toBeCloseTo((15 / 260) * 100, 9)
    expect(layout.spinePct).toBeCloseTo((12 / 392) * 100, 9)
    expect(2 * layout.pagePct + layout.spinePct).toBeCloseTo(100, 9)
    expect(layout.aspectRatio).toBe('392 / 230')
    expect(layout.photoOverflowYPct).toBeCloseTo((15 / 230) * 100, 9)
    expect(layout.photoOverflowXPct).toBeCloseTo((15 / 190) * 100, 9)
    expect(layout.spineFrac).toBeCloseTo(12 / 392, 9)
    expect(layout.spineLenFrac).toBeCloseTo(220 / 392, 9)
    expect(layout.bandOfTrim).toBeCloseTo(15 / 230, 9)
    expect(layout.frontDropFrom).toBeCloseTo(217 / 422, 9)
  })

  it('widens the spine to 61.39 px at 120 pages', () => {
    const layout = coverLayout(geometryOf(190, 230, 120))
    const px = (pct: number) => (pct / 100) * FIT_W
    expect(px(layout.spineToPct - layout.spineFromPct)).toBeCloseTo(61.39, 1)
    expect(px(layout.cover.width)).toBeCloseTo(790.44, 1)
    expect(px(layout.bandXPct)).toBeCloseTo(28.78, 1)
  })

  it('leaves an A3 landscape band under the chip threshold', () => {
    const layout = coverLayout(geometryOf(420, 297, 20))
    const sheetHPx = FIT_W * (327 / 882)
    expect(sheetHPx).toBeCloseTo(314.4, 1)
    expect((layout.bandYPct / 100) * sheetHPx).toBeCloseTo(14.42, 1)
  })
})

describe('sameCoverGeometry', () => {
  it('is equal for equal values and differs on any drawn value', () => {
    const a = geometryOf(190, 230, 20)
    expect(sameCoverGeometry(a, geometryOf(190, 230, 20))).toBe(true)
    expect(sameCoverGeometry(a, geometryOf(190, 230, 22))).toBe(false)
    expect(sameCoverGeometry(a, geometryOf(190, 240, 20))).toBe(false)
    expect(sameCoverGeometry(a, { ...a, profileName: 'Other' })).toBe(false)
    expect(sameCoverGeometry(a, { ...a, source: 'manual' })).toBe(false)
    expect(sameCoverGeometry(a, { ...a, hinge: 9 })).toBe(false)
    expect(sameCoverGeometry(a, { ...a, wrap: 9 })).toBe(false)
    expect(sameCoverGeometry(a, { ...a, safe: 9 })).toBe(false)
    expect(sameCoverGeometry(a, { ...a, trimW: 9 })).toBe(false)
    expect(sameCoverGeometry(a, { ...a, spine: 9 })).toBe(false)
    expect(sameCoverGeometry(a, { ...a, printedPages: 9 })).toBe(false)
  })
})

describe('coverPanelPpi', () => {
  it('uses the tighter axis and divides by the crop zoom', () => {
    const photo = { widthPx: 2400, heightPx: 1800 }
    const panel = { widthMm: 300, heightMm: 300 }
    expect(coverPanelPpi(photo, panel, 1)).toBe(152)
    expect(coverPanelPpi(photo, panel, 2)).toBe(76)
    expect(coverPanelPpi({ widthPx: 1800, heightPx: 2400 }, panel, 1)).toBe(152)
  })
})

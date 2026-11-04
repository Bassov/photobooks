import assert from 'node:assert/strict'
import { describe, expect, it } from 'vitest'
import {
  frameDpi,
  genericPrintProfile,
  lowDpi,
  parsePrintProfile,
  sourceCropRect,
  type Frame,
  type PrintProfile,
} from '../index'

const IN = 25.4

function profileWithDpi(warn: number, min: number): PrintProfile {
  const parsed = parsePrintProfile({
    ...genericPrintProfile(),
    id: 'lab',
    dpi: { warn, min },
  })
  assert(parsed.ok)
  return parsed.profile
}

/** Effective DPI of a photo (EXIF-oriented px) in a frame, as the editor reads it. */
function effective(
  frameMm: { width: number; height: number },
  px: { widthPx: number; heightPx: number },
  crop: Frame['crop'],
) {
  const rect = { x: 0, y: 0, ...frameMm }
  const window = sourceCropRect(rect, crop, px.widthPx / px.heightPx)
  return frameDpi(
    rect,
    window,
    crop?.quarterTurns ?? 0,
    px.widthPx,
    px.heightPx,
  )
}

const CENTER = { x: 0.5, y: 0.5 }
const generic = genericPrintProfile()

describe('effective DPI through profile thresholds', () => {
  it('frame size: 3000 px across a 10 in frame is 300 dpi, across 20 in 150', () => {
    const photo = { widthPx: 3000, heightPx: 2000 }
    // Frames wider than the 3:2 photo use its full width.
    const small = effective(
      { width: 10 * IN, height: 5 * IN },
      photo,
      undefined,
    )
    const large = effective(
      { width: 20 * IN, height: 10 * IN },
      photo,
      undefined,
    )
    expect(small).toBeCloseTo(300)
    expect(large).toBeCloseTo(150)
    expect(lowDpi(small, generic.dpi)).toBeUndefined()
    expect(lowDpi(large, generic.dpi)).toEqual({ dpi: 150, level: 'warn' })
    const strict = profileWithDpi(300, 200).dpi
    expect(lowDpi(small, strict)).toBeUndefined()
    expect(lowDpi(large, strict)).toEqual({ dpi: 150, level: 'min' })
  })

  it('crop zoom: 2000 px in a 10 in square is 200 dpi, 160 at 1.25×, 100 at 2×', () => {
    const photo = { widthPx: 2000, heightPx: 2000 }
    const frame = { width: 10 * IN, height: 10 * IN }
    const at = (zoom: number) =>
      effective(frame, photo, { zoom, center: CENTER })
    expect(at(1)).toBeCloseTo(200)
    expect(at(1.25)).toBeCloseTo(160)
    expect(at(2)).toBeCloseTo(100)
    expect(lowDpi(at(1), generic.dpi)).toBeUndefined()
    expect(lowDpi(at(1.25), generic.dpi)).toEqual({ dpi: 160, level: 'warn' })
    expect(lowDpi(at(2), generic.dpi)).toEqual({ dpi: 100, level: 'min' })
    const lenient = profileWithDpi(150, 120).dpi
    expect(lowDpi(at(1.25), lenient)).toBeUndefined()
    expect(lowDpi(at(2), lenient)).toEqual({ dpi: 100, level: 'min' })
  })

  it('oriented pixels: a 2000 × 3000 portrait turned a quarter spans 3000 px', () => {
    const photo = { widthPx: 2000, heightPx: 3000 }
    const frame = { width: 10 * IN, height: (10 * IN * 2) / 3 }
    const upright = effective(frame, photo, { zoom: 1, center: CENTER })
    const turned = effective(frame, photo, {
      zoom: 1,
      center: CENTER,
      quarterTurns: 1,
    })
    // Upright: 2000 px wide over 10 in; turned: the 3000 px side is across.
    expect(upright).toBeCloseTo(200)
    expect(turned).toBeCloseTo(300)
    const strict = profileWithDpi(250, 220).dpi
    expect(lowDpi(upright, strict)).toEqual({ dpi: 200, level: 'min' })
    expect(lowDpi(turned, strict)).toBeUndefined()
    expect(lowDpi(upright, generic.dpi)).toBeUndefined()
  })
})

import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'
import {
  capTierToSource,
  HIDPI_PREVIEW_EDGE,
  IMAGE_TIERS,
  selectImageTier,
  WORKING_PREVIEW_EDGE,
} from './imageTiers'
import { bitmapResizeOptions } from './processPhoto'

describe('selectImageTier', () => {
  it('keeps a 900 css px frame on 1280 at DPR 1', () => {
    expect(selectImageTier(900, 1)).toBe(1280)
  })

  it('moves a 900 css px frame to 2560 at DPR 2', () => {
    expect(selectImageTier(900, 2)).toBe(2560)
  })

  it('keeps a 300 css px frame on 1280 at DPR 2', () => {
    expect(selectImageTier(300, 2)).toBe(1280)
  })

  it('treats a need of exactly 1280 device px as covered by 1280', () => {
    expect(selectImageTier(640, 2)).toBe(1280)
    expect(selectImageTier(641, 2)).toBe(2560)
  })

  it('stays on 2560 above the ladder (deep zoom)', () => {
    expect(selectImageTier(4000, 2)).toBe(HIDPI_PREVIEW_EDGE)
  })

  it('defaults to the working preview without arguments', () => {
    expect(selectImageTier()).toBe(WORKING_PREVIEW_EDGE)
  })

  it('exposes the 1280 → 2560 ladder', () => {
    expect(IMAGE_TIERS).toEqual([1280, 2560])
  })
})

describe('capTierToSource', () => {
  it('keeps a source no larger than 1280 on 1280', () => {
    expect(capTierToSource(2560, 1280)).toBe(1280)
    expect(capTierToSource(2560, 900)).toBe(1280)
  })

  it('keeps 2560 for a larger or unknown source', () => {
    expect(capTierToSource(2560, 1281)).toBe(2560)
    expect(capTierToSource(2560, undefined)).toBe(2560)
  })

  it('never raises a lower tier', () => {
    expect(capTierToSource(1280, 6000)).toBe(1280)
    expect(capTierToSource(1280, 600)).toBe(1280)
  })

  it('never decodes a 2000 px source above 2000 px', () => {
    const tier = capTierToSource(selectImageTier(900, 2), 2000)
    expect(tier).toBe(2560)
    // The worker keeps a non-cover source at its own size under the cap.
    expect(bitmapResizeOptions(2000, 1500, tier, false)).toBeUndefined()
  })
})

test.prop([
  fc.double({ min: 0, max: 20_000, noNaN: true }),
  fc.double({ min: 0.5, max: 4, noNaN: true }),
])(
  'selectImageTier is a ladder step that covers the need up to 2560',
  (cssPx, dpr) => {
    const tier = selectImageTier(cssPx, dpr)
    expect(IMAGE_TIERS).toContain(tier)
    expect(tier >= cssPx * dpr || tier === HIDPI_PREVIEW_EDGE).toBe(true)
    expect(selectImageTier(cssPx * 2, dpr)).toBeGreaterThanOrEqual(tier)
  },
)

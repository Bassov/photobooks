import { describe, expect, it } from 'vitest'
import type { DerivativePreset } from '../plan'
import {
  LAB_CANDIDATES,
  LAB_EDGES,
  LAB_THRESHOLDS,
  labTable,
  passes,
  pickPresets,
  type LabResult,
} from './candidates'
import type { LabFixture } from './fixtures'

function preset(
  maxEdge: number,
  mimeType: DerivativePreset['mimeType'],
  quality: number,
): DerivativePreset {
  const format = mimeType === 'image/jpeg' ? 'jpeg' : 'webp'
  return {
    id: `${String(maxEdge)}-${format}-q${String(Math.round(quality * 100))}`,
    maxEdge,
    mimeType,
    quality,
  }
}

function result(
  fixture: LabFixture,
  p: DerivativePreset,
  overrides: Partial<LabResult> = {},
): LabResult {
  return {
    fixture,
    preset: p,
    width: p.maxEdge,
    height: Math.round((p.maxEdge * 3) / 4),
    byteLength: 1000,
    ssim: 0.99,
    bandStep: 0.5,
    ...overrides,
  }
}

describe('lab candidates', () => {
  it('covers 1600 / 2048 / 3200 × WebP 0.75–0.90 × JPEG 0.80–0.90, edge-major', () => {
    expect(LAB_EDGES).toEqual([1600, 2048, 3200])
    expect(LAB_CANDIDATES.slice(0, 7)).toEqual([
      preset(1600, 'image/webp', 0.75),
      preset(1600, 'image/webp', 0.8),
      preset(1600, 'image/webp', 0.85),
      preset(1600, 'image/webp', 0.9),
      preset(1600, 'image/jpeg', 0.8),
      preset(1600, 'image/jpeg', 0.85),
      preset(1600, 'image/jpeg', 0.9),
    ])
    expect(LAB_CANDIDATES.map((c) => c.id)).toHaveLength(21)
    expect(LAB_CANDIDATES.slice(7).map((c) => c.id)).toEqual([
      '2048-webp-q75',
      '2048-webp-q80',
      '2048-webp-q85',
      '2048-webp-q90',
      '2048-jpeg-q80',
      '2048-jpeg-q85',
      '2048-jpeg-q90',
      '3200-webp-q75',
      '3200-webp-q80',
      '3200-webp-q85',
      '3200-webp-q90',
      '3200-jpeg-q80',
      '3200-jpeg-q85',
      '3200-jpeg-q90',
    ])
  })
})

describe('passes', () => {
  const p = preset(1600, 'image/webp', 0.85)

  it('states the bar: SSIM ≥ 0.97 everywhere, band step ≤ 1.5 on the sky', () => {
    expect(LAB_THRESHOLDS).toEqual({
      minSsim: 0.97,
      maxBandStep: 1.5,
      bandFixture: 'sky',
    })
  })

  it('holds SSIM at the threshold on every fixture', () => {
    expect(passes(result('foliage', p, { ssim: 0.97 }))).toBe(true)
    expect(passes(result('foliage', p, { ssim: 0.9699 }))).toBe(false)
    expect(passes(result('sky', p, { ssim: 0.9699 }))).toBe(false)
  })

  it('holds the band step on the sky gradient only', () => {
    expect(passes(result('sky', p, { bandStep: 1.5 }))).toBe(true)
    expect(passes(result('sky', p, { bandStep: 1.51 }))).toBe(false)
    expect(passes(result('shadows', p, { bandStep: 2.4 }))).toBe(true)
  })
})

describe('pickPresets', () => {
  const webp75 = preset(1600, 'image/webp', 0.75)
  const webp80 = preset(1600, 'image/webp', 0.8)
  const webp85 = preset(1600, 'image/webp', 0.85)
  const jpeg80 = preset(1600, 'image/jpeg', 0.8)
  const jpeg90 = preset(1600, 'image/jpeg', 0.9)

  it('picks the lowest quality passing on every fixture per edge and format', () => {
    const results = [
      // Out of quality order on purpose: the pick sorts.
      result('sky', webp85, { byteLength: 30 }),
      result('foliage', webp85, { byteLength: 300 }),
      result('sky', webp80, { byteLength: 20 }),
      result('foliage', webp80, { byteLength: 200 }),
      result('sky', webp75, { bandStep: 2 }),
      result('foliage', webp75),
      result('sky', jpeg80),
      result('foliage', jpeg80, { ssim: 0.9 }),
      result('sky', jpeg90, { byteLength: 7 }),
      result('foliage', jpeg90, { byteLength: 9 }),
    ]

    expect(pickPresets(results)).toEqual([
      {
        maxEdge: 1600,
        mimeType: 'image/webp',
        preset: webp80,
        byteLength: 220,
      },
      {
        maxEdge: 1600,
        mimeType: 'image/jpeg',
        preset: jpeg90,
        byteLength: 16,
      },
    ])
  })

  it('reports a group where no quality passes', () => {
    const big = preset(3200, 'image/webp', 0.9)

    expect(pickPresets([result('sky', big, { bandStep: 1.9 })])).toEqual([
      {
        maxEdge: 3200,
        mimeType: 'image/webp',
        preset: undefined,
        byteLength: 0,
      },
    ])
  })
})

describe('labTable', () => {
  it('renders one markdown row per result with a verdict', () => {
    const p = preset(2048, 'image/jpeg', 0.85)

    expect(
      labTable([
        result('sky', p, {
          byteLength: 51_712,
          ssim: 0.98123,
          bandStep: 1.234,
        }),
        result('shadows', p, { ssim: 0.9 }),
      ]),
    ).toBe(
      [
        '| fixture | preset | size | KB | SSIM | band step | verdict |',
        '| --- | --- | --- | ---: | ---: | ---: | --- |',
        '| sky | 2048-jpeg-q85 | 2048×1536 | 50.5 | 0.9812 | 1.23 | pass |',
        '| shadows | 2048-jpeg-q85 | 2048×1536 | 1.0 | 0.9000 | 0.50 | fail |',
      ].join('\n'),
    )
  })
})

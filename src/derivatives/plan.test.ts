import { describe, expect, it } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import {
  canStartDerivative,
  DERIVATIVE_PRESETS,
  DERIVATIVE_SLOT_CAP,
  derivativeSize,
  planDerivativeJobs,
  presetCacheId,
  resolvePresets,
  type DerivativeGateSignals,
  type DerivativePreset,
} from './plan'

const presetArb: fc.Arbitrary<DerivativePreset> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  maxEdge: fc.integer({ min: 1, max: 8000 }),
  mimeType: fc.constantFrom('image/webp' as const, 'image/jpeg' as const),
  quality: fc.integer({ min: 1, max: 100 }).map((q) => q / 100),
})

const idle: DerivativeGateSignals = {
  queuedDecodeJobs: 0,
  metadataBusy: false,
  scrollQuiet: false,
  activeDerivativeJobs: 0,
}

describe('presets config', () => {
  it('lists the site presets smallest first with unique ids', () => {
    expect(
      DERIVATIVE_PRESETS.map((p) => [p.id, p.maxEdge, p.mimeType, p.quality]),
    ).toEqual([
      ['site-thumb', 480, 'image/webp', 0.8],
      ['site-display', 1600, 'image/webp', 0.85],
      ['site-large', 3200, 'image/webp', 0.9],
      ['site-share', 1600, 'image/jpeg', 0.9],
    ])
  })

  it('resolves ids in config order, all presets when omitted', () => {
    expect(
      resolvePresets(['site-share', 'site-thumb']).map((p) => p.id),
    ).toEqual(['site-thumb', 'site-share'])
    expect(resolvePresets(undefined)).toEqual(DERIVATIVE_PRESETS)
    expect(resolvePresets([])).toEqual([])
  })

  it('rejects an id that is not in config', () => {
    expect(() => resolvePresets(['site-thumb', 'huge'])).toThrow(
      'Unknown derivative preset: huge',
    )
  })
})

describe('derivativeSize', () => {
  it('fits the long edge and keeps the aspect ratio', () => {
    expect(derivativeSize(6000, 4000, 1600)).toEqual({
      width: 1600,
      height: 1067,
    })
    expect(derivativeSize(3000, 4000, 480)).toEqual({ width: 360, height: 480 })
  })

  it('never upscales and never collapses below 1 px', () => {
    expect(derivativeSize(800, 600, 1600)).toEqual({ width: 800, height: 600 })
    expect(derivativeSize(1600, 1600, 1600)).toEqual({
      width: 1600,
      height: 1600,
    })
    expect(derivativeSize(10000, 2, 100)).toEqual({ width: 100, height: 1 })
  })

  test.prop([
    fc.integer({ min: 1, max: 20000 }),
    fc.integer({ min: 1, max: 20000 }),
    fc.integer({ min: 1, max: 8000 }),
  ])('long edge is min(source long edge, maxEdge)', (w, h, maxEdge) => {
    const out = derivativeSize(w, h, maxEdge)
    expect(Math.max(out.width, out.height)).toBe(
      Math.min(Math.max(w, h), maxEdge),
    )
    expect(out.width).toBeLessThanOrEqual(w)
    expect(out.height).toBeLessThanOrEqual(h)
  })
})

describe('presetCacheId', () => {
  it('folds edge, format and quality into the id', () => {
    expect(DERIVATIVE_PRESETS.map(presetCacheId)).toEqual([
      'drv-site-thumb-480-webp-q80',
      'drv-site-display-1600-webp-q85',
      'drv-site-large-3200-webp-q90',
      'drv-site-share-1600-jpeg-q90',
    ])
  })

  test.prop([presetArb])('is stable for equal presets', (preset) => {
    expect(presetCacheId({ ...preset })).toBe(presetCacheId(preset))
  })

  test.prop([presetArb, presetArb])(
    'differs whenever any keyed field differs',
    (a, b) => {
      const same =
        a.id === b.id &&
        a.maxEdge === b.maxEdge &&
        a.mimeType === b.mimeType &&
        Math.round(a.quality * 100) === Math.round(b.quality * 100)
      expect(presetCacheId(a) === presetCacheId(b)).toBe(same)
    },
  )
})

describe('planDerivativeJobs', () => {
  it('keeps first-request order and merges repeats into config order', () => {
    const first = { assetHash: 'b', presetIds: ['site-share'] }
    const jobs = planDerivativeJobs([
      first,
      { assetHash: 'a', presetIds: ['site-large'] },
      { assetHash: 'b', presetIds: ['site-thumb', 'site-share'] },
    ])
    expect(
      jobs.map((job) => [job.assetHash, job.presets.map((p) => p.id)]),
    ).toEqual([
      ['b', ['site-thumb', 'site-share']],
      ['a', ['site-large']],
    ])
    expect(jobs[0]?.request).toBe(first)
  })

  test.prop([
    fc.array(
      fc.record({
        assetHash: fc.constantFrom('a', 'b', 'c', 'd'),
        presetIds: fc.subarray(DERIVATIVE_PRESETS.map((p) => p.id)),
      }),
      { maxLength: 12 },
    ),
  ])('one job per asset, each wanted preset exactly once', (requests) => {
    const jobs = planDerivativeJobs(requests)
    const hashes = jobs.map((job) => job.assetHash)
    expect(hashes).toEqual([...new Set(requests.map((r) => r.assetHash))])
    for (const job of jobs) {
      const wanted = new Set(
        requests
          .filter((r) => r.assetHash === job.assetHash)
          .flatMap((r) => r.presetIds),
      )
      expect(job.presets.map((p) => p.id)).toEqual(
        DERIVATIVE_PRESETS.map((p) => p.id).filter((id) => wanted.has(id)),
      )
    }
  })
})

describe('canStartDerivative', () => {
  it('starts only when every higher lane is idle and a slot is free', () => {
    expect(canStartDerivative(idle)).toBe(true)
    expect(canStartDerivative({ ...idle, queuedDecodeJobs: 1 })).toBe(false)
    expect(canStartDerivative({ ...idle, metadataBusy: true })).toBe(false)
    expect(canStartDerivative({ ...idle, scrollQuiet: true })).toBe(false)
    expect(
      canStartDerivative({
        ...idle,
        activeDerivativeJobs: DERIVATIVE_SLOT_CAP,
      }),
    ).toBe(false)
    expect(
      canStartDerivative({
        ...idle,
        activeDerivativeJobs: DERIVATIVE_SLOT_CAP - 1,
      }),
    ).toBe(true)
  })

  test.prop([
    fc.record({
      queuedDecodeJobs: fc.nat(20),
      metadataBusy: fc.boolean(),
      scrollQuiet: fc.boolean(),
      activeDerivativeJobs: fc.nat(3),
    }),
  ])('never starts behind a queued thumb or tier decode', (signals) => {
    if (signals.queuedDecodeJobs > 0) {
      expect(canStartDerivative(signals)).toBe(false)
    }
  })
})

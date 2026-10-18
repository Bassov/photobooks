import { describe, expect, it, vi } from 'vitest'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import {
  assetIdsOnSpread,
  desiredTiersForItems,
  frameEdgePx,
  isFramePressed,
  positiveDevicePixelRatio,
  queueReadyTierIfCached,
  resolveMaxDesiredTier,
  resolveSpreadPreviewUrl,
  subscribeAssetIds,
  thumbSnapshotFor,
  thumbUrlFromSnapshot,
  tierDisplayKeyFor,
  tierNumberFromKey,
  tierUrlFromKey,
} from './spreadPreviewKeys'

describe('spreadPreviewKeys', () => {
  it('dedupes asset ids and skips empty frames', () => {
    expect(
      assetIdsOnSpread([
        {},
        { assetId: 'a' },
        { assetId: 'b' },
        { assetId: 'a' },
      ]),
    ).toEqual(['a', 'b'])
    expect(assetIdsOnSpread([])).toEqual([])
  })

  it('builds thumb and tier display keys from per-spread assets only', () => {
    expect(thumbSnapshotFor([], () => 'x')).toBe('')
    expect(
      thumbSnapshotFor(['a', 'b'], (id) => (id === 'a' ? 'blob:a' : undefined)),
    ).toBe('a:blob:a|b:')

    const urls = new Map([
      ['a', { url: 'blob:tier-a', tier: 320 }],
      ['other', { url: 'blob:other', tier: 640 }],
    ])
    expect(tierDisplayKeyFor([], urls)).toBe('')
    expect(tierDisplayKeyFor(['a', 'b'], urls)).toBe('a:320:blob:tier-a|b:')
  })

  it('parses thumb urls from a mint-style asset id snapshot', () => {
    const id = 'asset-12-vacation.jpg'
    const snapshot = thumbSnapshotFor([id, 'asset-13-other.png'], (assetId) =>
      assetId === id ? 'blob:vacation' : undefined,
    )
    expect(snapshot).toBe(`${id}:blob:vacation|asset-13-other.png:`)
    expect(thumbUrlFromSnapshot(snapshot, id)).toBe('blob:vacation')
    expect(thumbUrlFromSnapshot(snapshot, 'asset-13-other.png')).toBeUndefined()
    expect(thumbUrlFromSnapshot('', id)).toBeUndefined()
    expect(thumbUrlFromSnapshot(`${id}:`, id)).toBeUndefined()
    expect(thumbUrlFromSnapshot(snapshot, 'missing')).toBeUndefined()
  })

  it('parses tier url and number from a display key', () => {
    const key = 'a:320:blob:tier-a|b:640:blob:tier-b'
    expect(tierUrlFromKey(key, 'a')).toBe('blob:tier-a')
    expect(tierUrlFromKey(key, 'b')).toBe('blob:tier-b')
    expect(tierUrlFromKey(key, 'missing')).toBeUndefined()
    expect(tierUrlFromKey('a:', 'a')).toBeUndefined()
    expect(tierUrlFromKey('a:320', 'a')).toBeUndefined()
    expect(tierUrlFromKey('a:320:', 'a')).toBeUndefined()

    expect(tierNumberFromKey(key, 'a')).toBe(320)
    expect(tierNumberFromKey(key, 'b')).toBe(640)
    expect(tierNumberFromKey(key, 'missing')).toBeUndefined()
    expect(tierNumberFromKey('a:', 'a')).toBeUndefined()
    expect(tierNumberFromKey('a:320', 'a')).toBeUndefined()
    expect(tierNumberFromKey('a::blob', 'a')).toBeUndefined()
    expect(tierNumberFromKey('a:nope:blob', 'a')).toBeUndefined()
    expect(tierNumberFromKey('a:NaN:blob', 'a')).toBeUndefined()
  })

  it('uses the longer frame edge in CSS px', () => {
    expect(frameEdgePx({ width: 100, height: 50 }, SPREAD_PX_PER_MM)).toBe(
      100 * SPREAD_PX_PER_MM,
    )
    expect(frameEdgePx({ width: 40, height: 90 }, 2)).toBe(180)
  })

  it('falls back to dpr 1 when the ratio is missing or non-positive', () => {
    expect(positiveDevicePixelRatio(2)).toBe(2)
    expect(positiveDevicePixelRatio(0)).toBe(1)
    expect(positiveDevicePixelRatio(-1)).toBe(1)
    expect(positiveDevicePixelRatio(Number.NaN)).toBe(1)
    expect(positiveDevicePixelRatio(undefined)).toBe(1)
  })

  it('keeps the max desired tier per asset across frames and zoom', () => {
    const selectTier = vi.fn((cssPx: number) => Math.floor(cssPx))
    const tiers = desiredTiersForItems(
      [
        { rectMm: { width: 10, height: 5 } },
        {
          assetId: 'a',
          rectMm: { width: 10, height: 5 },
        },
        {
          assetId: 'a',
          rectMm: { width: 40, height: 5 },
        },
        {
          assetId: 'b',
          rectMm: { width: 8, height: 8 },
        },
      ],
      2,
      1,
      1,
      selectTier,
    )
    expect(tiers.get('a')).toBe(80)
    expect(tiers.get('b')).toBe(16)
    expect(selectTier).toHaveBeenCalledWith(20, 1)
    expect(selectTier).toHaveBeenCalledWith(80, 1)
  })

  it('resolves preview url from tier, book preview, then thumb snapshot', () => {
    expect(
      resolveSpreadPreviewUrl(
        'a',
        'a:320:blob:tier',
        'a:blob:thumb',
        'blob:book',
      ),
    ).toBe('blob:tier')
    expect(
      resolveSpreadPreviewUrl('a', 'a:', 'a:blob:thumb', 'blob:book'),
    ).toBe('blob:book')
    expect(resolveSpreadPreviewUrl('a', 'a:', 'a:blob:thumb', undefined)).toBe(
      'blob:thumb',
    )
    expect(resolveSpreadPreviewUrl('a', 'a:', 'a:', undefined)).toBeUndefined()
  })

  it('detects the pressed move-source frame on this spread only', () => {
    expect(isFramePressed(null, 'f1')).toBe(false)
    expect(isFramePressed('', 'f1')).toBe(false)
    expect(isFramePressed('f1', 'f1')).toBe(true)
    expect(isFramePressed('f2', 'f1')).toBe(false)
  })

  it('resolves max desired tier with a spread fallback', () => {
    expect(resolveMaxDesiredTier('a', 320, () => 640)).toBe(640)
    expect(resolveMaxDesiredTier('a', 320, () => undefined)).toBe(320)
  })

  it('queues a ready tier swap only when the url is cached', () => {
    const queue = vi.fn()
    queueReadyTierIfCached('a', 320, () => undefined, queue)
    expect(queue).not.toHaveBeenCalled()
    queueReadyTierIfCached('a', 320, () => 'blob:ready', queue)
    expect(queue).toHaveBeenCalledWith('a', 320, 'blob:ready')
  })

  it('subscribes each asset and tears every listener down on unsubscribe', () => {
    const calls: string[] = []
    const teardowns: string[] = []
    const unsubscribe = subscribeAssetIds(
      ['a', 'b'],
      (assetId, listener) => {
        calls.push(assetId)
        listener()
        return () => {
          teardowns.push(assetId)
        }
      },
      vi.fn(),
    )
    expect(calls).toEqual(['a', 'b'])
    expect(teardowns).toEqual([])
    unsubscribe()
    expect(teardowns).toEqual(['a', 'b'])

    const idle = subscribeAssetIds([], () => () => undefined, vi.fn())
    expect(() => {
      idle()
    }).not.toThrow()
  })
})

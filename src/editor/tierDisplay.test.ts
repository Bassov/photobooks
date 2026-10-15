import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearSpreadTiers,
  getDisplayedPreview,
  getTierDisplaySnapshot,
  maxDesiredTier,
  queueTierSwap,
  resetTierDisplay,
  setSpreadTiers,
  subscribeTierDisplay,
} from './tierDisplay'

describe('tierDisplay', () => {
  afterEach(() => {
    resetTierDisplay()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the larger tier when two spreads share an asset', () => {
    setSpreadTiers('s0', new Map([['a', 320]]))
    setSpreadTiers('s1', new Map([['a', 1280]]))

    expect(maxDesiredTier('a')).toBe(1280)

    clearSpreadTiers('s0')
    expect(maxDesiredTier('a')).toBe(1280)
    clearSpreadTiers('missing')
    clearSpreadTiers('s1')
    expect(maxDesiredTier('a')).toBeUndefined()
  })

  it('ignores a swap for a tier that is no longer desired', async () => {
    setSpreadTiers('s0', new Map([['a', 640]]))
    queueTierSwap('a', 320, 'blob:small')
    await Promise.resolve()

    expect(getDisplayedPreview('a')).toBeUndefined()
  })

  it('keeps the previous image when decode fails', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockRejectedValue(
      new Error('decode failed'),
    )
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    setSpreadTiers('s0', new Map([['a', 320]]))
    queueTierSwap('a', 320, 'blob:bad')
    await Promise.resolve()
    await Promise.resolve()

    expect(getDisplayedPreview('a')).toBeUndefined()
  })

  it('decodes the same url again after a rejected attempt', async () => {
    const decode = vi.spyOn(HTMLImageElement.prototype, 'decode')
    decode.mockRejectedValueOnce(new Error('decode failed'))
    decode.mockResolvedValueOnce()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    setSpreadTiers('s0', new Map([['a', 320]]))
    queueTierSwap('a', 320, 'blob:retry')
    await Promise.resolve()
    await Promise.resolve()
    expect(getDisplayedPreview('a')).toBeUndefined()

    queueTierSwap('a', 320, 'blob:retry')
    await Promise.resolve()
    await Promise.resolve()
    expect(getDisplayedPreview('a')).toBe('blob:retry')
  })

  it('drops a swap when the desired tier changes during decode', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(
      () => gate,
    )
    setSpreadTiers('s0', new Map([['a', 320]]))
    queueTierSwap('a', 320, 'blob:old')
    setSpreadTiers('s0', new Map([['a', 1280]]))
    release?.()
    await gate
    await Promise.resolve()

    expect(getDisplayedPreview('a')).toBeUndefined()
  })

  it('publishes one decoded tier and ignores a duplicate request', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    const seen: number[] = []
    const unsubscribe = subscribeTierDisplay(() => {
      seen.push(getTierDisplaySnapshot().version)
    })
    setSpreadTiers('s0', new Map([['a', 320]]))
    queueTierSwap('a', 320, 'blob:tier')
    queueTierSwap('a', 320, 'blob:tier')
    await Promise.resolve()
    await Promise.resolve()

    expect(getDisplayedPreview('a')).toBe('blob:tier')
    expect(getTierDisplaySnapshot().urls.get('a')?.tier).toBe(320)
    expect(seen.length).toBeGreaterThan(0)
    unsubscribe()
  })
})

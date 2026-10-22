import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearSpreadTiers,
  clearStaleDisplayedPreview,
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

  it('ignores a swap above the desired covering tier', async () => {
    const decode = vi.spyOn(HTMLImageElement.prototype, 'decode')
    setSpreadTiers('s0', new Map([['a', 320]]))
    queueTierSwap('a', 640, 'blob:large')
    await Promise.resolve()

    expect(decode).not.toHaveBeenCalled()
    expect(getDisplayedPreview('a')).toBeUndefined()
  })

  it('shows a cached lower tier while a higher covering tier is desired', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    setSpreadTiers('s0', new Map([['a', 1280]]))
    queueTierSwap('a', 320, 'blob:low')
    await Promise.resolve()
    await Promise.resolve()

    expect(getDisplayedPreview('a')).toBe('blob:low')
    expect(getTierDisplaySnapshot().urls.get('a')?.tier).toBe(320)

    queueTierSwap('a', 640, 'blob:mid')
    await Promise.resolve()
    await Promise.resolve()
    expect(getDisplayedPreview('a')).toBe('blob:mid')
    expect(getTierDisplaySnapshot().urls.get('a')?.tier).toBe(640)

    queueTierSwap('a', 320, 'blob:worse')
    await Promise.resolve()
    await Promise.resolve()
    expect(getDisplayedPreview('a')).toBe('blob:mid')

    queueTierSwap('a', 1280, 'blob:cover')
    await Promise.resolve()
    await Promise.resolve()

    expect(getDisplayedPreview('a')).toBe('blob:cover')
    expect(getTierDisplaySnapshot().urls.get('a')?.tier).toBe(1280)
  })

  it('ignores a swap when no covering tier is desired', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    queueTierSwap('a', 320, 'blob:orphan')
    await Promise.resolve()
    await Promise.resolve()
    expect(getDisplayedPreview('a')).toBeUndefined()
  })

  it('replaces the covering display URL at the same tier', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    setSpreadTiers('s0', new Map([['a', 320]]))
    queueTierSwap('a', 320, 'blob:first')
    await Promise.resolve()
    await Promise.resolve()
    expect(getDisplayedPreview('a')).toBe('blob:first')

    queueTierSwap('a', 320, 'blob:second')
    await Promise.resolve()
    await Promise.resolve()
    expect(getDisplayedPreview('a')).toBe('blob:second')
  })

  it('clears a displayed preview when its hot URL is no longer live', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    setSpreadTiers('s0', new Map([['a', 320]]))
    queueTierSwap('a', 320, 'blob:gone')
    await Promise.resolve()
    await Promise.resolve()
    expect(getDisplayedPreview('a')).toBe('blob:gone')

    const versions: number[] = []
    const unsubscribe = subscribeTierDisplay(() => {
      versions.push(getTierDisplaySnapshot().version)
    })
    clearStaleDisplayedPreview('a', () => undefined)
    expect(getDisplayedPreview('a')).toBeUndefined()
    expect(versions.length).toBeGreaterThan(0)
    expect(getTierDisplaySnapshot().urls.has('a')).toBe(false)
    unsubscribe()
  })

  it('keeps a displayed preview when its hot URL is still live', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback): number => {
        cb(0)
        return 1
      },
    )
    setSpreadTiers('s0', new Map([['a', 320]]))
    queueTierSwap('a', 320, 'blob:live')
    await Promise.resolve()
    await Promise.resolve()

    clearStaleDisplayedPreview('a', () => 'blob:live')
    expect(getDisplayedPreview('a')).toBe('blob:live')
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

  it('keeps a lower decode as provisional when desired rises during decode', async () => {
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

    expect(getDisplayedPreview('a')).toBe('blob:old')
    expect(getTierDisplaySnapshot().urls.get('a')?.tier).toBe(320)
  })

  it('drops a swap when desired falls below the queued tier during decode', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(
      () => gate,
    )
    setSpreadTiers('s0', new Map([['a', 1280]]))
    queueTierSwap('a', 1280, 'blob:cover')
    setSpreadTiers('s0', new Map([['a', 320]]))
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

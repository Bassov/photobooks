import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestTier, subscribeTier } from '../photo/tierCache'
import { getAssetPixelSizeSnapshot } from './bookStore'
import {
  DRAG_TIER_LINGER_MS,
  holdDisplayTiers,
  holdDragTier,
  releaseDragTier,
} from './holdDisplayTiers'
import {
  getDisplayedPreview,
  maxDesiredTier,
  queueTierSwap,
  resetTierDisplay,
} from './tierDisplay'

// Worker / cache boundary: record tier requests instead of encoding.
const unsubscribed: string[] = []
vi.mock('../photo/tierCache', () => ({
  getTierUrl: () => undefined,
  requestTier: vi.fn(),
  subscribeTier: vi.fn((assetId: string, tier: number) => () => {
    unsubscribed.push(`${assetId}:${String(tier)}`)
  }),
}))

vi.mock('./bookStore', () => ({
  getAssetCacheKey: () => undefined,
  getAssetPixelSizeSnapshot: vi.fn(() => undefined),
}))

function requested(): string[] {
  return vi
    .mocked(requestTier)
    .mock.calls.map(([assetId, tier]) => `${assetId}:${String(tier)}`)
}

afterEach(() => {
  // Flush the lingering drag release so it cannot leak into the next test.
  vi.useFakeTimers()
  releaseDragTier()
  vi.runAllTimers()
  vi.useRealTimers()
  resetTierDisplay()
  unsubscribed.length = 0
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('holdDisplayTiers', () => {
  it('requests 1280 first, then 2560, for a HiDPI frame', () => {
    const release = holdDisplayTiers('s0', new Map([['a', 2560]]))

    expect(maxDesiredTier('a')).toBe(2560)
    expect(requested()).toEqual(['a:1280', 'a:2560'])
    expect(vi.mocked(subscribeTier)).toHaveBeenCalledTimes(2)

    release()
    expect(maxDesiredTier('a')).toBeUndefined()
    expect(unsubscribed).toEqual(['a:1280', 'a:2560'])
  })

  it('ignores a tier notify before its url is live', async () => {
    const decode = vi
      .spyOn(HTMLImageElement.prototype, 'decode')
      .mockResolvedValue()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    holdDisplayTiers('s0', new Map([['a', 1280]]))
    queueTierSwap('a', 1280, 'blob:shown')
    await vi.waitFor(() => {
      expect(getDisplayedPreview('a')).toBe('blob:shown')
    })

    vi.mocked(subscribeTier).mock.calls[0]?.[2]()
    await Promise.resolve()
    expect(decode).toHaveBeenCalledTimes(1)
    expect(getDisplayedPreview('a')).toBe('blob:shown')
  })

  it('requests only 1280 for a working-preview frame', () => {
    holdDisplayTiers('s0', new Map([['a', 1280]]))

    expect(requested()).toEqual(['a:1280'])
  })

  it('keeps a source no larger than 1280 px on 1280', () => {
    vi.mocked(getAssetPixelSizeSnapshot).mockReturnValueOnce({
      widthPx: 1200,
      heightPx: 800,
    })
    holdDisplayTiers('s0', new Map([['a', 2560]]))

    expect(maxDesiredTier('a')).toBe(1280)
    expect(requested()).toEqual(['a:1280'])
  })

  it('keeps 2560 for a source larger than 1280 px', () => {
    // Only the long edge counts: the short edge is under 1280.
    vi.mocked(getAssetPixelSizeSnapshot).mockReturnValueOnce({
      widthPx: 1000,
      heightPx: 2000,
    })
    holdDisplayTiers('s0', new Map([['a', 2560]]))

    expect(maxDesiredTier('a')).toBe(2560)
  })
})

describe('holdDragTier', () => {
  it('starts 1280 on dragstart and raises to the hovered frame tier at DPR 2', () => {
    vi.stubGlobal('devicePixelRatio', 2)
    holdDragTier('a', 0)
    expect(maxDesiredTier('a')).toBe(1280)
    // The same tier again keeps the running hold.
    holdDragTier('a', 0)
    expect(requested()).toEqual(['a:1280'])

    holdDragTier('a', 900)
    expect(maxDesiredTier('a')).toBe(2560)
    // The 1280 hold releases only after the 2560 hold re-subscribed 1280.
    expect(unsubscribed).toEqual(['a:1280'])
    expect(requested()).toEqual(['a:1280', 'a:1280', 'a:2560'])

    holdDragTier('a', 300)
    expect(maxDesiredTier('a')).toBe(2560)
    expect(requested()).toHaveLength(3)
  })

  it('stays on 1280 at DPR 1 for the same frame', () => {
    vi.stubGlobal('devicePixelRatio', 1)
    holdDragTier('a', 900)

    expect(maxDesiredTier('a')).toBe(1280)
  })

  it('moves the hold to a newly dragged asset', () => {
    holdDragTier('a', 0)
    holdDragTier('b', 0)

    expect(maxDesiredTier('a')).toBeUndefined()
    expect(maxDesiredTier('b')).toBe(1280)
  })

  it('releases the hold shortly after drag end', () => {
    vi.useFakeTimers()
    try {
      holdDragTier('a', 0)
      releaseDragTier()
      // The dropped frame's spread subscribes in a later commit.
      expect(maxDesiredTier('a')).toBe(1280)
      expect(unsubscribed).toEqual([])

      vi.advanceTimersByTime(DRAG_TIER_LINGER_MS)
      expect(maxDesiredTier('a')).toBeUndefined()
      expect(unsubscribed).toEqual(['a:1280'])
      releaseDragTier()
      vi.runAllTimers()
      expect(unsubscribed).toEqual(['a:1280'])
    } finally {
      vi.useRealTimers()
    }
  })
})

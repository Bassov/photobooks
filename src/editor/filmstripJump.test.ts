import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FILMSTRIP_JUMP_HIGHLIGHT_MS,
  applyFilmstripJumpScroll,
  filmstripJumpScrollPlan,
  getFilmstripJumpHighlightId,
  getFilmstripJumpRequest,
  requestFilmstripJump,
  resetFilmstripJumpForTests,
  subscribeFilmstripJump,
} from './filmstripJump'
import { getSelectedAssetId, resetGallerySelection } from './gallerySelection'
import { buildStridePrefix } from './thumbSlotSize'

describe('filmstripJumpScrollPlan', () => {
  it('returns null when the asset is not in the gallery', () => {
    expect(
      filmstripJumpScrollPlan(['a'], buildStridePrefix([1]), 'missing'),
    ).toBeNull()
  })

  it('plans scroll for the first gallery item', () => {
    const prefix = buildStridePrefix([1.5, 0.5])
    const plan = filmstripJumpScrollPlan(['a', 'b'], prefix, 'a')
    expect(plan?.scrollLeft).toBe(0)
    expect(plan?.scrollLeft).toBe(prefix[0])
  })

  it('returns scrollLeft from the stride prefix for a later item', () => {
    const prefix = buildStridePrefix([1.5, 0.5, 1.5])
    const plan = filmstripJumpScrollPlan(['a', 'b', 'c'], prefix, 'b')
    expect(plan?.scrollLeft).toBe(prefix[1])
  })
})

describe('applyFilmstripJumpScroll', () => {
  it('returns null when the node or plan is missing', () => {
    const node = document.createElement('div')
    expect(
      applyFilmstripJumpScroll(null, { scrollLeft: 10, windowStart: 1 }),
    ).toBeNull()
    expect(applyFilmstripJumpScroll(node, null)).toBeNull()
  })

  it('writes scrollLeft and returns windowStart', () => {
    const node = document.createElement('div')
    Object.defineProperty(node, 'scrollLeft', {
      configurable: true,
      writable: true,
      value: 0,
    })
    expect(
      applyFilmstripJumpScroll(node, { scrollLeft: 42, windowStart: 3 }),
    ).toBe(3)
    expect(node.scrollLeft).toBe(42)
  })
})

describe('requestFilmstripJump', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetFilmstripJumpForTests()
    resetGallerySelection()
  })

  afterEach(() => {
    resetFilmstripJumpForTests()
    resetGallerySelection()
    vi.useRealTimers()
  })

  it('selects the asset, bumps seq, and clears highlight after the timeout', () => {
    const listener = vi.fn()
    const unsub = subscribeFilmstripJump(listener)
    requestFilmstripJump('asset-1')
    expect(getSelectedAssetId()).toBe('asset-1')
    expect(getFilmstripJumpRequest()).toEqual({ assetId: 'asset-1', seq: 1 })
    expect(getFilmstripJumpHighlightId()).toBe('asset-1')
    expect(listener).toHaveBeenCalled()
    requestFilmstripJump('asset-2')
    expect(getFilmstripJumpRequest()?.seq).toBe(2)
    expect(getFilmstripJumpHighlightId()).toBe('asset-2')
    vi.advanceTimersByTime(FILMSTRIP_JUMP_HIGHLIGHT_MS)
    expect(getFilmstripJumpHighlightId()).toBeNull()
    unsub()
    const afterUnsub = listener.mock.calls.length
    requestFilmstripJump('asset-3')
    expect(listener.mock.calls.length).toBe(afterUnsub)
  })

  it('resets pending jump state for tests', () => {
    const listener = vi.fn()
    subscribeFilmstripJump(listener)
    requestFilmstripJump('asset-1')
    listener.mockClear()
    resetFilmstripJumpForTests()
    expect(getFilmstripJumpRequest()).toBeNull()
    expect(getFilmstripJumpHighlightId()).toBeNull()
    expect(listener).toHaveBeenCalled()
    requestFilmstripJump('asset-2')
    expect(getFilmstripJumpRequest()?.seq).toBe(1)
  })
})

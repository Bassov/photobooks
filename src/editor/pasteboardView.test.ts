import { describe, expect, it, vi } from 'vitest'
import { PASTEBOARD_GAP_PX } from './pasteboardWindow'
import {
  bindGalleryDrop,
  cancelPendingScrollFrame,
  nextTrackedScroll,
  nextViewportSize,
  pasteboardSlotPaddingBottom,
  pasteboardStrideAtZoom,
  pasteboardWindowKey,
  pasteboardWorldWidthPx,
  readPasteboardSlotEntry,
  resolvePreferredActiveId,
  resolveTrackedScrollTop,
  selectMarkedSpreadId,
  shouldRenderSpacer,
  spreadActiveIndex,
  widestPageCount,
} from './pasteboardView'

describe('resolveTrackedScrollTop', () => {
  it('prefers tracked top when epochs match or tracked is newer', () => {
    expect(
      resolveTrackedScrollTop(
        { top: 40, epoch: 2 },
        { scrollTop: 10, epoch: 2 },
      ),
    ).toBe(40)
    expect(
      resolveTrackedScrollTop(
        { top: 40, epoch: 3 },
        { scrollTop: 10, epoch: 2 },
      ),
    ).toBe(40)
  })

  it('falls back to camera scroll when tracked epoch is stale', () => {
    expect(
      resolveTrackedScrollTop(
        { top: 40, epoch: 1 },
        { scrollTop: 10, epoch: 2 },
      ),
    ).toBe(10)
  })
})

describe('nextTrackedScroll', () => {
  it('returns the same object when top and epoch match', () => {
    const current = { top: 12, epoch: 4 }
    expect(nextTrackedScroll(current, 12, 4)).toBe(current)
  })

  it('allocates a new scroll when top or epoch differs', () => {
    const current = { top: 12, epoch: 4 }
    expect(nextTrackedScroll(current, 12, 5)).toEqual({ top: 12, epoch: 5 })
    expect(nextTrackedScroll(current, 99, 4)).toEqual({ top: 99, epoch: 4 })
  })
})

describe('nextViewportSize', () => {
  it('returns the same object when size matches', () => {
    const current = { width: 500, height: 400 }
    expect(nextViewportSize(current, 500, 400)).toBe(current)
  })

  it('allocates a new size when width or height differs', () => {
    const current = { width: 500, height: 400 }
    expect(nextViewportSize(current, 501, 400)).toEqual({
      width: 501,
      height: 400,
    })
    expect(nextViewportSize(current, 500, 401)).toEqual({
      width: 500,
      height: 401,
    })
  })
})

describe('selectMarkedSpreadId / spreadActiveIndex', () => {
  it('keeps active when still mounted, else first mounted', () => {
    expect(selectMarkedSpreadId('b', ['a', 'b', 'c'])).toBe('b')
    expect(selectMarkedSpreadId('z', ['a', 'b'])).toBe('a')
    expect(selectMarkedSpreadId(null, ['a', 'b'])).toBe('a')
    expect(selectMarkedSpreadId('a', [])).toBeUndefined()
  })

  it('maps marked id to index and clamps missing to 0', () => {
    expect(spreadActiveIndex('b', ['a', 'b', 'c'])).toBe(1)
    expect(spreadActiveIndex(undefined, ['a'])).toBe(0)
    expect(spreadActiveIndex('missing', ['a', 'b'])).toBe(0)
  })
})

describe('world / stride helpers', () => {
  it('uses two pages when at least two spreads exist', () => {
    expect(widestPageCount(0)).toBe(1)
    expect(widestPageCount(1)).toBe(1)
    expect(widestPageCount(2)).toBe(2)
  })

  it('picks the max of viewport and stack width', () => {
    expect(
      pasteboardWorldWidthPx({
        viewportWidth: 800,
        trimWidthMm: 100,
        spreadCount: 2,
        pxPerMm: 2,
      }),
    ).toBe(800)
    expect(
      pasteboardWorldWidthPx({
        viewportWidth: 100,
        trimWidthMm: 100,
        spreadCount: 2,
        pxPerMm: 2,
      }),
    ).toBe(400)
  })

  it('scales stride and gap padding by zoom', () => {
    expect(pasteboardStrideAtZoom(100, 2)).toBeGreaterThan(
      pasteboardStrideAtZoom(100, 1),
    )
    expect(pasteboardSlotPaddingBottom(2)).toBe(PASTEBOARD_GAP_PX * 2)
  })

  it('joins mounted ids for the window key', () => {
    expect(pasteboardWindowKey(['a', 'b'])).toBe('a\0b')
    expect(pasteboardWindowKey([])).toBe('')
  })
})

describe('cancelPendingScrollFrame / shouldRenderSpacer', () => {
  it('cancels a non-zero frame id and returns 0', () => {
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame')
    expect(cancelPendingScrollFrame(0)).toBe(0)
    expect(cancel).not.toHaveBeenCalled()
    expect(cancelPendingScrollFrame(7)).toBe(0)
    expect(cancel).toHaveBeenCalledWith(7)
  })

  it('renders spacers only for positive extents', () => {
    expect(shouldRenderSpacer(0)).toBe(false)
    expect(shouldRenderSpacer(-1)).toBe(false)
    expect(shouldRenderSpacer(1)).toBe(true)
  })

  it('bindGalleryDrop skips null scroll and installs otherwise', () => {
    const cleanup = vi.fn()
    const install = vi.fn(() => cleanup)
    expect(bindGalleryDrop(null, install)).toBeUndefined()
    expect(install).not.toHaveBeenCalled()
    const node = document.createElement('div')
    expect(bindGalleryDrop(node, install)).toBe(cleanup)
    expect(install).toHaveBeenCalledWith(node)
  })
})

describe('readPasteboardSlotEntry', () => {
  it('returns null for non-elements and incomplete dataset', () => {
    expect(
      readPasteboardSlotEntry({
        target: null,
        intersectionRatio: 0.5,
      }),
    ).toBeNull()
    const bare = document.createElement('div')
    expect(
      readPasteboardSlotEntry({ target: bare, intersectionRatio: 0.5 }),
    ).toBeNull()
    bare.dataset.spreadId = 's1'
    expect(
      readPasteboardSlotEntry({ target: bare, intersectionRatio: 0.5 }),
    ).toBeNull()
  })

  it('reads id, ratio, and slot index from a slot element', () => {
    const slot = document.createElement('div')
    slot.dataset.spreadId = 'spread-2'
    slot.dataset.slotIndex = '2'
    expect(
      readPasteboardSlotEntry({ target: slot, intersectionRatio: 0.75 }),
    ).toEqual({ id: 'spread-2', ratio: 0.75, index: 2 })
  })
})

describe('resolvePreferredActiveId', () => {
  it('keeps the preferred id while its ratio is positive', () => {
    const ratios = new Map([
      ['a', 0.9],
      ['b', 0.4],
    ])
    expect(resolvePreferredActiveId('b', ratios)).toEqual({
      activeId: 'b',
      preferredId: 'b',
    })
  })

  it('clears the preferred id when its ratio is zero or missing', () => {
    expect(resolvePreferredActiveId('b', new Map([['a', 1]]))).toEqual({
      activeId: null,
      preferredId: null,
    })
    expect(resolvePreferredActiveId('b', new Map([['b', 0]]))).toEqual({
      activeId: null,
      preferredId: null,
    })
  })

  it('is a no-op when nothing is preferred', () => {
    expect(resolvePreferredActiveId(null, new Map([['a', 1]]))).toEqual({
      activeId: null,
      preferredId: null,
    })
  })
})

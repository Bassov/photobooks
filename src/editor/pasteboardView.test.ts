import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import {
  STACK_GAP_RATIO,
  STACK_MIN_SPREAD_PX,
  pasteboardStridePx,
} from './pasteboardWindow'
import {
  bindGalleryDrop,
  cancelPendingScrollFrame,
  nextTrackedScroll,
  nextViewportSize,
  pasteboardClickSpreadId,
  pasteboardStrideAtZoom,
  pasteboardWindowKey,
  pasteboardWorldWidthPx,
  readPasteboardSlotEntry,
  resolvePreferredActiveId,
  resolveTrackedScrollTop,
  selectMarkedSpreadId,
  shouldRenderSpacer,
  PASTEBOARD_PAD_PX,
  spreadActiveIndex,
  stackHeightFitZoom,
  stackScrollTop,
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

  it('scales the whole stride (spread and gap) with zoom', () => {
    // 100 mm × 0.5 px/mm = 50 px at zoom 1; gap = spread × 104 / 588.
    const ratio = 1 + STACK_GAP_RATIO
    expect(pasteboardStrideAtZoom(100, 1)).toBeCloseTo(50 * ratio, 9)
    expect(pasteboardStrideAtZoom(100, 2)).toBeCloseTo(100 * ratio, 9)
    expect(pasteboardStrideAtZoom(100, 6)).toBeCloseTo(300 * ratio, 9)
    expect(pasteboardStrideAtZoom(100, 0.32)).toBeCloseTo(16 * ratio, 9)
    // A 588 px spread (the #/demo Fit height) has a 104 px gap (round 7, M49).
    expect(pasteboardStrideAtZoom(588, 2)).toBeCloseTo(588 + 104, 9)
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
    // Index alone is not enough — missing spreadId must still reject.
    bare.dataset.slotIndex = '0'
    expect(
      readPasteboardSlotEntry({ target: bare, intersectionRatio: 0.5 }),
    ).toBeNull()
    bare.dataset.spreadId = 's1'
    delete bare.dataset.slotIndex
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
  it('keeps the preferred id while the pin is held', () => {
    expect(resolvePreferredActiveId('b')).toEqual({
      activeId: 'b',
      preferredId: 'b',
    })
  })

  it('is a no-op when nothing is preferred', () => {
    expect(resolvePreferredActiveId(null)).toEqual({
      activeId: null,
      preferredId: null,
    })
  })
})

describe('pasteboardClickSpreadId', () => {
  function build(): {
    slot: HTMLElement
    inner: HTMLElement
    btn: HTMLElement
  } {
    const slot = document.createElement('div')
    slot.setAttribute('data-pasteboard-slot', '')
    slot.setAttribute('data-spread-id', 's1')
    const inner = document.createElement('span')
    const btn = document.createElement('button')
    slot.append(inner, btn)
    return { slot, inner, btn }
  }

  it('resolves the slot under the target', () => {
    const { inner } = build()
    expect(pasteboardClickSpreadId(inner, 0, [])).toBe('s1')
  })

  it('leaves controls alone', () => {
    const { btn } = build()
    expect(pasteboardClickSpreadId(btn, 0, [])).toBeNull()
  })

  it('maps the gray beside a spread to the slot row under clientY', () => {
    const { slot } = build()
    slot.getBoundingClientRect = () => ({ top: 100, bottom: 200 }) as DOMRect
    expect(
      pasteboardClickSpreadId(document.createElement('div'), 150, [slot]),
    ).toBe('s1')
    expect(
      pasteboardClickSpreadId(document.createElement('div'), 250, [slot]),
    ).toBeNull()
  })

  it('treats the slot top as inside and the bottom as outside', () => {
    const { slot } = build()
    slot.getBoundingClientRect = () => ({ top: 100, bottom: 200 }) as DOMRect
    const gray = document.createElement('div')
    expect(pasteboardClickSpreadId(gray, 100, [slot])).toBe('s1')
    expect(pasteboardClickSpreadId(gray, 99.5, [slot])).toBeNull()
    expect(pasteboardClickSpreadId(gray, 199.5, [slot])).toBe('s1')
    expect(pasteboardClickSpreadId(gray, 200, [slot])).toBeNull()
  })

  it('picks the matching row among several slots', () => {
    const { slot } = build()
    slot.getBoundingClientRect = () => ({ top: 0, bottom: 100 }) as DOMRect
    const other = document.createElement('div')
    other.setAttribute('data-spread-id', 's2')
    other.getBoundingClientRect = () => ({ top: 100, bottom: 200 }) as DOMRect
    const gray = document.createElement('div')
    expect(pasteboardClickSpreadId(gray, 150, [slot, other])).toBe('s2')
    expect(pasteboardClickSpreadId(gray, 50, [slot, other])).toBe('s1')
  })
})

describe('stackScrollTop', () => {
  it('removes the world pad and never goes negative', () => {
    expect(stackScrollTop(0)).toBe(0)
    expect(stackScrollTop(PASTEBOARD_PAD_PX - 1)).toBe(0)
    expect(stackScrollTop(PASTEBOARD_PAD_PX + 300)).toBe(300)
  })
})

describe('stackHeightFitZoom', () => {
  it('fits a short book, gaps scaled with the spreads', () => {
    const zoom = stackHeightFitZoom(2, 150, 800)
    expect(zoom).toBeCloseTo(400 / (150 * (1 + STACK_GAP_RATIO)), 9)
    expect(2 * pasteboardStridePx(150 * zoom)).toBeCloseTo(800, 6)
  })

  it('stops a long book at the minimum spread height', () => {
    // 60 strides in 800 px would be 12.4 px spreads: floor at 16 px.
    const zoom = stackHeightFitZoom(60, 150, 800)
    expect(zoom).toBe(STACK_MIN_SPREAD_PX / 150)
    expect(pasteboardStridePx(150 * zoom)).toBeCloseTo(
      16 * (1 + STACK_GAP_RATIO),
      9,
    )
    // 40 strides in 800 px: 18.6 px spreads still fit whole.
    expect(stackHeightFitZoom(40, 150, 800) * 150).toBeCloseTo(
      800 / 40 / (1 + STACK_GAP_RATIO),
      9,
    )
  })

  it('is unbounded with nothing to fit', () => {
    expect(stackHeightFitZoom(0, 150, 800)).toBe(Number.POSITIVE_INFINITY)
    expect(stackHeightFitZoom(3, 0, 800)).toBe(Number.POSITIVE_INFINITY)
    expect(stackHeightFitZoom(3, 150, 0)).toBe(Number.POSITIVE_INFINITY)
  })

  it('fills the port exactly or stops at the spread floor (PBT)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.double({ min: 10, max: 2000, noNaN: true }),
        fc.double({ min: 100, max: 4000, noNaN: true }),
        (count, h, port) => {
          const zoom = stackHeightFitZoom(count, h, port)
          const spread = h * zoom
          const height = count * pasteboardStridePx(spread)
          expect(spread).toBeGreaterThanOrEqual(STACK_MIN_SPREAD_PX - 1e-9)
          if (spread > STACK_MIN_SPREAD_PX + 1e-9) {
            expect(Math.abs(height - port)).toBeLessThan(1e-6 * port)
          } else {
            expect(height).toBeGreaterThanOrEqual(port - 1e-6 * port)
          }
        },
      ),
    )
  })
})

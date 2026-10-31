import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import { PASTEBOARD_GAP_PX, pasteboardStridePx } from './pasteboardWindow'
import {
  bindGalleryDrop,
  cancelPendingScrollFrame,
  nextTrackedScroll,
  nextViewportSize,
  pasteboardClickSpreadId,
  pasteboardSlotPaddingBottom,
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
  stackContentYAtZoom,
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

  it('scales the spread part of the stride by zoom; the gap stays 44 px', () => {
    // 100 mm × 0.5 px/mm = 50 px at zoom 1.
    expect(pasteboardStrideAtZoom(100, 2)).toBe(100 + PASTEBOARD_GAP_PX)
    expect(pasteboardStrideAtZoom(100, 6)).toBe(300 + PASTEBOARD_GAP_PX)
    expect(pasteboardSlotPaddingBottom(100, 2)).toBe(44)
    expect(pasteboardSlotPaddingBottom(100, 6)).toBe(44)
  })

  it('shrinks the gap with a spread under 88 px', () => {
    expect(pasteboardStrideAtZoom(100, 1.76)).toBeCloseTo(88 + 44, 9)
    expect(pasteboardStrideAtZoom(100, 1)).toBe(50 + 25)
    expect(pasteboardSlotPaddingBottom(100, 1)).toBe(25)
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

describe('stackContentYAtZoom', () => {
  // Zoom-1 spread height 100 px: stride 144 at zoom 1, 244 at zoom 2.
  it('keeps a point on its spread and a gap offset in px', () => {
    expect(stackContentYAtZoom(50, 100, 1, 2)).toBe(100)
    expect(stackContentYAtZoom(120, 100, 1, 2)).toBe(220)
    expect(stackContentYAtZoom(144 + 50, 100, 1, 2)).toBe(244 + 100)
    expect(stackContentYAtZoom(2 * 144, 100, 1, 2)).toBe(2 * 244)
  })

  it('keeps a gap point at its share of a shrunk gap', () => {
    // Zoom 0.5: 50 px spread, 25 px gap (stride 75); zoom 1: 100 + 44.
    expect(stackContentYAtZoom(50 + 12.5, 100, 0.5, 1)).toBe(100 + 22)
    expect(stackContentYAtZoom(75 + 25, 100, 0.5, 1)).toBe(144 + 50)
    expect(stackContentYAtZoom(100 + 22, 100, 1, 0.5)).toBe(50 + 12.5)
  })

  it('scales points above the stack', () => {
    expect(stackContentYAtZoom(0, 100, 1, 2)).toBe(0)
    expect(stackContentYAtZoom(-40, 100, 1, 2)).toBe(-80)
  })

  it('scales linearly when the stride is not usable', () => {
    expect(stackContentYAtZoom(30, -100, 1, 2)).toBe(60)
  })

  it('maps spread i, fraction f to the same spread and fraction (PBT)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 40 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 10, max: 2000, noNaN: true }),
        fc.double({ min: 0.05, max: 8, noNaN: true }),
        fc.double({ min: 0.05, max: 8, noNaN: true }),
        (index, f, h, from, to) => {
          const y = index * pasteboardStridePx(h * from) + f * h * from
          const mapped = stackContentYAtZoom(y, h, from, to)
          const expected = index * pasteboardStridePx(h * to) + f * h * to
          expect(Math.abs(mapped - expected)).toBeLessThan(1e-6 * (1 + y))
          const back = stackContentYAtZoom(mapped, h, to, from)
          expect(Math.abs(back - y)).toBeLessThan(1e-6 * (1 + y))
        },
      ),
    )
  })
})

describe('stackHeightFitZoom', () => {
  it('fits a long book with gaps shrunk to half a spread', () => {
    // 40 × 150 px spreads in 800 px: 20 px per stride, 13.3 px spread.
    const zoom = stackHeightFitZoom(40, 150, 800)
    expect(zoom).toBeCloseTo(20 / (150 * 1.5), 9)
    expect(40 * pasteboardStridePx(150 * zoom)).toBeCloseTo(800, 6)
  })

  it('fits a short book with the full 44 px gap', () => {
    const zoom = stackHeightFitZoom(2, 150, 800)
    expect(zoom).toBeCloseTo((400 - 44) / 150, 9)
    expect(2 * pasteboardStridePx(150 * zoom)).toBeCloseTo(800, 6)
  })

  it('is unbounded with nothing to fit', () => {
    expect(stackHeightFitZoom(0, 150, 800)).toBe(Number.POSITIVE_INFINITY)
    expect(stackHeightFitZoom(3, 0, 800)).toBe(Number.POSITIVE_INFINITY)
    expect(stackHeightFitZoom(3, 150, 0)).toBe(Number.POSITIVE_INFINITY)
  })

  it('fills the port exactly at the returned zoom (PBT)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        fc.double({ min: 10, max: 2000, noNaN: true }),
        fc.double({ min: 100, max: 4000, noNaN: true }),
        (count, h, port) => {
          const zoom = stackHeightFitZoom(count, h, port)
          const height = count * pasteboardStridePx(h * zoom)
          expect(Math.abs(height - port)).toBeLessThan(1e-6 * port)
        },
      ),
    )
  })
})

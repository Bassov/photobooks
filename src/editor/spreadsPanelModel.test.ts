import { describe, expect, it, vi } from 'vitest'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
  subscribeSpreadRevealRequest,
} from './photoRootSession'
import {
  canDeleteSpread,
  coverCardRatio,
  endpaperCardRatio,
  firstSlotAspect,
  neighbourAfterDelete,
  scrollPasteboardToSpread,
  scrollTopToReveal,
  selectedSpreadId,
  spreadsKeyAction,
  spreadsListWindow,
  spreadsRowGeometry,
  fitThumbPx,
  thumbCardStyle,
} from './spreadsPanelModel'

const ROW = spreadsRowGeometry(0, 2).rowPx

const key = (k: string, mod = false) => ({
  key: k,
  ctrlKey: mod,
  metaKey: false,
})

describe('spreadsPanelModel', () => {
  it('selects active id or falls back to first spread', () => {
    expect(selectedSpreadId('b', ['a', 'b'])).toBe('b')
    expect(selectedSpreadId(null, ['a', 'b'])).toBe('a')
    expect(selectedSpreadId('gone', ['a', 'b'])).toBe('a')
    expect(selectedSpreadId(null, [])).toBeNull()
  })

  it('requests a pasteboard reveal and marks the spread active', () => {
    const seen = vi.fn()
    const off = subscribeSpreadRevealRequest(seen)
    scrollPasteboardToSpread('s1')
    off()
    scrollPasteboardToSpread('s2')
    expect(seen).toHaveBeenCalledTimes(1)
    expect(seen).toHaveBeenCalledWith('s1')
    expect(getActiveSpreadId()).toBe('s2')
    resetActiveSpreadIdForTests()
  })

  it('picks the neighbour after delete: next, else previous', () => {
    expect(neighbourAfterDelete(['a', 'b', 'c'], 'b')).toBe('c')
    expect(neighbourAfterDelete(['a', 'b', 'c'], 'c')).toBe('b')
    expect(neighbourAfterDelete(['a', 'b'], 'a')).toBe('b')
    expect(neighbourAfterDelete(['a'], 'a')).toBeNull()
    expect(neighbourAfterDelete(['a'], 'x')).toBeNull()
  })

  it('refuses deleting the last spread', () => {
    expect(canDeleteSpread(1)).toBe(false)
    expect(canDeleteSpread(2)).toBe(true)
  })

  it('windows only the rows near the viewport', () => {
    const win = spreadsListWindow(1000, 0, 400, ROW)
    expect(win.start).toBe(0)
    expect(win.end).toBeLessThan(15)
    expect(win.tailPx).toBeGreaterThan(0)
    const mid = spreadsListWindow(1000, 500 * ROW, 400, ROW)
    expect(mid.start).toBeGreaterThan(400)
    expect(mid.end - mid.start).toBeLessThan(20)
    expect(spreadsListWindow(0, 0, 400, ROW).end).toBe(0)
  })

  it('computes the scroll needed to reveal a row', () => {
    expect(scrollTopToReveal(1, 0, 400, ROW)).toBeNull()
    expect(scrollTopToReveal(0, ROW, 400, ROW)).toBe(0)
    expect(scrollTopToReveal(10, 0, 400, ROW)).toBe(11 * ROW - 400)
    // Exactly flush with either edge is already visible.
    expect(scrollTopToReveal(2, 2 * ROW, 400, ROW)).toBeNull()
    expect(scrollTopToReveal(1, 0, 2 * ROW, ROW)).toBeNull()
    // Taller-than-viewport rows never scroll below zero.
    expect(scrollTopToReveal(0, 10, 20, ROW)).toBe(0)
    // No selection never scrolls.
    expect(scrollTopToReveal(-1, ROW, 400, ROW)).toBeNull()
  })

  it('reveals rows below the Cover / Endpaper head', () => {
    const head = 250
    expect(scrollTopToReveal(0, 0, 2 * ROW + head, ROW, head)).toBeNull()
    expect(scrollTopToReveal(0, head + 1, 400, ROW, head)).toBe(head)
    expect(scrollTopToReveal(10, 0, 400, ROW, head)).toBe(head + 11 * ROW - 400)
    expect(scrollTopToReveal(-1, 0, 400, ROW, head)).toBeNull()
  })

  it('builds the kit card: a ≥1.6 box with the ratio paper centred', () => {
    expect(thumbCardStyle(2)).toEqual({
      box: { aspectRatio: '2' },
      inner: { width: '100%', aspectRatio: '2' },
    })
    expect(thumbCardStyle(1.6).inner.width).toBe('100%')
    expect(thumbCardStyle(0.8)).toEqual({
      box: { aspectRatio: '1.6' },
      inner: { width: '50%', aspectRatio: '0.8' },
    })
  })

  it('derives the cover and endpaper card ratios from the trim', () => {
    const trim = { widthMm: 200, heightMm: 100 }
    expect(coverCardRatio(trim, 12)).toBe(4.12)
    expect(endpaperCardRatio(trim)).toBe(4)
  })

  it('fits each spread into the shared thumb box at its own aspect', () => {
    // Wide spread fills the width, a square one is height-limited.
    expect(fitThumbPx(156, 97.5, 2)).toEqual({ widthPx: 156, heightPx: 78 })
    expect(fitThumbPx(156, 97.5, 1)).toEqual({ widthPx: 97.5, heightPx: 97.5 })
  })

  it('sizes the row like the kit: thumb keeps the spread aspect', () => {
    // 188px panel: 188 - 12 (pl-3) - 4 (pr-1) - 16 (p-2) = 156px thumb box.
    const wide = spreadsRowGeometry(188, 2)
    expect(wide.thumbWidthPx).toBe(156)
    expect(wide.thumbHeightPx).toBe(78)
    expect(wide.boxHeightPx).toBe(78)
    // box + p-2 (16) + mt-1.5 (6) + label line (14.85) + mb-1 (4)
    expect(wide.rowPx).toBeCloseTo(78 + 16 + 6 + 14.85 + 4, 5)
    // Narrower than 1.6:1 keeps the 1.6 box and centres a narrower paper.
    const narrow = spreadsRowGeometry(188, 1.2)
    expect(narrow.boxHeightPx).toBe(156 / 1.6)
    expect(narrow.thumbWidthPx).toBeCloseTo((156 / 1.6) * 1.2, 5)
    expect(narrow.thumbWidthPx / narrow.thumbHeightPx).toBeCloseTo(1.2, 5)
    // Unmeasured width falls back to the default panel width.
    expect(spreadsRowGeometry(0, 2)).toEqual(spreadsRowGeometry(212, 2))
    // A resized panel scales the thumb with it.
    expect(spreadsRowGeometry(260, 2).thumbWidthPx).toBe(228)
  })

  it('maps keys to panel actions', () => {
    expect(spreadsKeyAction(key('ArrowUp'))).toEqual({
      kind: 'move',
      delta: -1,
    })
    expect(spreadsKeyAction(key('ArrowDown'))).toEqual({
      kind: 'move',
      delta: 1,
    })
    expect(spreadsKeyAction(key('Enter', true))).toEqual({ kind: 'add' })
    expect(spreadsKeyAction(key('d', true))).toEqual({ kind: 'duplicate' })
    expect(spreadsKeyAction(key('Delete'))).toEqual({ kind: 'delete' })
    expect(spreadsKeyAction(key('Backspace'))).toEqual({ kind: 'delete' })
    expect(spreadsKeyAction(key('z', true))).toEqual({ kind: 'none' })
    expect(spreadsKeyAction(key('ArrowUp', true))).toEqual({ kind: 'none' })
    expect(spreadsKeyAction(key('Delete', true))).toEqual({ kind: 'none' })
    expect(
      spreadsKeyAction({ key: 'D', ctrlKey: false, metaKey: true }),
    ).toEqual({ kind: 'duplicate' })
    expect(spreadsKeyAction(key('a'))).toEqual({ kind: 'none' })
  })

  it('sizes the list from the first slot: page 1 keeps a spread-wide slot', () => {
    const page = { spreadWidthMm: 190, spreadHeightMm: 230 }
    expect(firstSlotAspect(undefined, 0)).toBe(2)
    // A one-spread book has no side: the page alone.
    expect(firstSlotAspect(page, 1)).toBeCloseTo(190 / 230, 9)
    expect(firstSlotAspect(page, 2)).toBeCloseTo(380 / 230, 9)
    expect(firstSlotAspect(page, 5)).toBeCloseTo(380 / 230, 9)
  })
})

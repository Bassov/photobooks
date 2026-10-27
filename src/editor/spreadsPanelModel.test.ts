import { describe, expect, it, vi } from 'vitest'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
  subscribeSpreadRevealRequest,
} from './photoRootSession'
import {
  canDeleteSpread,
  neighbourAfterDelete,
  scrollPasteboardToSpread,
  scrollTopToReveal,
  selectedSpreadId,
  SPREADS_ROW_PX,
  spreadsKeyAction,
  spreadsListWindow,
} from './spreadsPanelModel'

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
    const win = spreadsListWindow(1000, 0, 400)
    expect(win.start).toBe(0)
    expect(win.end).toBeLessThan(15)
    expect(win.tailPx).toBeGreaterThan(0)
    const mid = spreadsListWindow(1000, 500 * SPREADS_ROW_PX, 400)
    expect(mid.start).toBeGreaterThan(400)
    expect(mid.end - mid.start).toBeLessThan(20)
    expect(spreadsListWindow(0, 0, 400).end).toBe(0)
  })

  it('computes the scroll needed to reveal a row', () => {
    expect(scrollTopToReveal(1, 0, 400)).toBeNull()
    expect(scrollTopToReveal(0, SPREADS_ROW_PX, 400)).toBe(0)
    expect(scrollTopToReveal(10, 0, 400)).toBe(11 * SPREADS_ROW_PX - 400)
    // Exactly flush with either edge is already visible.
    expect(scrollTopToReveal(2, 2 * SPREADS_ROW_PX, 400)).toBeNull()
    expect(scrollTopToReveal(1, 0, 2 * SPREADS_ROW_PX)).toBeNull()
    // Taller-than-viewport rows never scroll below zero.
    expect(scrollTopToReveal(0, 10, 20)).toBe(0)
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
})

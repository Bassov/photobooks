import { describe, expect, it, vi } from 'vitest'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
} from './photoRootSession'
import { scrollPasteboardToSpread, selectedSpreadId } from './spreadsPanelModel'

describe('spreadsPanelModel', () => {
  it('selects active id or falls back to first spread', () => {
    expect(selectedSpreadId('b', ['a', 'b'])).toBe('b')
    expect(selectedSpreadId(null, ['a', 'b'])).toBe('a')
    expect(selectedSpreadId(null, [])).toBeNull()
  })

  it('scrolls a matching pasteboard slot when present', () => {
    const slot = document.createElement('div')
    slot.setAttribute('data-pasteboard-slot', '')
    slot.setAttribute('data-spread-id', 's1')
    const scrollIntoView = vi.fn()
    Object.defineProperty(slot, 'scrollIntoView', { value: scrollIntoView })
    document.body.appendChild(slot)
    scrollPasteboardToSpread('s1')
    expect(scrollIntoView).toHaveBeenCalled()
    expect(getActiveSpreadId()).toBe('s1')
    slot.remove()
    resetActiveSpreadIdForTests()
  })

  it('sets active id even when no slot is mounted', () => {
    scrollPasteboardToSpread('missing')
    expect(getActiveSpreadId()).toBe('missing')
    resetActiveSpreadIdForTests()
  })
})

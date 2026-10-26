import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSpreadIdsSnapshot, resetBookStore } from './bookStore'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
  setActiveSpreadId,
} from './photoRootSession'
import {
  scrollPasteboardToSpread,
  selectedSpreadId,
  SpreadsPanel,
} from './SpreadsPanel'

describe('SpreadsPanel helpers', () => {
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

describe('SpreadsPanel', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetActiveSpreadIdForTests()
  })

  it('lists spreads and add-spread appends one', () => {
    const before = getSpreadIdsSnapshot().length
    render(<SpreadsPanel />)
    expect(screen.getByTestId('spreads-panel')).toBeTruthy()
    expect(screen.getByTestId('spreads-list')).toBeTruthy()
    fireEvent.click(screen.getByTestId('add-spread'))
    expect(getSpreadIdsSnapshot().length).toBe(before + 1)
  })

  it('marks the active spread selected and first-spread data-first', () => {
    const ids = getSpreadIdsSnapshot()
    expect(ids.length).toBeGreaterThan(1)
    const first = ids.at(0) ?? ''
    const target = ids.at(1) ?? ''
    setActiveSpreadId(target)
    render(<SpreadsPanel />)
    expect(
      screen
        .getByTestId(`spread-list-item-${first}`)
        .getAttribute('data-first'),
    ).toBe('true')
    expect(
      screen
        .getByTestId(`spread-list-item-${target}`)
        .getAttribute('data-first'),
    ).toBe('false')
    const btn = screen.getByTestId(`spread-list-item-${target}`)
    expect(btn.getAttribute('aria-selected')).toBe('true')
    expect(btn.querySelector('[data-label]')?.className).toContain(
      'font-semibold',
    )
    expect(
      screen
        .getByTestId(`spread-list-item-${first}`)
        .querySelector('[data-label]')?.className,
    ).toContain('font-normal')
    fireEvent.click(screen.getByTestId(`spread-list-item-${first}`))
    expect(getActiveSpreadId()).toBe(first)
  })
})

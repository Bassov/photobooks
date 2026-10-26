import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getSpreadIdsSnapshot, resetBookStore } from './bookStore'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
  setActiveSpreadId,
} from './photoRootSession'
import { SpreadsPanel } from './SpreadsPanel'

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

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getSpreadIdsSnapshot, resetBookStore } from './bookStore'
import {
  getActiveSpreadId,
  resetActiveSpreadIdForTests,
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
    expect(screen.getByTestId('list')).toBeTruthy()
    fireEvent.click(screen.getByTestId('add-spread'))
    expect(getSpreadIdsSnapshot().length).toBe(before + 1)
  })

  it('selecting a spread sets active id', () => {
    const ids = getSpreadIdsSnapshot()
    expect(ids.length).toBeGreaterThan(0)
    const target = ids.at(0) ?? ''
    expect(target.length).toBeGreaterThan(0)
    render(<SpreadsPanel />)
    fireEvent.click(screen.getByTestId(`spread-list-item-${target}`))
    expect(getActiveSpreadId()).toBe(target)
  })
})

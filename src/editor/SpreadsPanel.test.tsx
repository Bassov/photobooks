import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  dispatchBookOp,
  getSpreadIdsSnapshot,
  resetBookStore,
} from './bookStore'
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

  it('duplicates, adds after and deletes the selected spread by keyboard', () => {
    render(<SpreadsPanel />)
    const [first, second] = getSpreadIdsSnapshot()
    const row = screen.getByTestId(`spread-list-item-${first ?? ''}`)
    fireEvent.keyDown(row, { key: 'd', ctrlKey: true })
    const afterDup = getSpreadIdsSnapshot()
    expect(afterDup[0]).toBe(first)
    expect(afterDup[2]).toBe(second)
    const copy = afterDup[1] ?? ''
    expect(getActiveSpreadId()).toBe(copy)

    fireEvent.keyDown(screen.getByTestId(`spread-list-item-${copy}`), {
      key: 'Enter',
      ctrlKey: true,
    })
    expect(getSpreadIdsSnapshot()).toHaveLength(afterDup.length + 1)
    expect(getSpreadIdsSnapshot().indexOf(copy)).toBe(1)

    // Add-after selected the new spread; Delete acts on the selection.
    const added = getActiveSpreadId() ?? ''
    expect(added).not.toBe(copy)
    const total = getSpreadIdsSnapshot().length
    fireEvent.keyDown(screen.getByTestId(`spread-list-item-${added}`), {
      key: 'Delete',
    })
    expect(getSpreadIdsSnapshot()).toHaveLength(total - 1)
    expect(getSpreadIdsSnapshot()).not.toContain(added)
    expect(getActiveSpreadId()).toBe(second)
  })

  it('keeps the last spread and renders inert thumbnails', () => {
    const [only] = getSpreadIdsSnapshot()
    for (const id of getSpreadIdsSnapshot().slice(1)) {
      dispatchBookOp({ type: 'removeSpread', spreadId: id })
    }
    render(<SpreadsPanel />)
    fireEvent.keyDown(screen.getByTestId(`spread-list-item-${only ?? ''}`), {
      key: 'Delete',
    })
    expect(getSpreadIdsSnapshot()).toEqual([only])
    expect(screen.queryByTestId('spread-view')).toBeNull()
    expect(
      screen
        .getByTestId(`spread-list-item-${only ?? ''}`)
        .querySelector('.spread-view--thumb'),
    ).not.toBeNull()
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

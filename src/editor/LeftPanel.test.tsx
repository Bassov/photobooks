import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetBookStore } from './bookStore'
import { LeftPanel } from './LeftPanel'

describe('LeftPanel', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('shows Pages first and switches to the Masters stub and back', () => {
    render(<LeftPanel />)
    expect(screen.getByTestId('spreads-panel')).toBeTruthy()
    expect(
      screen.getByTestId('left-tab-pages').getAttribute('aria-selected'),
    ).toBe('true')

    fireEvent.click(screen.getByTestId('left-tab-masters'))
    expect(screen.getByTestId('masters-stub').textContent).toContain(
      'No masters yet',
    )
    expect(screen.queryByTestId('spreads-panel')).toBeNull()
    expect(
      screen.getByTestId('left-tab-masters').getAttribute('aria-selected'),
    ).toBe('true')
    expect(
      screen.getByTestId('left-tab-pages').getAttribute('aria-selected'),
    ).toBe('false')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Pages',
      'Masters',
    ])

    fireEvent.click(screen.getByTestId('left-tab-pages'))
    expect(screen.getByTestId('spreads-panel')).toBeTruthy()
  })
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetBookStore } from './bookStore'
import { LeftPanel } from './LeftPanel'

describe('LeftPanel', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
  })

  it('shows Pages first and switches to Assets and back', () => {
    render(<LeftPanel />)
    expect(screen.getByTestId('spreads-panel')).toBeTruthy()
    expect(
      screen.getByTestId('left-tab-pages').getAttribute('aria-selected'),
    ).toBe('true')

    fireEvent.click(screen.getByTestId('left-tab-assets'))
    expect(screen.getByTestId('assets-panel')).toBeTruthy()
    expect(screen.queryByTestId('spreads-panel')).toBeNull()
    expect(
      screen.getByTestId('left-tab-assets').getAttribute('aria-selected'),
    ).toBe('true')
    expect(
      screen.getByTestId('left-tab-pages').getAttribute('aria-selected'),
    ).toBe('false')

    fireEvent.click(screen.getByTestId('left-tab-pages'))
    expect(screen.getByTestId('spreads-panel')).toBeTruthy()
  })
})

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GridToggle } from './GridToggle'
import { getGridVisible, setGridVisible } from './gridView'

describe('GridToggle', () => {
  afterEach(() => {
    cleanup()
    setGridVisible(false)
  })

  it('reflects and flips the grid flag with a pressed state', () => {
    render(<GridToggle />)
    const button = screen.getByTestId('grid-topbar-toggle')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('aria-label')).toContain('Layout grid')
    fireEvent.click(button)
    expect(getGridVisible()).toBe(true)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    act(() => {
      setGridVisible(false)
    })
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })
})

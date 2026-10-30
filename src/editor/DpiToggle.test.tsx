import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DpiToggle } from './DpiToggle'
import { getDpiView, setDpiView } from './dpiView'

describe('DpiToggle', () => {
  afterEach(() => {
    cleanup()
    setDpiView(false)
  })

  it('is unpressed by default and flips the DPI view flag', () => {
    render(<DpiToggle />)
    const button = screen.getByTestId('dpi-topbar-toggle')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('aria-label')).toBe('DPI badges')
    fireEvent.click(button)
    expect(getDpiView()).toBe(true)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    act(() => {
      setDpiView(false)
    })
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })
})

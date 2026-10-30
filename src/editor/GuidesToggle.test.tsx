import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GuidesToggle } from './GuidesToggle'
import { getGuidesVisible, setGuidesVisible } from './guidesView'

describe('GuidesToggle', () => {
  afterEach(() => {
    cleanup()
    setGuidesVisible(true)
  })

  it('is pressed by default and flips the guides flag', () => {
    render(<GuidesToggle />)
    const button = screen.getByTestId('guides-topbar-toggle')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('aria-label')).toBe('Guides (Ctrl+;)')
    fireEvent.click(button)
    expect(getGuidesVisible()).toBe(false)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    act(() => {
      setGuidesVisible(true)
    })
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })
})

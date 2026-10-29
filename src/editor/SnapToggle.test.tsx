import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SnapToggle } from './SnapToggle'
import { getSnapOn, setSnapOn } from './gridView'

describe('SnapToggle', () => {
  afterEach(() => {
    cleanup()
    setSnapOn(true)
  })

  it('is pressed by default and flips the snap flag', () => {
    render(<SnapToggle />)
    const button = screen.getByTestId('snap-topbar-toggle')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.getAttribute('aria-label')).toContain('Shift+S')
    fireEvent.click(button)
    expect(getSnapOn()).toBe(false)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    act(() => {
      setSnapOn(true)
    })
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })
})

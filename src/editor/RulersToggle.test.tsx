import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RulersToggle } from './RulersToggle'
import { getRulersVisible, setRulersVisible } from './rulersView'

describe('RulersToggle', () => {
  afterEach(() => {
    cleanup()
    setRulersVisible(false)
  })

  it('is unpressed by default and flips the rulers flag', () => {
    render(<RulersToggle />)
    const button = screen.getByTestId('rulers-topbar-toggle')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('aria-label')).toBe('Rulers (Shift+R)')
    fireEvent.click(button)
    expect(getRulersVisible()).toBe(true)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    act(() => {
      setRulersVisible(false)
    })
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToggleSwitch } from './InspectorControls'

afterEach(cleanup)

describe('ToggleSwitch', () => {
  it('flips on click; enabled carries no aria-disabled', () => {
    const onChange = vi.fn()
    render(<ToggleSwitch label="Live" on={false} onChange={onChange} />)
    const toggle = screen.getByRole('switch', { name: 'Live' })
    expect(toggle.hasAttribute('aria-disabled')).toBe(false)
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('disabled stays announced and ignores clicks', () => {
    const onChange = vi.fn()
    render(
      <ToggleSwitch label="Live" on={false} onChange={onChange} disabled />,
    )
    const toggle = screen.getByRole('switch', { name: 'Live' })
    expect(toggle.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(toggle)
    expect(onChange).not.toHaveBeenCalled()
  })
})

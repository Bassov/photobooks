import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToggleButton } from './ToggleButton'

describe('ToggleButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('toggles selected state through onChange', () => {
    const onChange = vi.fn()
    render(
      <ToggleButton aria-label="Grid" onChange={onChange} className="extra">
        Grid
      </ToggleButton>,
    )
    const btn = screen.getByRole('button', { name: 'Grid' })
    expect(btn.className).toBe(
      'pb-toggle pb-toggle--default pb-toggle--md extra',
    )
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(btn)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('honors isDisabled and outline size variants', () => {
    render(
      <ToggleButton aria-label="Rulers" isDisabled variant="outline" size="sm">
        Rulers
      </ToggleButton>,
    )
    const btn = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Rulers',
    })
    expect(btn.disabled).toBe(true)
    expect(btn.className).toBe('pb-toggle pb-toggle--outline pb-toggle--sm')
  })
})

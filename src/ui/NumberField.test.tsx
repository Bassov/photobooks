import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NumberField } from './NumberField'

describe('NumberField', () => {
  afterEach(cleanup)

  it('shows the unit suffix by default and hides it for unit={null}', () => {
    const { container, rerender } = render(
      <NumberField label="Width" value={5} onChange={vi.fn()} />,
    )
    expect(container.querySelector('.pb-field__unit')?.textContent).toBe('mm')
    expect(screen.getByRole('spinbutton').getAttribute('aria-valuetext')).toBe(
      '5 mm',
    )
    rerender(
      <NumberField label="Width" value={5} unit={null} onChange={vi.fn()} />,
    )
    expect(container.querySelector('.pb-field__unit')).toBeNull()
    expect(screen.getByRole('spinbutton').getAttribute('aria-valuetext')).toBe(
      '5',
    )
  })

  it('has no steppers unless asked', () => {
    render(<NumberField label="Width" value={5} onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Increase' })).toBeNull()
  })

  it('steppers are mouse-only (out of the tab order) and ordered up, down', () => {
    render(<NumberField label="Width" value={5} steppers onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.getAttribute('data-direction'))).toEqual([
      'up',
      'down',
    ])
    expect(buttons.map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '-1'])
  })

  it('stepper clicks ignore Shift: they use the small step', () => {
    const onChange = vi.fn()
    render(
      <NumberField
        label="Width"
        value={5}
        step={1}
        shiftStep={10}
        steppers
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }))
    expect(onChange).toHaveBeenLastCalledWith(6)
  })

  it('steppers step by `step` and clamp to min / max', () => {
    const onChange = vi.fn()
    render(
      <NumberField
        label="Width"
        value={10}
        min={9.95}
        max={10.1}
        step={0.1}
        unit={null}
        steppers
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }))
    expect(onChange).toHaveBeenLastCalledWith(10.1)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease' }))
    expect(onChange).toHaveBeenLastCalledWith(9.95)
  })
})

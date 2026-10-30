import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ListSelect } from './ListSelect'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

describe('ListSelect', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens a listbox with a check on the current item and reports a pick', async () => {
    const onChange = vi.fn()
    render(
      <ListSelect
        label="Size"
        value="a"
        onChange={onChange}
        options={options}
        data-testid="sel"
      />,
    )
    const trigger = screen.getByTestId('sel')
    expect(trigger.textContent).toContain('Alpha')
    fireEvent.click(trigger)
    const current = await screen.findByRole('option', { name: 'Alpha' })
    expect(current.querySelector('.pb-list-select__check svg')).not.toBeNull()
    const other = screen.getByRole('option', { name: 'Beta' })
    expect(other.querySelector('.pb-list-select__check svg')).toBeNull()
    fireEvent.click(other)
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('names the trigger from aria-label and omits the visible label', () => {
    render(
      <ListSelect
        aria-label="Pick"
        value="b"
        onChange={() => undefined}
        options={options}
      />,
    )
    expect(document.querySelector('.pb-field__label')).toBeNull()
    expect(screen.getByRole('button', { name: /Beta/ })).toBeTruthy()
    expect(document.querySelector('[aria-label="Pick"]')).not.toBeNull()
  })

  it('does not report a pick when the same item is re-chosen', async () => {
    const onChange = vi.fn()
    render(
      <ListSelect
        label="Size"
        value="a"
        onChange={onChange}
        options={options}
        data-testid="sel"
      />,
    )
    fireEvent.click(screen.getByTestId('sel'))
    fireEvent.click(await screen.findByRole('option', { name: 'Alpha' }))
    expect(onChange).not.toHaveBeenCalledWith(null)
    expect(onChange).not.toHaveBeenCalledWith('null')
  })
})

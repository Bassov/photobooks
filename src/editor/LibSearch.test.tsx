import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LibSearch } from './LibSearch'

describe('LibSearch', () => {
  afterEach(() => {
    cleanup()
  })

  it('forwards change and clears on Escape', () => {
    const onChange = vi.fn()
    render(<LibSearch value="ab" onChange={onChange} />)
    const input = screen.getByTestId('lib-search-input')
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(onChange).toHaveBeenCalledWith('abc')
    onChange.mockClear()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onChange).toHaveBeenCalledWith('')
  })
})

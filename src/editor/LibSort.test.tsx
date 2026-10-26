import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LibSort } from './LibSort'

describe('LibSort', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows current sort label and selects a new key', async () => {
    const onChange = vi.fn()
    render(<LibSort value="edited" onChange={onChange} />)
    expect(
      screen.getByRole('button', { name: 'Sort books: Last edited' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByTestId('lib-sort'))
    const menu = await screen.findByTestId('lib-sort-menu')
    expect(menu).toBeTruthy()
    fireEvent.click(screen.getByText('Title'))
    expect(onChange).toHaveBeenCalledWith('title')
  })

  it('labels Created when that sort is active', () => {
    render(<LibSort value="created" onChange={() => undefined} />)
    expect(
      screen.getByRole('button', { name: 'Sort books: Created' }),
    ).toBeTruthy()
  })
})

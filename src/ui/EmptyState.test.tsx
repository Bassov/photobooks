import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders title, description, and action presses', () => {
    const onAdd = vi.fn()
    render(
      <EmptyState
        title="Start with your photos"
        description="Add a folder to begin."
        actions={<Button onPress={onAdd}>Add folder…</Button>}
      />,
    )

    expect(screen.getByTestId('empty-state')).toBeTruthy()
    expect(screen.getByText('Start with your photos')).toBeTruthy()
    expect(screen.getByText('Add a folder to begin.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add folder…' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})

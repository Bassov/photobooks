import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders default / secondary / ghost variants and sizes', () => {
    const { rerender } = render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn.className).toBe('pb-button pb-button--default pb-button--md')

    rerender(
      <Button variant="secondary" size="sm" className="extra">
        Cancel
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toBe(
      'pb-button pb-button--secondary pb-button--sm extra',
    )

    rerender(<Button variant="ghost">Quiet</Button>)
    expect(screen.getByRole('button', { name: 'Quiet' }).className).toBe(
      'pb-button pb-button--ghost pb-button--md',
    )

    rerender(<Button variant="destructive">Remove</Button>)
    expect(screen.getByRole('button', { name: 'Remove' }).className).toBe(
      'pb-button pb-button--destructive pb-button--md',
    )
  })

  it('invokes onPress and respects isDisabled', () => {
    const onPress = vi.fn()
    const { rerender } = render(<Button onPress={onPress}>Go</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onPress).toHaveBeenCalledTimes(1)

    rerender(
      <Button onPress={onPress} isDisabled>
        Go
      </Button>,
    )
    const disabled = screen.getByRole('button', { name: 'Go' })
    expect(disabled.getAttribute('data-disabled')).not.toBeNull()
    expect(getComputedStyle(disabled).backgroundColor.length).toBeGreaterThan(0)
    fireEvent.click(disabled)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('marks pending buttons with data-pending', () => {
    render(<Button isPending>Saving…</Button>)
    expect(
      screen
        .getByRole('button', { name: 'Saving…' })
        .getAttribute('data-pending'),
    ).toBe('true')
  })
})

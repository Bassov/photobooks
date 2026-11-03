import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Icon } from './Icon'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('exposes label as accessible name on the button', () => {
    render(
      <IconButton label="Undo (Ctrl+Z)">
        <Icon name="undo" />
      </IconButton>,
    )
    expect(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' })).toBeTruthy()
  })

  it('applies sm / md size classes and merges className', () => {
    const { rerender } = render(
      <IconButton label="Redo" size="md" tooltip={false} className="x">
        <Icon name="redo" />
      </IconButton>,
    )
    expect(screen.getByRole('button', { name: 'Redo' }).className).toBe(
      'pb-button pb-button--ghost pb-button--md pb-icon-button pb-icon-button--md x',
    )
    rerender(
      <IconButton label="Redo" size="sm" tooltip={false}>
        <Icon name="redo" />
      </IconButton>,
    )
    expect(screen.getByRole('button', { name: 'Redo' }).className).toContain(
      'pb-icon-button--sm',
    )
  })

  it('disables via isDisabled', () => {
    render(
      <IconButton label="Nothing to redo" isDisabled tooltip={false}>
        <Icon name="redo" />
      </IconButton>,
    )
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Nothing to redo',
      }).disabled,
    ).toBe(true)
  })

  it('with a disabledReason stays focusable, ignores presses and explains itself', () => {
    const onPress = vi.fn()
    render(
      <IconButton
        label="Distribute horizontally"
        isDisabled
        disabledReason="Select 3 or more unlocked frames"
        onPress={onPress}
        isOpen
      >
        <Icon name="alignHorizontalDistributeCenter" />
      </IconButton>,
    )
    const button = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Distribute horizontally',
    })
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('data-disabled-reason')).toBe(true)
    expect(
      screen.getByRole('button', {
        description: 'Select 3 or more unlocked frames',
      }),
    ).toBe(button)
    expect(
      screen.getByRole('tooltip', { name: 'Select 3 or more unlocked frames' }),
    ).toBeTruthy()
    fireEvent.click(button)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('ignores disabledReason while enabled', () => {
    const onPress = vi.fn()
    render(
      <IconButton
        label="Align left edges"
        disabledReason="Needs 2 unlocked frames"
        onPress={onPress}
        tooltip={false}
      >
        <Icon name="alignStartVertical" />
      </IconButton>,
    )
    const button = screen.getByRole('button', { name: 'Align left edges' })
    expect(button.hasAttribute('aria-disabled')).toBe(false)
    expect(document.querySelector('[hidden]')).toBeNull()
    expect(button.hasAttribute('aria-describedby')).toBe(false)
    fireEvent.click(button)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('wraps with a tooltip by default and skips when tooltip is false', () => {
    const { rerender, container } = render(
      <IconButton label="Grid (G)" isOpen>
        <Icon name="grid" />
      </IconButton>,
    )
    expect(screen.getByRole('tooltip', { name: 'Grid (G)' })).toBeTruthy()

    rerender(
      <IconButton label="Grid (G)" tooltip={false} isOpen>
        <Icon name="grid" />
      </IconButton>,
    )
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(container.querySelector('.pb-icon-button')).toBeTruthy()
  })
})

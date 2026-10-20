import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
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

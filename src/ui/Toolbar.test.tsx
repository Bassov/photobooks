import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from './Button'
import { Toolbar } from './Toolbar'

describe('Toolbar', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a toolbar role with labelled children', () => {
    render(
      <Toolbar aria-label="Editor tools" className="bar">
        <Button>Preview</Button>
        <Button isDisabled>Export</Button>
      </Toolbar>,
    )
    const toolbar = screen.getByRole('toolbar', { name: 'Editor tools' })
    expect(toolbar.className).toBe('pb-toolbar bar')
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Export' })
        .disabled,
    ).toBe(true)
  })
})

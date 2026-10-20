import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from './Button'
import { Tooltip, TooltipTrigger } from './Tooltip'

describe('Tooltip', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders tooltip content with pb-tooltip class when open', () => {
    render(
      <TooltipTrigger delay={0} isOpen>
        <Button>Snap</Button>
        <Tooltip className="tip">Snap to grid (Shift+S)</Tooltip>
      </TooltipTrigger>,
    )
    const tip = screen.getByRole('tooltip', { name: 'Snap to grid (Shift+S)' })
    expect(tip.className).toBe('pb-tooltip tip')
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import * as RAC from 'react-aria-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Tooltip, TooltipTrigger } from './Tooltip'

const seen = vi.hoisted(() => ({
  trigger: [] as Record<string, unknown>[],
  tooltip: [] as Record<string, unknown>[],
}))

vi.mock('react-aria-components', async (importOriginal) => {
  const actual = await importOriginal<typeof RAC>()
  return {
    ...actual,
    TooltipTrigger: (props: ComponentProps<typeof actual.TooltipTrigger>) => {
      seen.trigger.push({ ...props })
      return <actual.TooltipTrigger {...props} />
    },
    Tooltip: (props: ComponentProps<typeof actual.Tooltip>) => {
      seen.tooltip.push({ ...props })
      return <actual.Tooltip {...props} />
    },
  }
})

describe('Tooltip', () => {
  afterEach(() => {
    cleanup()
    seen.trigger.length = 0
    seen.tooltip.length = 0
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

  it('opens after 300 ms and sits 4 px from the trigger by default (kit top-bar tooltip)', () => {
    render(
      <TooltipTrigger isOpen>
        <Button>Snap</Button>
        <Tooltip>Snap to grid</Tooltip>
      </TooltipTrigger>,
    )
    expect(seen.trigger.at(-1)?.delay).toBe(300)
    expect(seen.tooltip.at(-1)?.offset).toBe(4)
  })

  it('keeps an explicit delay and offset', () => {
    render(
      <TooltipTrigger delay={700} isOpen>
        <Button>Snap</Button>
        <Tooltip offset={6}>Snap to grid</Tooltip>
      </TooltipTrigger>,
    )
    expect(seen.trigger.at(-1)?.delay).toBe(700)
    expect(seen.tooltip.at(-1)?.offset).toBe(6)
  })
})

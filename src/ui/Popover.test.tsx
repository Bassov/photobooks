import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from './Button'
import { Popover, PopoverDialog, PopoverTrigger } from './Popover'

describe('Popover', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens from a trigger', async () => {
    render(
      <PopoverTrigger>
        <Button>More</Button>
        <Popover>
          <PopoverDialog>
            <p>Popover body</p>
          </PopoverDialog>
        </Popover>
      </PopoverTrigger>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(await screen.findByText('Popover body')).toBeTruthy()
  })
})

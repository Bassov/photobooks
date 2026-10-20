import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Dialog, DialogTitle, DialogTrigger } from './Dialog'

describe('Dialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('opens from a trigger and exposes the title', async () => {
    render(
      <DialogTrigger>
        <Button>Open dialog</Button>
        <Dialog>
          <DialogTitle>Library details</DialogTitle>
          <p>Body copy</p>
        </Dialog>
      </DialogTrigger>,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Library details' }),
    ).toBeTruthy()
  })

  it('supports controlled open state', () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog isOpen onOpenChange={onOpenChange}>
        <DialogTitle>Controlled</DialogTitle>
      </Dialog>,
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

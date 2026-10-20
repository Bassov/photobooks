import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AlertDialog } from './AlertDialog'

describe('AlertDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('confirms and cancels through public handlers', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <AlertDialog
        isOpen
        title='Remove "Road trip"?'
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        Photos stay on disk.
      </AlertDialog>,
    )

    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Remove "Road trip"?' }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('uses destructive confirm styling by default', async () => {
    render(<AlertDialog isOpen title="Delete?" />)
    await screen.findByRole('alertdialog')
    expect(screen.getByRole('button', { name: 'Remove' }).className).toContain(
      'pb-button--destructive',
    )
    expect(screen.getByRole('alertdialog').getAttribute('data-tone')).toBe(
      'destructive',
    )
  })

  it('uses default confirm styling for neutral tone', async () => {
    render(
      <AlertDialog isOpen title="Continue?" tone="neutral" confirmLabel="OK" />,
    )
    await screen.findByRole('alertdialog')
    expect(screen.getByRole('button', { name: 'OK' }).className).toContain(
      'pb-button--default',
    )
  })

  it('tolerates missing handlers', async () => {
    render(<AlertDialog isOpen title="Delete?" />)
    await screen.findByRole('alertdialog')
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  })
})

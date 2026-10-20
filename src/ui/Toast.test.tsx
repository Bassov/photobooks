import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastRegion } from './Toast'
import { createToastQueue } from './toastQueue'

describe('Toast', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows a queued toast with tone and action', async () => {
    const onAction = vi.fn()
    const queue = createToastQueue()
    render(<ToastRegion queue={queue} />)

    queue.add({
      title: '3 files skipped',
      description: 'Unsupported format',
      tone: 'error',
      action: { label: 'Show files', onAction },
    })

    expect(await screen.findByText('3 files skipped')).toBeTruthy()
    expect(screen.getByText('Unsupported format')).toBeTruthy()
    const toast = screen.getByText('3 files skipped').closest('.pb-toast')
    expect(toast?.getAttribute('data-tone')).toBe('error')

    fireEvent.click(screen.getByRole('button', { name: 'Show files' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('defaults tone to default when omitted', async () => {
    const queue = createToastQueue()
    render(<ToastRegion queue={queue} />)
    queue.add({ title: 'Hello' })
    expect(await screen.findByText('Hello')).toBeTruthy()
    expect(
      screen.getByText('Hello').closest('.pb-toast')?.getAttribute('data-tone'),
    ).toBe('default')
  })

  it('renders an action without onAction without throwing', async () => {
    const queue = createToastQueue()
    render(<ToastRegion queue={queue} />)
    queue.add({
      title: 'Needs attention',
      action: { label: 'Dismiss later' },
    })
    expect(await screen.findByText('Needs attention')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss later' }))
    expect(screen.getByText('Needs attention')).toBeTruthy()
  })

  it('closes a toast via the close control', async () => {
    const queue = createToastQueue()
    render(<ToastRegion queue={queue} />)

    queue.add({ title: 'Library saved', tone: 'success' })
    expect(await screen.findByText('Library saved')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByText('Library saved')).toBeNull()
    })
  })
})

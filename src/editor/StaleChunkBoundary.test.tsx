import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StaleChunkOutcome } from '../lib/staleChunkReload'
import { StaleChunkBoundary } from './StaleChunkBoundary'

const recovery = vi.hoisted(() => ({
  recover: vi.fn<() => Promise<StaleChunkOutcome>>(),
  reloadNow: vi.fn<(discard?: boolean) => Promise<StaleChunkOutcome>>(),
}))

vi.mock('./staleChunkSession', () => ({
  staleChunkRecovery: () => recovery,
}))

const CHUNK_ERROR = new TypeError(
  'Failed to fetch dynamically imported module: /assets/SitePreview-old.js',
)

function Throws({ error }: { error: Error }): never {
  throw error
}

function renderFailing(error: Error) {
  const onExit = vi.fn()
  render(
    <StaleChunkBoundary onExit={onExit}>
      <Throws error={error} />
    </StaleChunkBoundary>,
  )
  return { onExit }
}

describe('StaleChunkBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors; keep the run quiet.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    recovery.recover.mockReset()
    recovery.reloadNow.mockReset()
  })

  it('renders its children when nothing throws', () => {
    render(
      <StaleChunkBoundary onExit={() => undefined}>
        <p>preview</p>
      </StaleChunkBoundary>,
    )
    expect(screen.getByText('preview')).toBeTruthy()
    expect(screen.queryByTestId('site-preview-load-error')).toBeNull()
  })

  it('starts the reload on a chunk error and shows the update note', () => {
    recovery.recover.mockReturnValue(new Promise(() => undefined))
    renderFailing(CHUNK_ERROR)
    expect(recovery.recover).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert').textContent).toBe('Updating Photobooks…')
    expect(screen.getByTestId('site-preview-back')).toBeTruthy()
  })

  it('offers Reload when the guard declines, then Back exits', async () => {
    recovery.recover.mockResolvedValue('failed')
    const { onExit } = renderFailing(CHUNK_ERROR)
    const reload = await screen.findByRole('button', { name: 'Reload' })
    expect(reload).toBeTruthy()
    fireEvent.click(screen.getByTestId('site-preview-back'))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('offers Reload for other render errors without auto reload', () => {
    renderFailing(new Error('boom'))
    expect(recovery.recover).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
  })

  it('asks before discarding changes that could not be saved', async () => {
    recovery.reloadNow.mockResolvedValue('failed')
    renderFailing(new Error('boom'))
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(recovery.reloadNow).toHaveBeenLastCalledWith(false)
    const anyway = await screen.findByRole('button', { name: 'Reload anyway' })
    expect(screen.getByRole('alert').textContent).toContain(
      'could not be saved',
    )
    recovery.reloadNow.mockResolvedValue('reloading')
    fireEvent.click(anyway)
    expect(recovery.reloadNow).toHaveBeenLastCalledWith(true)
  })
})

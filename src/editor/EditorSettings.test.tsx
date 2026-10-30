import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetBookStore } from './bookStore'
import { resetCameraStore } from './cameraStore'
import { EditorSettings } from './EditorSettings'
import { EditorShell } from './EditorShell'
import * as projectSession from './projectSession'
import { resetProjectSessionForTests } from './projectSession'

type Listed = Awaited<ReturnType<typeof projectSession.listLibraryBooks>>

function twoBooks(): Listed {
  return { ok: true, value: [{}, {}] as never }
}

describe('editor top bar Settings', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    resetBookStore()
    resetCameraStore()
    resetProjectSessionForTests()
  })

  it('opens Settings from the gear and returns with Back', () => {
    render(<EditorShell />)
    expect(screen.queryByTestId('editor-settings')).toBeNull()
    fireEvent.click(screen.getByTestId('editor-settings-open'))
    expect(screen.getByTestId('editor-settings')).toBeTruthy()
    expect(screen.getByTestId('settings-section-title').textContent).toBe(
      'Library',
    )
    // No vertical rule between the nav and content (borders are banned).
    expect(
      screen.getByTestId('settings-nav-library').parentElement?.className,
    ).not.toContain('border')
    fireEvent.click(screen.getByTestId('editor-settings-back'))
    expect(screen.queryByTestId('editor-settings')).toBeNull()
  })

  it('shows the listed book count and calls onClose from Back', async () => {
    vi.spyOn(projectSession, 'listLibraryBooks').mockResolvedValue(twoBooks())
    const onClose = vi.fn()
    render(
      <EditorSettings
        libraryPath="Photobooks"
        changeDisabled={false}
        onClose={onClose}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('settings-book-count').textContent).toBe('2')
    })
    fireEvent.click(screen.getByTestId('editor-settings-back'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the count at 0 when listing fails', async () => {
    const spy = vi
      .spyOn(projectSession, 'listLibraryBooks')
      .mockResolvedValue({ ok: false, error: { kind: 'io' } } as never)
    render(
      <EditorSettings
        libraryPath="Photobooks"
        changeDisabled={false}
        onClose={() => undefined}
      />,
    )
    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1)
    })
    await Promise.resolve()
    expect(screen.getByTestId('settings-book-count').textContent).toBe('0')
  })

  it('ignores a listing that lands after unmount', async () => {
    let resolve: (value: Listed) => void = () => undefined
    vi.spyOn(projectSession, 'listLibraryBooks').mockReturnValue(
      new Promise<Listed>((r) => {
        resolve = r
      }),
    )
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const { unmount } = render(
      <EditorSettings
        libraryPath="Photobooks"
        changeDisabled={false}
        onClose={() => undefined}
      />,
    )
    unmount()
    resolve(twoBooks())
    await Promise.resolve()
    expect(errors).not.toHaveBeenCalled()
  })

  it('lists once, not on every re-render', async () => {
    const spy = vi
      .spyOn(projectSession, 'listLibraryBooks')
      .mockResolvedValue(twoBooks())
    const { rerender } = render(
      <EditorSettings
        libraryPath="Photobooks"
        changeDisabled={false}
        onClose={() => undefined}
      />,
    )
    await waitFor(() => {
      expect(screen.getByTestId('settings-book-count').textContent).toBe('2')
    })
    rerender(
      <EditorSettings
        libraryPath="Other"
        changeDisabled
        onClose={() => undefined}
      />,
    )
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

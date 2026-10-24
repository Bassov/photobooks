import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LibraryScreen } from './LibraryScreen'
import {
  attachMemoryLibraryForTests,
  createBookInLibrary,
  leaveEditorForLibrary,
  resetProjectSessionForTests,
  setSurfaceForTests,
} from './projectSession'

describe('LibraryScreen', () => {
  beforeEach(() => {
    resetProjectSessionForTests()
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: () => Promise.resolve({ name: 'Lib' }),
    })
  })

  afterEach(() => {
    cleanup()
    resetProjectSessionForTests()
    vi.restoreAllMocks()
  })

  it('shows empty create affordance then lists a created book', async () => {
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    setSurfaceForTests('library')
    render(<LibraryScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('create-book')).toBeTruthy()
    })

    const created = await createBookInLibrary('Trip')
    expect(created.ok).toBe(true)
    await leaveEditorForLibrary()
    setSurfaceForTests('library')

    await waitFor(() => {
      expect(screen.getByTestId('library-books')).toBeTruthy()
    })
    expect(screen.getByText('Trip')).toBeTruthy()
    expect(screen.getByTestId('change-library')).toBeTruthy()
    expect(screen.getByTestId('library-settings')).toBeTruthy()

    fireEvent.click(screen.getByTestId('library-settings'))
    expect(screen.getByTestId('settings-dialog')).toBeTruthy()
    fireEvent.click(screen.getByTestId('settings-close'))
    await waitFor(() => {
      expect(screen.queryByTestId('settings-dialog')).toBeNull()
    })
  })
})

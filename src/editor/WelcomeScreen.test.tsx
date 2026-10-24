import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WelcomeScreen } from './WelcomeScreen'
import {
  resetProjectSessionForTests,
  setAccessPhaseForTests,
  setSurfaceForTests,
} from './projectSession'
import * as projectSession from './projectSession'

describe('WelcomeScreen', () => {
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
    setSurfaceForTests('welcome')
  })

  afterEach(() => {
    cleanup()
    resetProjectSessionForTests()
    vi.restoreAllMocks()
  })

  it('offers choose library folder', () => {
    render(<WelcomeScreen />)
    expect(screen.getByTestId('welcome-screen')).toBeTruthy()
    expect(screen.getByTestId('choose-library')).toBeTruthy()
  })

  it('calls chooseLibraryFolder from the primary action', async () => {
    const choose = vi
      .spyOn(projectSession, 'chooseLibraryFolder')
      .mockResolvedValue({ ok: true, value: undefined })
    render(<WelcomeScreen />)
    fireEvent.click(screen.getByTestId('choose-library'))
    await waitFor(() => {
      expect(choose).toHaveBeenCalled()
    })
  })

  it('shows allow-access when permission is required', async () => {
    const regrant = vi
      .spyOn(projectSession, 'regrantLibrary')
      .mockResolvedValue({ ok: true, value: undefined })
    setAccessPhaseForTests('permission-required')
    render(<WelcomeScreen />)
    expect(screen.getByTestId('allow-library-access')).toBeTruthy()
    fireEvent.click(screen.getByTestId('allow-library-access'))
    await waitFor(() => {
      expect(regrant).toHaveBeenCalled()
    })
  })
})

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
  patchProjectSessionSnapshotForTests,
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

  it('offers Create Library with kit chrome and plain credit', () => {
    render(<WelcomeScreen />)
    expect(screen.getByTestId('welcome-screen')).toBeTruthy()
    expect(screen.getByTestId('home-screen')).toBeTruthy()
    expect(screen.getByTestId('welcome-mark').textContent).toMatch(/Photobooks/)
    expect(
      screen.getByTestId('welcome-hero').getAttribute('data-hero-src'),
    ).toBe('/photos/hi/c18.jpg')
    const headline = screen.getByRole('heading', { level: 1 })
    expect(headline.className).toMatch(/pb-welcome-headline/)
    expect(headline.querySelector('em')?.textContent).toMatch(/for your books/)
    expect(screen.getByTestId('create-library')).toBeTruthy()
    expect(screen.getByTestId('create-library').textContent).toMatch(
      /Create Library/,
    )
    const credit = screen.getByTestId('screen-credit')
    expect(credit.textContent).toMatch(/Dietmar Rabich/)
    expect(credit.textContent).toMatch(/CC BY-SA 4\.0/)
    expect(credit.textContent).toMatch(/modified/)
  })

  it('exposes start-session harness for manual-qa entry', () => {
    const start = vi.spyOn(projectSession, 'startSessionEditor')
    render(<WelcomeScreen />)
    fireEvent.click(screen.getByTestId('start-session'))
    expect(start).toHaveBeenCalled()
  })

  it('calls chooseLibraryFolder from Create Library', async () => {
    const choose = vi
      .spyOn(projectSession, 'chooseLibraryFolder')
      .mockResolvedValue({ ok: true, value: undefined })
    render(<WelcomeScreen />)
    fireEvent.click(screen.getByTestId('create-library'))
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
    expect(screen.queryByTestId('create-library')).toBeNull()
    fireEvent.click(screen.getByTestId('allow-library-access'))
    await waitFor(() => {
      expect(regrant).toHaveBeenCalled()
    })
  })

  it('uses library folder fallback and disables allow while busy', () => {
    patchProjectSessionSnapshotForTests({
      libraryLabel: null,
      actionBusy: true,
      restorePending: false,
    })
    setAccessPhaseForTests('permission-required')
    render(<WelcomeScreen />)
    expect(screen.getByTestId('allow-library-access').textContent).toMatch(
      /library folder/,
    )
    const allow = screen.getByTestId('allow-library-access')
    expect(
      allow.getAttribute('data-disabled') ??
        allow.getAttribute('aria-disabled') ??
        allow.getAttribute('disabled'),
    ).toBeTruthy()
  })

  it('shows loading while restorePending and hides Create Library', () => {
    patchProjectSessionSnapshotForTests({ restorePending: true })
    render(<WelcomeScreen />)
    expect(screen.getByTestId('welcome-loading')).toBeTruthy()
    expect(screen.queryByTestId('create-library')).toBeNull()
  })

  it('shows welcome error status when homeError is set', () => {
    patchProjectSessionSnapshotForTests({
      restorePending: false,
      homeError: 'Pick failed',
    })
    render(<WelcomeScreen />)
    expect(screen.getByTestId('welcome-error').textContent).toBe('Pick failed')
  })
})

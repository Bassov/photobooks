import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SettingsScreen } from './SettingsScreen'
import * as projectSession from './projectSession'

describe('SettingsScreen', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows library path and live book count', () => {
    render(<SettingsScreen libraryPath="Summer Lib" bookCount={3} />)
    expect(screen.getByTestId('settings')).toBeTruthy()
    expect(screen.getByTestId('library-path').textContent).toBe('Summer Lib')
    expect(screen.getByTestId('settings-book-count').textContent).toBe('3')
    expect(screen.getByTestId('settings-section-title').textContent).toBe(
      'Library',
    )
    expect(screen.getByTestId('library-settings-panel').className).not.toMatch(
      /border(?!-)/,
    )
    expect(screen.getAllByTestId('settings-rule')).toHaveLength(2)
    expect(
      screen.getByTestId('settings-nav-library').getAttribute('aria-current'),
    ).toBe('page')
    expect(screen.getByTestId('settings-nav-library').className).toMatch(
      /\bbg-accent\b/,
    )
    expect(screen.getByTestId('settings-nav-library').className).toMatch(
      /\bfont-medium\b/,
    )
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('shows coming-later copy for deferred sections without fake inputs', () => {
    render(<SettingsScreen libraryPath="Lib" bookCount={0} />)
    fireEvent.click(screen.getByTestId('settings-nav-hosting'))
    expect(screen.getByTestId('settings-section-title').textContent).toBe(
      'Hosting',
    )
    expect(
      screen.getByTestId('settings-nav-hosting').getAttribute('aria-current'),
    ).toBe('page')
    expect(
      screen.getByTestId('settings-nav-library').getAttribute('aria-current'),
    ).toBeNull()
    expect(screen.getByTestId('settings-nav-hosting').className).toMatch(
      /\bfont-medium\b/,
    )
    expect(screen.getByTestId('settings-nav-library').className).not.toMatch(
      /\bfont-medium\b/,
    )
    expect(screen.getByTestId('settings-deferred-hosting').textContent).toMatch(
      /come later/i,
    )
    expect(screen.queryByRole('textbox')).toBeNull()
    fireEvent.click(screen.getByTestId('settings-nav-site'))
    expect(screen.getByTestId('settings-section-title').textContent).toBe(
      'Site',
    )
    expect(screen.getByTestId('settings-deferred-site')).toBeTruthy()
    fireEvent.click(screen.getByTestId('settings-nav-print'))
    expect(screen.getByTestId('settings-section-title').textContent).toBe(
      'Print presets',
    )
    expect(screen.getByTestId('settings-deferred-print')).toBeTruthy()
    fireEvent.click(screen.getByTestId('settings-nav-interface'))
    expect(screen.getByTestId('settings-section-title').textContent).toBe(
      'Interface',
    )
    expect(screen.getByTestId('settings-deferred-interface')).toBeTruthy()
  })

  it('Change library cancel leaves path and closes confirm', () => {
    const change = vi
      .spyOn(projectSession, 'changeLibraryFolder')
      .mockResolvedValue({ ok: true, value: undefined })
    render(<SettingsScreen libraryPath="Keep Me" bookCount={1} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    fireEvent.click(screen.getByTestId('change-library'))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(change).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('library-path').textContent).toBe('Keep Me')
  })

  it('Change library confirm invokes changeLibraryFolder and closes', async () => {
    const change = vi
      .spyOn(projectSession, 'changeLibraryFolder')
      .mockResolvedValue({ ok: true, value: undefined })
    render(<SettingsScreen libraryPath="Lib" bookCount={2} />)
    fireEvent.click(screen.getByTestId('change-library'))
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder…' }))
    await waitFor(() => {
      expect(change).toHaveBeenCalled()
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('exposes a named settings scrollport', () => {
    render(<SettingsScreen libraryPath="Lib" bookCount={0} />)
    const scroll = screen.getByTestId('settings-scroll')
    expect(scroll.getAttribute('data-scrollport')).toBe('settings')
    expect(scroll.id).toBe('settings-scroll')
  })
})

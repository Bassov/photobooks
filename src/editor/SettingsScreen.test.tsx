import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as assets from '../assets'
import { SettingsScreen } from './SettingsScreen'
import * as projectSession from './projectSession'

describe('SettingsScreen', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows the measured preview cache size, a dash when unavailable', async () => {
    const measure = vi
      .spyOn(assets, 'measureDerivedCacheBytes')
      .mockResolvedValueOnce(212 * 1024 * 1024)
    render(<SettingsScreen libraryPath="Lib" bookCount={1} />)
    await waitFor(() => {
      expect(screen.getByTestId('settings-preview-cache').textContent).toBe(
        '212 MB',
      )
    })
    cleanup()
    measure.mockResolvedValueOnce(null)
    render(<SettingsScreen libraryPath="Lib" bookCount={1} />)
    expect(screen.getByTestId('settings-preview-cache').textContent).toBe('—')
  })

  it('measures the preview cache once per mount, not per re-render', () => {
    const measure = vi
      .spyOn(assets, 'measureDerivedCacheBytes')
      .mockResolvedValue(1)
    const view = render(<SettingsScreen libraryPath="Lib" bookCount={1} />)
    view.rerender(<SettingsScreen libraryPath="Lib2" bookCount={2} />)
    expect(measure).toHaveBeenCalledTimes(1)
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
    expect(screen.getAllByTestId('settings-rule')).toHaveLength(3)
    expect(screen.getByTestId('settings-preview-cache')).toBeTruthy()
    expect(
      screen
        .getByText('Allowed · read and write')
        .closest('[data-color]')
        ?.getAttribute('data-color'),
    ).toBe('success') // kit demo-parts/settings.tsx:48 (round 10, M66)
    expect(screen.getByTestId('settings-nav-library').className).not.toMatch(
      /\bring-/,
    )
    expect(
      screen.getByTestId('settings-nav-library').getAttribute('aria-current'),
    ).toBe('page')
    expect(screen.getByTestId('settings-nav-library').className).toMatch(
      /bg-\[#CACACA\]/,
    )
    expect(screen.getByTestId('settings-nav-library').className).toMatch(
      /\bborder-0\b/,
    )
    expect(screen.getByTestId('settings-nav-library').className).toMatch(
      /\bfont-medium\b/,
    )
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('hides sections without backing behavior (no stubs, no inputs)', () => {
    render(<SettingsScreen libraryPath="Lib" bookCount={0} />)
    for (const id of ['hosting', 'site', 'print', 'interface']) {
      expect(screen.queryByTestId(`settings-nav-${id}`)).toBeNull()
      expect(screen.queryByTestId(`settings-deferred-${id}`)).toBeNull()
    }
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Library',
      'Change library folder…',
    ])
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

  it('sets kit line-heights on the content (round 10, M66)', () => {
    render(<SettingsScreen libraryPath="Lib" bookCount={0} />)
    const classes = (id: string) =>
      screen.getByTestId(id).className.split(/\s+/)
    expect(classes('settings-scroll')).toContain('pb-kit-type')
    expect(classes('settings-section-title')).toContain('leading-[1.2]')
    expect(document.querySelector('style[data-pb-kit-type]')).not.toBeNull()
  })
})

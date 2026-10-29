import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeImportFileError } from './importFileError.test-helpers'
import {
  appendImportErrors,
  isImportErrorsPanelOpen,
  resetImportErrorsStoreForTests,
} from './importErrorsStore'
import {
  resetImportProgressForTests,
  setImportProgress,
} from './importProgressStore'
import { FilmstripStatus } from './FilmstripStatus'
import {
  resetFolderRescanForTests,
  setFolderRescanProgressForTests,
} from './photoRootSession'

afterEach(() => {
  cleanup()
  resetImportErrorsStoreForTests()
  resetFolderRescanForTests()
  resetImportProgressForTests()
})

describe('FilmstripStatus', () => {
  it('returns null when idle with an empty gallery', () => {
    const { container } = render(<FilmstripStatus />)
    expect(container.firstChild).toBeNull()
  })

  it('has no separate photo count line (the dock header owns it)', () => {
    const { container } = render(<FilmstripStatus />)
    expect(screen.queryByTestId('filmstrip-count')).toBeNull()
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByTestId('import-progress')).toBeNull()
  })

  it('shows Importing text and a determinate progress bar while running', () => {
    setImportProgress({
      total: 10,
      completed: 3,
      errors: [],
      running: true,
    })
    render(<FilmstripStatus />)
    expect(screen.getByTestId('import-progress').textContent).toMatch(
      /Importing 3 \/ 10/,
    )
    const bar = screen.getByRole('progressbar', { name: 'Importing' })
    expect(bar.getAttribute('aria-valuenow')).toBe('3')
    expect(bar.getAttribute('aria-valuemax')).toBe('10')
  })

  it('clamps progress max to 1 when total is zero while running', () => {
    setImportProgress({
      total: 0,
      completed: 0,
      errors: [],
      running: true,
    })
    render(<FilmstripStatus />)
    expect(
      screen
        .getByRole('progressbar', { name: 'Importing' })
        .getAttribute('aria-valuemax'),
    ).toBe('1')
  })

  it('shows folder re-scan progress with a stable test id', () => {
    setFolderRescanProgressForTests({
      total: 8,
      completed: 2,
      running: true,
      phase: 'priority',
    })
    render(<FilmstripStatus />)
    expect(screen.getByTestId('folder-rescan-progress').textContent).toMatch(
      /Checking photos 2 \/ 8/,
    )
    expect(
      screen.getByRole('progressbar', { name: 'Checking photos' }),
    ).toBeTruthy()
  })

  it('shows lazy-phase folder re-scan label and clamps zero total', () => {
    setFolderRescanProgressForTests({
      total: 0,
      completed: 0,
      running: true,
      phase: 'lazy',
    })
    render(<FilmstripStatus />)
    expect(screen.getByTestId('folder-rescan-progress').textContent).toMatch(
      /Scanning folder 0 \/ 0/,
    )
    expect(
      screen
        .getByRole('progressbar', { name: 'Checking photos' })
        .getAttribute('aria-valuemax'),
    ).toBe('1')
  })

  it('shows a store-backed errors button that opens the panel', () => {
    appendImportErrors([
      makeImportFileError({
        name: 'a.tif',
        message: 'Unsupported',
        reason: 'unsupported-type',
      }),
    ])
    setImportProgress({
      total: 2,
      completed: 2,
      errors: [],
      running: false,
    })
    render(<FilmstripStatus />)
    const button = screen.getByRole('button', {
      name: /Imported with 1 error/,
    })
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(isImportErrorsPanelOpen()).toBe(false)
    fireEvent.click(button)
    expect(isImportErrorsPanelOpen()).toBe(true)
  })
})

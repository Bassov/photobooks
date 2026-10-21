import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeImportFileError } from './importFileError.test-helpers'
import {
  appendImportErrors,
  isImportErrorsPanelOpen,
  resetImportErrorsStoreForTests,
} from './importErrorsStore'
import { FilmstripStatus } from './FilmstripStatus'

afterEach(() => {
  cleanup()
  resetImportErrorsStoreForTests()
})

describe('FilmstripStatus', () => {
  it('returns null when idle with an empty gallery', () => {
    const { container } = render(
      <FilmstripStatus photoCount={0} progress={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows photo count without a progress bar when not importing', () => {
    render(<FilmstripStatus photoCount={2} progress={null} />)
    expect(screen.getByTestId('filmstrip-count').textContent).toBe('2 photos')
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByTestId('import-progress')).toBeNull()
  })

  it('shows Importing text and a determinate progress bar while running', () => {
    render(
      <FilmstripStatus
        photoCount={0}
        progress={{
          total: 10,
          completed: 3,
          errors: [],
          running: true,
        }}
      />,
    )
    expect(screen.getByTestId('filmstrip-count').textContent).toBe('0 photos')
    expect(screen.getByTestId('import-progress').textContent).toMatch(
      /Importing 3 \/ 10/,
    )
    const bar = screen.getByRole('progressbar', { name: 'Importing' })
    expect(bar.getAttribute('aria-valuenow')).toBe('3')
    expect(bar.getAttribute('aria-valuemax')).toBe('10')
  })

  it('clamps progress max to 1 when total is zero while running', () => {
    render(
      <FilmstripStatus
        photoCount={0}
        progress={{
          total: 0,
          completed: 0,
          errors: [],
          running: true,
        }}
      />,
    )
    expect(
      screen
        .getByRole('progressbar', { name: 'Importing' })
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
    render(
      <FilmstripStatus
        photoCount={1}
        progress={{
          total: 2,
          completed: 2,
          errors: [],
          running: false,
        }}
      />,
    )
    const button = screen.getByRole('button', {
      name: /Imported with 1 error/,
    })
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByTestId('filmstrip-count').textContent).toBe('1 photo')
    expect(isImportErrorsPanelOpen()).toBe(false)
    fireEvent.click(button)
    expect(isImportErrorsPanelOpen()).toBe(true)
  })
})

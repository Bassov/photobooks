import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook } from '../../core/testing/fixtures'
import { resetBookStore } from '../bookStore'
import { ExportSiteDialog } from './ExportSiteDialog'
import { EXPORT_SITE_IDLE, exportSiteStore } from './exportSiteStore'
import { startExportSite } from './startExportSite'

vi.mock('./startExportSite', () => ({
  startExportSite: vi.fn(() => {
    exportSiteStore.dispatch({ type: 'start' })
  }),
}))

const site = { kind: 'directory', name: 'Site' }

function settle(): void {
  exportSiteStore.dispatch({ type: 'failed', code: 'unknown', folder: '' })
  exportSiteStore.dispatch({ type: 'seen' })
}

function step(): string | null {
  return screen.getByTestId('export-site-dialog').getAttribute('data-step')
}

function press(testId: string): void {
  fireEvent.click(screen.getByTestId(testId))
}

beforeEach(() => {
  settle()
  vi.mocked(startExportSite).mockClear()
  resetBookStore({
    book: makeBook({ title: 'Lake' }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
})

afterEach(() => {
  cleanup()
  settle()
  vi.unstubAllGlobals()
})

describe('ExportSiteDialog', () => {
  it('needs a folder before Export and names the open book', () => {
    render(
      <ExportSiteDialog
        initialStep="opts"
        opened={EXPORT_SITE_IDLE}
        onClose={vi.fn()}
      />,
    )

    expect(step()).toBe('opts')
    expect(screen.getByTestId('export-site-books').textContent).toBe(
      '“Lake” as it is now.',
    )
    expect(
      screen.getByTestId('export-site-go').hasAttribute('data-disabled'),
    ).toBe(true)
  })

  it('picks a folder, exports, hides, and lands on Done in place', async () => {
    const showDirectoryPicker = vi.fn(() => Promise.resolve(site))
    vi.stubGlobal('showDirectoryPicker', showDirectoryPicker)
    const onClose = vi.fn()
    const view = render(
      <ExportSiteDialog
        initialStep="opts"
        opened={EXPORT_SITE_IDLE}
        onClose={onClose}
      />,
    )

    press('export-site-choose')
    await waitFor(() => {
      expect(screen.getByTestId('export-site-folder').textContent).toBe('Site')
    })
    expect(screen.getByText(/The site goes into Site\/dist/)).toBeTruthy()
    press('export-site-go')

    expect(startExportSite).toHaveBeenCalledWith(site)
    expect(step()).toBe('run')
    expect(screen.getByTestId('export-site-phase').textContent).toBe(
      'Preparing photos · 0%',
    )
    act(() => {
      exportSiteStore.dispatch({
        type: 'done',
        summary: { books: 1, files: 4, bytes: 0 },
        folder: 'Site',
      })
    })
    expect(step()).toBe('done')
    expect(screen.getByTestId('export-site-summary').textContent).toBe(
      '1 book · 4 files · 0.0 MB in Site/dist.',
    )
    view.unmount()
  })

  it('hides while running and the export keeps going', () => {
    exportSiteStore.dispatch({ type: 'start' })
    const onClose = vi.fn()
    render(
      <ExportSiteDialog
        initialStep="run"
        opened={exportSiteStore.getSnapshot()}
        onClose={onClose}
      />,
    )

    press('export-site-hide')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(exportSiteStore.getSnapshot().kind).toBe('running')
  })

  it('sends a foreign dist back to choosing a folder', () => {
    render(
      <ExportSiteDialog
        initialStep="failed"
        opened={{ kind: 'failed', code: 'not-our-export', folder: 'Home' }}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('export-site-error').textContent).toBe(
      'dist in “Home” isn’t a Photobooks export, so it was left as it is. Choose another folder.',
    )
    expect(screen.queryByTestId('export-site-retry')).toBeNull()

    press('export-site-rechoose')

    expect(step()).toBe('opts')
    expect(screen.getByTestId('export-site-choose')).toBeTruthy()
  })

  it('offers Try again for other failures, which needs the folder again', () => {
    const onClose = vi.fn()
    render(
      <ExportSiteDialog
        initialStep="failed"
        opened={{ kind: 'failed', code: 'permission', folder: 'Site' }}
        onClose={onClose}
      />,
    )

    press('export-site-retry')

    expect(step()).toBe('opts')
    expect(startExportSite).not.toHaveBeenCalled()
  })

  it('closes a failure and clears the pill state', () => {
    exportSiteStore.dispatch({ type: 'start' })
    exportSiteStore.dispatch({ type: 'failed', code: 'quota', folder: 'S' })
    const onClose = vi.fn()
    render(
      <ExportSiteDialog
        initialStep="failed"
        opened={exportSiteStore.getSnapshot()}
        onClose={onClose}
      />,
    )

    press('export-site-close')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(exportSiteStore.getSnapshot().kind).toBe('idle')
  })
})

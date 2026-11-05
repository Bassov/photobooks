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
import { ExportSiteDialog, type ExportSiteStep } from './ExportSiteDialog'
import {
  loadExportFolder,
  saveExportFolder,
  SESSION_FOLDER_KEY,
} from './exportSiteFolder'
import { otherPublishedTitles } from './exportSiteRun'
import {
  EXPORT_SITE_IDLE,
  exportSiteStore,
  type ExportSiteState,
} from './exportSiteStore'
import { startExportSite } from './startExportSite'

vi.mock('./startExportSite', () => ({
  startExportSite: vi.fn(() => {
    exportSiteStore.dispatch({ type: 'start' })
  }),
}))

vi.mock('./exportSiteFolder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./exportSiteFolder')>()),
  loadExportFolder: vi.fn(() => Promise.resolve(null)),
  saveExportFolder: vi.fn(() => Promise.resolve()),
}))

vi.mock('./exportSiteRun', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./exportSiteRun')>()),
  otherPublishedTitles: vi.fn(() => Promise.resolve([])),
}))

const site = { kind: 'directory', name: 'Site' }
const old = { kind: 'directory', name: 'Old' } as FileSystemDirectoryHandle

/** Each heading as its text, prefixed with its icon (`[loader] Exporting…`). */
function titles(): string[] {
  return screen.getAllByRole('heading').map((node) => {
    const icon = node.querySelector('[data-icon]')?.getAttribute('data-icon')
    const text = node.textContent
    return icon === undefined || icon === null ? text : `[${icon}] ${text}`
  })
}

function folderName(): string | null {
  return screen.queryByTestId('export-site-folder')?.textContent ?? null
}

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
  vi.mocked(loadExportFolder).mockClear()
  vi.mocked(saveExportFolder).mockClear()
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
    expect(saveExportFolder).toHaveBeenCalledWith(SESSION_FOLDER_KEY, site)
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
    exportSiteStore.dispatch({ type: 'start' })
    exportSiteStore.dispatch({
      type: 'failed',
      code: 'not-our-export',
      folder: 'Home',
    })
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
    expect(exportSiteStore.getSnapshot().kind).toBe('idle')
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

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <ExportSiteDialog
        initialStep="opts"
        opened={EXPORT_SITE_IDLE}
        onClose={onClose}
      />,
    )

    fireEvent.keyDown(screen.getByTestId('export-site-dialog'), {
      key: 'Escape',
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  const done: ExportSiteState = {
    kind: 'done',
    summary: { books: 1, files: 4, bytes: 0 },
    folder: 'Site',
  }
  const failed: ExportSiteState = {
    kind: 'failed',
    code: 'quota',
    folder: 'Site',
  }
  it.each<[ExportSiteStep, ExportSiteState, string]>([
    ['opts', EXPORT_SITE_IDLE, 'Export site'],
    ['opts', done, 'Export site'],
    ['opts', failed, 'Export site'],
    ['done', done, '[circle-check] Site exported'],
    ['failed', failed, '[warning] Export failed'],
  ])('shows only the %s step (opened on %o)', (initialStep, opened, title) => {
    render(
      <ExportSiteDialog
        initialStep={initialStep}
        opened={opened}
        onClose={vi.fn()}
      />,
    )

    expect(titles()).toEqual([title])
  })

  it('shows only the run step, at 100 % once the run is no longer reported', () => {
    render(
      <ExportSiteDialog
        initialStep="run"
        opened={EXPORT_SITE_IDLE}
        onClose={vi.fn()}
      />,
    )

    expect(titles()).toEqual([expect.stringMatching(/^\[loader\] /)])
    expect(screen.getByTestId('export-site-phase').textContent).toBe(
      'Writing files · 100%',
    )
  })

  it('restores the remembered folder, and Change… picks another', async () => {
    vi.mocked(loadExportFolder).mockResolvedValueOnce(old)
    vi.stubGlobal('showDirectoryPicker', () => Promise.resolve(site))
    render(
      <ExportSiteDialog
        initialStep="opts"
        opened={EXPORT_SITE_IDLE}
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(folderName()).toBe('Old')
    })
    expect(loadExportFolder).toHaveBeenCalledWith(SESSION_FOLDER_KEY)
    press('export-site-change')

    await waitFor(() => {
      expect(folderName()).toBe('Site')
    })
    expect(saveExportFolder).toHaveBeenCalledWith(SESSION_FOLDER_KEY, site)
  })

  it('keeps the remembered folder when the picker is cancelled', async () => {
    vi.mocked(loadExportFolder).mockResolvedValueOnce(old)
    const picker = vi.fn(() =>
      Promise.reject(new DOMException('', 'AbortError')),
    )
    vi.stubGlobal('showDirectoryPicker', picker)
    render(
      <ExportSiteDialog
        initialStep="opts"
        opened={EXPORT_SITE_IDLE}
        onClose={vi.fn()}
      />,
    )
    await waitFor(() => {
      expect(folderName()).toBe('Old')
    })

    press('export-site-change')
    await waitFor(() => {
      expect(picker).toHaveBeenCalledTimes(1)
    })
    await act(() => Promise.resolve())

    expect(folderName()).toBe('Old')
    expect(saveExportFolder).not.toHaveBeenCalled()
  })

  it('keeps a folder picked before the remembered one loads', async () => {
    let remember: (handle: FileSystemDirectoryHandle) => void = () => undefined
    vi.mocked(loadExportFolder).mockReturnValueOnce(
      new Promise((resolve) => {
        remember = resolve
      }),
    )
    vi.stubGlobal('showDirectoryPicker', () => Promise.resolve(site))
    render(
      <ExportSiteDialog
        initialStep="opts"
        opened={EXPORT_SITE_IDLE}
        onClose={vi.fn()}
      />,
    )

    press('export-site-choose')
    await waitFor(() => {
      expect(folderName()).toBe('Site')
    })
    await act(async () => {
      remember(old)
      await Promise.resolve()
    })

    expect(folderName()).toBe('Site')
  })

  it('names the books of earlier exports', async () => {
    vi.mocked(otherPublishedTitles).mockResolvedValueOnce(['Sea'])
    render(
      <ExportSiteDialog
        initialStep="opts"
        opened={EXPORT_SITE_IDLE}
        onClose={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('export-site-books').textContent).toBe(
        '“Lake” as it is now, plus 1 book from earlier exports: Sea.',
      )
    })
  })
})

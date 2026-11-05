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
import { ExportSiteButton } from './ExportSiteButton'
import { exportSiteStore } from './exportSiteStore'

vi.mock('./startExportSite', () => ({
  startExportSite: vi.fn(() => {
    exportSiteStore.dispatch({ type: 'start' })
  }),
}))

/** Bring the shared store back to idle whatever a test left it in. */
function settleExportSiteStore(): void {
  exportSiteStore.dispatch({ type: 'failed', code: 'unknown', folder: '' })
  exportSiteStore.dispatch({ type: 'seen' })
  exportSiteStore.dispatch({ type: 'expire' })
}

function pill(): HTMLElement {
  return screen.getByTestId('export-site')
}

async function progress(percent: number): Promise<void> {
  act(() => {
    exportSiteStore.dispatch({ type: 'progress', phase: 'render', percent })
  })
  await waitFor(() => {
    expect(pill().textContent).toContain(`${String(percent)}%`)
  })
}

beforeEach(() => {
  settleExportSiteStore()
  resetBookStore({
    book: makeBook({ title: 'Lake' }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
})

afterEach(() => {
  cleanup()
  settleExportSiteStore()
})

describe('ExportSiteButton', () => {
  it('rests as "Export site" with a hidden rest-content sizer', () => {
    render(<ExportSiteButton disabled={false} />)

    expect(pill().getAttribute('data-state')).toBe('idle')
    expect(pill().getAttribute('title')).toBe('Export site')
    const sizer = screen.getByTestId('export-site-sizer')
    expect(sizer.getAttribute('aria-hidden')).toBe('true')
    expect(sizer.textContent).toBe('Export site')
  })

  it('is disabled at rest when the editor says so', () => {
    render(<ExportSiteButton disabled />)

    expect((pill() as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows NN% over a fill while running and keeps its name and sizer', async () => {
    render(<ExportSiteButton disabled />)
    act(() => {
      exportSiteStore.dispatch({ type: 'start' })
    })

    await progress(42)

    expect(pill().getAttribute('data-state')).toBe('running')
    expect((pill() as HTMLButtonElement).disabled).toBe(false)
    expect(pill().getAttribute('aria-label')).toBe('Export site')
    expect(pill().getAttribute('title')).toBe('Exporting site · 42%')
    expect(pill().style.getPropertyValue('--export-site-progress')).toBe('0.42')
    expect(screen.getByTestId('export-site-sizer').textContent).toBe(
      'Export site',
    )
    expect(screen.getByRole('status').textContent).toBe('Exporting site, 42%')
  })

  it('announces progress at most every 10 %', async () => {
    render(<ExportSiteButton disabled={false} />)
    act(() => {
      exportSiteStore.dispatch({ type: 'start' })
    })
    await progress(40)

    await progress(49)
    expect(screen.getByRole('status').textContent).toBe('Exporting site, 40%')

    await progress(50)
    expect(screen.getByRole('status').textContent).toBe('Exporting site, 50%')
  })

  it('shows Exported and opens Done with the summary', () => {
    render(<ExportSiteButton disabled={false} />)
    act(() => {
      exportSiteStore.dispatch({ type: 'start' })
      exportSiteStore.dispatch({
        type: 'done',
        summary: { books: 2, files: 10, bytes: 3_000_000 },
        folder: 'Site',
      })
    })

    expect(pill().textContent).toContain('Exported')
    expect(pill().getAttribute('title')).toBe('Site exported')
    expect(screen.getByRole('status').textContent).toBe('Site exported')
    fireEvent.click(pill())
    expect(
      screen.getByTestId('export-site-dialog').getAttribute('data-step'),
    ).toBe('done')
    expect(screen.getByTestId('export-site-summary').textContent).toBe(
      '2 books · 10 files · 3.0 MB in Site/dist.',
    )
    fireEvent.click(screen.getByTestId('export-site-close'))
    expect(screen.queryByTestId('export-site-dialog')).toBeNull()
  })

  it('shows Failed until opened, then rests again', () => {
    render(<ExportSiteButton disabled={false} />)
    act(() => {
      exportSiteStore.dispatch({ type: 'start' })
      exportSiteStore.dispatch({ type: 'failed', code: 'quota', folder: 'S' })
    })
    expect(pill().textContent).toContain('Failed')
    expect(screen.getByRole('status').textContent).toBe('Site export failed')

    fireEvent.click(pill())

    expect(screen.getByTestId('export-site-error').textContent).toBe(
      'The disk is full.',
    )
    expect(pill().getAttribute('data-state')).toBe('idle')
  })
})

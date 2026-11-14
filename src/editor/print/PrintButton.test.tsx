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
import type { ExportFileHandle } from '../../project'
import { resetBookStore } from '../bookStore'
import { PrintButton } from './PrintButton'
import { printStore } from './printStore'

vi.mock('./startPrint', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./startPrint')>()),
  checkOpenBook: vi.fn(() => Promise.resolve([])),
  startPrint: vi.fn(),
  retryPrint: vi.fn(),
  openPrintedPdf: vi.fn(),
}))

function settlePrintStore(): void {
  printStore.dispatch({ type: 'failed', code: 'other', library: '' })
  printStore.dispatch({ type: 'seen' })
  printStore.dispatch({ type: 'expire' })
}

const pill = () => screen.getByTestId('print')
const done = {
  file: 'lake-trip-A5.pdf',
  sheets: 20,
  bytes: 2_000_000,
  skipped: { count: 0, pages: [] },
  handle: { kind: 'file', name: 'lake-trip-A5.pdf' } as ExportFileHandle,
  library: 'Photobooks',
}

beforeEach(() => {
  settlePrintStore()
  resetBookStore({
    book: makeBook({ title: 'Lake trip' }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
})

afterEach(() => {
  cleanup()
  settlePrintStore()
})

describe('PrintButton', () => {
  it('rests as an icon-only "Print" pill', () => {
    render(<PrintButton disabled={false} />)

    expect(pill().getAttribute('data-state')).toBe('idle')
    expect(pill().getAttribute('title')).toBe('Print')
    expect(pill().getAttribute('aria-label')).toBe('Print')
    expect(pill().textContent).toBe('')
    expect(
      screen.getByTestId('print-sizer').querySelector('svg'),
    ).not.toBeNull()
  })

  it('is disabled at rest only', () => {
    render(<PrintButton disabled />)
    expect((pill() as HTMLButtonElement).disabled).toBe(true)

    act(() => {
      printStore.dispatch({ type: 'start', sheets: 20 })
    })

    expect((pill() as HTMLButtonElement).disabled).toBe(false)
  })

  it('fills while running, says the percent and keeps the Printer', async () => {
    render(<PrintButton disabled={false} />)
    act(() => {
      printStore.dispatch({ type: 'start', sheets: 20 })
      printStore.dispatch({ type: 'progress', painted: 9 })
    })

    await waitFor(() => {
      expect(pill().getAttribute('title')).toBe('Exporting PDF · 43%')
    })
    expect(pill().getAttribute('data-state')).toBe('running')
    expect(pill().style.getPropertyValue('--site-job-progress')).toBe('0.43')
    expect(screen.getByTestId('print-status').textContent).toBe(
      'Exporting PDF, 43%',
    )
  })

  it('shows PDF ready, opens the done step from the pill', () => {
    render(<PrintButton disabled={false} />)
    act(() => {
      printStore.dispatch({ type: 'start', sheets: 20 })
      printStore.dispatch({ type: 'done', ...done })
    })

    expect(pill().getAttribute('title')).toBe('PDF ready')
    expect(screen.getByTestId('print-status').textContent).toBe('PDF ready')
    fireEvent.click(pill())

    expect(screen.getByTestId('print-dialog').getAttribute('data-step')).toBe(
      'done',
    )
    expect(screen.getByTestId('print-done').textContent).toBe(
      'lake-trip-A5.pdf · 20 pages · 2.0 MB',
    )
  })

  it('keeps a failure until the pill opens it', () => {
    render(<PrintButton disabled />)
    act(() => {
      printStore.dispatch({ type: 'start', sheets: 20 })
      printStore.dispatch({ type: 'failed', code: 'full', library: 'L' })
    })
    expect(pill().getAttribute('title')).toBe('PDF not exported')
    expect(screen.getByTestId('print-status').textContent).toBe(
      'PDF not exported',
    )

    fireEvent.click(pill())

    expect(printStore.getSnapshot().kind).toBe('idle')
    expect(screen.getByTestId('print-error').textContent).toBe(
      'The disk is full.',
    )
    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByTestId('print-dialog')).toBeNull()
  })

  it('opens Options at rest and the run step while running', () => {
    render(<PrintButton disabled={false} />)
    fireEvent.click(pill())
    expect(screen.getByTestId('print-dialog').getAttribute('data-step')).toBe(
      'opts',
    )
    fireEvent.click(screen.getByText('Cancel'))

    act(() => {
      printStore.dispatch({ type: 'start', sheets: 20 })
    })
    fireEvent.click(pill())

    expect(screen.getByTestId('print-dialog').getAttribute('data-step')).toBe(
      'run',
    )
  })
})

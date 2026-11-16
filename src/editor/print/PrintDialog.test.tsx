import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreflightRow } from '../../core'
import { makeBook, makeSpread } from '../../core/testing/fixtures'
import type { ExportFileHandle } from '../../project'
import { resetBookStore } from '../bookStore'
import { PrintDialog } from './PrintDialog'
import { PRINT_IDLE, printStore, type PrintState } from './printStore'
import {
  checkOpenBook,
  openPrintedPdf,
  retryPrint,
  startPrint,
} from './startPrint'

vi.mock('./startPrint', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./startPrint')>()),
  checkOpenBook: vi.fn(),
  startPrint: vi.fn(() => {
    printStore.dispatch({ type: 'start', sheets: 20 })
  }),
  retryPrint: vi.fn(() => {
    printStore.dispatch({ type: 'start', sheets: 20 })
  }),
  openPrintedPdf: vi.fn(),
}))

const handle = { kind: 'file', name: 'lake-trip-A5.pdf' } as ExportFileHandle
const coverHandle = {
  kind: 'file',
  name: 'lake-trip-A5-cover.pdf',
} as ExportFileHandle
const outcome = {
  file: 'lake-trip-A5.pdf',
  layout: 'single' as const,
  sheets: 20,
  bytes: 3_456_789,
  skipped: { count: 0, pages: [], cover: false },
  handle,
  cover: {
    file: 'lake-trip-A5-cover.pdf',
    bytes: 2_940_000,
    handle: coverHandle,
  },
  library: 'Photobooks',
}

const row = (
  id: PreflightRow['id'],
  severity: PreflightRow['severity'],
  text: string,
  pageList = '',
  scope: PreflightRow['scope'] = 'pages',
): PreflightRow => ({
  id,
  severity,
  count: 1,
  text,
  pages: [],
  pageList,
  scope,
})

function settlePrintStore(): void {
  printStore.dispatch({ type: 'failed', code: 'other', library: '' })
  printStore.dispatch({ type: 'seen' })
  printStore.dispatch({ type: 'expire' })
}

function show(
  initialStep: 'opts' | 'run' | 'done' | 'failed' = 'opts',
  opened: PrintState = PRINT_IDLE,
) {
  const onClose = vi.fn()
  render(
    <PrintDialog initialStep={initialStep} opened={opened} onClose={onClose} />,
  )
  return onClose
}

const step = () => screen.getByTestId('print-dialog').getAttribute('data-step')
const check = () => screen.getByTestId('print-check')

beforeEach(() => {
  settlePrintStore()
  vi.mocked(checkOpenBook).mockResolvedValue([])
  resetBookStore({
    book: makeBook({
      title: 'Lake trip',
      settings: { trim: { widthMm: 190, heightMm: 230 }, bleedMm: 3 },
      spreads: Array.from({ length: 11 }, (_, i) =>
        makeSpread({ id: `s${String(i)}` }),
      ),
    }),
    sessionMeta: new Map(),
    importRunning: false,
    importExpectedCount: 0,
  })
})

afterEach(() => {
  cleanup()
  settlePrintStore()
  vi.clearAllMocks()
})

describe('PrintDialog options', () => {
  it('shows the read-only rows and the bleed summary', async () => {
    show()

    expect(screen.getByTestId('print-size').textContent).toBe(
      'Page sizeCustom · 19 × 23 cm',
    )
    expect(screen.getByTestId('print-profile').textContent).toBe(
      'PrinterGeneric',
    )
    // cover-pdf §2.1.1: 19 × 23 cm, 20 pages → 2 × 190 + 12 + 2 × 15 mm wide.
    expect(screen.getByTestId('print-cover').textContent).toBe(
      'Cover42.2 × 26 cm · spine 12 mm',
    )
    const imposition = screen.getByRole('radiogroup', { name: 'Imposition' })
    expect(screen.getByTestId('print-imposition').textContent).toBe(
      'Imposition (duplex)1 per sheet2-up4-up',
    )
    expect(
      screen.getByRole('radio', { name: '1 per sheet' }).matches(':checked'),
    ).toBe(true)
    expect(imposition.querySelectorAll('input:disabled')).toHaveLength(0)
    expect(screen.getByText('Add 3 mm bleed and crop marks')).not.toBeNull()
    const summary = screen.getByTestId('print-summary')
    expect(summary.textContent).toBe('PDF · 20 pages + cover · bleed 3 mm')

    fireEvent.click(screen.getByTestId('print-bleed'))

    expect(summary.textContent).toBe(
      'PDF · 20 pages + cover · trim size, no marks',
    )
    await waitFor(() => {
      expect(check().getAttribute('data-state')).toBe('clean')
    })
  })

  it('counts paper sheets for a booklet and exports it', () => {
    show()
    const summary = screen.getByTestId('print-summary')

    fireEvent.click(screen.getByRole('radio', { name: '2-up' }))
    expect(summary.textContent).toBe('PDF · 20 pages on 5 sheets · bleed 3 mm')
    expect(screen.getByTestId('print-cover').textContent).toBe(
      'CoverNone with booklets',
    )
    fireEvent.click(screen.getByRole('radio', { name: '4-up' }))
    expect(summary.textContent).toBe('PDF · 20 pages on 3 sheets · bleed 3 mm')
    fireEvent.click(screen.getByTestId('print-go'))

    expect(startPrint).toHaveBeenCalledWith(true, '4up')
  })

  it('checks the book: checking, then clean', async () => {
    let finish: (rows: PreflightRow[]) => void = () => undefined
    vi.mocked(checkOpenBook).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    show()

    expect(check().getAttribute('data-state')).toBe('checking')
    expect(check().textContent).toBe('CheckChecking the book…')
    expect(screen.getByTestId('print-go')).not.toHaveProperty('disabled', true)
    await act(async () => {
      finish([])
      await Promise.resolve()
    })

    expect(check().getAttribute('data-state')).toBe('clean')
    expect(check().textContent).toBe('CheckNo problems found')
  })

  it('lists issues with pages and the error note, never blocking Export', async () => {
    vi.mocked(checkOpenBook).mockResolvedValue([
      row('asset-missing', 'error', '1 photo can’t be found', ' · page 6'),
      row(
        'dpi-below-warn',
        'warning',
        '2 photos below 200 ppi',
        ' · pages 2, 3',
      ),
      row('empty-text-frame', 'info', '1 empty text frame'),
    ])
    show()

    await waitFor(() => {
      expect(check().getAttribute('data-state')).toBe('issues')
    })
    const rows = screen.getAllByTestId('print-check-row')
    expect(rows.map((li) => li.getAttribute('data-rule'))).toEqual([
      'asset-missing',
      'dpi-below-warn',
      'empty-text-frame',
    ])
    expect(rows[0]?.textContent).toBe('1 photo can’t be found · page 6')
    expect(rows[0]?.className).toContain('print-check-row--error')
    expect(check().textContent).toContain('Check · 1 error, 1 warning')
    expect(screen.getByTestId('print-check-note')).not.toBeNull()

    fireEvent.click(screen.getByTestId('print-go'))

    expect(startPrint).toHaveBeenCalledWith(true, 'single')
    expect(step()).toBe('run')
  })

  it('shows the cover rows with 1 per sheet only, counting the shown rows', async () => {
    vi.mocked(checkOpenBook).mockResolvedValue([
      row('dpi-below-warn', 'warning', '2 photos below 200 ppi'),
      row(
        'cover-dpi-below-min',
        'error',
        'Front cover photo is 120 ppi, below 150 ppi',
        '',
        'cover',
      ),
    ])
    show()

    await waitFor(() => {
      expect(check().getAttribute('data-state')).toBe('issues')
    })
    const rules = () =>
      screen
        .getAllByTestId('print-check-row')
        .map((li) => li.getAttribute('data-rule'))
    expect(rules()).toEqual(['dpi-below-warn', 'cover-dpi-below-min'])
    expect(check().textContent).toContain('Check · 1 error, 1 warning')
    expect(screen.getByTestId('print-check-note')).not.toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: '4-up' }))

    expect(rules()).toEqual(['dpi-below-warn'])
    expect(check().textContent).toContain('Check · 1 warning')
    expect(screen.queryByTestId('print-check-note')).toBeNull()
    // C9: the worker checks the cover per layout.
    expect(vi.mocked(checkOpenBook).mock.calls).toEqual([['single'], ['4up']])
  })

  it('leaves the note out without errors', async () => {
    vi.mocked(checkOpenBook).mockResolvedValue([
      row('dpi-below-warn', 'warning', '2 photos below 200 ppi'),
    ])
    show()

    await waitFor(() => {
      expect(check().getAttribute('data-state')).toBe('issues')
    })
    expect(screen.queryByTestId('print-check-note')).toBeNull()
  })

  it('exports without marks when unchecked; Cancel closes', () => {
    const onClose = show()
    fireEvent.click(screen.getByTestId('print-bleed'))
    fireEvent.click(screen.getByTestId('print-go'))
    expect(startPrint).toHaveBeenCalledWith(false, 'single')

    fireEvent.click(screen.getByTestId('print-hide'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(printStore.getSnapshot().kind).toBe('running')
  })

  it('closes on Escape', () => {
    const onClose = show()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not check when opened on another step', () => {
    show('run')

    expect(checkOpenBook).not.toHaveBeenCalled()
  })
})

describe('PrintDialog run', () => {
  it('shows the page being painted and moves to PDF ready in place', async () => {
    show()
    fireEvent.click(screen.getByTestId('print-go'))
    act(() => {
      printStore.dispatch({ type: 'progress', painted: 10 })
    })

    await waitFor(() => {
      expect(screen.getByTestId('print-run-text').textContent).toBe(
        'Page 11 of 20 · 45%',
      )
    })
    act(() => {
      printStore.dispatch({ type: 'progress', painted: 20 })
    })
    await waitFor(() => {
      expect(screen.getByTestId('print-run-text').textContent).toBe(
        'Cover · 90%',
      )
    })
    act(() => {
      printStore.dispatch({ type: 'saving' })
    })
    expect(screen.getByTestId('print-run-text').textContent).toBe(
      'Saving · 97%',
    )
    act(() => {
      printStore.dispatch({ type: 'done', ...outcome })
    })

    expect(step()).toBe('done')
    expect(screen.getByTestId('print-done').textContent).toBe(
      'lake-trip-A5.pdf · 20 pages · 3.5 MB',
    )
    expect(screen.getByTestId('print-done-cover').textContent).toBe(
      'lake-trip-A5-cover.pdf · cover · 2.9 MB',
    )
    expect(screen.getByTestId('print-open').textContent).toBe('Open pages')
    expect(screen.getByTestId('print-open-cover').textContent).toBe(
      'Open cover',
    )
    expect(screen.getByTestId('print-saved').textContent).toBe(
      'Saved in Photobooks/exports.',
    )
    expect(screen.queryByTestId('print-skipped')).toBeNull()
    expect(screen.queryByTestId('print-duplex')).toBeNull()
  })

  it('shows a booklet imposing, then its sheets and how to fold it', async () => {
    show()
    fireEvent.click(screen.getByTestId('print-go'))
    act(() => {
      printStore.dispatch({ type: 'imposing', imposed: 1, sheets: 5 })
    })

    await waitFor(() => {
      expect(screen.getByTestId('print-run-text').textContent).toBe(
        'Imposing sheets · 2 of 5 · 83%',
      )
    })
    act(() => {
      printStore.dispatch({
        type: 'done',
        ...outcome,
        file: 'lake-trip-A5-2up.pdf',
        layout: '2up',
        sheets: 5,
        cover: null,
      })
    })

    expect(screen.getByTestId('print-done').textContent).toBe(
      'lake-trip-A5-2up.pdf · 5 sheets · 3.5 MB',
    )
    expect(screen.queryByTestId('print-done-cover')).toBeNull()
    expect(screen.queryByTestId('print-open-cover')).toBeNull()
    expect(screen.getByTestId('print-open').textContent).toBe('Open PDF')
    expect(screen.getByTestId('print-duplex').textContent).toMatch(
      /^Print on both sides, flip on the short edge\./,
    )
  })

  it('shows an empty run text before the store runs', () => {
    show('run')

    expect(screen.getByTestId('print-run-text').textContent).toBe('')
  })
})

describe('PrintDialog done', () => {
  it('lists skipped photos, the cover first, and opens both files', () => {
    const skipped = { count: 3, pages: [3, 6], cover: true }
    const onClose = show('done', { kind: 'done', ...outcome, skipped })

    expect(screen.getByTestId('print-skipped').textContent).toBe(
      '3 photos couldn’t be read and print as blank paper · cover, pages 3, 6',
    )
    fireEvent.click(screen.getByTestId('print-open'))
    expect(openPrintedPdf).toHaveBeenCalledWith(handle)
    fireEvent.click(screen.getByTestId('print-open-cover'))
    expect(openPrintedPdf).toHaveBeenLastCalledWith(coverHandle)
    fireEvent.click(screen.getByTestId('print-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('PrintDialog failed', () => {
  it('names the library and tries the same export again', () => {
    show('failed', { kind: 'failed', code: 'access', library: 'Photobooks' })

    expect(screen.getByTestId('print-error').textContent).toBe(
      'Photobooks can’t write to “Photobooks”. Allow access to the folder and try again.',
    )
    fireEvent.click(screen.getByTestId('print-retry'))

    expect(retryPrint).toHaveBeenCalledWith(true, 'single')
    expect(step()).toBe('run')
  })

  it('moves a failing run to the failed step and clears it on Close', () => {
    const onClose = show()
    fireEvent.click(screen.getByTestId('print-go'))
    act(() => {
      printStore.dispatch({ type: 'failed', code: 'other', library: 'L' })
    })

    expect(step()).toBe('failed')
    fireEvent.click(screen.getByText('Close'))

    expect(printStore.getSnapshot().kind).toBe('idle')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

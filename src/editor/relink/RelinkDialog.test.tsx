import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import assert from 'node:assert/strict'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as dialogActions from './dialogActions'
import { RelinkDialog } from './RelinkDialog'
import {
  markRelinkFound,
  replaceRelinkStatuses,
  resetRelinkStore,
  setRelinkDialogOpen,
  setRelinkProgress,
} from './statusStore'

const noopRescan = (): Promise<undefined> => Promise.resolve(undefined)
const noopResolve = (): Promise<number> => Promise.resolve(0)

describe('RelinkDialog', () => {
  afterEach(() => {
    cleanup()
    resetRelinkStore()
    vi.restoreAllMocks()
  })

  it('renders nothing when closed', () => {
    setRelinkDialogOpen(false)
    const { container } = render(
      <RelinkDialog onRescanFiles={noopRescan} onResolve={noopResolve} />,
    )
    expect(container.querySelector('[data-testid="relink-dialog"]')).toBeNull()
  })

  it('shows empty copy when open with no problems', () => {
    setRelinkDialogOpen(true)
    render(<RelinkDialog onRescanFiles={noopRescan} onResolve={noopResolve} />)
    expect(screen.getByTestId('relink-empty').textContent).toBe(
      'Everything is linked.',
    )
  })

  it('lists missing and modified problem rows', () => {
    replaceRelinkStatuses(
      new Map([
        ['a1', 'missing'],
        ['a2', 'modified'],
        ['a3', 'ok'],
      ]),
    )
    setRelinkDialogOpen(true)
    render(<RelinkDialog onRescanFiles={noopRescan} onResolve={noopResolve} />)
    const rows = screen.getAllByTestId('relink-row')
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.getAttribute('data-status')).sort()).toEqual([
      'missing',
      'modified',
    ])
  })

  it('updates rows, dotted badges, progress and Resolve live while open', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    replaceRelinkStatuses(new Map([['a1', 'missing']]))
    setRelinkDialogOpen(true)
    render(<RelinkDialog onRescanFiles={noopRescan} onResolve={noopResolve} />)
    const badge = (): HTMLElement =>
      screen.getAllByTestId('relink-row')[0]?.querySelector('.pb-badge') ??
      document.body
    expect(badge().querySelector('.pb-badge-dot')).not.toBeNull()
    // Kit RelinkDialog header: pt-5 px-6 pb-2 (r40 M150).
    expect(
      screen.getByTestId('relink-dialog').querySelector('header')?.style
        .padding,
    ).toBe('1.25rem 1.5rem 0.5rem')

    act(() => {
      setRelinkProgress({ total: 4, completed: 1, running: true })
    })
    expect(screen.getByTestId('relink-scan-progress').textContent).toContain(
      '25%',
    )
    act(() => {
      setRelinkProgress({ total: 0, completed: 0, running: true })
      replaceRelinkStatuses(
        new Map([
          ['a1', 'missing'],
          ['a2', 'modified'],
        ]),
      )
    })
    expect(screen.getByTestId('relink-scan-progress').textContent).toContain(
      '0%',
    )
    expect(screen.getAllByTestId('relink-row')).toHaveLength(2)
    act(() => {
      setRelinkProgress(null)
      markRelinkFound(['a1'])
    })
    expect(screen.queryByTestId('relink-scan-progress')).toBeNull()
    expect(screen.getByTestId('relink-resolve').textContent).toBe('Resolve 1')
    expect(badge().getAttribute('data-dot')).toBe('true')
    act(() => {
      replaceRelinkStatuses(new Map())
    })
    expect(screen.getByTestId('relink-empty')).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('Skip closes the dialog', () => {
    replaceRelinkStatuses(new Map([['a1', 'missing']]))
    setRelinkDialogOpen(true)
    render(<RelinkDialog onRescanFiles={noopRescan} onResolve={noopResolve} />)
    fireEvent.click(screen.getByTestId('relink-skip'))
    expect(screen.queryByTestId('relink-dialog')).toBeNull()
  })

  it('shows found status and Resolve label', () => {
    replaceRelinkStatuses(new Map([['a1', 'missing']]))
    markRelinkFound(['a1'])
    setRelinkDialogOpen(true)
    render(<RelinkDialog onRescanFiles={noopRescan} onResolve={noopResolve} />)
    expect(screen.getByTestId('relink-row').getAttribute('data-status')).toBe(
      'found',
    )
    expect(screen.getByTestId('relink-resolve').textContent).toBe('Resolve 1')
    expect(screen.getByTestId('relink-resolve').hasAttribute('disabled')).toBe(
      false,
    )
  })

  it('Resolve closes when onResolve returns a positive count', async () => {
    replaceRelinkStatuses(new Map([['a1', 'missing']]))
    markRelinkFound(['a1'])
    setRelinkDialogOpen(true)
    const onResolve = vi.fn((): Promise<number> => Promise.resolve(1))
    render(<RelinkDialog onRescanFiles={noopRescan} onResolve={onResolve} />)
    fireEvent.click(screen.getByTestId('relink-resolve'))
    await vi.waitFor(() => {
      expect(screen.queryByTestId('relink-dialog')).toBeNull()
    })
    expect(onResolve).toHaveBeenCalled()
  })

  it('keeps dialog open when onResolve returns zero', async () => {
    replaceRelinkStatuses(new Map([['a1', 'missing']]))
    markRelinkFound(['a1'])
    setRelinkDialogOpen(true)
    render(
      <RelinkDialog
        onRescanFiles={noopRescan}
        onResolve={() => Promise.resolve(0)}
      />,
    )
    fireEvent.click(screen.getByTestId('relink-resolve'))
    await vi.waitFor(() => {
      expect(screen.getByTestId('relink-dialog')).toBeTruthy()
    })
  })

  it('shows scan progress and disables rescan while running', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    setRelinkDialogOpen(true)
    setRelinkProgress({ total: 10, completed: 4, running: true })
    render(<RelinkDialog onRescanFiles={noopRescan} onResolve={noopResolve} />)
    expect(screen.getByTestId('relink-scan-progress').textContent).toContain(
      '40%',
    )
    expect(screen.getByTestId('relink-rescan').hasAttribute('disabled')).toBe(
      true,
    )
    vi.unstubAllGlobals()
  })

  it('Rescan folder click opens the hidden folder input', () => {
    setRelinkDialogOpen(true)
    render(<RelinkDialog onRescanFiles={noopRescan} onResolve={noopResolve} />)
    const input = screen.getByTestId('relink-folder-input')
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByTestId('relink-rescan'))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('invokes onRescanFiles from folder input and clears the value', () => {
    setRelinkDialogOpen(true)
    const onRescanFiles = vi.fn((): Promise<undefined> =>
      Promise.resolve(undefined),
    )
    const clear = vi.spyOn(dialogActions, 'clearFolderInputValue')
    render(
      <RelinkDialog onRescanFiles={onRescanFiles} onResolve={noopResolve} />,
    )
    const input = screen.getByTestId('relink-folder-input')
    assert(input instanceof HTMLInputElement)
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }),
        ],
      },
    })
    expect(onRescanFiles).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledWith(input)
  })

  it('ignores empty folder input changes', () => {
    setRelinkDialogOpen(true)
    const onRescanFiles = vi.fn((): Promise<undefined> =>
      Promise.resolve(undefined),
    )
    render(
      <RelinkDialog onRescanFiles={onRescanFiles} onResolve={noopResolve} />,
    )
    fireEvent.change(screen.getByTestId('relink-folder-input'), {
      target: { files: null },
    })
    expect(onRescanFiles).not.toHaveBeenCalled()
  })
})

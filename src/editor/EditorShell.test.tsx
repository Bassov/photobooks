import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAssetPool } from '../photo/assetPool'
import { resetAssetSources } from '../photo/assetSources'
import { resetTierCache } from '../photo/tierCache'
import { loadPainterFixture, resetBookStore } from './bookStore'
import { resetTierDisplay } from './tierDisplay'
import { resetCameraStore } from './cameraStore'
import { EditorShell } from './EditorShell'
import { seedGallery } from './gallery.test-helpers'
import {
  attachMemoryLibraryForTests,
  resetProjectSessionForTests,
  setAccessPhaseForTests,
} from './projectSession'
import { resetThumbCache } from './thumbCache'

const editorShellCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'EditorShell.css'),
  'utf8',
)

describe('EditorShell viewport containment', () => {
  afterEach(() => {
    cleanup()
    window.history.pushState({}, '', '/')
    resetBookStore()
    resetCameraStore()
    resetThumbCache()
    resetAssetPool()
    resetTierCache()
    resetTierDisplay()
    resetAssetSources()
    resetProjectSessionForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('paints the session spread instead of a placeholder', () => {
    window.history.pushState({}, '', '/')
    render(<EditorShell />)

    expect(screen.queryByText(/Pasteboard workspace arrives/)).toBeNull()
    expect(screen.getByTestId('pasteboard-scroll').dataset.spreadCount).toBe(
      '3',
    )
    const mounted = screen.getAllByTestId('spread-view')
    expect(mounted.length).toBeGreaterThan(0)
    expect(mounted.length).toBeLessThan(3)
    expect(screen.getByTestId('spread-frame-placeholder')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Spreads' })).toBeTruthy()
    expect(
      screen.getByRole('region', { name: 'Spreads' }).getAttribute('tabindex'),
    ).toBe('0')
    expect(
      screen.getByTestId('pasteboard-slot').getAttribute('data-active'),
    ).toBe('true')
  })

  it('mounts a window of the fixture book, not every spread', () => {
    vi.stubGlobal(
      'Worker',
      class {
        addEventListener(): void {
          // hang — the fixture test does not need a decode
        }
        removeEventListener(): void {
          // no-op
        }
        postMessage(): void {
          // no-op
        }
        terminate(): void {
          // no-op
        }
      },
    )
    window.history.pushState({}, '', '/?fixture=painter')
    loadPainterFixture()
    render(<EditorShell />)

    expect(screen.getByTestId('pasteboard-scroll').dataset.spreadCount).toBe(
      '40',
    )
    const mounted = screen.getAllByTestId('spread-view')
    expect(mounted.length).toBeGreaterThan(0)
    expect(mounted.length).toBeLessThan(40)
    expect(
      screen.getAllByTestId('spread-frame-placeholder').length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/Pasteboard workspace arrives/)).toBeNull()
  })

  it('locks the shell to the viewport when the gallery is long', () => {
    seedGallery(50)
    render(<EditorShell />)

    expect(screen.getByTestId('editor-shell')).toBeTruthy()
    expect(screen.getByTestId('editor-workspace')).toBeTruthy()
    expect(
      screen.getByTestId('filmstrip').getAttribute('data-gallery-count'),
    ).toBe('50')

    expect(editorShellCss).toMatch(
      /\.editor-shell\s*\{[^}]*overflow:\s*hidden/s,
    )
    expect(editorShellCss).toMatch(/\.editor-shell\s*\{[^}]*max-width:\s*100%/s)
    expect(editorShellCss).toMatch(/\.editor-shell\s*\{[^}]*min-width:\s*0/s)
    expect(editorShellCss).toMatch(
      /\.editor-shell\s*\{[^}]*max-height:\s*100svh/s,
    )
    expect(editorShellCss).toMatch(
      /\.editor-workspace\s*\{[^}]*min-width:\s*0/s,
    )
  })

  it('shows Grant access only when permission is required', () => {
    render(<EditorShell />)
    expect(screen.queryByTestId('regrant-library')).toBeNull()
    expect(screen.queryByTestId('book-lock-banner')).toBeNull()

    act(() => {
      setAccessPhaseForTests('permission-required')
    })
    const grant = screen.getByTestId('regrant-library')
    expect(grant.textContent).toBe('Grant access')
    expect(grant.tagName).toBe('BUTTON')
  })

  it('shows lock banner and disables Save when locked elsewhere', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    const saveBefore = screen.getByTestId('save-book')
    if (!(saveBefore instanceof HTMLButtonElement)) {
      throw new Error('expected save button')
    }
    expect(saveBefore.disabled).toBe(false)
    act(() => {
      setAccessPhaseForTests('locked-elsewhere')
    })
    expect(screen.getByTestId('book-lock-banner').textContent).toBe(
      'This book is open in another tab',
    )
    const saveAfter = screen.getByTestId('save-book')
    if (!(saveAfter instanceof HTMLButtonElement)) {
      throw new Error('expected save button')
    }
    expect(saveAfter.disabled).toBe(true)
    expect(screen.queryByTestId('save-indicator')).toBeNull()
  })
})

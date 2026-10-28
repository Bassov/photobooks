import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAssetPool } from '../photo/assetPool'
import { resetAssetSources } from '../photo/assetSources'
import { resetTierCache } from '../photo/tierCache'
import { loadPainterFixture, resetBookStore } from './bookStore'
import { resetTierDisplay } from './tierDisplay'
import { resetCameraStore } from './cameraStore'
import { addSpread, placeAsset } from '../core'
import { makeBook } from '../core/testing/fixtures'
import { enterCropMode, getCropTarget } from './cropMode'
import { EditorShell } from './EditorShell'
import { resetEditorToolForTests } from './editorToolStore'
import { seedGallery } from './gallery.test-helpers'
import {
  attachMemoryLibraryForTests,
  getProjectSessionSnapshot,
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
    resetEditorToolForTests()
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

  it('installs the crop gestures: Escape leaves crop mode', () => {
    window.history.pushState({}, '', '/')
    render(<EditorShell />)
    let book = addSpread(
      makeBook({ id: 'crop', spreads: [], gallery: ['a'], assets: { a: {} } }),
      { id: 's0' },
    )
    const frame = book.spreads[0]?.frames[0]
    assert(frame !== undefined, 'expected a frame')
    book = placeAsset(book, 's0', frame.id, 'a')
    act(() => {
      resetBookStore({
        book,
        sessionMeta: new Map(),
        previewUrls: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
      enterCropMode('s0', frame.id)
    })
    expect(getCropTarget()).not.toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(getCropTarget()).toBeNull()
  })

  it('installs the frame gesture: F then a drag draws a selected frame', () => {
    window.history.pushState({}, '', '/')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 600,
    } as DOMRect)
    render(<EditorShell />)
    const book = addSpread(makeBook({ id: 'draw', spreads: [] }), { id: 's0' })
    act(() => {
      resetBookStore({
        book,
        sessionMeta: new Map(),
        previewUrls: new Map(),
        importRunning: false,
        importExpectedCount: 0,
      })
    })
    const spread = document.querySelector<HTMLElement>(
      '[data-testid="spread-view"][data-spread-id="s0"]',
    )
    assert(spread !== null, 'expected the spread')
    const before = spread.querySelectorAll(
      '[data-testid="spread-frame"]',
    ).length
    fireEvent.keyDown(document.body, { key: 'f' })
    // A bare corner of the paper: spread frames are inset from the edge.
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: x,
        clientY: y,
        altKey: true,
      })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      spread.dispatchEvent(event)
    }
    act(() => {
      pointer('pointerdown', 2, 2)
      pointer('pointermove', 100, 100)
      pointer('pointerup', 100, 100)
    })
    expect(
      spread.querySelectorAll('[data-testid="spread-frame"]'),
    ).toHaveLength(before + 1)
  })

  it('paints the session spread instead of a placeholder', () => {
    window.history.pushState({}, '', '/')
    render(<EditorShell />)

    expect(screen.queryByText(/Pasteboard workspace arrives/)).toBeNull()
    expect(screen.getByTestId('pasteboard-empty-card')).toBeTruthy()
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
      /\.editor-workspace\s*\{[^}]*background-color:\s*var\(--canvas\)[^}]*radial-gradient\([^)]*var\(--dot\)/s,
    )
    expect(editorShellCss).toMatch(
      /\.editor-shell\s*\{[^}]*max-height:\s*100svh/s,
    )
    expect(editorShellCss).toMatch(
      /\.editor-workspace\s*\{[^}]*min-width:\s*0/s,
    )
  })

  it('collapses the inspector from its panel header', () => {
    render(<EditorShell />)
    fireEvent.click(screen.getByTestId('toggle-r'))
    expect(screen.getByTestId('resize-right')).toBeTruthy()
    fireEvent.click(screen.getByTestId('panel-collapse-right'))
    expect(screen.queryByTestId('resize-right')).toBeNull()
    expect(screen.getByTestId('panel-l').getAttribute('data-open')).toBe('true')
    expect(document.activeElement).toBe(screen.getByTestId('toggle-r'))
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

  it('shows the lock banner and drops the saved meta when locked elsewhere', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    expect(screen.getByTestId('book-size').textContent).toContain('saved')
    act(() => {
      setAccessPhaseForTests('locked-elsewhere')
    })
    expect(screen.getByTestId('book-lock-banner').textContent).toBe(
      'This book is open in another tab',
    )
    expect(screen.getByTestId('book-size').textContent).not.toContain('saved')
  })

  it('has no Rename / New book / Save chrome', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    expect(getProjectSessionSnapshot().bookId).not.toBeNull()
    for (const id of ['rename-book', 'create-book', 'save-book']) {
      expect(screen.queryByTestId(id)).toBeNull()
    }
    expect(screen.getByTestId('book-title').textContent).toBe('Untitled book')
  })
})

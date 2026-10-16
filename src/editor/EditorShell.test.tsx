import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAssetPool } from '../photo/assetPool'
import { resetAssetSources } from '../photo/assetSources'
import { resetTierCache } from '../photo/tierCache'
import { resetBookStore } from './bookStore'
import { resetTierDisplay } from './tierDisplay'
import { resetCameraStore } from './cameraStore'
import { EditorShell } from './EditorShell'
import { seedGallery } from './gallery.test-helpers'
import { resetProjectSessionForTests } from './projectSession'
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
})

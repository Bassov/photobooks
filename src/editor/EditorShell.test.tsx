import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAssetPool } from '../photo/assetPool'
import { resetBookStore } from './bookStore'
import { EditorShell } from './EditorShell'
import { seedGallery } from './gallery.test-helpers'
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
    resetThumbCache()
    resetAssetPool()
    vi.restoreAllMocks()
  })

  it('keeps the workspace placeholder without the fixture query', () => {
    window.history.pushState({}, '', '/')
    render(<EditorShell />)

    expect(screen.getByText(/Pasteboard workspace arrives/)).toBeTruthy()
    expect(screen.queryByTestId('spread-view')).toBeNull()
  })

  it('paints the fixture book in the workspace scrollport', () => {
    window.history.pushState({}, '', '/?fixture=painter')
    render(<EditorShell />)

    expect(screen.getAllByTestId('spread-view')).toHaveLength(40)
    expect(
      screen.getAllByTestId('spread-frame-placeholder').length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('region', { name: 'Spreads' })).toBeTruthy()
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

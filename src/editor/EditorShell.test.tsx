import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAssetPool } from '../photo/assetPool'
import { resetAssetSources } from '../photo/assetSources'
import { resetTierCache } from '../photo/tierCache'
import {
  getBookStoreSnapshot,
  loadPainterFixture,
  resetBookStore,
} from './bookStore'
import { resetTierDisplay } from './tierDisplay'
import { resetCameraStore } from './cameraStore'
import { EditorShell } from './EditorShell'
import { seedGallery } from './gallery.test-helpers'
import * as importPhotos from './importPhotos'
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
    assert(saveBefore instanceof HTMLButtonElement, 'expected save button')
    expect(saveBefore.disabled).toBe(false)
    act(() => {
      setAccessPhaseForTests('locked-elsewhere')
    })
    expect(screen.getByTestId('book-lock-banner').textContent).toBe(
      'This book is open in another tab',
    )
    const saveAfter = screen.getByTestId('save-book')
    assert(saveAfter instanceof HTMLButtonElement, 'expected save button')
    expect(saveAfter.disabled).toBe(true)
    expect(screen.queryByTestId('save-indicator')).toBeNull()
  })

  it('rename prompt updates chrome title via setTitle', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    expect(getProjectSessionSnapshot().bookId).not.toBeNull()
    expect(screen.getByTestId('book-title').textContent).toBe('Untitled book')

    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'EditorRename'),
    )
    fireEvent.click(screen.getByTestId('rename-book'))
    await waitFor(() => {
      expect(screen.getByTestId('book-title').textContent).toBe('EditorRename')
    })
    expect(getBookStoreSnapshot().book.title).toBe('EditorRename')
  })

  it('create book prompt stores the entered title', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    const beforeId = getProjectSessionSnapshot().bookId

    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'BrandNew'),
    )
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    fireEvent.click(screen.getByTestId('create-book'))
    await waitFor(() => {
      expect(getProjectSessionSnapshot().bookId).not.toBe(beforeId)
    })
    expect(getBookStoreSnapshot().book.title).toBe('BrandNew')
    expect(screen.getByTestId('book-title').textContent).toBe('BrandNew')
  })

  it('cancel rename leaves the chrome title unchanged', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    vi.stubGlobal(
      'prompt',
      vi.fn(() => null),
    )
    fireEvent.click(screen.getByTestId('rename-book'))
    expect(screen.getByTestId('book-title').textContent).toBe('Untitled book')
  })

  it('cancel create leaves the active book unchanged', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    const beforeId = getProjectSessionSnapshot().bookId
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    vi.stubGlobal(
      'prompt',
      vi.fn(() => null),
    )
    fireEvent.click(screen.getByTestId('create-book'))
    expect(getProjectSessionSnapshot().bookId).toBe(beforeId)
    expect(screen.getByTestId('book-title').textContent).toBe('Untitled book')
  })

  it('rename click is a no-op when no active book id', () => {
    render(<EditorShell />)
    expect(getProjectSessionSnapshot().bookId).toBeNull()
    const rename = screen.getByTestId('rename-book')
    assert(rename instanceof HTMLButtonElement)
    expect(rename.disabled).toBe(true)
    const prompt = vi.fn(() => 'ShouldNotApply')
    vi.stubGlobal('prompt', prompt)
    fireEvent.click(rename)
    expect(prompt).not.toHaveBeenCalled()
    expect(screen.getByTestId('book-title').textContent).toBe('Untitled book')
  })

  it('copies photo input FileList before clearing value', () => {
    const seen: File[][] = []
    vi.spyOn(importPhotos, 'importPhotoFiles').mockImplementation((files) => {
      seen.push([...files])
      return Promise.resolve({ imported: files.length, errors: [] })
    })
    render(<EditorShell />)
    const input = screen.getByTestId('photo-file-input')
    assert(input instanceof HTMLInputElement, 'expected file input')
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'a.jpg', {
      type: 'image/jpeg',
    })
    let cleared = false
    const liveList: FileList = {
      length: 1,
      item: (index) => (index === 0 && !cleared ? file : null),
      *[Symbol.iterator]() {
        if (!cleared) {
          yield file
        }
      },
    } as FileList
    Object.defineProperty(liveList, '0', {
      get: () => (cleared ? undefined : file),
    })
    Object.defineProperty(input, 'files', {
      configurable: true,
      get: () => liveList,
    })
    const proto = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )
    Object.defineProperty(input, 'value', {
      configurable: true,
      get(): string {
        const current = proto?.get?.call(this)
        return typeof current === 'string' ? current : ''
      },
      set(next: string) {
        proto?.set?.call(this, next)
        if (next === '') {
          cleared = true
          Object.defineProperty(liveList, 'length', { value: 0 })
        }
      },
    })

    act(() => {
      fireEvent.change(input)
    })

    expect(cleared).toBe(true)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual([file])
  })
})

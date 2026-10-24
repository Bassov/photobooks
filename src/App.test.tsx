import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getBookStoreSnapshot, resetBookStore } from './editor/bookStore'
import {
  attachMemoryLibraryForTests,
  resetProjectSessionForTests,
  setSurfaceForTests,
  startSessionEditor,
} from './editor/projectSession'
import { resetThumbCache } from './editor/thumbCache'
import { resetAssetPool } from './photo/assetPool'
import { mockWorkerSuccess } from './photo/photo.test-helpers'

async function enterEditor(): Promise<void> {
  await attachMemoryLibraryForTests()
  startSessionEditor()
  await waitFor(() => {
    expect(screen.getByTestId('editor-shell')).toBeTruthy()
  })
}

describe('App editor shell', () => {
  beforeEach(() => {
    resetBookStore()
    resetProjectSessionForTests()
    resetThumbCache()
    resetAssetPool()
    Object.defineProperty(globalThis, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(globalThis, 'showDirectoryPicker', {
      configurable: true,
      value: () => {
        throw new Error('unused picker')
      },
    })
  })

  afterEach(() => {
    cleanup()
    resetBookStore()
    resetProjectSessionForTests()
    resetThumbCache()
    resetAssetPool()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows welcome then editor shell with workspace and filmstrip', async () => {
    render(<App />)
    expect(screen.getByTestId('welcome-screen')).toBeTruthy()
    await enterEditor()
    expect(screen.getByTestId('editor-workspace')).toBeTruthy()
    expect(screen.getByTestId('filmstrip')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add folder' })).toBeTruthy()
    expect(screen.queryByTestId('photo-card')).toBeNull()
  })

  it('shows unsupported screen when the directory picker is missing', async () => {
    Reflect.deleteProperty(globalThis, 'showDirectoryPicker')
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('unsupported-browser')).toBeTruthy()
    })
    expect(screen.queryByTestId('welcome-screen')).toBeNull()
    expect(screen.queryByTestId('editor-shell')).toBeNull()
  })

  it('shows library screen after attaching a memory library', async () => {
    render(<App />)
    expect(screen.getByTestId('welcome-screen')).toBeTruthy()
    const attached = await attachMemoryLibraryForTests()
    expect(attached.ok).toBe(true)
    setSurfaceForTests('library')
    await waitFor(() => {
      expect(screen.getByTestId('library-screen')).toBeTruthy()
    })
  })

  it('imports a file via the hidden input into the gallery', async () => {
    const previewBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer
    mockWorkerSuccess({
      ok: true,
      name: 'a.jpg',
      mimeType: 'image/jpeg',
      byteLength: 4,
      width: 30,
      height: 20,
      correctedWidth: 30,
      correctedHeight: 20,
      orientation: 1,
      previewBuffer,
      previewMimeType: 'image/jpeg',
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    render(<App />)
    await enterEditor()
    const input = screen.getByTestId('photo-file-input')
    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', {
      type: 'image/jpeg',
    })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(getBookStoreSnapshot().book.gallery.length).toBeGreaterThan(0)
    })
    await waitFor(() => {
      expect(screen.getAllByTestId('filmstrip-item').length).toBeGreaterThan(0)
    })
  })

  it('shows per-file error for TIFF without aborting', async () => {
    render(<App />)
    await enterEditor()
    const input = screen.getByTestId('photo-file-input')
    const bad = new File([new Uint8Array([1])], 'scan.tiff', {
      type: 'image/tiff',
    })
    fireEvent.change(input, { target: { files: [bad] } })

    await waitFor(() => {
      expect(screen.getByTestId('import-errors').textContent).toMatch(
        /Unsupported/i,
      )
    })
  })
})

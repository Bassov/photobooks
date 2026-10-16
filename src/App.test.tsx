import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getBookStoreSnapshot, resetBookStore } from './editor/bookStore'
import { resetProjectSessionForTests } from './editor/projectSession'
import { resetThumbCache } from './editor/thumbCache'
import { resetAssetPool } from './photo/assetPool'
import { mockWorkerSuccess } from './photo/photo.test-helpers'

describe('App editor shell', () => {
  afterEach(() => {
    cleanup()
    resetBookStore()
    resetProjectSessionForTests()
    resetThumbCache()
    resetAssetPool()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows home then editor shell with workspace and filmstrip', () => {
    render(<App />)
    expect(screen.getByTestId('home-screen')).toBeTruthy()
    fireEvent.click(screen.getByTestId('start-session'))
    expect(screen.getByTestId('editor-shell')).toBeTruthy()
    expect(screen.getByTestId('editor-workspace')).toBeTruthy()
    expect(screen.getByTestId('filmstrip')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add folder' })).toBeTruthy()
    expect(screen.queryByTestId('photo-card')).toBeNull()
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
    fireEvent.click(screen.getByTestId('start-session'))
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
    fireEvent.click(screen.getByTestId('start-session'))
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
    expect(getBookStoreSnapshot().book.gallery).toHaveLength(0)
  })
})

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { resetScanWorker } from './assets'
import { stubScanWorker } from './assets/scanWorkerMock.test-helpers'
import { getBookStoreSnapshot, resetBookStore } from './editor/bookStore'
import * as importPhotos from './editor/importPhotos'
import {
  attachMemoryLibraryForTests,
  resetProjectSessionForTests,
  setSurfaceForTests,
  startSessionEditor,
} from './editor/projectSession'
import * as photoRootSession from './editor/photoRootSession'
import { resetThumbCache } from './editor/thumbCache'
import { createFakeBrowserDirectory } from './project/fsa/browserDirectory.test-helpers'
import { resetAssetPool } from './photo/assetPool'
import * as pickPhotos from './photo/pickPhotos'
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
    stubScanWorker()
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
    resetScanWorker()
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
    expect(screen.getByTestId('choose-photo-folder')).toBeTruthy()
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

  it('imports a file via the photo folder picker into the gallery', async () => {
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
    // mockWorkerSuccess replaces Worker — reinstall scan stub after.
    stubScanWorker()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-thumb')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const directory = createFakeBrowserDirectory({ name: 'photos' })
    directory.writeFile('a.jpg', new Uint8Array([1, 2, 3]))
    vi.spyOn(pickPhotos, 'canUseDirectoryPicker').mockReturnValue(true)
    vi.spyOn(pickPhotos, 'pickFolderWithDirectoryPicker').mockResolvedValue({
      directory,
    })
    vi.spyOn(photoRootSession, 'bindPhotoFolder').mockResolvedValue({
      sourceRootId: 'root-test',
    })
    vi.spyOn(photoRootSession, 'persistBoundPhotoFolder').mockResolvedValue()
    vi.spyOn(
      photoRootSession,
      'registerBoundPhotoFolderSource',
    ).mockImplementation(vi.fn())
    vi.spyOn(importPhotos, 'importPhotoFiles').mockResolvedValue({
      imported: 1,
      errors: [],
      skipped: 0,
    })

    render(<App />)
    await enterEditor()
    fireEvent.click(screen.getByTestId('choose-photo-folder'))

    await waitFor(() => {
      expect(importPhotos.importPhotoFiles).toHaveBeenCalledWith(
        [expect.objectContaining({ name: 'a.jpg' })],
        expect.objectContaining({ source: 'folder' }),
      )
    })
    expect(getBookStoreSnapshot()).toBeTruthy()
  })

  it('shows per-file error for TIFF without aborting', async () => {
    stubScanWorker()
    const directory = createFakeBrowserDirectory({ name: 'photos' })
    directory.writeFile('scan.tiff', new Uint8Array([1]))
    vi.spyOn(pickPhotos, 'canUseDirectoryPicker').mockReturnValue(true)
    vi.spyOn(pickPhotos, 'pickFolderWithDirectoryPicker').mockResolvedValue({
      directory,
    })
    vi.spyOn(photoRootSession, 'bindPhotoFolder').mockResolvedValue({
      sourceRootId: 'root-test',
    })
    vi.spyOn(photoRootSession, 'persistBoundPhotoFolder').mockResolvedValue()
    vi.spyOn(
      photoRootSession,
      'registerBoundPhotoFolderSource',
    ).mockImplementation(vi.fn())

    render(<App />)
    await enterEditor()
    fireEvent.click(screen.getByTestId('choose-photo-folder'))

    await waitFor(() => {
      expect(screen.getByTestId('import-errors').textContent).toMatch(
        /Unsupported/i,
      )
    })
  })
})

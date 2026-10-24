import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetScanWorker } from '../assets'
import { stubScanWorker } from '../assets/scanWorkerMock.test-helpers'
import { createFakeBrowserDirectory } from '../project/fsa/browserDirectory.test-helpers'
import { resetAssetPool } from '../photo/assetPool'
import * as pickPhotos from '../photo/pickPhotos'
import type { PickedPhotoFolder } from '../photo/pickPhotos'
import { resetAssetSources } from '../photo/assetSources'
import { resetTierCache } from '../photo/tierCache'
import { getBookStoreSnapshot, resetBookStore } from './bookStore'
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
import * as projectSession from './projectSession'
import { makeImportFileError } from './importFileError.test-helpers'
import { resetImportErrorsStoreForTests } from './importErrorsStore'
import * as photoRootSession from './photoRootSession'
import { resetPhotoRootSessionForTests } from './photoRootSession'
import { resetThumbCache } from './thumbCache'
import { resetTierDisplay } from './tierDisplay'
import {
  getNoPhotosFoundHint,
  resetNoPhotosFoundHint,
} from './emptyGalleryHint'

const CHOOSE_LABEL = 'Choose photo folder…'

function stubFolderPick(files: File[]): FileSystemDirectoryHandle {
  const directory = createFakeBrowserDirectory({ name: 'picked' })
  for (const file of files) {
    directory.writeFile(file.name, new Uint8Array(Math.max(file.size, 1)))
  }
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
  return directory
}

function clickChoosePhotoFolder(): void {
  fireEvent.click(screen.getByTestId('choose-photo-folder'))
}

describe('EditorTopBar', () => {
  beforeEach(() => {
    stubScanWorker()
  })

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
    resetPhotoRootSessionForTests()
    resetNoPhotosFoundHint()
    resetImportErrorsStoreForTests()
    resetScanWorker()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses Toolbar primitives and one primary choose-photo-folder action', () => {
    render(<EditorShell />)
    expect(screen.getByRole('toolbar', { name: 'Editor' })).toBeTruthy()
    const topBarChoose = screen.getByTestId('choose-photo-folder')
    expect(topBarChoose.textContent).toBe(CHOOSE_LABEL)
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    expect(screen.queryByTestId('app-theme-toggle')).toBeNull()
  })

  it('saves on Ctrl+S when a library is open and ignores other keys', async () => {
    const save = vi.spyOn(projectSession, 'saveBookNow')
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })

    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(save).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 's', metaKey: true })
    expect(save).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(window, { key: 'S', ctrlKey: true })
    expect(save).toHaveBeenCalledTimes(3)

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    expect(save).toHaveBeenCalledTimes(3)

    fireEvent.keyDown(window, { key: 's' })
    expect(save).toHaveBeenCalledTimes(3)
  })

  it('does not save on Ctrl+S without an open library', () => {
    const save = vi.spyOn(projectSession, 'saveBookNow')
    render(<EditorShell />)
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(save).not.toHaveBeenCalled()
  })

  it('imports via the directory picker when available', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'd.jpg', {
      type: 'image/jpeg',
    })
    stubFolderPick([file])
    const importSpy = vi
      .spyOn(importPhotos, 'importPhotoFiles')
      .mockResolvedValue({ imported: 1, errors: [], skipped: 0 })

    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(
        [expect.objectContaining({ name: 'd.jpg' })],
        expect.objectContaining({
          source: 'folder',
          sourceRootId: 'root-test',
          libraryBacked: false,
        }),
      )
    })
  })

  it('shows a status message when the directory picker is unavailable', async () => {
    vi.spyOn(pickPhotos, 'canUseDirectoryPicker').mockReturnValue(false)
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(screen.getByTestId('editor-status').textContent).toContain(
        'Chromium',
      )
    })
  })

  it('ignores a cancelled folder picker result', async () => {
    vi.spyOn(pickPhotos, 'canUseDirectoryPicker').mockReturnValue(true)
    vi.spyOn(pickPhotos, 'pickFolderWithDirectoryPicker').mockResolvedValue(
      null,
    )
    const importSpy = vi.spyOn(importPhotos, 'importPhotoFiles')
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(pickPhotos.pickFolderWithDirectoryPicker).toHaveBeenCalled()
    })
    expect(importSpy).not.toHaveBeenCalled()
  })

  it('disables choose photo folder while the directory picker is outstanding', async () => {
    vi.spyOn(pickPhotos, 'canUseDirectoryPicker').mockReturnValue(true)
    let resolvePicker!: (value: PickedPhotoFolder | null) => void
    const pending = new Promise<PickedPhotoFolder | null>((resolve) => {
      resolvePicker = resolve
    })
    vi.spyOn(pickPhotos, 'pickFolderWithDirectoryPicker').mockReturnValue(
      pending,
    )
    render(<EditorShell />)
    const choose = screen.getByTestId('choose-photo-folder')
    fireEvent.click(choose)
    await waitFor(() => {
      expect(choose.hasAttribute('disabled')).toBe(true)
    })
    resolvePicker(null)
    await waitFor(() => {
      expect(choose.hasAttribute('disabled')).toBe(false)
    })
  })

  it('shows import errors and opens the panel from Show files', async () => {
    const file = new File([new Uint8Array([1])], 'bad.jpg', {
      type: 'image/jpeg',
    })
    stubFolderPick([file])
    vi.spyOn(importPhotos, 'importPhotoFiles').mockResolvedValue({
      imported: 0,
      errors: [
        makeImportFileError({
          name: 'bad.jpg',
          message: 'decode failed',
          reason: 'decode-failed',
        }),
      ],
      skipped: 0,
    })
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(screen.getByTestId('import-errors').textContent).toContain(
        'bad.jpg',
      )
    })
    await waitFor(() => {
      expect(screen.getByTestId('editor-status').textContent).toContain(
        'bad.jpg: decode failed',
      )
    })
    fireEvent.click(screen.getByRole('button', { name: 'Show files' }))
    await waitFor(() => {
      expect(screen.getByTestId('import-errors-panel')).toBeTruthy()
    })
  })

  it('confirms before creating a book when the editor has content', async () => {
    seedGallery(1)
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const prompt = vi.fn(() => 'Nope')
    vi.stubGlobal('prompt', prompt)
    fireEvent.click(screen.getByTestId('create-book'))
    expect(confirm).toHaveBeenCalled()
    expect(prompt).not.toHaveBeenCalled()
  })

  it('creates a book after confirm when content exists', async () => {
    seedGallery(1)
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
      vi.fn(() => 'AfterConfirm'),
    )
    fireEvent.click(screen.getByTestId('create-book'))
    await waitFor(() => {
      expect(getProjectSessionSnapshot().bookId).not.toBe(beforeId)
    })
    expect(getBookStoreSnapshot().book.title).toBe('AfterConfirm')
  })

  it('invokes library chrome actions', () => {
    const leave = vi
      .spyOn(projectSession, 'leaveEditorForLibrary')
      .mockResolvedValue(undefined)
    const ok = { ok: true as const, value: undefined }
    const regrant = vi
      .spyOn(projectSession, 'regrantLibrary')
      .mockResolvedValue(ok)
    render(<EditorShell />)
    fireEvent.click(screen.getByTestId('go-library'))
    act(() => {
      setAccessPhaseForTests('permission-required')
    })
    fireEvent.click(screen.getByTestId('regrant-library'))
    expect(leave).toHaveBeenCalled()
    expect(regrant).toHaveBeenCalled()
  })

  it('shows photo-folder Allow access and wires regrantPhotoFolder', () => {
    const regrant = vi
      .spyOn(projectSession, 'regrantPhotoFolder')
      .mockResolvedValue('granted')
    render(<EditorShell />)
    act(() => {
      photoRootSession.setPhotoAccessPhaseForTests(
        'permission-required',
        'Vacation',
      )
    })
    const allow = screen.getByRole('button', {
      name: 'Allow access to Vacation',
    })
    expect(allow.getAttribute('data-testid')).toBe('regrant-photo-folder')
    fireEvent.pointerDown(allow, { button: 0, pointerType: 'mouse' })
    fireEvent.pointerUp(allow, { button: 0, pointerType: 'mouse' })
    fireEvent.click(allow)
    expect(regrant).toHaveBeenCalledTimes(1)
  })

  it('disables choose photo folder when the book is locked elsewhere', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    act(() => {
      setAccessPhaseForTests('locked-elsewhere')
    })
    expect(
      screen.getByTestId('choose-photo-folder').hasAttribute('disabled'),
    ).toBe(true)
  })

  it('shows Saved in the save indicator when a library is ready', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    expect(screen.getByTestId('save-indicator').textContent).toBe('Saved')
  })

  it('saves when the Save button is pressed', async () => {
    const save = vi.spyOn(projectSession, 'saveBookNow')
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    fireEvent.click(screen.getByTestId('save-book'))
    expect(save).toHaveBeenCalled()
  })

  it('clears the import-error toast after a successful import', async () => {
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      writable: true,
      value: () => true,
    })
    vi.spyOn(pickPhotos, 'canUseDirectoryPicker').mockReturnValue(true)
    vi.spyOn(photoRootSession, 'bindPhotoFolder').mockResolvedValue({
      sourceRootId: 'root-test',
    })
    vi.spyOn(photoRootSession, 'persistBoundPhotoFolder').mockResolvedValue()
    vi.spyOn(
      photoRootSession,
      'registerBoundPhotoFolderSource',
    ).mockImplementation(vi.fn())
    const dirA = createFakeBrowserDirectory({ name: 'a' })
    dirA.writeFile('bad.jpg', new Uint8Array([1]))
    const dirB = createFakeBrowserDirectory({ name: 'b' })
    dirB.writeFile('ok.jpg', new Uint8Array([1]))
    vi.spyOn(pickPhotos, 'pickFolderWithDirectoryPicker')
      .mockResolvedValueOnce({ directory: dirA })
      .mockResolvedValueOnce({ directory: dirB })
    vi.spyOn(importPhotos, 'importPhotoFiles')
      .mockResolvedValueOnce({
        imported: 0,
        errors: [
          makeImportFileError({
            name: 'bad.jpg',
            message: 'decode failed',
            reason: 'decode-failed',
          }),
        ],
        skipped: 0,
      })
      .mockResolvedValueOnce({ imported: 1, errors: [], skipped: 0 })
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(screen.getByTestId('import-errors')).toBeTruthy()
    })
    await waitFor(() => {
      expect(
        screen.getByTestId('choose-photo-folder').hasAttribute('disabled'),
      ).toBe(false)
    })
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(screen.queryByTestId('import-errors')).toBeNull()
    })
    expect(screen.queryByRole('button', { name: 'Show files' })).toBeNull()
    expect(
      screen.getByRole('button', { name: /Imported with 1 error/ }),
    ).toBeTruthy()
  })

  it('marks no-photos found when a folder import adds zero photos', async () => {
    const file = new File([new Uint8Array([1])], 'README.md', {
      type: 'text/plain',
    })
    stubFolderPick([file])
    vi.spyOn(importPhotos, 'importPhotoFiles').mockResolvedValue({
      imported: 0,
      errors: [],
      skipped: 1,
    })
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(getNoPhotosFoundHint()).toBe(true)
    })
    expect(screen.getByText('No photos found in that folder')).toBeTruthy()
    expect(screen.getByTestId('editor-status').textContent).toBe(
      '1 non-image file skipped',
    )
    expect(screen.queryByTestId('import-errors')).toBeNull()
  })

  it('passes source folder and announces skip status without import-errors', async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'a.jpg', {
      type: 'image/jpeg',
    })
    const readme = new File(['# hi'], 'README.md', { type: 'text/markdown' })
    stubFolderPick([jpeg, readme])
    const importSpy = vi
      .spyOn(importPhotos, 'importPhotoFiles')
      .mockResolvedValue({ imported: 1, errors: [], skipped: 1 })
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'a.jpg' }),
          expect.objectContaining({ name: 'README.md' }),
        ]),
        expect.objectContaining({ source: 'folder' }),
      )
    })
    await waitFor(() => {
      expect(screen.getByTestId('editor-status').textContent).toBe(
        '1 non-image file skipped',
      )
    })
    expect(screen.queryByTestId('import-errors')).toBeNull()
  })

  it('pluralizes folder skip status for multiple non-image files', async () => {
    const readme = new File(['# hi'], 'README.md', { type: 'text/markdown' })
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' })
    stubFolderPick([readme, txt])
    vi.spyOn(importPhotos, 'importPhotoFiles').mockResolvedValue({
      imported: 0,
      errors: [],
      skipped: 2,
    })
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(screen.getByTestId('editor-status').textContent).toBe(
        '2 non-image files skipped',
      )
    })
  })

  it('keeps import-error status when folder skips coexist with errors', async () => {
    const readme = new File(['# hi'], 'README.md', { type: 'text/markdown' })
    const tiff = new File([new Uint8Array([1])], 'scan.tiff', {
      type: 'image/tiff',
    })
    stubFolderPick([readme, tiff])
    vi.spyOn(importPhotos, 'importPhotoFiles').mockResolvedValue({
      imported: 0,
      errors: [
        makeImportFileError({
          name: 'scan.tiff',
          message: 'Unsupported image format: image/tiff',
          reason: 'unsupported-type',
        }),
      ],
      skipped: 1,
    })
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(screen.getByTestId('editor-status').textContent).toContain(
        'scan.tiff',
      )
    })
    expect(screen.getByTestId('editor-status').textContent).not.toMatch(
      /non-image/,
    )
    expect(screen.getByTestId('import-errors')).toBeTruthy()
  })

  it('does not announce skip status when a folder import skips nothing', async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'a.jpg', {
      type: 'image/jpeg',
    })
    stubFolderPick([jpeg])
    vi.spyOn(importPhotos, 'importPhotoFiles').mockResolvedValue({
      imported: 1,
      errors: [],
      skipped: 0,
    })
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(importPhotos.importPhotoFiles).toHaveBeenCalled()
    })
    expect(screen.getByTestId('editor-status').textContent).not.toMatch(
      /non-image/,
    )
  })
})

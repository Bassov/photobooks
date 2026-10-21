import assert from 'node:assert/strict'
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
import * as pickPhotos from '../photo/pickPhotos'
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
import { resetThumbCache } from './thumbCache'
import { resetTierDisplay } from './tierDisplay'

describe('EditorTopBar', () => {
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
    resetImportErrorsStoreForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses Toolbar primitives and one primary Add photos action', () => {
    render(<EditorShell />)
    expect(screen.getByRole('toolbar', { name: 'Editor' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
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

  it('imports via the file picker when showOpenFilePicker is available', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'p.jpg', {
      type: 'image/jpeg',
    })
    vi.spyOn(pickPhotos, 'canUseOpenFilePicker').mockReturnValue(true)
    vi.spyOn(pickPhotos, 'pickPhotosWithFilePicker').mockResolvedValue([file])
    const importSpy = vi
      .spyOn(importPhotos, 'importPhotoFiles')
      .mockResolvedValue({ imported: 1, errors: [] })

    render(<EditorShell />)
    fireEvent.click(screen.getByRole('button', { name: 'Add photos' }))
    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith([file], expect.any(Object))
    })
  })

  it('falls back to the hidden file input when the picker is unavailable', async () => {
    vi.spyOn(pickPhotos, 'canUseOpenFilePicker').mockReturnValue(false)
    const click = vi.fn()
    render(<EditorShell />)
    const input = screen.getByTestId('photo-file-input')
    assert(input instanceof HTMLInputElement)
    input.click = click
    fireEvent.click(screen.getByRole('button', { name: 'Add photos' }))
    await waitFor(() => {
      expect(click).toHaveBeenCalled()
    })
  })

  it('imports via the directory picker when available', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'd.jpg', {
      type: 'image/jpeg',
    })
    vi.spyOn(pickPhotos, 'canUseDirectoryPicker').mockReturnValue(true)
    vi.spyOn(pickPhotos, 'pickFolderWithDirectoryPicker').mockResolvedValue([
      file,
    ])
    const importSpy = vi
      .spyOn(importPhotos, 'importPhotoFiles')
      .mockResolvedValue({ imported: 1, errors: [] })

    render(<EditorShell />)
    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))
    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith([file], expect.any(Object))
    })
  })

  it('falls back to the folder input when the directory picker is unavailable', async () => {
    vi.spyOn(pickPhotos, 'canUseDirectoryPicker').mockReturnValue(false)
    const click = vi.fn()
    render(<EditorShell />)
    const input = screen.getByTestId('folder-file-input')
    assert(input instanceof HTMLInputElement)
    input.click = click
    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))
    await waitFor(() => {
      expect(click).toHaveBeenCalled()
    })
  })

  it('ignores a cancelled photo picker result', async () => {
    vi.spyOn(pickPhotos, 'canUseOpenFilePicker').mockReturnValue(true)
    vi.spyOn(pickPhotos, 'pickPhotosWithFilePicker').mockResolvedValue(null)
    const importSpy = vi.spyOn(importPhotos, 'importPhotoFiles')
    render(<EditorShell />)
    fireEvent.click(screen.getByRole('button', { name: 'Add photos' }))
    await waitFor(() => {
      expect(pickPhotos.pickPhotosWithFilePicker).toHaveBeenCalled()
    })
    expect(importSpy).not.toHaveBeenCalled()
  })

  it('disables Add photos while the file picker is outstanding', async () => {
    vi.spyOn(pickPhotos, 'canUseOpenFilePicker').mockReturnValue(true)
    let resolvePicker!: (files: File[] | null) => void
    const pending = new Promise<File[] | null>((resolve) => {
      resolvePicker = resolve
    })
    vi.spyOn(pickPhotos, 'pickPhotosWithFilePicker').mockReturnValue(pending)
    render(<EditorShell />)
    const addPhotos = screen.getByRole('button', { name: 'Add photos' })
    fireEvent.click(addPhotos)
    await waitFor(() => {
      expect(addPhotos.hasAttribute('disabled')).toBe(true)
    })
    resolvePicker(null)
    await waitFor(() => {
      expect(addPhotos.hasAttribute('disabled')).toBe(false)
    })
  })

  it('shows import errors and opens the panel from Show files', async () => {
    vi.spyOn(importPhotos, 'importPhotoFiles').mockResolvedValue({
      imported: 0,
      errors: [
        makeImportFileError({
          name: 'bad.jpg',
          message: 'decode failed',
          reason: 'decode-failed',
        }),
      ],
    })
    render(<EditorShell />)
    const input = screen.getByTestId('photo-file-input')
    assert(input instanceof HTMLInputElement)
    const file = new File([new Uint8Array([1])], 'bad.jpg', {
      type: 'image/jpeg',
    })
    act(() => {
      fireEvent.change(input, { target: { files: [file] } })
    })
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

  it('ignores empty file lists from the photo and folder inputs', () => {
    const importSpy = vi.spyOn(importPhotos, 'importPhotoFiles')
    render(<EditorShell />)
    const photo = screen.getByTestId('photo-file-input')
    const folder = screen.getByTestId('folder-file-input')
    assert(photo instanceof HTMLInputElement)
    assert(folder instanceof HTMLInputElement)
    act(() => {
      fireEvent.change(photo, { target: { files: [] } })
      fireEvent.change(folder, { target: { files: [] } })
    })
    expect(importSpy).not.toHaveBeenCalled()
  })

  it('copies folder FileList before clearing value', () => {
    const seen: File[][] = []
    vi.spyOn(importPhotos, 'importPhotoFiles').mockImplementation((files) => {
      seen.push([...files])
      return Promise.resolve({ imported: files.length, errors: [] })
    })
    render(<EditorShell />)
    const input = screen.getByTestId('folder-file-input')
    assert(input instanceof HTMLInputElement)
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'f.jpg', {
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
    expect(seen).toEqual([[file]])
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
    const home = vi
      .spyOn(projectSession, 'leaveEditorForHome')
      .mockResolvedValue(undefined)
    const ok = { ok: true as const, value: undefined }
    const createLib = vi
      .spyOn(projectSession, 'createLibrary')
      .mockResolvedValue(ok)
    const openLib = vi
      .spyOn(projectSession, 'openLibrary')
      .mockResolvedValue(ok)
    const regrant = vi
      .spyOn(projectSession, 'regrantLibrary')
      .mockResolvedValue(ok)
    render(<EditorShell />)
    fireEvent.click(screen.getByTestId('go-home'))
    fireEvent.click(screen.getByTestId('create-library'))
    fireEvent.click(screen.getByTestId('open-library'))
    act(() => {
      setAccessPhaseForTests('permission-required')
    })
    fireEvent.click(screen.getByTestId('regrant-library'))
    expect(home).toHaveBeenCalled()
    expect(createLib).toHaveBeenCalled()
    expect(openLib).toHaveBeenCalled()
    expect(regrant).toHaveBeenCalled()
  })

  it('disables Add photos when the book is locked elsewhere', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    act(() => {
      setAccessPhaseForTests('locked-elsewhere')
    })
    expect(
      screen
        .getByRole('button', { name: 'Add photos' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(
      screen
        .getByRole('button', { name: 'Add folder' })
        .hasAttribute('disabled'),
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
      })
      .mockResolvedValueOnce({ imported: 1, errors: [] })
    render(<EditorShell />)
    const input = screen.getByTestId('photo-file-input')
    assert(input instanceof HTMLInputElement)
    const bad = new File([new Uint8Array([1])], 'bad.jpg', {
      type: 'image/jpeg',
    })
    const good = new File([new Uint8Array([1])], 'ok.jpg', {
      type: 'image/jpeg',
    })
    act(() => {
      fireEvent.change(input, { target: { files: [bad] } })
    })
    await waitFor(() => {
      expect(screen.getByTestId('import-errors')).toBeTruthy()
    })
    act(() => {
      fireEvent.change(input, { target: { files: [good] } })
    })
    await waitFor(() => {
      expect(screen.queryByTestId('import-errors')).toBeNull()
    })
    // Toast clears on success; store keeps prior errors (append model).
    expect(screen.queryByRole('button', { name: 'Show files' })).toBeNull()
    expect(
      screen.getByRole('button', { name: /Imported with 1 error/ }),
    ).toBeTruthy()
  })

  it('ignores a cancelled folder picker result', async () => {
    vi.spyOn(pickPhotos, 'canUseDirectoryPicker').mockReturnValue(true)
    vi.spyOn(pickPhotos, 'pickFolderWithDirectoryPicker').mockResolvedValue(
      null,
    )
    const importSpy = vi.spyOn(importPhotos, 'importPhotoFiles')
    render(<EditorShell />)
    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }))
    await waitFor(() => {
      expect(pickPhotos.pickFolderWithDirectoryPicker).toHaveBeenCalled()
    })
    expect(importSpy).not.toHaveBeenCalled()
  })
})

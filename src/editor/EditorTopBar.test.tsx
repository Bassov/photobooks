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
import {
  isBookSettingsSelected,
  setBookSettingsSelected,
} from './bookSettingsSelection'
import { dispatchBookOp, resetBookStore } from './bookStore'
import { isCoverSelected, setCoverSelected } from './coverSelection'
import { physicalZoom } from './camera'
import {
  commitZoom,
  getCommittedZoom,
  registerCameraCommands,
  resetCameraStore,
} from './cameraStore'
import { EditorShell } from './EditorShell'
import * as importPhotos from './importPhotos'
import {
  attachMemoryLibraryForTests,
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
  fireEvent.click(screen.getByTestId('film-add-folder'))
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

  it('uses Toolbar primitives; Add folder… lives in the filmstrip, not the top bar', () => {
    render(<EditorShell />)
    const toolbar = screen.getByRole('toolbar', { name: 'Editor' })
    expect(toolbar).toBeTruthy()
    // uikit/src/sandbox/chrome.tsx TopBar has no folder button; Add folder… is a filmstrip chip.
    expect(screen.queryByTestId('choose-photo-folder')).toBeNull()
    expect(toolbar.textContent).not.toContain(CHOOSE_LABEL)
    expect(screen.getByTestId('film-add-folder').textContent).toBe(
      'Add folder…',
    )
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByTestId('app-theme-toggle')).toBeNull()
    expect(screen.getByTestId('book-title')).toBeTruthy()
    expect(screen.getByTestId('book-size')).toBeTruthy()
  })

  it('opens Book settings from the title (kit step 24)', () => {
    setCoverSelected(true)
    render(<EditorShell />)
    fireEvent.click(screen.getByTestId('book-title'))
    expect(isBookSettingsSelected()).toBe(true)
    expect(isCoverSelected()).toBe(false)
    setBookSettingsSelected(false)
  })

  it('zooms in and out from the chrome controls', () => {
    commitZoom(1, 0, 0)
    render(<EditorShell />)
    fireEvent.click(screen.getByTestId('zoom-in'))
    expect(getCommittedZoom()).toBeCloseTo(1.25)
    fireEvent.click(screen.getByTestId('zoom-out'))
    expect(getCommittedZoom()).toBeCloseTo(1)
  })

  it('has no placeholder buttons and a Preview pill that presents', () => {
    render(<EditorShell />)
    expect(screen.queryByTestId('editor-preview')).toBeNull()
    expect(screen.queryByTestId('export')).toBeNull()
    expect(screen.queryByTestId('editor-publish')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(screen.queryByTestId('camera-bar')).toBeNull()
    expect(screen.queryByRole('toolbar', { name: 'Camera' })).toBeNull()
    const preview = screen.getByTestId('present')
    expect(preview.textContent).toBe('Preview')
  })

  it('labels undo / redo tooltips with the step name', () => {
    render(<EditorShell />)
    expect(screen.getByTestId('undo').getAttribute('aria-label')).toBe(
      'Nothing to undo',
    )
    expect(screen.getByTestId('redo').getAttribute('aria-label')).toBe(
      'Nothing to redo',
    )
    act(() => {
      dispatchBookOp({ type: 'addSpread', templateId: 'one-per-page' })
    })
    expect(screen.getByTestId('undo').getAttribute('aria-label')).toBe(
      'Undo “Add spread” (Ctrl+Z)',
    )
    fireEvent.click(screen.getByTestId('undo'))
    expect(screen.getByTestId('redo').getAttribute('aria-label')).toBe(
      'Redo “Add spread” (Shift+Ctrl+Z)',
    )
  })

  it('drives the camera from the zoom menu with key hints', () => {
    render(<EditorShell />)
    const commands = {
      fitSpread: vi.fn(),
      fitWidth: vi.fn(),
      actualSize: vi.fn(),
      zoomTo: vi.fn(),
      zoomStep: vi.fn(),
      fitSpreadZoom: vi.fn(() => 0.5),
    }
    registerCameraCommands(commands)
    act(() => {
      commitZoom(0.5, 0, 0)
    })
    const trigger = screen.getByTestId('zoom-menu')
    expect(screen.getByTestId('zoom-label').textContent).toBe('Fit')

    const open = (): void => {
      fireEvent.click(trigger)
    }
    open()
    const items = screen.getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Fit spread Ctrl+0',
      'Fit width',
      '100%',
      '150%',
      '200%',
      '400%',
      '50%',
    ])
    expect(screen.getByText('Ctrl+0').className).toContain('pb-menu-keyboard')
    fireEvent.click(screen.getByRole('menuitem', { name: /Fit spread/ }))
    expect(commands.fitSpread).toHaveBeenCalledTimes(1)

    open()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Fit width' }))
    expect(commands.fitWidth).toHaveBeenCalledTimes(1)

    open()
    fireEvent.click(screen.getByRole('menuitem', { name: '100%' }))
    expect(commands.actualSize).toHaveBeenCalledTimes(1)

    for (const percent of [150, 200, 400, 50]) {
      open()
      fireEvent.click(
        screen.getByRole('menuitem', { name: `${String(percent)}%` }),
      )
      expect(commands.zoomTo).toHaveBeenLastCalledWith(
        (physicalZoom() * percent) / 100,
      )
    }

    act(() => {
      commitZoom(physicalZoom() * 2, 0, 0)
    })
    expect(screen.getByTestId('zoom-label').textContent).toBe('200%')
  }, 30_000)

  it('fits the spread on Ctrl+0 / Cmd+0 except in text fields', () => {
    render(<EditorShell />)
    const fitSpread = vi.fn()
    registerCameraCommands({
      fitSpread,
      fitWidth: vi.fn(),
      actualSize: vi.fn(),
      zoomTo: vi.fn(),
      zoomStep: vi.fn(),
      fitSpreadZoom: () => null,
    })
    fireEvent.keyDown(window, { key: '0', ctrlKey: true })
    fireEvent.keyDown(window, { key: '0', metaKey: true })
    expect(fitSpread).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(window, { key: '0' })
    fireEvent.keyDown(window, { key: '1', ctrlKey: true })
    expect(fitSpread).toHaveBeenCalledTimes(2)
    const input = document.createElement('input')
    document.body.append(input)
    fireEvent.keyDown(input, { key: '0', ctrlKey: true })
    const area = document.createElement('textarea')
    document.body.append(area)
    fireEvent.keyDown(area, { key: '0', ctrlKey: true })
    input.remove()
    area.remove()
    expect(fitSpread).toHaveBeenCalledTimes(2)
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
    const choose = screen.getByTestId('film-add-folder')
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
      expect(screen.getByTestId('editor-status').textContent).toContain(
        'bad.jpg: decode failed',
      )
    })
    expect(screen.queryByRole('button', { name: 'Show files' })).toBeNull()
    fireEvent.click(screen.getByTestId('import-errors'))
    await waitFor(() => {
      expect(screen.getByTestId('import-errors-panel')).toBeTruthy()
    })
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
    expect(screen.getByTestId('film-add-folder').hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('shows "saved" in the book meta when a library is ready', async () => {
    render(<EditorShell />)
    await act(async () => {
      await attachMemoryLibraryForTests()
    })
    expect(screen.getByTestId('book-size').textContent).toBe(
      '30 × 30 cm · 6 pages · saved',
    )
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
        screen.getByTestId('film-add-folder').hasAttribute('disabled'),
      ).toBe(false)
    })
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(importPhotos.importPhotoFiles).toHaveBeenCalledTimes(2)
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
      skipped: 0,
    })
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      expect(getNoPhotosFoundHint()).toBe(true)
    })
    expect(screen.queryByText('No photos found in that folder')).toBeNull()
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
      .mockResolvedValue({ imported: 1, errors: [], skipped: 0 })
    render(<EditorShell />)
    clickChoosePhotoFolder()
    await waitFor(() => {
      // List-first: non-images are counted as skips and never body-imported.
      expect(importSpy).toHaveBeenCalledWith(
        [expect.objectContaining({ name: 'a.jpg' })],
        expect.objectContaining({
          source: 'folder',
          listAlreadyEnqueued: true,
        }),
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
      skipped: 0,
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
      skipped: 0,
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

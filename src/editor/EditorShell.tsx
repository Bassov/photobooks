import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ImportFileError } from '../photo/assetPool'
import {
  canUseDirectoryPicker,
  canUseOpenFilePicker,
  photoInputAccept,
  pickFolderWithDirectoryPicker,
  pickPhotosWithFilePicker,
} from '../photo/pickPhotos'
import { createFsaLibraryStorage } from '../project'
import { getEditorStatus, subscribeEditorStatus } from './editorStatus'
import { Filmstrip } from './Filmstrip'
import { installEditorKeys } from './galleryDrop'
import { importPhotoFiles, type ImportProgress } from './importPhotos'
import { Pasteboard } from './Pasteboard'
import { loadPainterFixture } from './bookStore'
import { isPainterFixtureQuery } from './painterFixtureQuery'
import {
  attachLibraryForTests,
  createBookInLibrary,
  createLibrary,
  exposeProjectSessionTestApi,
  getProjectSessionSnapshot,
  openLibrary,
  saveBookNow,
  subscribeProjectSession,
  tryRestore,
} from './projectSession'
import './EditorShell.css'

function isTestLibraryQuery(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return new URLSearchParams(window.location.search).has('testLibrary')
}

async function ensureTestLibrary(): Promise<void> {
  const restored = await tryRestore()
  if (restored.ok && restored.value !== null) {
    return
  }
  if (typeof navigator.storage.getDirectory !== 'function') {
    return
  }
  const root = await navigator.storage.getDirectory()
  const dir = await root.getDirectoryHandle('photobooks-e2e-library', {
    create: true,
  })
  await attachLibraryForTests({
    storage: createFsaLibraryStorage({ root: dir }),
    handle: dir,
  })
}

export function EditorShell() {
  const painterFixture = isPainterFixtureQuery()
  const editorStatus = useSyncExternalStore(
    subscribeEditorStatus,
    getEditorStatus,
    getEditorStatus,
  )
  const project = useSyncExternalStore(
    subscribeProjectSession,
    getProjectSessionSnapshot,
    getProjectSessionSnapshot,
  )
  useEffect(() => installEditorKeys(), [])
  useEffect(() => {
    exposeProjectSessionTestApi()
  }, [])
  useEffect(() => {
    if (painterFixture) {
      loadPainterFixture()
      return
    }
    if (isTestLibraryQuery()) {
      void ensureTestLibrary()
      return
    }
    void tryRestore()
  }, [painterFixture])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== 's'
      ) {
        return
      }
      if (!project.libraryOpen || project.bookId === null) {
        return
      }
      event.preventDefault()
      saveBookNow()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [project.libraryOpen, project.bookId])

  const filesInputId = useId()
  const folderInputId = useId()
  const filesInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [pickerBusy, setPickerBusy] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [errors, setErrors] = useState<ImportFileError[]>([])

  const runImport = async (files: readonly File[]): Promise<void> => {
    if (files.length === 0) {
      return
    }
    setErrors([])
    let raf = 0
    let latest: ImportProgress | null = null
    const onProgress = (state: ImportProgress): void => {
      latest = state
      if (raf !== 0) {
        return
      }
      raf = requestAnimationFrame(() => {
        raf = 0
        if (latest) {
          setProgress(latest)
        }
      })
    }
    const result = await importPhotoFiles(files, { onProgress })
    if (raf !== 0) {
      cancelAnimationFrame(raf)
    }
    setErrors(result.errors)
    if (!result.errors.length) {
      setProgress(null)
    } else {
      setProgress({
        total: files.length,
        completed: files.length,
        errors: result.errors,
        running: false,
      })
    }
  }

  const onAddPhotos = async (): Promise<void> => {
    setPickerBusy(true)
    try {
      if (canUseOpenFilePicker()) {
        const files = await pickPhotosWithFilePicker()
        if (files) {
          await runImport(files)
        }
        return
      }
      filesInputRef.current?.click()
    } finally {
      setPickerBusy(false)
    }
  }

  const onAddFolder = async (): Promise<void> => {
    setPickerBusy(true)
    try {
      if (canUseDirectoryPicker()) {
        const files = await pickFolderWithDirectoryPicker()
        if (files) {
          await runImport(files)
        }
        return
      }
      folderInputRef.current?.click()
    } finally {
      setPickerBusy(false)
    }
  }

  const libraryReady = project.libraryOpen
  const bookReady = libraryReady && project.bookId !== null

  return (
    <div className="editor-shell" data-testid="editor-shell">
      <p className="editor-live" data-testid="editor-status" aria-live="polite">
        {editorStatus}
      </p>
      <header className="editor-chrome">
        <p className="brand">Photobooks</p>
        <div className="editor-actions">
          <button
            type="button"
            className="editor-action editor-action-secondary"
            data-testid="create-library"
            onClick={() => {
              void createLibrary()
            }}
            disabled={pickerBusy}
          >
            New library
          </button>
          <button
            type="button"
            className="editor-action editor-action-secondary"
            data-testid="open-library"
            onClick={() => {
              void openLibrary()
            }}
            disabled={pickerBusy}
          >
            Open
          </button>
          <button
            type="button"
            className="editor-action editor-action-secondary"
            data-testid="create-book"
            onClick={() => {
              void createBookInLibrary()
            }}
            disabled={pickerBusy || !libraryReady}
          >
            New book
          </button>
          <button
            type="button"
            className="editor-action editor-action-secondary"
            data-testid="save-book"
            onClick={() => {
              saveBookNow()
            }}
            disabled={pickerBusy || !bookReady || project.saving}
          >
            Save
          </button>
          <button
            type="button"
            className="editor-action"
            onClick={() => {
              void onAddPhotos()
            }}
            disabled={pickerBusy}
          >
            Add photos
          </button>
          <button
            type="button"
            className="editor-action editor-action-secondary"
            onClick={() => {
              void onAddFolder()
            }}
            disabled={pickerBusy}
          >
            Add folder
          </button>
          <input
            id={filesInputId}
            ref={filesInputRef}
            className="photo-file-input"
            data-testid="photo-file-input"
            type="file"
            accept={photoInputAccept()}
            multiple
            onChange={(event) => {
              const list = event.target.files
              if (!list || list.length === 0) {
                return
              }
              // Copy before clearing — FileList is live and empties with value=''.
              const files = [...list]
              event.target.value = ''
              void runImport(files)
            }}
          />
          <input
            id={folderInputId}
            ref={(element) => {
              folderInputRef.current = element
              if (element) {
                element.setAttribute('webkitdirectory', '')
              }
            }}
            className="photo-file-input"
            data-testid="folder-file-input"
            type="file"
            accept={photoInputAccept()}
            multiple
            onChange={(event) => {
              const list = event.target.files
              if (!list || list.length === 0) {
                return
              }
              const files = [...list]
              event.target.value = ''
              void runImport(files)
            }}
          />
        </div>
        {errors.length > 0 ? (
          <ul
            className="import-errors"
            data-testid="import-errors"
            role="alert"
          >
            {errors.map((error) => (
              <li key={`${error.name}:${error.message}`}>
                {error.name}: {error.message}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <main className="editor-workspace" data-testid="editor-workspace">
        <Pasteboard />
      </main>

      <Filmstrip progress={progress} />
    </div>
  )
}

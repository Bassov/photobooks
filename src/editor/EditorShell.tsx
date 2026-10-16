import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ImportFileError } from '../photo/assetPool'
import {
  canUseDirectoryPicker,
  canUseOpenFilePicker,
  photoInputAccept,
  pickFolderWithDirectoryPicker,
  pickPhotosWithFilePicker,
} from '../photo/pickPhotos'
import { getEditorStatus, subscribeEditorStatus } from './editorStatus'
import { Filmstrip } from './Filmstrip'
import { installDocumentDragGesture } from './editorGesture'
import { installEditorKeys } from './galleryDrop'
import { importPhotoFiles, type ImportProgress } from './importPhotos'
import { Pasteboard } from './Pasteboard'
import { getBookStoreSnapshot } from './bookStore'
import {
  createBookInLibrary,
  createLibrary,
  getProjectSessionSnapshot,
  leaveEditorForHome,
  openLibrary,
  regrantLibrary,
  saveBookNow,
  subscribeProjectSession,
} from './projectSession'
import './EditorShell.css'

function editorHasContent(): boolean {
  const book = getBookStoreSnapshot().book
  if (book.gallery.length > 0) {
    return true
  }
  return book.spreads.some((spread) =>
    spread.frames.some((frame) => frame.assetId !== undefined),
  )
}

export function EditorShell() {
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
  useEffect(() => installDocumentDragGesture(), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== 's'
      ) {
        return
      }
      if (!project.libraryOpen) {
        return
      }
      event.preventDefault()
      saveBookNow()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [project.libraryOpen])

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
  const writeBlocked = project.accessPhase === 'locked-elsewhere'

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
            data-testid="go-home"
            onClick={() => {
              void leaveEditorForHome()
            }}
            disabled={
              pickerBusy || project.actionBusy || project.restorePending
            }
          >
            Home
          </button>
          <button
            type="button"
            className="editor-action editor-action-secondary"
            data-testid="create-library"
            onClick={() => {
              void createLibrary()
            }}
            disabled={
              pickerBusy || project.actionBusy || project.restorePending
            }
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
            disabled={
              pickerBusy || project.actionBusy || project.restorePending
            }
          >
            Open
          </button>
          {project.accessPhase === 'permission-required' ? (
            <button
              type="button"
              className="editor-action"
              data-testid="regrant-library"
              onClick={() => {
                void regrantLibrary()
              }}
              disabled={
                pickerBusy || project.actionBusy || project.restorePending
              }
            >
              Grant access
            </button>
          ) : null}
          <button
            type="button"
            className="editor-action editor-action-secondary"
            data-testid="create-book"
            onClick={() => {
              if (editorHasContent()) {
                const ok = window.confirm(
                  'Create a new empty book? Current gallery and layout will be replaced.',
                )
                if (!ok) {
                  return
                }
              }
              void createBookInLibrary()
            }}
            disabled={
              pickerBusy ||
              project.actionBusy ||
              project.restorePending ||
              !libraryReady
            }
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
            disabled={
              pickerBusy || !libraryReady || project.saving || writeBlocked
            }
          >
            Save
          </button>
          {writeBlocked ? (
            <span
              className="book-lock-banner"
              data-testid="book-lock-banner"
              role="status"
              aria-live="polite"
            >
              This book is open in another tab
            </span>
          ) : null}
          {libraryReady && !writeBlocked ? (
            <span
              className="save-indicator"
              data-testid="save-indicator"
              data-save-phase={project.savePhase}
              data-dirty={project.dirty ? 'true' : 'false'}
              aria-live="polite"
            >
              {project.savePhase === 'saving'
                ? 'Saving…'
                : project.savePhase === 'error'
                  ? 'Save failed'
                  : project.savePhase === 'pending' || project.dirty
                    ? 'Unsaved'
                    : 'Saved'}
            </span>
          ) : null}
          <button
            type="button"
            className="editor-action"
            onClick={() => {
              void onAddPhotos()
            }}
            disabled={pickerBusy || writeBlocked}
          >
            Add photos
          </button>
          <button
            type="button"
            className="editor-action editor-action-secondary"
            onClick={() => {
              void onAddFolder()
            }}
            disabled={pickerBusy || writeBlocked}
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

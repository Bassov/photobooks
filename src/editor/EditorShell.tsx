import { useEffect, useId, useRef, useState } from 'react'
import type { ImportFileError } from '../photo/assetPool'
import {
  canUseDirectoryPicker,
  canUseOpenFilePicker,
  photoInputAccept,
  pickFolderWithDirectoryPicker,
  pickPhotosWithFilePicker,
} from '../photo/pickPhotos'
import { Filmstrip } from './Filmstrip'
import { importPhotoFiles, type ImportProgress } from './importPhotos'
import { loadPainterFixture } from './bookStore'
import { PainterFixtureWorkspace } from './PainterFixtureWorkspace'
import { isPainterFixtureQuery } from './painterFixtureQuery'
import './EditorShell.css'

export function EditorShell() {
  const painterFixture = isPainterFixtureQuery()
  useEffect(() => {
    if (!painterFixture) {
      return
    }
    loadPainterFixture()
  }, [painterFixture])

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

  return (
    <div className="editor-shell" data-testid="editor-shell">
      <header className="editor-chrome">
        <p className="brand">Photobooks</p>
        <div className="editor-actions">
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

      <main
        className={
          painterFixture
            ? 'editor-workspace editor-workspace-fixture'
            : 'editor-workspace'
        }
        data-testid="editor-workspace"
      >
        {painterFixture ? (
          <PainterFixtureWorkspace />
        ) : (
          <p className="workspace-placeholder">
            Pasteboard workspace arrives in the next milestone. Use the
            filmstrip below to import your gallery.
          </p>
        )}
      </main>

      <Filmstrip progress={progress} />
    </div>
  )
}

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
} from 'react'
import {
  canUseDirectoryPicker,
  canUseOpenFilePicker,
  photoInputAccept,
  pickFolderWithDirectoryPicker,
  pickPhotosWithFilePicker,
} from '../photo/pickPhotos'
import '../ui/Button.css'
import '../ui/Toolbar.css'
import type { PhotobooksToastQueue } from '../ui/toastQueue'
import { BookTitleChrome } from './BookTitleChrome'
import { clickIfPresent } from './clickIfPresent'
import {
  createBookWithPrompt,
  renameActiveBook,
} from './editorChromeBookActions'
import {
  isChromeBusy,
  isImportDisabled,
  isNewBookDisabled,
  isRenameDisabled,
  isSaveDisabled,
} from './editorChromeDisabled'
import { setEditorStatus } from './editorStatus'
import { filesFromInputChange } from './filesFromInputChange'
import {
  clearImportErrorsToast,
  enqueueImportErrorsToast,
  importErrorsStatusText,
} from './importErrorToast'
import type { ImportProgress } from './importPhotos'
import { installEditorSaveShortcut } from './installEditorSaveShortcut'
import {
  createBookInLibrary,
  createLibrary,
  getProjectSessionSnapshot,
  leaveEditorForHome,
  openLibrary,
  regrantLibrary,
  renameBookInLibrary,
  saveBookNow,
  subscribeProjectSession,
} from './projectSession'
import { runChromeImport } from './runChromeImport'
import { saveIndicatorLabel } from './saveIndicatorLabel'

function ChromeButton({
  variant = 'secondary',
  size = 'sm',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary'
  size?: 'sm' | 'md'
}) {
  return (
    <button
      type="button"
      className={[
        'pb-button',
        `pb-button--${variant}`,
        `pb-button--${size}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

export function EditorTopBar({
  onImportProgress,
  toastQueue,
}: {
  onImportProgress: (progress: ImportProgress | null) => void
  toastQueue: PhotobooksToastQueue
}) {
  const project = useSyncExternalStore(
    subscribeProjectSession,
    getProjectSessionSnapshot,
    getProjectSessionSnapshot,
  )

  useEffect(
    () => installEditorSaveShortcut(project.libraryOpen),
    [project.libraryOpen],
  )

  const filesInputId = useId()
  const folderInputId = useId()
  const filesInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [pickerBusy, setPickerBusy] = useState(false)

  const runImport = async (files: readonly File[]): Promise<void> => {
    await runChromeImport(files, {
      onProgress: onImportProgress,
      onErrors: (next) => {
        if (next.length === 0) {
          clearImportErrorsToast(toastQueue)
          return
        }
        const snapshot = [...next]
        enqueueImportErrorsToast(toastQueue, snapshot, () => {
          setEditorStatus(importErrorsStatusText(snapshot))
        })
      },
    })
  }

  const onAddPhotos = async (): Promise<void> => {
    setPickerBusy(true)
    try {
      if (canUseOpenFilePicker()) {
        const files = await pickPhotosWithFilePicker()
        if (files !== null) {
          await runImport(files)
        }
        return
      }
      clickIfPresent(filesInputRef.current)
    } finally {
      setPickerBusy(false)
    }
  }

  const onAddFolder = async (): Promise<void> => {
    setPickerBusy(true)
    try {
      if (canUseDirectoryPicker()) {
        const files = await pickFolderWithDirectoryPicker()
        if (files !== null) {
          await runImport(files)
        }
        return
      }
      clickIfPresent(folderInputRef.current)
    } finally {
      setPickerBusy(false)
    }
  }

  const libraryReady = project.libraryOpen
  const writeBlocked = project.accessPhase === 'locked-elsewhere'
  const activeBookId = project.bookId
  const chromeBusy = isChromeBusy(
    pickerBusy,
    project.actionBusy,
    project.restorePending,
  )

  return (
    <header className="editor-chrome">
      <p className="brand">Photobooks</p>
      <BookTitleChrome />
      <div
        role="toolbar"
        aria-label="Editor"
        className="editor-top-bar pb-toolbar"
      >
        <ChromeButton
          data-testid="go-home"
          onClick={() => {
            void leaveEditorForHome()
          }}
          disabled={chromeBusy}
        >
          Home
        </ChromeButton>
        <ChromeButton
          data-testid="create-library"
          onClick={() => {
            void createLibrary()
          }}
          disabled={chromeBusy}
        >
          New library
        </ChromeButton>
        <ChromeButton
          data-testid="open-library"
          onClick={() => {
            void openLibrary()
          }}
          disabled={chromeBusy}
        >
          Open
        </ChromeButton>
        {project.accessPhase === 'permission-required' ? (
          <ChromeButton
            variant="default"
            data-testid="regrant-library"
            onClick={() => {
              void regrantLibrary()
            }}
            disabled={chromeBusy}
          >
            Grant access
          </ChromeButton>
        ) : null}
        <ChromeButton
          data-testid="rename-book"
          onClick={() => {
            renameActiveBook(activeBookId, (bookId, title) => {
              void renameBookInLibrary(bookId, title)
            })
          }}
          disabled={isRenameDisabled(
            chromeBusy,
            libraryReady,
            writeBlocked,
            activeBookId,
          )}
        >
          Rename
        </ChromeButton>
        <ChromeButton
          data-testid="create-book"
          onClick={() => {
            createBookWithPrompt((title) => {
              void createBookInLibrary(title)
            })
          }}
          disabled={isNewBookDisabled(chromeBusy, libraryReady)}
        >
          New book
        </ChromeButton>
        <ChromeButton
          data-testid="save-book"
          title="Save (Ctrl+S)"
          onClick={() => {
            saveBookNow()
          }}
          disabled={isSaveDisabled(
            pickerBusy,
            libraryReady,
            project.saving,
            writeBlocked,
          )}
        >
          Save
        </ChromeButton>
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
            {saveIndicatorLabel(project.savePhase, project.dirty)}
          </span>
        ) : null}
        <ChromeButton
          variant={
            project.accessPhase === 'permission-required'
              ? 'secondary'
              : 'default'
          }
          onClick={() => {
            void onAddPhotos()
          }}
          disabled={isImportDisabled(pickerBusy, writeBlocked)}
        >
          Add photos
        </ChromeButton>
        <ChromeButton
          onClick={() => {
            void onAddFolder()
          }}
          disabled={isImportDisabled(pickerBusy, writeBlocked)}
        >
          Add folder
        </ChromeButton>
        <input
          id={filesInputId}
          ref={filesInputRef}
          className="photo-file-input"
          data-testid="photo-file-input"
          type="file"
          accept={photoInputAccept()}
          multiple
          onChange={(event) => {
            const files = filesFromInputChange(event.currentTarget)
            if (files === null) {
              return
            }
            void runImport(files)
          }}
        />
        <input
          id={folderInputId}
          ref={(element) => {
            folderInputRef.current = element
            element?.setAttribute('webkitdirectory', '')
          }}
          className="photo-file-input"
          data-testid="folder-file-input"
          type="file"
          accept={photoInputAccept()}
          multiple
          onChange={(event) => {
            const files = filesFromInputChange(event.currentTarget)
            if (files === null) {
              return
            }
            void runImport(files)
          }}
        />
      </div>
    </header>
  )
}

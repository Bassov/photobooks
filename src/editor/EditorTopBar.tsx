import {
  useEffect,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
} from 'react'
import '../ui/Button.css'
import '../ui/Toolbar.css'
import { BookTitleChrome } from './BookTitleChrome'
import {
  createBookWithPrompt,
  renameActiveBook,
} from './editorChromeBookActions'
import {
  isChromeBusy,
  isNewBookDisabled,
  isRenameDisabled,
  isSaveDisabled,
} from './editorChromeDisabled'
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
import { saveIndicatorLabel } from './saveIndicatorLabel'
import type { ChromeImportApi } from './useChromeImport'

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
  chromeImport,
}: {
  chromeImport: ChromeImportApi
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

  const libraryReady = project.libraryOpen
  const writeBlocked = project.accessPhase === 'locked-elsewhere'
  const activeBookId = project.bookId
  const pickerBusy = chromeImport.pickerBusy
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
            void chromeImport.onAddPhotos()
          }}
          disabled={chromeImport.importDisabled}
        >
          Add photos
        </ChromeButton>
        <ChromeButton
          onClick={() => {
            void chromeImport.onAddFolder()
          }}
          disabled={chromeImport.importDisabled}
        >
          Add folder
        </ChromeButton>
        {chromeImport.inputs}
      </div>
    </header>
  )
}

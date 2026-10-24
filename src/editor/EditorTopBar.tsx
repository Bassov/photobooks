import {
  useEffect,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
} from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import '../ui/Button.css'
import { Status } from '../ui/Status'
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
  regrantPhotoFolder,
  renameBookInLibrary,
  saveBookNow,
  subscribeProjectSession,
} from './projectSession'
import {
  allowAccessPhotoFolderLabel,
  getPhotoRootSessionSnapshot,
  subscribePhotoRootSession,
} from './photoRootSession'
import {
  saveIndicatorBadgeColor,
  saveIndicatorLabel,
} from './saveIndicatorLabel'
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
  const photoRoot = useSyncExternalStore(
    subscribePhotoRootSession,
    getPhotoRootSessionSnapshot,
    getPhotoRootSessionSnapshot,
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
          <Button
            size="sm"
            data-testid="regrant-library"
            isDisabled={chromeBusy}
            onPress={() => {
              void regrantLibrary()
            }}
          >
            Grant access
          </Button>
        ) : null}
        {photoRoot.photoAccessPhase === 'permission-required' ? (
          <Button
            size="sm"
            data-testid="regrant-photo-folder"
            isDisabled={chromeBusy}
            onPress={() => {
              void regrantPhotoFolder()
            }}
          >
            {allowAccessPhotoFolderLabel(photoRoot.photoFolderLabel)}
          </Button>
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
          <Status className="book-lock-banner" data-testid="book-lock-banner">
            This book is open in another tab
          </Status>
        ) : null}
        {libraryReady && !writeBlocked ? (
          <Status
            className="save-indicator"
            data-testid="save-indicator"
            data-save-phase={project.savePhase}
            data-dirty={project.dirty ? 'true' : 'false'}
          >
            <Badge
              color={saveIndicatorBadgeColor(project.savePhase, project.dirty)}
              size="sm"
              type="pill-color"
              dot
            >
              {saveIndicatorLabel(project.savePhase, project.dirty)}
            </Badge>
          </Status>
        ) : null}
        <ChromeButton
          variant={
            project.accessPhase === 'permission-required'
              ? 'secondary'
              : 'default'
          }
          data-testid="choose-photo-folder"
          onClick={() => {
            void chromeImport.onChoosePhotoFolder()
          }}
          disabled={chromeImport.importDisabled}
        >
          {chromeImport.photoFolderLabel}
        </ChromeButton>
        {chromeImport.inputs}
      </div>
    </header>
  )
}

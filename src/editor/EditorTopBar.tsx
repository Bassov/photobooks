import {
  useEffect,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import '../ui/Button.css'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { Status } from '../ui/Status'
import '../ui/Toolbar.css'
import { displayBookTitle } from '../project'
import {
  commitZoom,
  getCommittedCamera,
  getCommittedZoom,
  getLiveZoom,
  subscribeCommitted,
  subscribeLive,
} from './cameraStore'
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
import {
  bookSizeLine,
  nextZoomIn,
  nextZoomOut,
  toggleEditorPanel,
  zoomChromeLabel,
  type EditorPanels,
} from './editorChromePanels'
import { BAR, FIELD, SUB, T } from './editorChromeTokens'
import { PanelToggles } from './EditorFrame'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  redoBook,
  subscribeBookStore,
  subscribeHistory,
  undoBook,
} from './bookStore'
import { installEditorHistoryShortcut } from './installEditorHistoryShortcut'
import { installEditorSaveShortcut } from './installEditorSaveShortcut'
import {
  createBookInLibrary,
  getProjectSessionSnapshot,
  leaveEditorForLibrary,
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
  size = 'sm',
  className,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'sm' | 'md'
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      className={[
        'pb-button',
        'pb-button--secondary',
        'e7-ghost',
        `pb-button--${size}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        color: SUB,
        background: 'transparent',
        border: 0,
        boxShadow: 'none',
        ...style,
      }}
      {...props}
    />
  )
}

function readActiveBook() {
  return getBookStoreSnapshot().book
}

function BookMetaChrome({ saveLabel }: { saveLabel: string | null }) {
  const book = useSyncExternalStore(
    subscribeBookStore,
    readActiveBook,
    readActiveBook,
  )
  const title = displayBookTitle(book.title)
  const sizeLine = bookSizeLine({
    widthMm: book.settings.trim.widthMm,
    heightMm: book.settings.trim.heightMm,
    spreads: book.spreads.length,
    saveLabel,
  })
  return (
    <div className="e7-title ml-1 flex h-8 items-baseline gap-2 rounded-md border-0 px-2.5 pt-1.5">
      <span
        className="text-md"
        style={{ fontFamily: 'var(--font-heading)', color: T }}
        data-testid="book-title"
        title={title}
      >
        <em>{title}</em>
      </span>
      <span
        className="text-sm tabular-nums"
        style={{ color: SUB }}
        data-testid="book-size"
      >
        {sizeLine}
      </span>
    </div>
  )
}

function HistoryChrome() {
  const { canUndo, canRedo } = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getHistorySnapshot,
  )
  return (
    <div className="flex items-center gap-0.5" style={{ color: SUB }}>
      <IconButton
        label="Undo (Ctrl Z)"
        size="sm"
        data-testid="undo"
        isDisabled={!canUndo}
        onPress={undoBook}
      >
        <Icon name="undo" size={16} />
      </IconButton>
      <IconButton
        label="Redo (Shift Ctrl Z)"
        size="sm"
        data-testid="redo"
        isDisabled={!canRedo}
        onPress={redoBook}
      >
        <Icon name="redo" size={16} />
      </IconButton>
    </div>
  )
}

function ZoomChrome() {
  const live = useSyncExternalStore(subscribeLive, getLiveZoom, getLiveZoom)
  const committed = useSyncExternalStore(
    subscribeCommitted,
    getCommittedZoom,
    getCommittedZoom,
  )
  const zoom = live || committed
  const label = zoomChromeLabel(zoom)
  return (
    <div className="flex items-center gap-0.5 text-sm" style={{ color: SUB }}>
      <IconButton
        label="Zoom out (Ctrl −)"
        size="sm"
        data-testid="zoom-out"
        onPress={() => {
          const cam = getCommittedCamera()
          commitZoom(nextZoomOut(zoom), cam.scrollLeft, cam.scrollTop)
        }}
      >
        <Icon name="zoomOut" size={16} />
      </IconButton>
      <span
        className="min-w-12 px-1 text-center text-sm tabular-nums"
        data-testid="zoom-menu"
      >
        {label}
      </span>
      <IconButton
        label="Zoom in (Ctrl +)"
        size="sm"
        data-testid="zoom-in"
        onPress={() => {
          const cam = getCommittedCamera()
          commitZoom(nextZoomIn(zoom), cam.scrollLeft, cam.scrollTop)
        }}
      >
        <Icon name="zoomIn" size={16} />
      </IconButton>
    </div>
  )
}

export function EditorTopBar({
  chromeImport,
  panels,
  onPanelsChange,
}: {
  chromeImport: ChromeImportApi
  panels: EditorPanels
  onPanelsChange: (next: EditorPanels) => void
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

  useEffect(() => installEditorHistoryShortcut(), [])

  const libraryReady = project.libraryOpen
  const writeBlocked = project.accessPhase === 'locked-elsewhere'
  const activeBookId = project.bookId
  const pickerBusy = chromeImport.pickerBusy
  const chromeBusy = isChromeBusy(
    pickerBusy,
    project.actionBusy,
    project.restorePending,
  )

  const saveMeta =
    libraryReady && !writeBlocked
      ? project.savePhase === 'saving'
        ? 'saving'
        : project.savePhase === 'error'
          ? 'not saved'
          : 'saved'
      : null

  return (
    <header
      className="editor-chrome relative z-10 flex min-h-12 shrink-0 flex-wrap items-center gap-2 px-3"
      style={{ background: BAR, color: T }}
      data-testid="editor-bar"
    >
      <ChromeButton
        className="h-8 gap-1 pl-1.5 pr-2.5 text-sm"
        style={{ color: SUB, background: 'transparent' }}
        data-testid="go-library"
        aria-label="Library"
        onClick={() => {
          void leaveEditorForLibrary()
        }}
        disabled={chromeBusy}
      >
        <Icon name="chevronLeft" size={16} />
        Library
      </ChromeButton>
      <BookMetaChrome saveLabel={saveMeta} />

      <div
        role="toolbar"
        aria-label="Editor"
        className="editor-top-bar pb-toolbar ml-2 flex min-w-0 flex-1 flex-wrap items-center gap-1"
      >
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
              color={saveIndicatorBadgeColor(project.savePhase)}
              size="sm"
              type="pill-color"
              dot
            >
              {saveIndicatorLabel(project.savePhase, project.dirty)}
            </Badge>
          </Status>
        ) : null}
        <ChromeButton
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

      <HistoryChrome />
      <ZoomChrome />
      <PanelToggles
        panels={panels}
        onToggle={(key) => {
          onPanelsChange(toggleEditorPanel(panels, key))
        }}
      />
      <div className="flex items-center gap-1.5">
        <ChromeButton
          className="e7-sec h-8 gap-1.5 rounded-full px-3 text-sm font-medium"
          style={{ background: FIELD, color: T }}
          data-testid="editor-preview"
          disabled
          title="Preview coming later"
        >
          <Icon name="eye" size={16} />
          Preview
        </ChromeButton>
        <ChromeButton
          className="e7-sec h-8 gap-1.5 rounded-full px-3.5 text-sm font-medium"
          style={{ background: FIELD, color: T }}
          data-testid="export"
          disabled
          title="Export coming later"
        >
          <Icon name="export" size={16} />
          Export
        </ChromeButton>
        <ChromeButton
          className="e7-sec h-8 gap-1.5 rounded-full px-3 text-sm font-medium"
          style={{ background: FIELD, color: T }}
          data-testid="editor-publish"
          disabled
          title="Publish coming later"
        >
          Publish
        </ChromeButton>
      </div>
    </header>
  )
}

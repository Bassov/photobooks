import { setBookSettingsSelected } from './bookSettingsSelection'
import { setCoverSelected } from './coverSelection'
import type { Key } from 'react-aria-components'
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from 'react'
import { Button } from '../ui/Button'
import '../ui/Button.css'
import { Icon } from '../ui/Icon'
import {
  Menu,
  MenuItem,
  MenuKeyboard,
  MenuPopover,
  MenuSeparator,
  MenuTrigger,
} from '../ui/Menu'
import { IconButton } from '../ui/IconButton'
import { Status } from '../ui/Status'
import '../ui/Toolbar.css'
import { displayBookTitle } from '../project'
import { formatZoomPercent, physicalZoom } from './camera'
import {
  getCameraCommands,
  getCommittedZoom,
  getLiveZoom,
  subscribeCommitted,
  subscribeLive,
} from './cameraStore'
import { isChromeBusy } from './editorChromeDisabled'
import {
  bookSizeLine,
  toggleEditorPanel,
  zoomChromeLabel,
  type EditorPanels,
} from './editorChromePanels'
import { BAR, FIELD, SUB, T } from './editorChromeTokens'
import { PanelToggles } from './EditorFrame'
import { EditorSettings } from './EditorSettings'
import { EditorToolGroup } from './EditorToolGroup'
import { GridToggle } from './GridToggle'
import { SnapToggle } from './SnapToggle'
import { getDpiView, subscribeDpiView, toggleDpiView } from './dpiView'
import {
  getGuidesVisible,
  subscribeGuidesVisible,
  toggleGuidesVisible,
} from './guidesView'
import {
  getRulersVisible,
  subscribeRulersVisible,
  toggleRulersVisible,
} from './rulersView'
import {
  getBookStoreSnapshot,
  getHistorySnapshot,
  getSpreadIdsSnapshot,
  redoBook,
  subscribeBookStore,
  subscribeHistory,
  undoBook,
} from './bookStore'
import { installEditorHistoryShortcut } from './installEditorHistoryShortcut'
import { installEditorSaveShortcut } from './installEditorSaveShortcut'
import {
  getProjectSessionSnapshot,
  leaveEditorForLibrary,
  regrantLibrary,
  regrantPhotoFolder,
  subscribeProjectSession,
} from './projectSession'
import {
  allowAccessPhotoFolderLabel,
  getPhotoRootSessionSnapshot,
  subscribePhotoRootSession,
} from './photoRootSession'
import { saveIndicatorLabel } from './saveIndicatorLabel'
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

function readSpreadCount() {
  return getSpreadIdsSnapshot().length
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
      <button
        type="button"
        className="e7-title-button text-md"
        style={{ fontFamily: 'var(--font-heading)', color: T }}
        data-testid="book-title"
        title={title}
        onClick={() => {
          setCoverSelected(false)
          setBookSettingsSelected(true)
        }}
      >
        <em>{title}</em>
      </button>
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
  const { canUndo, canRedo, undoLabel, redoLabel } = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getHistorySnapshot,
  )
  return (
    <div className="ml-2 flex items-center gap-0.5" style={{ color: SUB }}>
      <IconButton
        label={
          undoLabel !== null
            ? `Undo “${undoLabel}” (Ctrl+Z)`
            : 'Nothing to undo'
        }
        size="sm"
        data-testid="undo"
        isDisabled={!canUndo}
        onPress={undoBook}
      >
        <Icon name="undo" size={16} />
      </IconButton>
      <IconButton
        label={
          redoLabel !== null
            ? `Redo “${redoLabel}” (Shift+Ctrl+Z)`
            : 'Nothing to redo'
        }
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

/**
 * View toggles the kit bar does not show (kit chrome.tsx:168-180 has only
 * grid · snap) stay reachable from one checkable menu (kit Menu pattern,
 * uikit menu.tsx) instead of three bar buttons.
 */
const VIEW_ITEMS = [
  {
    id: 'rulers',
    label: 'Rulers',
    shortcut: 'Shift+R',
    toggle: toggleRulersVisible,
  },
  {
    id: 'guides',
    label: 'Guides',
    shortcut: 'Ctrl+;',
    toggle: toggleGuidesVisible,
  },
  {
    id: 'dpi',
    label: 'DPI badges',
    shortcut: undefined,
    toggle: toggleDpiView,
  },
] as const

function ViewMenu() {
  const on = {
    rulers: useSyncExternalStore(
      subscribeRulersVisible,
      getRulersVisible,
      getRulersVisible,
    ),
    guides: useSyncExternalStore(
      subscribeGuidesVisible,
      getGuidesVisible,
      getGuidesVisible,
    ),
    dpi: useSyncExternalStore(subscribeDpiView, getDpiView, getDpiView),
  }
  const selected = VIEW_ITEMS.filter(({ id }) => on[id]).map(({ id }) => id)
  return (
    <MenuTrigger>
      <IconButton label="View options" size="sm" data-testid="view-menu">
        <Icon name="slidersHorizontal" size={16} />
      </IconButton>
      <MenuPopover placement="bottom end" className="w-48">
        <Menu
          selectionMode="multiple"
          shouldCloseOnSelect
          selectedKeys={selected}
          onAction={(key) => {
            VIEW_ITEMS.find(({ id }) => id === key)?.toggle()
          }}
        >
          {VIEW_ITEMS.map(({ id, label, shortcut }) => (
            <MenuItem key={id} id={id} data-testid={`view-${id}-item`}>
              {label}
              {shortcut === undefined ? null : (
                <MenuKeyboard>{shortcut}</MenuKeyboard>
              )}
            </MenuItem>
          ))}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
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
  const label = zoomChromeLabel(
    zoom,
    getCameraCommands()?.fitSpreadZoom() ?? null,
  )
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== '0' || !(event.ctrlKey || event.metaKey)) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement)
      ) {
        return
      }
      event.preventDefault()
      getCameraCommands()?.fitSpread()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
  const onAction = (key: Key): void => {
    const commands = getCameraCommands()
    if (commands === null) return
    if (key === 'fit-spread') commands.fitSpread()
    else if (key === 'fit-width') commands.fitWidth()
    else if (key === '100') commands.actualSize()
    else commands.zoomTo((physicalZoom() * Number(key)) / 100)
  }
  return (
    <div className="flex items-center gap-0.5 text-sm" style={{ color: SUB }}>
      <IconButton
        label="Zoom out (Ctrl −)"
        size="sm"
        data-testid="zoom-out"
        onPress={() => {
          getCameraCommands()?.zoomStep(-1)
        }}
      >
        <Icon name="minus" size={16} />
      </IconButton>
      <MenuTrigger>
        <Button
          variant="ghost"
          size="sm"
          className="min-w-[4.75rem] justify-center gap-1 px-2 text-sm tabular-nums"
          style={{ color: SUB, background: 'transparent' }}
          aria-label="Zoom"
          data-testid="zoom-menu"
        >
          <span
            data-testid="zoom-label"
            data-zoom-percent={formatZoomPercent(zoom)}
          >
            {label}
          </span>
          <Icon name="chevronDown" size={14} className="opacity-50" />
        </Button>
        <MenuPopover placement="bottom end" className="w-48">
          <Menu onAction={onAction}>
            <MenuItem id="fit-spread">
              Fit spread <MenuKeyboard>Ctrl+0</MenuKeyboard>
            </MenuItem>
            <MenuItem id="fit-width">Fit width</MenuItem>
            <MenuItem id="100">100%</MenuItem>
            <MenuItem id="150">150%</MenuItem>
            <MenuItem id="200">200%</MenuItem>
            <MenuItem id="400">400%</MenuItem>
            <MenuSeparator />
            <MenuItem id="50">50%</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>
      <IconButton
        label="Zoom in (Ctrl +)"
        size="sm"
        data-testid="zoom-in"
        onPress={() => {
          getCameraCommands()?.zoomStep(1)
        }}
      >
        <Icon name="plus" size={16} />
      </IconButton>
    </div>
  )
}

export function EditorTopBar({
  chromeImport,
  panels,
  onPanelsChange,
  onPresent,
}: {
  chromeImport: ChromeImportApi
  panels: EditorPanels
  onPanelsChange: (next: EditorPanels) => void
  onPresent: () => void
}) {
  const spreadCount = useSyncExternalStore(
    subscribeBookStore,
    readSpreadCount,
    readSpreadCount,
  )
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

  const [settingsOpen, setSettingsOpen] = useState(false)
  const libraryReady = project.libraryOpen
  const writeBlocked = project.accessPhase === 'locked-elsewhere'
  const pickerBusy = chromeImport.pickerBusy
  const chromeBusy = isChromeBusy(
    pickerBusy,
    project.actionBusy,
    project.restorePending,
  )

  const saveMeta =
    libraryReady && !writeBlocked
      ? saveIndicatorLabel(project.savePhase, project.dirty).toLowerCase()
      : null

  return (
    <header
      className="editor-chrome relative z-10 flex h-12 shrink-0 items-center gap-2 px-3"
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
      <HistoryChrome />

      <div
        role="toolbar"
        aria-label="Editor"
        className="editor-top-bar pb-toolbar mx-auto flex min-w-0 items-center gap-1"
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
        {writeBlocked ? (
          <Status className="book-lock-banner" data-testid="book-lock-banner">
            This book is open in another tab
          </Status>
        ) : null}
        {chromeImport.inputs}
        <EditorToolGroup />
        <GridToggle />
        <SnapToggle />
      </div>

      <ZoomChrome />
      <ViewMenu />
      <PanelToggles
        panels={panels}
        onToggle={(key) => {
          onPanelsChange(toggleEditorPanel(panels, key))
        }}
      />
      <ChromeButton
        className="e7-sec h-8 gap-1.5 rounded-full px-3 text-sm font-medium"
        style={{ background: FIELD, color: T }}
        data-testid="present"
        disabled={spreadCount === 0}
        title="Preview"
        onClick={onPresent}
      >
        <Icon name="eye" size={16} />
        Preview
      </ChromeButton>
      <IconButton
        label="Settings"
        size="sm"
        data-testid="editor-settings-open"
        onPress={() => {
          setSettingsOpen(true)
        }}
      >
        <Icon name="settings" size={16} />
      </IconButton>
      {settingsOpen ? (
        <EditorSettings
          libraryPath={project.libraryLabel ?? 'Library'}
          changeDisabled={chromeBusy}
          onClose={() => {
            setSettingsOpen(false)
          }}
        />
      ) : null}
    </header>
  )
}

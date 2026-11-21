import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  FRAMES_PAYLOAD_TYPE,
  getSpreadSizeMm,
  type FramesPayload,
  type ZMove,
} from '../core'
import { Icon } from '../ui/Icon'
import { uiScale } from '../ui/uiScale'
import {
  Menu,
  MenuItem,
  MenuKeyboard,
  MenuPopover,
  MenuSeparator,
} from '../ui/Menu'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { enterCropMode, exitCropMode } from './cropMode'
import {
  deleteFramesOp,
  findTargetFrame,
  runArrangeAction,
  runSetArrangeAction,
  selectedSet,
  type ArrangeAction,
  type FrameSetTarget,
  type FrameTarget,
} from './frameArrange'
import {
  copySelectedFrames,
  cutSelectedFrames,
  duplicateSelectedFrames,
  frameClipboardMirror,
  frameEditScope,
  pasteFrames,
} from './frameClipboard'
import { disabledRowIds, frameMenuRows } from './frameMenuModel'
import { setFrameSelection, setFrameSource } from './frameSelection'
import { getGuidesVisible } from './guidesView'
import { menuKeys } from './menuKeys'
import { overrideCopyOf } from './parentChanges'
import { isMacPlatform, parentHitAt, type ParentHit } from './parentHit'
import { startPhotoPick } from './photoPick'
import { setActiveSpreadId } from './photoRootSession'
import { handleOwner } from './selectionPeer'

interface FrameMenuAt {
  kind: 'frame'
  target: FrameTarget
  x: number
  y: number
  /** The multi-selection the menu acts on; null for one frame. */
  set: FrameSetTarget | null
  /** Opened by Shift+F10 / the menu key (M5: focus the first enabled row). */
  keyboard: boolean
}

interface ParentMenuAt {
  kind: 'parent'
  spreadId: string
  hit: Exclude<ParentHit, { kind: 'copy' }>
  x: number
  y: number
}

/** M6: the paper of a book spread with no frame under the pointer. */
interface PageMenuAt {
  kind: 'page'
  spreadId: string
  x: number
  y: number
}

type MenuAt = FrameMenuAt | ParentMenuAt | PageMenuAt

/**
 * The anchor is fixed inside the zoomed #root, where left/top are app px:
 * the screen-px point ÷ interface scale lands it under the pointer.
 */
function inAppPx(at: MenuAt): MenuAt {
  const s = uiScale()
  return { ...at, x: at.x / s, y: at.y / s }
}

const SPREAD_SELECTOR = '[data-testid="spread-view"]'

function readBook() {
  return getBookStoreSnapshot().book
}

/**
 * The editor frame a `contextmenu` lands on. Only editor frames (book spread
 * or Masters canvas) are buttons: previews and the parent layer under a book
 * spread are inert and never open the menu. The keyboard path
 * (Shift+F10, ContextMenu key; `menuKey` or a 0,0 event) opens at the frame
 * corner.
 */
function frameMenuAt(
  event: MouseEvent,
  menuKey: boolean,
): Omit<FrameMenuAt, 'kind' | 'set'> | null {
  // A selected copy's handles sit on its peer above the own frames.
  const button =
    event.target instanceof Element ? handleOwner(event.target) : null
  const frameId = button?.getAttribute('data-frame-id') ?? ''
  const spreadId =
    button?.closest('[data-spread-id]')?.getAttribute('data-spread-id') ?? ''
  if (button === null || frameId === '' || spreadId === '') {
    return null
  }
  const target = { spreadId, frameId }
  // Chromium reports a point inside the focused element for Shift+F10.
  if (menuKey || (event.clientX === 0 && event.clientY === 0)) {
    const rect = button.getBoundingClientRect()
    return { target, x: rect.left, y: rect.bottom, keyboard: true }
  }
  return { target, x: event.clientX, y: event.clientY, keyboard: false }
}

/**
 * Designer PO4: a right-click on a book spread that misses its frames hit
 * tests the inherited parent items through the own frames, as the
 * Ctrl+Shift press does (`parentHit.ts`). The Masters canvas has none. An
 * override copy hits first and opens its own frame menu. M6: a miss on the
 * paper opens the page menu when frames were copied in this tab.
 */
function spreadMenuAt(event: MouseEvent): MenuAt | null {
  const spreadEl =
    event.target instanceof Element
      ? event.target.closest(SPREAD_SELECTOR)
      : null
  if (spreadEl === null) {
    return null
  }
  const book = readBook()
  const spread = book.spreads.find(
    (s) => s.id === spreadEl.getAttribute('data-spread-id'),
  )
  if (spread === undefined) {
    return null
  }
  const spreadId = spread.id
  const spreadIndex = book.spreads.indexOf(spread)
  // A zero-size box gives non-finite mm, which hit nothing.
  // The point is screen px / screen px per mm (one space); the guide hit
  // radius is app chrome, so it gets app px per mm (÷ interface scale).
  const box = spreadEl.getBoundingClientRect()
  const pxPerMm = box.width / getSpreadSizeMm(book, spreadIndex).widthMm
  const hit = parentHitAt(
    book,
    spreadId,
    {
      x: (event.clientX - box.left) / pxPerMm,
      y: (event.clientY - box.top) / pxPerMm,
    },
    pxPerMm / uiScale(),
    getGuidesVisible(),
  )
  const x = event.clientX
  const y = event.clientY
  if (hit === null) {
    // The canvas paper only (not previews), in edit scope.
    return frameClipboardMirror() !== null &&
      frameEditScope(spreadId) &&
      spreadEl.closest('[data-pasteboard-slot]') !== null
      ? { kind: 'page', spreadId, x, y }
      : null
  }
  return hit.kind === 'copy'
    ? {
        kind: 'frame',
        target: { spreadId, frameId: hit.frame.id },
        x,
        y,
        set: null,
        keyboard: false,
      }
    : { kind: 'parent', spreadId, hit, x, y }
}

const MENU_CLASS = '[&_svg]:size-4 [&_svg]:text-muted-foreground'

/**
 * `document.execCommand('copy')`: deprecated, yet the only synchronous
 * clipboard write that carries the frames' own MIME type (absent in jsdom).
 */
interface CopyCommand {
  execCommand?: (command: 'copy') => boolean
}

/**
 * Menu Copy / Cut also put the payload on the system clipboard, so Ctrl+V
 * pastes it (kit `writeClipboard`): a one-shot `copy` event ahead of the
 * editor's own listener. No clipboard: the mirror still pastes from the menu.
 */
function writeSystemClipboard(payload: FramesPayload | null): void {
  if (payload === null) {
    return
  }
  const json = JSON.stringify(payload)
  const onCopy = (event: ClipboardEvent): void => {
    event.stopImmediatePropagation()
    event.preventDefault()
    event.clipboardData?.setData(FRAMES_PAYLOAD_TYPE, json)
  }
  document.addEventListener('copy', onCopy, { capture: true })
  ;(document as CopyCommand).execCommand?.('copy')
  document.removeEventListener('copy', onCopy, { capture: true })
}

/** M2: each row runs the command of its key or inspector button. */
function runFrameRow(at: FrameMenuAt, key: string): void {
  const { target, set } = at
  const book = readBook()
  const arrange = (action: ArrangeAction): void => {
    if (set === null) {
      runArrangeAction(target, action)
    } else {
      runSetArrangeAction(set, action)
    }
  }
  switch (key) {
    case 'reset-parent':
    case 'hide-parent': {
      const copy = overrideCopyOf(book, target)
      if (copy !== undefined) {
        // The copy goes either way; the store drops its selection.
        dispatchBookOp({
          type: key === 'reset-parent' ? 'resetParentItem' : 'hideParentItem',
          spreadId: target.spreadId,
          parentItemId: copy.overridesId,
        })
      }
      return
    }
    case 'replace':
    case 'place':
      startPhotoPick({ ...target, kind: key })
      return
    case 'remove':
      dispatchBookOp({ type: 'unplace', ...target })
      return
    case 'fit': {
      const fit = findTargetFrame(book, target)?.fit ?? 'fill'
      dispatchBookOp({
        type: 'setFit',
        ...target,
        fit: fit === 'fill' ? 'fit' : 'fill',
      })
      return
    }
    case 'crop':
      enterCropMode(target.spreadId, target.frameId)
      return
    case 'cut':
      writeSystemClipboard(cutSelectedFrames())
      return
    case 'copy':
      writeSystemClipboard(copySelectedFrames())
      return
    case 'paste': {
      const mirror = frameClipboardMirror()
      if (mirror !== null) {
        pasteFrames(mirror, { inPlace: false })
      }
      return
    }
    case 'duplicate':
      duplicateSelectedFrames()
      return
    case 'delete':
      dispatchBookOp(
        deleteFramesOp(
          book,
          target.spreadId,
          set === null ? [target.frameId] : set.frameIds,
        ),
      )
      return
    case 'lock':
      arrange({ kind: 'lock' })
      return
    default:
      arrange({ kind: 'z', move: key as ZMove })
  }
}

/**
 * Designer frame-context-menu: one frame or a multi-selection, rows from
 * `frameMenuRows` (M1 fixed order, disabled rows skipped by the arrows).
 */
function FrameMenu({ at, close }: { at: FrameMenuAt; close: () => void }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const entries = frameMenuRows(book, at.target, {
    set: at.set,
    mirrorHasFrames: frameClipboardMirror() !== null,
    editScope: frameEditScope(at.target.spreadId),
  })
  const gone = entries.length === 0
  useEffect(() => {
    if (gone) {
      close()
    }
  }, [gone, close])
  if (gone) {
    return null
  }
  const mac = isMacPlatform()
  return (
    <Menu
      aria-label={at.set === null ? 'Frame' : 'Frames'}
      // M5: a pointer open focuses the menu (no row highlighted); the
      // keyboard path focuses the first enabled row.
      autoFocus={at.keyboard ? 'first' : true}
      data-testid="frame-menu"
      className={MENU_CLASS}
      disabledKeys={disabledRowIds(entries)}
      onAction={(key) => {
        runFrameRow(at, String(key))
        close()
      }}
    >
      {entries.map((entry, index) =>
        entry === 'separator' ? (
          <MenuSeparator key={`separator-${String(index)}`} />
        ) : (
          <MenuItem
            key={entry.id}
            id={entry.id}
            textValue={entry.label}
            variant={entry.destructive === true ? 'destructive' : 'default'}
            data-testid={`frame-menu-${entry.id}`}
          >
            <Icon name={entry.icon} size={16} />
            {entry.label}
            {entry.keys === undefined ? null : (
              <MenuKeyboard>{menuKeys(entry.keys, mac)}</MenuKeyboard>
            )}
          </MenuItem>
        ),
      )}
    </Menu>
  )
}

/** "Hide on this spread": the parent item leaves the spread ("Hide parent item"). */
function hideItem(testId: string) {
  return (
    <MenuItem
      key="hide"
      id="hide"
      textValue="Hide on this spread"
      data-testid={testId}
    >
      <Icon name="eyeOff" size={16} />
      Hide on this spread
    </MenuItem>
  )
}

/**
 * Designer frame-context-menu M6: Paste / Paste in place onto the
 * right-clicked spread (the page menu opens only with frames copied).
 */
function PageMenu({ close }: { close: () => void }) {
  const mac = isMacPlatform()
  const rows = [
    { id: 'page-menu-paste', label: 'Paste', keys: 'Ctrl+V' },
    {
      id: 'page-menu-paste-in-place',
      label: 'Paste in place',
      keys: 'Shift+Ctrl+V',
    },
  ]
  return (
    <Menu
      aria-label="Page"
      autoFocus
      data-testid="page-menu"
      className={`${MENU_CLASS} whitespace-nowrap`}
      onAction={(key) => {
        const mirror = frameClipboardMirror()
        if (mirror !== null) {
          pasteFrames(mirror, { inPlace: key === 'page-menu-paste-in-place' })
        }
        close()
      }}
    >
      {rows.map((row) => (
        <MenuItem
          key={row.id}
          id={row.id}
          textValue={row.label}
          data-testid={row.id}
        >
          <Icon name="clipboardPaste" size={16} />
          {row.label}
          <MenuKeyboard>{menuKeys(row.keys, mac)}</MenuKeyboard>
        </MenuItem>
      ))}
    </Menu>
  )
}

/**
 * Designer PO4: the menu on an inherited parent frame or guide. Override
 * makes the spread's local copy (a frame copy is selected); Hide drops the
 * item from the spread.
 */
function ParentMenu({ at, close }: { at: ParentMenuAt; close: () => void }) {
  const { spreadId, hit } = at
  const guide = hit.kind === 'guide'
  const parentItemId = guide ? hit.guideId : hit.frameId
  return (
    <Menu
      aria-label={guide ? 'Parent guide' : 'Parent item'}
      autoFocus="first"
      data-testid="parent-menu"
      className={`${MENU_CLASS} whitespace-nowrap`}
      onAction={(key) => {
        if (key === 'hide') {
          dispatchBookOp({ type: 'hideParentItem', spreadId, parentItemId })
        } else if (guide) {
          dispatchBookOp({
            type: 'overrideParentGuide',
            spreadId,
            parentGuideId: parentItemId,
          })
        } else {
          dispatchBookOp({
            type: 'overrideParentFrame',
            spreadId,
            parentFrameId: parentItemId,
          })
          const copy = readBook()
            .spreads.find((spread) => spread.id === spreadId)
            ?.parentOverrides?.frames?.find(
              (frame) => frame.overridesId === parentItemId,
            )
          if (copy !== undefined) {
            setFrameSource({ spreadId, frameId: copy.id })
          }
        }
        close()
      }}
    >
      <MenuItem
        id="override"
        textValue="Override on this spread"
        data-testid="parent-menu-override"
      >
        <Icon name="unlink2" size={16} />
        Override on this spread
        {/* The Ctrl+Shift press overrides parent frames (PO2) and guides (PO5). */}
        <MenuKeyboard>
          {isMacPlatform() ? '⌘⇧Click' : 'Ctrl+Shift+Click'}
        </MenuKeyboard>
      </MenuItem>
      {hideItem('parent-menu-hide')}
    </Menu>
  )
}

/** Open a spread-level menu: the copy's frame menu selects it; the page menu selects nothing. */
function selectFor(at: MenuAt): void {
  if (at.kind === 'frame') {
    setFrameSource(at.target)
  } else if (at.kind === 'page') {
    // Paste targets the selection's spread, else the active one.
    exitCropMode()
    setFrameSelection(null)
    setActiveSpreadId(at.spreadId)
  }
}

/**
 * Right-click on a canvas frame selects it and opens the frame menu; on a
 * parent item the parent menu; on the paper the page menu. The menu reads
 * the book only while open, so closed it never re-renders on edits.
 */
export function FrameContextMenu() {
  const [at, setAt] = useState<MenuAt | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // M5: the contextmenu that follows Shift+F10 / the menu key is a
    // keyboard open (focus the first enabled row).
    let menuKey = false
    const onKeyDown = (event: KeyboardEvent) => {
      menuKey =
        event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')
    }
    const onContextMenu = (event: MouseEvent) => {
      const next = frameMenuAt(event, menuKey)
      menuKey = false
      if (next === null) {
        const spreadMenu = spreadMenuAt(event)
        if (spreadMenu !== null) {
          event.preventDefault()
          selectFor(spreadMenu)
          setAt(inAppPx(spreadMenu))
        }
        return
      }
      event.preventDefault()
      // A right-click inside a multi-selection keeps it: the menu acts on the set.
      const set = selectedSet()
      const inSet =
        set !== null &&
        set.spreadId === next.target.spreadId &&
        set.frameIds.includes(next.target.frameId)
      if (!inSet) {
        setFrameSource(next.target)
      }
      setAt(inAppPx({ ...next, kind: 'frame', set: inSet ? set : null }))
    }
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])
  const close = useCallback(() => {
    setAt(null)
  }, [])
  return (
    <>
      <div
        ref={anchor}
        aria-hidden
        data-testid="frame-menu-anchor"
        className="pointer-events-none fixed size-0"
        style={at === null ? undefined : { left: at.x, top: at.y }}
      />
      {at === null ? null : (
        <MenuPopover
          triggerRef={anchor}
          isOpen
          // Controlled open: React Aria only ever reports a change to closed.
          onOpenChange={close}
          placement="bottom start"
          // PO4 / M6: parent and page rows and their press hints stay on one
          // line (rows 30.84); the frame and set menus keep the kit's 224 px.
          className={at.kind === 'frame' ? 'w-56' : 'w-max min-w-56'}
        >
          {at.kind === 'parent' ? (
            <ParentMenu at={at} close={close} />
          ) : at.kind === 'page' ? (
            <PageMenu close={close} />
          ) : (
            <FrameMenu at={at} close={close} />
          )}
        </MenuPopover>
      )}
    </>
  )
}

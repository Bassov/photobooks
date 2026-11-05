import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { getSpreadSizeMm, type ZMove } from '../core'
import { Icon } from '../ui/Icon'
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
import {
  findSetFrames,
  findTargetFrame,
  LOCK_KEYS,
  runArrangeAction,
  runSetArrangeAction,
  selectedSet,
  setZMovesFor,
  Z_MOVES,
  zMovesFor,
  type FrameSetTarget,
  type FrameTarget,
} from './frameArrange'
import { setFrameSource } from './frameSelection'
import { getGuidesVisible } from './guidesView'
import { overrideCopyOf } from './parentChanges'
import { isMacPlatform, parentHitAt, type ParentHit } from './parentHit'
import { handleOwner } from './selectionPeer'

interface FrameMenuAt {
  kind: 'frame'
  target: FrameTarget
  x: number
  y: number
  /** The multi-selection the menu acts on; null for one frame. */
  set: FrameSetTarget | null
}

interface ParentMenuAt {
  kind: 'parent'
  spreadId: string
  hit: ParentHit
  x: number
  y: number
}

type MenuAt = FrameMenuAt | ParentMenuAt

const SPREAD_SELECTOR = '[data-testid="spread-view"]'

function readBook() {
  return getBookStoreSnapshot().book
}

/**
 * The editor frame a `contextmenu` lands on. Only editor frames (book spread
 * or Masters canvas) are buttons: previews and the parent layer under a book
 * spread are inert and never open the menu. The keyboard path
 * (Shift+F10, ContextMenu key) reports 0,0 and opens at the frame corner.
 */
function frameMenuAt(
  event: MouseEvent,
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
  if (event.clientX === 0 && event.clientY === 0) {
    const rect = button.getBoundingClientRect()
    return { target, x: rect.left, y: rect.bottom }
  }
  return { target, x: event.clientX, y: event.clientY }
}

/**
 * Designer PO4: a right-click on a book spread that misses its frames hit
 * tests the inherited parent items through the own frames, as the
 * Ctrl+Shift press does (`parentHit.ts`). The Masters canvas has none.
 */
function parentMenuAt(event: MouseEvent): ParentMenuAt | null {
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
  const box = spreadEl.getBoundingClientRect()
  const pxPerMm = box.width / getSpreadSizeMm(book, spreadIndex).widthMm
  const hit = parentHitAt(
    book,
    spreadId,
    {
      x: (event.clientX - box.left) / pxPerMm,
      y: (event.clientY - box.top) / pxPerMm,
    },
    pxPerMm,
    getGuidesVisible(),
  )
  return hit === null
    ? null
    : { kind: 'parent', spreadId, hit, x: event.clientX, y: event.clientY }
}

function FrameMenu({
  target,
  close,
}: {
  target: FrameTarget
  close: () => void
}) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const frame = findTargetFrame(book, target)
  useEffect(() => {
    if (frame === undefined) {
      close()
    }
  }, [frame, close])
  if (frame === undefined) {
    return null
  }
  const moves = zMovesFor(book, target)
  const locked = frame.locked === true
  const copy = overrideCopyOf(book, target)
  return (
    <Menu
      aria-label="Frame"
      autoFocus="first"
      data-testid="frame-menu"
      className={MENU_CLASS}
      onAction={(key) => {
        if (copy !== undefined && (key === 'reset' || key === 'hide')) {
          // The copy goes either way; the store drops its selection.
          dispatchBookOp({
            type: key === 'reset' ? 'resetParentItem' : 'hideParentItem',
            spreadId: target.spreadId,
            parentItemId: copy.overridesId,
          })
        } else {
          runArrangeAction(
            target,
            key === 'lock'
              ? { kind: 'lock' }
              : { kind: 'z', move: key as ZMove },
          )
        }
        close()
      }}
    >
      {copy === undefined ? null : copyItems()}
      {zItems(moves)}
      {moves.length > 0 ? <MenuSeparator /> : null}
      {lockItem(locked)}
    </Menu>
  )
}

const MENU_CLASS = '[&_svg]:size-4 [&_svg]:text-muted-foreground'

function zItems(moves: readonly ZMove[]) {
  return Z_MOVES.filter((entry) => moves.includes(entry.move)).map((entry) => (
    <MenuItem
      key={entry.move}
      id={entry.move}
      textValue={entry.label}
      data-testid={`frame-menu-${entry.move}`}
    >
      <Icon name={entry.icon} size={16} />
      {entry.label}
      <MenuKeyboard>{entry.keys}</MenuKeyboard>
    </MenuItem>
  ))
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

/** Designer PO4: a local copy goes back to its parent item or hides it. */
function copyItems() {
  return [
    <MenuItem
      key="reset"
      id="reset"
      textValue="Reset to parent"
      data-testid="frame-menu-reset-parent"
    >
      <Icon name="rotateCcw" size={16} />
      Reset to parent
    </MenuItem>,
    hideItem('frame-menu-hide-parent'),
    <MenuSeparator key="copy-separator" />,
  ]
}

/** Lock / Unlock; `locked` = the action unlocks. */
function lockItem(locked: boolean) {
  const lockLabel = locked ? 'Unlock' : 'Lock'
  return (
    <MenuItem id="lock" textValue={lockLabel} data-testid="frame-menu-lock">
      <Icon name={locked ? 'unlock' : 'lock'} size={16} />
      {lockLabel}
      <MenuKeyboard>{LOCK_KEYS}</MenuKeyboard>
    </MenuItem>
  )
}

/**
 * The menu on a multi-selection: z-order and lock act on the whole set (one
 * step each) and "Delete N frames" removes it, as the inspector button.
 */
function SetMenu({ set, close }: { set: FrameSetTarget; close: () => void }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const frames = findSetFrames(book, set)
  const gone = frames.length === 0
  useEffect(() => {
    if (gone) {
      close()
    }
  }, [gone, close])
  if (gone) {
    return null
  }
  const moves = setZMovesFor(book, set)
  const deleteLabel = `Delete ${String(frames.length)} frames`
  return (
    <Menu
      aria-label="Frames"
      autoFocus="first"
      data-testid="frame-menu"
      className={MENU_CLASS}
      onAction={(key) => {
        if (key === 'delete') {
          dispatchBookOp({
            type: 'removeFrames',
            spreadId: set.spreadId,
            frameIds: frames.map((frame) => frame.id),
          })
        } else {
          runSetArrangeAction(
            set,
            key === 'lock'
              ? { kind: 'lock' }
              : { kind: 'z', move: key as ZMove },
          )
        }
        close()
      }}
    >
      {zItems(moves)}
      {moves.length > 0 ? <MenuSeparator /> : null}
      {lockItem(frames.every((frame) => frame.locked === true))}
      <MenuSeparator />
      <MenuItem
        id="delete"
        textValue={deleteLabel}
        data-testid="frame-menu-delete"
      >
        <Icon name="delete" size={16} />
        {deleteLabel}
        <MenuKeyboard>Del</MenuKeyboard>
      </MenuItem>
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

/**
 * Right-click on a canvas frame selects it and opens Arrange + Lock; on a
 * parent item it opens the parent menu. The menu reads the book only while
 * open, so closed it never re-renders on edits.
 */
export function FrameContextMenu() {
  const [at, setAt] = useState<MenuAt | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      const next = frameMenuAt(event)
      if (next === null) {
        const parent = parentMenuAt(event)
        if (parent !== null) {
          event.preventDefault()
          setAt(parent)
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
      setAt({ ...next, kind: 'frame', set: inSet ? set : null })
    }
    document.addEventListener('contextmenu', onContextMenu)
    return () => {
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
        style={{ left: at?.x ?? 0, top: at?.y ?? 0 }}
      />
      {at === null ? null : (
        <MenuPopover
          triggerRef={anchor}
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              close()
            }
          }}
          placement="bottom start"
          // PO4: a parent row and its press hint stay on one line (rows 30.84);
          // the frame and set menus keep the kit's 224 px.
          className={at.kind === 'parent' ? 'w-max min-w-56' : 'w-56'}
        >
          {at.kind === 'parent' ? (
            <ParentMenu at={at} close={close} />
          ) : at.set === null ? (
            <FrameMenu target={at.target} close={close} />
          ) : (
            <SetMenu set={at.set} close={close} />
          )}
        </MenuPopover>
      )}
    </>
  )
}

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ZMove } from '../core'
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

interface MenuAt {
  target: FrameTarget
  x: number
  y: number
  /** The multi-selection the menu acts on; null for one frame. */
  set: FrameSetTarget | null
}

function readBook() {
  return getBookStoreSnapshot().book
}

/**
 * The editor frame a `contextmenu` lands on. Only editor frames (book spread
 * or Masters canvas) are buttons: previews and the parent layer under a book
 * spread are inert and never open the menu. The keyboard path
 * (Shift+F10, ContextMenu key) reports 0,0 and opens at the frame corner.
 */
function frameMenuAt(event: MouseEvent): Omit<MenuAt, 'set'> | null {
  const button =
    event.target instanceof Element
      ? event.target.closest('button.spread-frame')
      : null
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
  return (
    <Menu
      aria-label="Frame"
      autoFocus="first"
      data-testid="frame-menu"
      className={MENU_CLASS}
      onAction={(key) => {
        runArrangeAction(
          target,
          key === 'lock' ? { kind: 'lock' } : { kind: 'z', move: key as ZMove },
        )
        close()
      }}
    >
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
 * Right-click on a canvas frame selects it and opens Arrange + Lock. The menu
 * reads the book only while open, so closed it never re-renders on edits.
 */
export function FrameContextMenu() {
  const [at, setAt] = useState<MenuAt | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      const next = frameMenuAt(event)
      if (next === null) {
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
      setAt({ ...next, set: inSet ? set : null })
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
          className="w-56"
        >
          {at.set === null ? (
            <FrameMenu target={at.target} close={close} />
          ) : (
            <SetMenu set={at.set} close={close} />
          )}
        </MenuPopover>
      )}
    </>
  )
}

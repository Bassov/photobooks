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
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import {
  findTargetFrame,
  LOCK_KEYS,
  runArrangeAction,
  Z_MOVES,
  zMovesFor,
  type FrameTarget,
} from './frameArrange'
import { setFrameSource } from './frameSelection'

interface MenuAt {
  target: FrameTarget
  x: number
  y: number
}

function readBook() {
  return getBookStoreSnapshot().book
}

/**
 * The editor frame a `contextmenu` lands on. Only editor frames are buttons:
 * preview and parent-spread frames never open the menu. The keyboard path
 * (Shift+F10, ContextMenu key) reports 0,0 and opens at the frame corner.
 */
function frameMenuAt(event: MouseEvent): MenuAt | null {
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
  const lockLabel = locked ? 'Unlock' : 'Lock'
  return (
    <Menu
      aria-label="Frame"
      autoFocus="first"
      data-testid="frame-menu"
      className="[&_svg]:size-4 [&_svg]:text-muted-foreground"
      onAction={(key) => {
        runArrangeAction(
          target,
          key === 'lock' ? { kind: 'lock' } : { kind: 'z', move: key as ZMove },
        )
        close()
      }}
    >
      {Z_MOVES.filter((entry) => moves.includes(entry.move)).map((entry) => (
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
      ))}
      {moves.length > 0 ? <MenuSeparator /> : null}
      <MenuItem id="lock" textValue={lockLabel} data-testid="frame-menu-lock">
        <Icon name={locked ? 'unlock' : 'lock'} size={16} />
        {lockLabel}
        <MenuKeyboard>{LOCK_KEYS}</MenuKeyboard>
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
      setFrameSource(next.target)
      setAt(next)
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
          <FrameMenu target={at.target} close={close} />
        </MenuPopover>
      )}
    </>
  )
}

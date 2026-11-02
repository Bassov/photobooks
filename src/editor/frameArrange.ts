import {
  layerOf,
  type Book,
  type BookOp,
  type Frame,
  type ZMove,
} from '../core'
import type { IconProps } from '../ui/Icon'
import { dispatchBookOp, getBookStoreSnapshot } from './bookStore'
import type { FrameDragSource } from './dropTargets'
import { getFrameSource } from './frameSelection'
import { isTypingTarget } from './isTypingTarget'

/**
 * Z-order and lock for one frame, shared by the inspector Arrange section, the
 * frame context menu and the keyboard: all three dispatch these ops.
 */
export type FrameTarget = FrameDragSource

export type ArrangeAction = { kind: 'z'; move: ZMove } | { kind: 'lock' }

export const Z_MOVES: readonly {
  move: ZMove
  label: string
  icon: IconProps['name']
  keys: string
}[] = [
  {
    move: 'front',
    label: 'Bring to front',
    icon: 'bringToFront',
    keys: 'Ctrl+Shift+]',
  },
  { move: 'forward', label: 'Bring forward', icon: 'arrowUp', keys: 'Ctrl+]' },
  {
    move: 'backward',
    label: 'Send backward',
    icon: 'arrowDown',
    keys: 'Ctrl+[',
  },
  {
    move: 'back',
    label: 'Send to back',
    icon: 'sendToBack',
    keys: 'Ctrl+Shift+[',
  },
]

export const LOCK_KEYS = 'Ctrl+Shift+L'

export function zOrderOp(target: FrameTarget, move: ZMove): BookOp {
  return {
    type: 'reorderFrame',
    spreadId: target.spreadId,
    frameId: target.frameId,
    move,
  }
}

export function lockOp(target: FrameTarget, locked: boolean): BookOp {
  return {
    type: 'setFrameLocked',
    spreadId: target.spreadId,
    frameId: target.frameId,
    locked,
  }
}

/**
 * Ctrl/Cmd+] forward, Ctrl/Cmd+[ backward, with Shift to the front / back;
 * Ctrl/Cmd+Shift+L toggles the lock. Physical keys, so Shift and the layout
 * do not change the bracket.
 */
export function arrangeShortcut(key: {
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}): ArrangeAction | null {
  if (!(key.ctrlKey || key.metaKey) || key.altKey) {
    return null
  }
  if (key.code === 'KeyL') {
    return key.shiftKey ? { kind: 'lock' } : null
  }
  if (key.code === 'BracketRight') {
    return { kind: 'z', move: key.shiftKey ? 'front' : 'forward' }
  }
  if (key.code === 'BracketLeft') {
    return { kind: 'z', move: key.shiftKey ? 'back' : 'backward' }
  }
  return null
}

/** The spread's own frame (parent-spread frames are not editable here). */
export function findTargetFrame(
  book: Book,
  target: FrameTarget,
): Frame | undefined {
  return book.spreads
    .find((spread) => spread.id === target.spreadId)
    ?.frames.find((frame) => frame.id === target.frameId)
}

export function frameLocked(book: Book, target: FrameTarget): boolean {
  return findTargetFrame(book, target)?.locked === true
}

/** Z moves that change the frame's place in the stack, front first. */
export function zMovesFor(book: Book, target: FrameTarget): ZMove[] {
  const spread = book.spreads.find((item) => item.id === target.spreadId)
  const layer = spread === undefined ? null : layerOf(spread, target.frameId)
  if (layer === null) {
    return []
  }
  return Z_MOVES.map((entry) => entry.move).filter((move) =>
    move === 'front' || move === 'forward'
      ? layer.layer < layer.count
      : layer.layer > 1,
  )
}

/** The op an action dispatches on a frame; null when it cannot change the book. */
export function arrangeOp(
  book: Book,
  target: FrameTarget,
  action: ArrangeAction,
): BookOp | null {
  const frame = findTargetFrame(book, target)
  if (frame === undefined) {
    return null
  }
  if (action.kind === 'lock') {
    return lockOp(target, frame.locked !== true)
  }
  return zMovesFor(book, target).includes(action.move)
    ? zOrderOp(target, action.move)
    : null
}

/** Dispatch an action on a frame; false when it would change nothing. */
export function runArrangeAction(
  target: FrameTarget,
  action: ArrangeAction,
): boolean {
  const op = arrangeOp(getBookStoreSnapshot().book, target, action)
  if (op === null) {
    return false
  }
  dispatchBookOp(op)
  return true
}

/** Arrange shortcuts on the selected frame; without one the key stays the browser's. */
export function installArrangeKeys(): () => void {
  const onKey = (event: KeyboardEvent) => {
    const action = arrangeShortcut(event)
    if (action === null || isTypingTarget(event.target)) return
    const target = getFrameSource()
    if (
      target === null ||
      findTargetFrame(getBookStoreSnapshot().book, target) === undefined
    ) {
      return
    }
    event.preventDefault()
    runArrangeAction(target, action)
  }
  window.addEventListener('keydown', onKey)
  return () => {
    window.removeEventListener('keydown', onKey)
  }
}

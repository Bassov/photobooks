import {
  applyBookOp,
  editableSpread,
  layerOf,
  type Book,
  type BookOp,
  type Frame,
  type ZMove,
} from '../core'
import type { IconProps } from '../ui/Icon'
import { dispatchBookOp, getBookStoreSnapshot } from './bookStore'
import type { FrameDragSource } from './dropTargets'
import { getFrameSelection, getFrameSource } from './frameSelection'
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

/** The frame on its book or parent spread (both take the same frame ops). */
export function findTargetFrame(
  book: Book,
  target: FrameTarget,
): Frame | undefined {
  return editableSpread(book, target.spreadId)?.spread.frames.find(
    (frame) => frame.id === target.frameId,
  )
}

export function frameLocked(book: Book, target: FrameTarget): boolean {
  return findTargetFrame(book, target)?.locked === true
}

/** Z moves that change the frame's place in the stack, front first. */
export function zMovesFor(book: Book, target: FrameTarget): ZMove[] {
  const spread = editableSpread(book, target.spreadId)?.spread
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

/** 2 or more frames selected together on one spread (see `FrameSelection`). */
export interface FrameSetTarget {
  spreadId: string
  frameIds: readonly string[]
}

/** The set's frames on its book or parent spread, in spread order. */
export function findSetFrames(book: Book, set: FrameSetTarget): Frame[] {
  return (
    editableSpread(book, set.spreadId)?.spread.frames.filter((frame) =>
      set.frameIds.includes(frame.id),
    ) ?? []
  )
}

function setZOrderOp(set: FrameSetTarget, move: ZMove): BookOp {
  return {
    type: 'reorderFrames',
    spreadId: set.spreadId,
    frameIds: set.frameIds,
    move,
  }
}

/** Z moves that change the set's place in the stack, front first. */
export function setZMovesFor(book: Book, set: FrameSetTarget): ZMove[] {
  return Z_MOVES.map((entry) => entry.move).filter(
    (move) => applyBookOp(book, setZOrderOp(set, move)) !== book,
  )
}

/**
 * The op an action dispatches on a set; null when it cannot change the book.
 * Lock locks every frame when any is unlocked, else unlocks them all.
 */
export function setArrangeOp(
  book: Book,
  set: FrameSetTarget,
  action: ArrangeAction,
): BookOp | null {
  const frames = findSetFrames(book, set)
  if (frames.length === 0) {
    return null
  }
  if (action.kind === 'lock') {
    return {
      type: 'setFramesLocked',
      spreadId: set.spreadId,
      frameIds: frames.map((frame) => frame.id),
      locked: frames.some((frame) => frame.locked !== true),
    }
  }
  return setZMovesFor(book, set).includes(action.move)
    ? setZOrderOp(set, action.move)
    : null
}

/** Dispatch an action on a set; false when it would change nothing. */
export function runSetArrangeAction(
  set: FrameSetTarget,
  action: ArrangeAction,
): boolean {
  const op = setArrangeOp(getBookStoreSnapshot().book, set, action)
  if (op === null) {
    return false
  }
  dispatchBookOp(op)
  return true
}

/** Lowest and highest layer of the set (1 = bottom) and the layer count. */
export function setLayerRange(
  book: Book,
  set: FrameSetTarget,
): { first: number; last: number; count: number } | null {
  const spread = editableSpread(book, set.spreadId)?.spread
  const layers = set.frameIds.flatMap((frameId) => {
    const layer = spread === undefined ? null : layerOf(spread, frameId)
    return layer === null ? [] : [layer]
  })
  const first = layers[0]
  if (first === undefined) {
    return null
  }
  const at = layers.map((layer) => layer.layer)
  return { first: Math.min(...at), last: Math.max(...at), count: first.count }
}

/** The selection as a set when 2 or more frames are selected, else null. */
export function selectedSet(): FrameSetTarget | null {
  const selection = getFrameSelection()
  return selection !== null && selection.frameIds.length > 1 ? selection : null
}

/** Arrange shortcuts on the selected frame(s); without one the key stays the browser's. */
export function installArrangeKeys(): () => void {
  const onKey = (event: KeyboardEvent) => {
    const action = arrangeShortcut(event)
    if (action === null || isTypingTarget(event.target)) return
    const set = selectedSet()
    if (set !== null) {
      if (findSetFrames(getBookStoreSnapshot().book, set).length > 0) {
        event.preventDefault()
        runSetArrangeAction(set, action)
      }
      return
    }
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

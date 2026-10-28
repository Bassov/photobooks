import type { Book, BookOp } from '../core'

/**
 * Undoable slice of the document: layout (incl. the book grid) and title only. Gallery, assets and
 * session meta are transient (import keeps landing while the user edits), so
 * undo never rolls them back.
 */
export interface HistorySnapshot {
  spreads: Book['spreads']
  title: Book['title']
  layoutGrid: Book['layoutGrid']
}

export interface History {
  past: readonly HistorySnapshot[]
  future: readonly HistorySnapshot[]
  /** Coalesce key of the newest `past` entry, if it may absorb more ops. */
  key: string | undefined
}

const HISTORY_LIMIT = 100

export const EMPTY_HISTORY: History = {
  past: [],
  future: [],
  key: undefined,
}

export function snapshotOf(book: Book): HistorySnapshot {
  return {
    spreads: book.spreads,
    title: book.title,
    layoutGrid: book.layoutGrid,
  }
}

/** Ops that edit the undoable slice; gallery ops are not steps. */
export function isUndoableOp(op: BookOp): boolean {
  switch (op.type) {
    case 'addToGallery':
    case 'removeFromGallery':
    case 'removeManyFromGallery':
      return false
    default:
      return true
  }
}

/** Consecutive ops with the same key (e.g. title typing) share one step. */
export function coalesceKey(op: BookOp): string | undefined {
  switch (op.type) {
    case 'setTitle':
      return 'setTitle'
    case 'setCrop':
    case 'resetCrop':
      return `crop:${op.spreadId}:${op.frameId}`
    default:
      return undefined
  }
}

/** Push the pre-op snapshot; drops redo steps and evicts the oldest over the limit. */
export function recordStep(
  history: History,
  before: HistorySnapshot,
  key: string | undefined,
  limit: number = HISTORY_LIMIT,
): History {
  if (
    key !== undefined &&
    key === history.key &&
    history.past.length > 0 &&
    history.future.length === 0
  ) {
    return history
  }
  const past = [...history.past, before]
  if (past.length > limit) {
    past.splice(0, past.length - limit)
  }
  return { past, future: [], key }
}

export function canUndo(history: History): boolean {
  return history.past.length > 0
}

export function canRedo(history: History): boolean {
  return history.future.length > 0
}

export interface HistoryMove {
  history: History
  snapshot: HistorySnapshot
}

/** Pointer move back; `current` becomes the first redo step. */
export function undoStep(
  history: History,
  current: HistorySnapshot,
): HistoryMove | null {
  const snapshot = history.past[history.past.length - 1]
  if (snapshot === undefined) {
    return null
  }
  return {
    snapshot,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, current],
      key: undefined,
    },
  }
}

export function redoStep(
  history: History,
  current: HistorySnapshot,
): HistoryMove | null {
  const snapshot = history.future[history.future.length - 1]
  if (snapshot === undefined) {
    return null
  }
  return {
    snapshot,
    history: {
      past: [...history.past, current],
      future: history.future.slice(0, -1),
      key: undefined,
    },
  }
}

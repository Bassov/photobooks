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
  /** Step names, parallel to `past` / `future` (same index = same step). */
  pastLabels: readonly string[]
  futureLabels: readonly string[]
}

const HISTORY_LIMIT = 100

export const EMPTY_HISTORY: History = {
  past: [],
  future: [],
  key: undefined,
  pastLabels: [],
  futureLabels: [],
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

const OP_LABELS: Partial<Record<BookOp['type'], string>> = {
  place: 'Place photo',
  replace: 'Replace photo',
  unplace: 'Remove photo',
  fillSpread: 'Fill spread',
  insertSpreadWithAssets: 'Insert spread',
  setCrop: 'Crop',
  resetCrop: 'Reset crop',
  setFit: 'Change fit',
  swap: 'Swap photos',
  applyTemplate: 'Apply layout',
  addSpread: 'Add spread',
  removeSpread: 'Delete spread',
  duplicateSpread: 'Duplicate spread',
  moveSpread: 'Move spread',
  addFrame: 'Add frame',
  removeFrames: 'Delete frame',
  setFrameRect: 'Edit frame',
  moveFrame: 'Move frame',
  resizeFrame: 'Resize frame',
  rotateFrame: 'Rotate frame',
  reorderFrame: 'Reorder frame',
  setFrameLocked: 'Lock frame',
  alignFrames: 'Align frames',
  distributeFrames: 'Distribute frames',
  setTitle: 'Rename book',
  setBookGrid: 'Change grid',
  setSpreadGrid: 'Change grid',
  resetSpreadGrid: 'Reset grid',
}

/** Short name of the step an op creates, for the undo / redo tooltip. */
export function opLabel(op: BookOp): string {
  return OP_LABELS[op.type] ?? 'Edit'
}

/** Consecutive ops with the same key (e.g. title typing) share one step. */
export function coalesceKey(op: BookOp): string | undefined {
  switch (op.type) {
    case 'setTitle':
      return 'setTitle'
    case 'setCrop':
    case 'resetCrop':
      return `crop:${op.spreadId}:${op.frameId}`
    case 'rotateFrame':
      return op.live === true
        ? `rotate:${op.spreadId}:${op.frameId}`
        : undefined
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
  label = 'Edit',
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
  const pastLabels = [...history.pastLabels, label]
  if (past.length > limit) {
    past.splice(0, past.length - limit)
    pastLabels.splice(0, pastLabels.length - limit)
  }
  return { past, future: [], key, pastLabels, futureLabels: [] }
}

function label(labels: readonly string[]): string {
  return labels[labels.length - 1] ?? 'Edit'
}

/** Name of the step Undo would revert, or null when nothing to undo. */
export function undoLabel(history: History): string | null {
  return history.past.length > 0 ? label(history.pastLabels) : null
}

/** Name of the step Redo would reapply, or null when nothing to redo. */
export function redoLabel(history: History): string | null {
  return history.future.length > 0 ? label(history.futureLabels) : null
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
      pastLabels: history.pastLabels.slice(0, -1),
      futureLabels: [...history.futureLabels, label(history.pastLabels)],
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
      pastLabels: [...history.pastLabels, label(history.futureLabels)],
      futureLabels: history.futureLabels.slice(0, -1),
    },
  }
}

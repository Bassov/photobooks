import { editableSpread, type Frame } from '../core'
import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import { setCoverSelected } from './coverSelection'
import type { FrameDragSource } from './dropTargets'
import { setEditorStatus } from './editorStatus'
import { setSelectedAssetId } from './gallerySelection'

export type FrameSource = FrameDragSource

/** Frames selected together; always on one spread, in selection order. */
export interface FrameSelection {
  spreadId: string
  frameIds: readonly string[]
}

type Listener = () => void

let selection: FrameSelection | null = null
/** The single selected frame; null when none or 2 or more are selected. */
let source: FrameSource | null = null
let syncing = false
const listeners = new Set<Listener>()

/** Joins the selected frame ids in a per-spread key (see `isFramePressed`). */
const KEY_SEPARATOR = '\n'

/** Key on the other spreads while 2 or more frames are selected elsewhere. */
const MULTI_ON_ANOTHER_SPREAD_KEY = KEY_SEPARATOR

/** Sentinel when the move source is on another spread (key is `''`). */
const SOURCE_ON_ANOTHER_SPREAD: FrameSource = {
  spreadId: '',
  frameId: '',
}

/**
 * Decode `getSpreadFrameSourceKey` for ConnectedSpreadView labels: the single
 * selected frame (the sentinel when it is on another spread), or null when
 * none or 2 or more are selected.
 */
export function sourceFromKey(
  spreadId: string,
  key: string | null,
): FrameSource | null {
  if (key === null || key.includes(KEY_SEPARATOR)) {
    return null
  }
  if (key === '') {
    return SOURCE_ON_ANOTHER_SPREAD
  }
  return { spreadId, frameId: key }
}

/** The single selected frame; null when none or 2 or more are selected. */
export function getFrameSource(): FrameSource | null {
  return source
}

export function getFrameSelection(): FrameSelection | null {
  return selection
}

/**
 * Per-spread selection key: null when nothing is selected; on another spread
 * `''` (one frame) or a lone separator (2 or more); else the selected ids.
 */
export function getSpreadFrameSourceKey(spreadId: string): string | null {
  if (selection === null) {
    return null
  }
  if (selection.spreadId !== spreadId) {
    return selection.frameIds.length > 1 ? MULTI_ON_ANOTHER_SPREAD_KEY : ''
  }
  return selection.frameIds.join(KEY_SEPARATOR)
}

export function subscribeSpreadFrameSource(
  spreadId: string,
  listener: Listener,
): () => void {
  let current = getSpreadFrameSourceKey(spreadId)
  return subscribeFrameSelection(() => {
    const next = getSpreadFrameSourceKey(spreadId)
    if (next === current) {
      return
    }
    current = next
    listener()
  })
}

/** Select one frame alone (null clears the selection). */
export function setFrameSource(next: FrameSource | null): void {
  if (next === null) {
    setSelection(null)
    return
  }
  if (sameSource(source, next)) {
    return
  }
  setSelection({ spreadId: next.spreadId, frameIds: [next.frameId] })
}

/** Select a whole set (marquee); an empty set or null clears the selection. */
export function setFrameSelection(next: FrameSelection | null): void {
  setSelection(next === null || next.frameIds.length === 0 ? null : next)
}

/**
 * Shift+click: toggle the frame in a selection on its spread; a selection on
 * another spread gives way to the frame alone. Removing the last frame clears.
 */
export function toggleFrameSelection(target: FrameSource): void {
  const current = selection
  if (current?.spreadId !== target.spreadId) {
    setFrameSource(target)
    return
  }
  const frameIds = current.frameIds.includes(target.frameId)
    ? current.frameIds.filter((id) => id !== target.frameId)
    : [...current.frameIds, target.frameId]
  setSelection(
    frameIds.length === 0 ? null : { spreadId: target.spreadId, frameIds },
  )
}

function setSelection(next: FrameSelection | null): void {
  if (next === null && selection === null) {
    return
  }
  selection = next
  const single = next?.frameIds.length === 1 ? next.frameIds[0] : undefined
  source =
    next === null || single === undefined
      ? null
      : { spreadId: next.spreadId, frameId: single }
  sourceWasFilled = source !== null && sourceFrameFilled(source)
  emit()
  if (next !== null) {
    setCoverSelected(false)
    withSelectionSync(() => {
      setSelectedAssetId(null)
    })
  }
}

export function subscribeFrameSelection(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetFrameSelection(): void {
  setFrameSource(null)
}

export function withSelectionSync(fn: () => void): void {
  if (syncing) {
    return
  }
  syncing = true
  try {
    fn()
  } finally {
    syncing = false
  }
}

export function frameControlLabel(
  filled: boolean,
  frameSource: FrameSource | null,
  frame: FrameSource,
  /** False when the selected frame is empty: nothing to move or swap. */
  sourceFilled = true,
): string {
  if (sameSource(frameSource, frame)) {
    return filled ? 'Cancel move' : 'Place photo'
  }
  if (frameSource === null || !sourceFilled) {
    return filled ? 'Select photo to move' : 'Place photo'
  }
  return filled ? 'Swap photos' : 'Move photo here'
}

function sameSource(a: FrameSource | null, b: FrameSource | null): boolean {
  if (a === b) {
    return true
  }
  if (a === null || b === null) {
    return false
  }
  return a.spreadId === b.spreadId && a.frameId === b.frameId
}

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

/** The frame on its spread or parent (Masters canvas) in the current book. */
export function sourceFrame(current: FrameSource): Frame | undefined {
  return editableSpread(
    getBookStoreSnapshot().book,
    current.spreadId,
  )?.spread.frames.find((item) => item.id === current.frameId)
}

export function sourceFrameFilled(current: FrameSource): boolean {
  return sourceFrame(current)?.assetId !== undefined
}

/** Whether the selected frame held a photo when it was selected. */
let sourceWasFilled = false

subscribeBookStore(() => {
  const current = selection
  if (current === null) {
    return
  }
  // A selected frame that vanished, or a single one that gained / lost its
  // photo, ends the selection.
  const kept = current.frameIds.every(
    (frameId) =>
      sourceFrame({ spreadId: current.spreadId, frameId }) !== undefined,
  )
  if (
    kept &&
    (source === null || sourceFrameFilled(source) === sourceWasFilled)
  ) {
    return
  }
  setFrameSource(null)
  setEditorStatus('')
})

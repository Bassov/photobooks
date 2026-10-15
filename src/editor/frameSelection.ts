import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import type { FrameDragSource } from './dropTargets'
import { setEditorStatus } from './editorStatus'
import { setSelectedAssetId } from './gallerySelection'

export type FrameSource = FrameDragSource

type Listener = () => void

let source: FrameSource | null = null
let syncing = false
const listeners = new Set<Listener>()

export function getFrameSource(): FrameSource | null {
  return source
}

export function setFrameSource(next: FrameSource | null): void {
  if (sameSource(source, next)) {
    return
  }
  source = next
  emit()
  if (next !== null) {
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
  gallerySelected: boolean,
  frameSource: FrameSource | null,
  frame: FrameSource,
): string {
  if (gallerySelected) {
    return filled ? 'Replace photo' : 'Place photo'
  }
  if (sameSource(frameSource, frame)) {
    return filled ? 'Cancel move' : 'Place photo'
  }
  if (frameSource === null) {
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

function sourceFrameFilled(current: FrameSource): boolean {
  const book = getBookStoreSnapshot().book
  const spread = book.spreads.find((item) => item.id === current.spreadId)
  const frame = spread?.frames.find((item) => item.id === current.frameId)
  return frame?.assetId !== undefined
}

subscribeBookStore(() => {
  const current = source
  if (current === null || sourceFrameFilled(current)) {
    return
  }
  setFrameSource(null)
  setEditorStatus('')
})

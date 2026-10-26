import { getBookStoreSnapshot, subscribeBookStore } from './bookStore'
import type { FrameDragSource } from './dropTargets'
import { setEditorStatus } from './editorStatus'
import { setSelectedAssetId } from './gallerySelection'

export type FrameSource = FrameDragSource

type Listener = () => void

let source: FrameSource | null = null
let syncing = false
const listeners = new Set<Listener>()

/** Sentinel when the move source is on another spread (key is `''`). */
const SOURCE_ON_ANOTHER_SPREAD: FrameSource = {
  spreadId: '',
  frameId: '',
}

/** Decode `getSpreadFrameSourceKey` for ConnectedSpreadView labels. */
export function sourceFromKey(
  spreadId: string,
  key: string | null,
): FrameSource | null {
  if (key === null) {
    return null
  }
  if (key === '') {
    return SOURCE_ON_ANOTHER_SPREAD
  }
  return { spreadId, frameId: key }
}

export function getFrameSource(): FrameSource | null {
  return source
}

export function getSpreadFrameSourceKey(spreadId: string): string | null {
  if (source === null) {
    return null
  }
  if (source.spreadId !== spreadId) {
    return ''
  }
  return source.frameId
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
  frameSource: FrameSource | null,
  frame: FrameSource,
): string {
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

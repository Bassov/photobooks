import type { Frame } from '../core'

/**
 * Transient geometry of the frame under a drag (move / resize / rotate). The
 * gestures preview with direct DOM writes; this mirrors the same numbers to the
 * inspector, coalesced to one publish per animation frame. Not part of the book.
 */
export interface LiveGeometry {
  spreadId: string
  frameId: string
  rect: Frame['rect']
  rotationDeg: number
}

type Listener = () => void

const listeners = new Set<Listener>()
let current: LiveGeometry | null = null
let pending: LiveGeometry | null = null
let frameHandle: number | null = null

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function flush(): void {
  frameHandle = null
  current = pending
  emit()
}

export function subscribeLiveGeometry(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getLiveGeometry(): LiveGeometry | null {
  return current
}

/** Latest values win; subscribers are notified at most once per frame. */
export function publishLiveGeometry(next: LiveGeometry): void {
  pending = next
  frameHandle ??= requestAnimationFrame(flush)
}

/** Gesture ended or cancelled: drop the live values immediately. */
export function clearLiveGeometry(): void {
  pending = null
  if (frameHandle !== null) {
    cancelAnimationFrame(frameHandle)
    frameHandle = null
  }
  if (current !== null) {
    current = null
    emit()
  }
}

/** The live values for one frame, or null when it is not being dragged. */
export function liveGeometryFor(
  live: LiveGeometry | null,
  spreadId: string,
  frameId: string,
): LiveGeometry | null {
  return live?.spreadId === spreadId && live.frameId === frameId ? live : null
}

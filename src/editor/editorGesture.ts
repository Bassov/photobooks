type Listener = () => void

let depth = 0
let active = false
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

/**
 * Push/pop gesture activity. `true` begins a gesture, `false` ends one.
 * Nested begins keep autosave blocked until the last end.
 */
export function setEditorGestureActive(next: boolean): void {
  if (next) {
    depth += 1
  } else {
    depth = Math.max(0, depth - 1)
  }
  const was = active
  active = depth > 0
  if (was !== active) {
    emit()
  }
}

export function isEditorGestureActive(): boolean {
  return active
}

export function subscribeEditorGesture(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Bridge HTML5 drag gestures so autosave can pause without DOM queries. */
export function installDocumentDragGesture(): () => void {
  const onStart = (): void => {
    setEditorGestureActive(true)
  }
  const onEnd = (): void => {
    setEditorGestureActive(false)
  }
  document.addEventListener('dragstart', onStart)
  document.addEventListener('dragend', onEnd)
  return () => {
    document.removeEventListener('dragstart', onStart)
    document.removeEventListener('dragend', onEnd)
  }
}

/** Unit-test seam. */
export function resetEditorGestureForTests(): void {
  depth = 0
  active = false
}

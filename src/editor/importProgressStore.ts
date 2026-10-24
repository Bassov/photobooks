import {
  filmstripScrollQuietRemainingMs,
  isFilmstripScrollQuiet,
} from './filmstripScrollQuiet'
import type { ImportProgress } from './importPhotos'

type Listener = () => void

let progress: ImportProgress | null = null
const listeners = new Set<Listener>()
let quietEmitTimer: ReturnType<typeof setTimeout> | undefined

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function clearQuietEmitTimer(): void {
  if (quietEmitTimer === undefined) {
    return
  }
  clearTimeout(quietEmitTimer)
  quietEmitTimer = undefined
}

function scheduleEmitAfterScrollQuiet(): void {
  clearQuietEmitTimer()
  const delayMs = filmstripScrollQuietRemainingMs()
  quietEmitTimer = setTimeout(() => {
    quietEmitTimer = undefined
    if (isFilmstripScrollQuiet()) {
      scheduleEmitAfterScrollQuiet()
      return
    }
    emit()
  }, delayMs)
}

export function subscribeImportProgress(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getImportProgress(): ImportProgress | null {
  return progress
}

/** Update import progress; no-ops when the snapshot is unchanged by identity. */
export function setImportProgress(next: ImportProgress | null): void {
  if (Object.is(progress, next)) {
    return
  }
  progress = next
  // Defer React notifies while the filmstrip is scrolling so progress ticks
  // do not stack with virtualizer remounts on the same animation frame.
  if (isFilmstripScrollQuiet()) {
    scheduleEmitAfterScrollQuiet()
    return
  }
  clearQuietEmitTimer()
  emit()
}

export function resetImportProgressForTests(): void {
  progress = null
  clearQuietEmitTimer()
  emit()
}

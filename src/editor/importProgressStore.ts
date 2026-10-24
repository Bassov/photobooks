import type { ImportProgress } from './importPhotos'

type Listener = () => void

let progress: ImportProgress | null = null
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
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
  emit()
}

export function resetImportProgressForTests(): void {
  progress = null
  emit()
}

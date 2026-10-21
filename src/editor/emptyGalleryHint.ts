type Listener = () => void

let noPhotosFound = false
const listeners = new Set<Listener>()

export function getNoPhotosFoundHint(): boolean {
  return noPhotosFound
}

export function setNoPhotosFoundHint(next: boolean): void {
  if (noPhotosFound === next) {
    return
  }
  noPhotosFound = next
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeNoPhotosFoundHint(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test / reset seam. */
export function resetNoPhotosFoundHint(): void {
  setNoPhotosFoundHint(false)
}

/** Editor-only "show layout grid" flag; never part of the document or exports. */

type Listener = () => void

let visible = false
const listeners = new Set<Listener>()

export function subscribeGridVisible(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getGridVisible(): boolean {
  return visible
}

export function setGridVisible(next: boolean): void {
  if (next === visible) {
    return
  }
  visible = next
  for (const listener of listeners) {
    listener()
  }
}

export function toggleGridVisible(): void {
  setGridVisible(!visible)
}

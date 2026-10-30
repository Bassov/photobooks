/** Editor-only "DPI badges" flag; never part of the document or exports. Off by default. */

type Listener = () => void

let visible = false
const listeners = new Set<Listener>()

export function subscribeDpiView(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getDpiView(): boolean {
  return visible
}

export function setDpiView(next: boolean): void {
  if (next === visible) {
    return
  }
  visible = next
  for (const listener of listeners) {
    listener()
  }
}

export function toggleDpiView(): void {
  setDpiView(!visible)
}

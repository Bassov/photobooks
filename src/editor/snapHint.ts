/** Active snap label (`snap · column 3`) shown while a gesture is snapped; null otherwise. */

type Listener = () => void

let hint: string | null = null
const listeners = new Set<Listener>()

export function subscribeSnapHint(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSnapHint(): string | null {
  return hint
}

export function setSnapHint(next: string | null): void {
  if (next === hint) {
    return
  }
  hint = next
  for (const listener of listeners) {
    listener()
  }
}

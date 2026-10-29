/** Active snap label (`snap · column 3`) shown while a gesture is snapped; null otherwise. */

type Listener = () => void

let hint: string | null = null
let hintSpreadId: string | undefined
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

/** Spread the hint belongs to; undefined = any spread shows it. */
export function getSnapHintSpread(): string | undefined {
  return hintSpreadId
}

export function setSnapHint(next: string | null, spreadId?: string): void {
  if (next === hint && spreadId === hintSpreadId) {
    return
  }
  hint = next
  hintSpreadId = spreadId
  for (const listener of listeners) {
    listener()
  }
}

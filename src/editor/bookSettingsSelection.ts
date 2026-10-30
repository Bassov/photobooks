/**
 * Whether Book settings is the inspector's context. Kit step 24: clicking the
 * book title opens it; it stays until another item (frame, spread, cover) is
 * picked, which calls `setCoverSelected`.
 */
let selected = false
const listeners = new Set<() => void>()

export function isBookSettingsSelected(): boolean {
  return selected
}

export function subscribeBookSettingsSelection(
  listener: () => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setBookSettingsSelected(next: boolean): void {
  if (next === selected) {
    return
  }
  selected = next
  for (const listener of listeners) {
    listener()
  }
}

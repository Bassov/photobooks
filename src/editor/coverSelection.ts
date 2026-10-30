/**
 * Whether the cover (not a spread) is the editor's current selection. Kit step
 * 09: the cover row in the pages list selects it, the canvas shows back ·
 * spine · front and the inspector shows the cover. Picking a spread or a frame
 * leaves it.
 */
let selected = false
const listeners = new Set<() => void>()

export function isCoverSelected(): boolean {
  return selected
}

export function subscribeCoverSelection(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setCoverSelected(next: boolean): void {
  if (next === selected) {
    return
  }
  selected = next
  for (const listener of listeners) {
    listener()
  }
}

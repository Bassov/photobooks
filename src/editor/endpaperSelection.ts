export type EndpaperSide = 'front' | 'back'

/**
 * Which endpaper (kit step 25) is the editor's current selection: the list row
 * shows it on the canvas and the inspector shows its fill. Picking the cover,
 * a spread or a frame leaves it (`setCoverSelected` clears it).
 */
let selected: EndpaperSide | null = null
const listeners = new Set<() => void>()

export function getSelectedEndpaper(): EndpaperSide | null {
  return selected
}

export function subscribeEndpaperSelection(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setEndpaperSelected(next: EndpaperSide | null): void {
  if (next === selected) {
    return
  }
  selected = next
  for (const listener of listeners) {
    listener()
  }
}

/** Editor-only "show layout grid" / "snap to grid" flags; never part of the document or exports. */

type Listener = () => void

let visible = false
let snapOn = true
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

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
  emit()
}

export function toggleGridVisible(): void {
  setGridVisible(!visible)
}

/** Snap is on by default; it only acts on the grid while the grid is shown. */
export function subscribeSnapOn(listener: Listener): () => void {
  return subscribeGridVisible(listener)
}

export function getSnapOn(): boolean {
  return snapOn
}

export function setSnapOn(next: boolean): void {
  if (next === snapOn) {
    return
  }
  snapOn = next
  emit()
}

export function toggleSnapOn(): void {
  setSnapOn(!snapOn)
}

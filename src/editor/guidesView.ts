/** Editor-only "show guides" flag; never part of the document or exports. On by default. */

type Listener = () => void

let visible = true
const listeners = new Set<Listener>()

export function subscribeGuidesVisible(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getGuidesVisible(): boolean {
  return visible
}

export function setGuidesVisible(next: boolean): void {
  if (next === visible) {
    return
  }
  visible = next
  for (const listener of listeners) {
    listener()
  }
}

export function toggleGuidesVisible(): void {
  setGuidesVisible(!visible)
}

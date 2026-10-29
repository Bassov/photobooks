/** Editor-only "show rulers" flag; never part of the document or exports. Off by default. */

type Listener = () => void

let visible = false
const listeners = new Set<Listener>()

export function subscribeRulersVisible(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getRulersVisible(): boolean {
  return visible
}

export function setRulersVisible(next: boolean): void {
  if (next === visible) {
    return
  }
  visible = next
  for (const listener of listeners) {
    listener()
  }
}

export function toggleRulersVisible(): void {
  setRulersVisible(!visible)
}

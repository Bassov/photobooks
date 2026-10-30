export type LeftPanelTab = 'pages' | 'masters'

type Listener = () => void

let tab: LeftPanelTab = 'pages'
const listeners = new Set<Listener>()

export function getLeftPanelTab(): LeftPanelTab {
  return tab
}

export function setLeftPanelTab(next: LeftPanelTab): void {
  if (next === tab) return
  tab = next
  listeners.forEach((l) => {
    l()
  })
}

export function subscribeLeftPanelTab(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetLeftPanelTabForTests(): void {
  tab = 'pages'
}

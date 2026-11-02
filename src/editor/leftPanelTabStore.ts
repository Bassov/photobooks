export type LeftPanelTab = 'pages' | 'masters'

type Listener = () => void

let tab: LeftPanelTab = 'pages'
/** Parent picked in the Masters list; `null` → the first parent. */
let pickedParentId: string | null = null
const listeners = new Set<Listener>()

function emit(): void {
  listeners.forEach((l) => {
    l()
  })
}

export function getLeftPanelTab(): LeftPanelTab {
  return tab
}

export function setLeftPanelTab(next: LeftPanelTab): void {
  if (next === tab) return
  tab = next
  emit()
}

export function getPickedParentId(): string | null {
  return pickedParentId
}

export function setPickedParentId(id: string | null): void {
  if (id === pickedParentId) return
  pickedParentId = id
  emit()
}

/** The parent Masters mode shows: the picked one while it exists, else the first. */
export function shownParentId(
  parents: readonly { id: string }[] | undefined,
  picked: string | null,
): string | null {
  if (parents === undefined) {
    return null
  }
  return (
    parents.find((parent) => parent.id === picked)?.id ?? parents[0]?.id ?? null
  )
}

export function subscribeLeftPanelTab(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetLeftPanelTabForTests(): void {
  tab = 'pages'
  pickedParentId = null
}

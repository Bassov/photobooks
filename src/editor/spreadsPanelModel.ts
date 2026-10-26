import { setActiveSpreadId } from './photoRootSession'

export function scrollPasteboardToSpread(spreadId: string): void {
  const slot = document.querySelector(
    `[data-pasteboard-slot][data-spread-id="${CSS.escape(spreadId)}"]`,
  )
  if (slot instanceof HTMLElement) {
    slot.scrollIntoView()
  }
  setActiveSpreadId(spreadId)
}

export function selectedSpreadId(
  activeId: string | null,
  spreadIds: readonly string[],
): string | null {
  return activeId ?? spreadIds[0] ?? null
}

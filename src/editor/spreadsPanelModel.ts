import { pasteboardWindow, type PasteboardWindow } from './pasteboardWindow'
import { requestSpreadReveal } from './photoRootSession'

/** Thumbnail box height; also exposed as the `--spreads-thumb-h` CSS variable. */
export const SPREADS_THUMB_HEIGHT_PX = 64
/** Fixed row stride (thumb + label + gap) so the list can be windowed. */
export const SPREADS_ROW_PX = 104
const OVERSCAN_ROWS = 3

export function scrollPasteboardToSpread(spreadId: string): void {
  requestSpreadReveal(spreadId)
}

/** Active spread when it still exists, else the first spread. */
export function selectedSpreadId(
  activeId: string | null,
  spreadIds: readonly string[],
): string | null {
  return spreadIds.find((id) => id === activeId) ?? spreadIds[0] ?? null
}

/** Spread to select after `removedId` is deleted: next, else previous. */
export function neighbourAfterDelete(
  spreadIds: readonly string[],
  removedId: string,
): string | null {
  const at = spreadIds.indexOf(removedId)
  if (at < 0) {
    return null
  }
  return spreadIds[at + 1] ?? spreadIds[at - 1] ?? null
}

export function canDeleteSpread(spreadCount: number): boolean {
  return spreadCount > 1
}

export function spreadsListWindow(
  count: number,
  scrollTop: number,
  viewportPx: number,
): PasteboardWindow {
  return pasteboardWindow({
    count,
    stridePx: SPREADS_ROW_PX,
    scrollTop,
    viewportPx,
    overscanPx: OVERSCAN_ROWS * SPREADS_ROW_PX,
  })
}

/** Scroll offset that brings row `index` fully into the viewport, or null. */
export function scrollTopToReveal(
  index: number,
  scrollTop: number,
  viewportPx: number,
): number | null {
  // -1: no selection (empty list) — nothing to reveal.
  if (index < 0) {
    return null
  }
  const top = index * SPREADS_ROW_PX
  const bottom = top + SPREADS_ROW_PX
  if (top < scrollTop) {
    return top
  }
  if (bottom > scrollTop + viewportPx) {
    return Math.max(0, bottom - viewportPx)
  }
  return null
}

export type SpreadsKeyAction =
  | { kind: 'move'; delta: -1 | 1 }
  | { kind: 'add' }
  | { kind: 'duplicate' }
  | { kind: 'delete' }
  | { kind: 'none' }

export function spreadsKeyAction(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
}): SpreadsKeyAction {
  const mod = event.ctrlKey || event.metaKey
  if (mod && event.key === 'Enter') return { kind: 'add' }
  if (mod && event.key.toLowerCase() === 'd') return { kind: 'duplicate' }
  if (mod) return { kind: 'none' }
  if (event.key === 'ArrowUp') return { kind: 'move', delta: -1 }
  if (event.key === 'ArrowDown') return { kind: 'move', delta: 1 }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    return { kind: 'delete' }
  }
  return { kind: 'none' }
}

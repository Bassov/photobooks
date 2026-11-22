import { isTypingTarget } from './isTypingTarget'
import { cycleLayout, layoutCycleBlocked } from './layoutCycle'
import { getActiveSpreadId } from './photoRootSession'

/** ⇧[ previous, ⇧] next (physical brackets, D2); null for any other key. */
export function layoutCycleKeyDir(event: {
  code: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}): 1 | -1 | null {
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
    return null
  }
  if (event.code === 'BracketRight') {
    return 1
  }
  return event.code === 'BracketLeft' ? -1 : null
}

// A layer over the editor (site Preview, dialogs) or a live marquee owns the keys.
const MUTED =
  '[aria-modal="true"], .editor-shell[inert], body > [data-testid="marquee"]'

/**
 * Designer cycle-layouts: ⇧[ / ⇧] step the active spread through its layout
 * set under the pill's conditions except the room above (a hidden pill still
 * cycles); the default is prevented only when a layout was applied.
 */
export function installLayoutCycleKeys(): () => void {
  const onKey = (event: KeyboardEvent): void => {
    const dir = layoutCycleKeyDir(event)
    const spreadId = getActiveSpreadId()
    if (
      dir === null ||
      spreadId === null ||
      isTypingTarget(event.target) ||
      layoutCycleBlocked() ||
      document.querySelector(MUTED) !== null
    ) {
      return
    }
    if (cycleLayout(spreadId, dir)) {
      event.preventDefault()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => {
    window.removeEventListener('keydown', onKey)
  }
}

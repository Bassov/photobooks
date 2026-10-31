type Listener = () => void

let text = ''
const listeners = new Set<Listener>()

export const STATUS_SELECTED =
  'Photo selected to move. Activate another frame to swap or move it, or press Unplace.'

export const STATUS_FRAME_LOCKED =
  'Frame is locked. Unlock it to move, resize or rotate.'

/** Shown while a frame photo is dragged (kit uikit/src/sandbox/canvas.tsx:105). */
export const STATUS_FRAME_DRAG =
  'Drag onto another frame to swap, or onto the filmstrip to take the photo back'

/**
 * Statuses the kit StatusLine pill paints at the canvas bottom-left. Every
 * other status stays a live-region announcement only (no status chips).
 */
export function isStatusPillVisible(status: string): boolean {
  return status === STATUS_FRAME_DRAG
}

export const STATUS_SWAPPED = 'Photos swapped'

export const STATUS_MOVED = 'Photo moved'

export const STATUS_UNPLACED = 'Photo unplaced'

export function unplacedFromSpreadStatus(count: number): string {
  if (count === 1) {
    return '1 photo was unplaced from the spread'
  }
  return `${String(count)} photos were unplaced from the spread`
}

export function leftInFilmstripStatus(count: number): string {
  if (count === 1) {
    return '1 photo left in the filmstrip'
  }
  return `${String(count)} photos left in the filmstrip`
}

export function getEditorStatus(): string {
  return text
}

export function setEditorStatus(next: string): void {
  if (text === next) {
    return
  }
  text = next
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeEditorStatus(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

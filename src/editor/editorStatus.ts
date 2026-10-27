type Listener = () => void

let text = ''
const listeners = new Set<Listener>()

export const STATUS_SELECTED =
  'Photo selected to move. Activate another frame to swap or move it, or press Unplace.'

export const STATUS_SWAPPED = 'Photos swapped'

export const STATUS_MOVED = 'Photo moved'

export const STATUS_UNPLACED = 'Photo unplaced'

export const STATUS_PLACEMENT_HINT =
  'Drag a photo onto a frame, or click a photo and then a frame.'

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

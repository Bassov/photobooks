/**
 * Filmstrip grid view state: the current (roving) row, whether it holds DOM
 * focus, focus-visible, the Shift-range anchor and a pending focus for a row
 * that mounts after a scroll. Rows read one number each, so a focus move
 * re-renders two rows, not the window.
 */

type Listener = () => void

/** Row focus snapshot: tab stop, focused, focus-visible. */
export const ROW_TAB_STOP = 1
export const ROW_FOCUSED = 2
export const ROW_FOCUS_VISIBLE = 4

let current: string | null = null
let hasFocus = false
let visible = false
let anchor: string | null = null
let pending: string | null = null
const listeners = new Set<Listener>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeFilmstripFocus(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Roving row (last focused or navigated to), or `null`. */
export function getFilmstripCurrentRow(): string | null {
  return current
}

/** Bit set of `ROW_*` flags for `id`. */
export function getFilmstripRowFocus(id: string): number {
  if (id !== current) {
    return 0
  }
  if (!hasFocus) {
    return ROW_TAB_STOP
  }
  return ROW_TAB_STOP | ROW_FOCUSED | (visible ? ROW_FOCUS_VISIBLE : 0)
}

/** `id` gained DOM focus (`focusVisible` per `:focus-visible`). */
export function noteFilmstripRowFocus(id: string, focusVisible: boolean): void {
  if (current === id && hasFocus && visible === focusVisible) {
    return
  }
  current = id
  hasFocus = true
  visible = focusVisible
  emit()
}

/** `id` lost DOM focus; it stays the roving row. */
export function noteFilmstripRowBlur(id: string): void {
  if (current !== id || !hasFocus) {
    return
  }
  hasFocus = false
  visible = false
  emit()
}

export function getFilmstripAnchor(): string | null {
  return anchor
}

export function setFilmstripAnchor(id: string | null): void {
  anchor = id
}

/** Focus `id` once its row mounts (keyboard move past the window). */
export function requestFilmstripRowFocus(id: string): void {
  pending = id
}

/** True once for the row that should take a pending focus. */
export function takeFilmstripPendingFocus(id: string): boolean {
  if (pending !== id) {
    return false
  }
  pending = null
  return true
}

export function resetFilmstripGridFocus(): void {
  current = null
  hasFocus = false
  visible = false
  anchor = null
  pending = null
  emit()
}

/**
 * Filmstrip selection rules (react-aria `replace` behaviour, minus its
 * per-row hooks): pure, over the view order.
 */

/** Selection inputs: view order, current ids and the Shift-range anchor. */
export interface FilmstripSelectionInput {
  order: readonly string[]
  selected: readonly string[]
  anchor: string | null
}

/** Next selection, its primary (the photo just picked) and the anchor. */
export interface FilmstripPick {
  ids: readonly string[]
  primary: string | null
  anchor: string | null
}

export interface FilmstripPickModifiers {
  /** Shift: range from the anchor. */
  shift: boolean
  /** Ctrl / Meta: toggle (click) or move focus only (keys). */
  toggle: boolean
}

export type FilmstripNavKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'

const NAV_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
])

export function isFilmstripNavKey(key: string): key is FilmstripNavKey {
  return NAV_KEYS.has(key)
}

/** Click (or Shift / Ctrl / Meta click) on `id`. */
export function pickFilmstripItem(
  input: FilmstripSelectionInput,
  id: string,
  modifiers: FilmstripPickModifiers,
): FilmstripPick {
  const from = input.anchor === null ? -1 : input.order.indexOf(input.anchor)
  const to = input.order.indexOf(id)
  if (modifiers.shift && from >= 0 && to >= 0) {
    return {
      ids: input.order.slice(Math.min(from, to), Math.max(from, to) + 1),
      primary: id,
      anchor: input.anchor,
    }
  }
  if (!modifiers.toggle) {
    return { ids: [id], primary: id, anchor: id }
  }
  if (input.selected.includes(id)) {
    const ids = input.selected.filter((other) => other !== id)
    return { ids, primary: ids[ids.length - 1] ?? null, anchor: id }
  }
  return { ids: [...input.selected, id], primary: id, anchor: id }
}

/** Ctrl / Meta+A: every photo in the view. */
export function selectAllFilmstrip(
  input: FilmstripSelectionInput,
): FilmstripPick {
  return {
    ids: input.order,
    primary: input.order[input.order.length - 1] ?? null,
    anchor: input.anchor,
  }
}

/** Row a navigation key moves focus to; `null` for an empty view. */
export function filmstripNavTarget(
  order: readonly string[],
  current: string | null,
  key: FilmstripNavKey,
): string | null {
  const last = order.length - 1
  if (key === 'Home') {
    return order[0] ?? null
  }
  if (key === 'End') {
    return order[last] ?? null
  }
  // No focused row (-1): either arrow lands on the first row.
  const at = current === null ? -1 : order.indexOf(current)
  const step = key === 'ArrowRight' ? 1 : -1
  return order[Math.min(Math.max(at + step, 0), last)] ?? null
}

/**
 * Navigation key from the focused row: focus moves, and the selection
 * follows it (Shift extends from the anchor; Ctrl / Meta leaves it).
 */
export function navigateFilmstrip(
  input: FilmstripSelectionInput,
  current: string | null,
  key: FilmstripNavKey,
  modifiers: FilmstripPickModifiers,
): { focus: string; pick: FilmstripPick | null } | null {
  const focus = filmstripNavTarget(input.order, current, key)
  if (focus === null) {
    return null
  }
  if (modifiers.toggle) {
    return { focus, pick: null }
  }
  const anchor = input.anchor ?? current
  return {
    focus,
    pick: pickFilmstripItem({ ...input, anchor }, focus, {
      shift: modifiers.shift,
      toggle: false,
    }),
  }
}

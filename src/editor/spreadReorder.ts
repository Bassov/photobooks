export const SPREAD_DRAG_MIME = 'application/x-photobooks-spread'

/** Vertical gap between list items (`mb-1`); item pitch = height + gap. */
export const SPREAD_ITEM_GAP_PX = 4

export interface ItemSpan {
  /** Offset from the top of the list content (scroll-independent). */
  top: number
  height: number
}

/** Pointer Y in list content coordinates (viewport Y minus list top plus scroll). */
export function contentY(
  clientY: number,
  listTop: number,
  scrollTop: number,
): number {
  return clientY - listTop + scrollTop
}

/**
 * Final index of the dragged item if dropped at `y`: the number of other
 * items whose midpoint lies above the pointer.
 */
export function reorderTargetIndex(
  spans: readonly ItemSpan[],
  fromIndex: number,
  y: number,
): number {
  let target = 0
  for (const [i, span] of spans.entries()) {
    if (i !== fromIndex && span.top + span.height / 2 < y) {
      target += 1
    }
  }
  return target
}

/** Vertical shift (px) for item `index` while `fromIndex` is dragged to `toIndex`. */
export function reorderShift(
  spans: readonly ItemSpan[],
  fromIndex: number,
  toIndex: number,
  index: number,
): number {
  const step = spans[fromIndex]?.height ?? 0
  if (index > fromIndex && index <= toIndex) {
    return -step
  }
  if (index < fromIndex && index >= toIndex) {
    return step
  }
  return 0
}

/** Content Y of the insertion line for a drag from `fromIndex` to `toIndex`. */
export function dropLineY(
  spans: readonly ItemSpan[],
  fromIndex: number,
  toIndex: number,
): number | null {
  const slot = spans[toIndex]
  if (slot === undefined || toIndex === fromIndex) {
    return null
  }
  return toIndex < fromIndex ? slot.top : slot.top + slot.height
}

/** Index to move to for Alt+↑/↓, or null when the key is not a valid move. */
export function altArrowTarget(
  key: string,
  altKey: boolean,
  index: number,
  count: number,
): number | null {
  if (!altKey) {
    return null
  }
  const to =
    key === 'ArrowUp' ? index - 1 : key === 'ArrowDown' ? index + 1 : -1
  return to >= 0 && to < count ? to : null
}

/** Arrow nudge in pinned crop (screen px); Shift multiplies it. */
const CROP_NUDGE_PX = 1
const CROP_NUDGE_SHIFT_FACTOR = 10

export type PinnedCropKey =
  | { kind: 'exit' }
  | { kind: 'tab'; back: boolean }
  | { kind: 'nudge'; dx: number; dy: number }

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/**
 * Walkthrough-ux-review §A, pinned crop: Esc exits, Tab / Shift+Tab cycle the
 * photo handles, arrows nudge the photo (screen px, Shift ×10). Modified keys
 * (Ctrl / Meta / Alt) belong to the editor shortcuts.
 */
export function pinnedCropKey(event: {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}): PinnedCropKey | null {
  if (event.key === 'Escape') {
    return { kind: 'exit' }
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null
  }
  if (event.key === 'Tab') {
    return { kind: 'tab', back: event.shiftKey }
  }
  const arrow = ARROWS[event.key]
  if (arrow === undefined) {
    return null
  }
  const step = CROP_NUDGE_PX * (event.shiftKey ? CROP_NUDGE_SHIFT_FACTOR : 1)
  return { kind: 'nudge', dx: arrow[0] * step, dy: arrow[1] * step }
}

/**
 * Next index when Tab cycles `count` handles from `current` (−1: none has
 * focus, so Tab starts at the first and Shift+Tab at the last).
 */
export function cycledIndex(
  current: number,
  count: number,
  back: boolean,
): number {
  if (current < 0) {
    return back ? count - 1 : 0
  }
  return (current + (back ? count - 1 : 1)) % count
}

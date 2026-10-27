import { clamp } from '../lib/clamp'

const SWIPE_MIN_PX = 60

/** Move by `delta` spreads; stays inside `[0, count - 1]` (no wrap). */
export function stepIndex(index: number, delta: number, count: number): number {
  if (count <= 0) {
    return 0
  }
  return clamp(index + delta, 0, count - 1)
}

/** Click on the right half goes forward, left half back. */
export function halfDelta(
  clientX: number,
  left: number,
  width: number,
): 1 | -1 {
  return clientX - left > width / 2 ? 1 : -1
}

/** Swipe left (finger moves left) goes forward; short moves are ignored. */
export function swipeDelta(startX: number, endX: number): 1 | -1 | 0 {
  const dx = endX - startX
  if (Math.abs(dx) <= SWIPE_MIN_PX) {
    return 0
  }
  return dx < 0 ? 1 : -1
}

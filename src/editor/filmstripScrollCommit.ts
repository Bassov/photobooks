import { indexFromScrollOffset } from './thumbSlotSize'

/**
 * True when a pending scrollLeft moves the virtualizer window start index.
 * Used to skip React setState when native scroll stays inside the same window.
 */
export function shouldCommitFilmstripScroll(
  nextLeft: number,
  prefix: readonly number[],
  committedWindowStart: number,
): boolean {
  return indexFromScrollOffset(nextLeft, prefix) !== committedWindowStart
}

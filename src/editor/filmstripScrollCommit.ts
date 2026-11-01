import type {
  FilmstripIndexRange,
  FilmstripScrollDirection,
} from './thumbSlotSize'

/**
 * True when a pending scroll moves the virtualizer window.
 * Used to skip React setState when native scroll stays inside the same window.
 */
export function shouldCommitFilmstripScroll(
  next: FilmstripIndexRange,
  committed: FilmstripIndexRange,
): boolean {
  return next.start !== committed.start || next.end !== committed.end
}

/** Direction of the latest scroll step; an unchanged offset keeps `previous`. */
export function filmstripScrollDirection(
  nextLeft: number,
  previousLeft: number,
  previous: FilmstripScrollDirection,
): FilmstripScrollDirection {
  if (nextLeft > previousLeft) {
    return 1
  }
  if (nextLeft < previousLeft) {
    return -1
  }
  return previous
}

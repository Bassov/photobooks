import {
  filmstripScrollQuietRemainingMs,
  isFilmstripScrollQuiet,
} from './filmstripScrollQuiet'
import { getFilmstripWindow, setFilmstripWindow } from './filmstripWindow'

/** Now-set publish interval while the filmstrip scrolls. */
export const VISIBLE_SYNC_THROTTLE_MS = 100
/** How far ahead (in time) a running scroll extends the published window. */
const VELOCITY_LOOKAHEAD_MS = 200

/** Mounted window position inside the filmstrip view order. */
export interface FilmstripWindowFrame {
  order: readonly string[]
  start: number
}

let lastPublishMs = Number.NEGATIVE_INFINITY
let lastSample: { order: readonly string[]; start: number; at: number } | null =
  null

/** Signed window velocity in items per ms since the previous frame. */
function sampleVelocity(frame: FilmstripWindowFrame, at: number): number {
  const previous = lastSample
  lastSample = { order: frame.order, start: frame.start, at }
  if (previous?.order !== frame.order) {
    return 0
  }
  return (frame.start - previous.start) / Math.max(1, at - previous.at)
}

/**
 * Window ids extended in the scroll direction by velocity × look-ahead,
 * capped at one window length.
 */
export function extendWindowIds(
  ids: readonly string[],
  frame: FilmstripWindowFrame,
  velocity: number,
): readonly string[] {
  const extra = Math.min(
    ids.length,
    Math.ceil(Math.abs(velocity) * VELOCITY_LOOKAHEAD_MS),
  )
  if (extra === 0) {
    return ids
  }
  if (velocity > 0) {
    const end = frame.start + ids.length
    return [...ids, ...frame.order.slice(end, end + extra)]
  }
  return [
    ...frame.order.slice(Math.max(0, frame.start - extra), frame.start),
    ...ids,
  ]
}

function publishWindow(
  ids: readonly string[],
  frame: FilmstripWindowFrame,
  velocity: number,
): void {
  const direction =
    velocity > 0 ? 1 : velocity < 0 ? -1 : getFilmstripWindow().direction
  setFilmstripWindow({
    order: frame.order,
    start: frame.start,
    end: frame.start + ids.length,
    direction,
  })
}

/**
 * Publish filmstrip-visible asset ids. While the strip scrolls, publish at
 * most every 100 ms with the window extended in the scroll direction, then
 * the exact window once scroll quiet ends.
 */
export function scheduleFilmstripVisibleSync(
  ids: readonly string[],
  setVisible: (ids: readonly string[]) => void,
  frame?: FilmstripWindowFrame,
): () => void {
  const now = performance.now()
  const velocity = frame === undefined ? 0 : sampleVelocity(frame, now)
  if (frame !== undefined) {
    publishWindow(ids, frame, velocity)
  }
  const publish = (next: readonly string[]): void => {
    lastPublishMs = performance.now()
    setVisible(next)
  }
  if (!isFilmstripScrollQuiet()) {
    publish(ids)
    return () => {
      // No timer to clear.
    }
  }
  const settleMs = filmstripScrollQuietRemainingMs()
  const throttleMs = Math.max(0, lastPublishMs + VISIBLE_SYNC_THROTTLE_MS - now)
  const settle = setTimeout(() => {
    publish(ids)
  }, settleMs)
  // The exact window lands first anyway: no extended publish after it.
  if (throttleMs >= settleMs) {
    return () => {
      clearTimeout(settle)
    }
  }
  const ahead =
    frame === undefined ? ids : extendWindowIds(ids, frame, velocity)
  const throttle = setTimeout(() => {
    publish(ahead)
  }, throttleMs)
  return () => {
    clearTimeout(throttle)
    clearTimeout(settle)
  }
}

export function resetFilmstripVisibleSyncForTests(): void {
  lastPublishMs = Number.NEGATIVE_INFINITY
  lastSample = null
}

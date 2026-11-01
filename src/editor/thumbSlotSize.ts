import { clamp } from '../lib/clamp'

export const THUMB_HEIGHT = 96
const THUMB_GAP = 8
/** Default landscape width before aspect is known (legacy 3:2 at THUMB_HEIGHT). */
export const THUMB_WIDTH_DEFAULT = 144
export const THUMB_WIDTH_MIN = 48
export const THUMB_WIDTH_MAX = 288

export interface ThumbSlotSize {
  width: number
  height: number
}

/**
 * Width / height ratio of a filmstrip slot: the aspect clamped to the slot
 * width bounds (scale-free, so CSS can size the slot from the height alone).
 */
export function thumbSlotAspect(aspect: number): number {
  const safe = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  return clamp(
    safe,
    THUMB_WIDTH_MIN / THUMB_HEIGHT,
    THUMB_WIDTH_MAX / THUMB_HEIGHT,
  )
}

/** Fixed-height filmstrip slot; width follows clamped aspect. */
export function thumbSlotSize(
  aspect: number,
  height = THUMB_HEIGHT,
): ThumbSlotSize {
  const safe = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const scale = height / THUMB_HEIGHT
  const width = Math.round(
    clamp(height * safe, THUMB_WIDTH_MIN * scale, THUMB_WIDTH_MAX * scale),
  )
  return { width, height }
}

/** Widest possible slot at `height` (window overscan sizing). */
export function thumbWidthMax(height = THUMB_HEIGHT): number {
  return Math.round((THUMB_WIDTH_MAX * height) / THUMB_HEIGHT)
}

export function thumbStride(aspect: number, height = THUMB_HEIGHT): number {
  return thumbSlotSize(aspect, height).width + THUMB_GAP
}

/** Inclusive prefix sums of item strides (length = aspects.length + 1, [0]=0). */
export function buildStridePrefix(
  aspects: readonly number[],
  height = THUMB_HEIGHT,
): readonly number[] {
  const prefix = new Array<number>(aspects.length + 1)
  prefix[0] = 0
  for (let i = 0; i < aspects.length; i += 1) {
    const prev = prefix[i]
    const aspect = aspects[i]
    if (prev === undefined || aspect === undefined) {
      continue
    }
    prefix[i + 1] = prev + thumbStride(aspect, height)
  }
  return prefix
}

/**
 * Left origin of each item when packed by actual card width + gap
 * (not a fixed max-width stride).
 */
export function itemOriginOffsets(
  aspects: readonly number[],
): readonly number[] {
  const prefix = buildStridePrefix(aspects)
  return prefix.slice(0, -1)
}

/** Largest index whose prefix offset is ≤ scrollLeft (with overscan pull-back). */
export function indexFromScrollOffset(
  scrollLeft: number,
  prefix: readonly number[],
  overscan = 4,
): number {
  if (prefix.length <= 1) {
    return 0
  }
  const maxIndex = prefix.length - 2
  let lo = 0
  let hi = maxIndex
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    const at = prefix[mid]
    if (at === undefined || at <= scrollLeft) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return Math.max(0, lo - overscan)
}

/**
 * How many items from `start` are needed so their packed width covers `coverPx`.
 * Fixed WINDOW_SIZE left a viewport hole for narrow (portrait) cards.
 */
export function windowCountForCover(
  prefix: readonly number[],
  start: number,
  coverPx: number,
): number {
  const itemCount = prefix.length - 1
  if (itemCount <= 0 || start >= itemCount) {
    return 0
  }
  const origin = prefix[start] ?? 0
  const target = origin + Math.max(coverPx, 0)
  let end = start + 1
  while (end < itemCount && (prefix[end] ?? 0) < target) {
    end += 1
  }
  return end - start
}

/** Filmstrip scroll direction: 1 toward the end, -1 toward the start. */
export type FilmstripScrollDirection = 1 | -1

/** Half-open item index range `[start, end)`. */
export interface FilmstripIndexRange {
  start: number
  end: number
}

/** Slots kept mounted behind the scroll direction. */
const WINDOW_BEHIND_SLOTS = 2

/** Items that intersect the scrollport `[scrollLeft, scrollLeft + viewportWidth)`. */
export function scrollportIndexRange(
  prefix: readonly number[],
  scrollLeft: number,
  viewportWidth: number,
): FilmstripIndexRange {
  if (prefix.length <= 1) {
    return { start: 0, end: 0 }
  }
  const lastPx = scrollLeft + Math.max(viewportWidth, 1) - 1
  return {
    start: indexFromScrollOffset(scrollLeft, prefix, 0),
    end: indexFromScrollOffset(lastPx, prefix, 0) + 1,
  }
}

/**
 * Mounted filmstrip window: the scrollport plus `aheadPx` in the scroll
 * direction (so `<img>` decode starts before a tile enters the view) and
 * WINDOW_BEHIND_SLOTS slots behind it.
 */
export function filmstripWindowRange(
  prefix: readonly number[],
  scrollLeft: number,
  viewportWidth: number,
  direction: FilmstripScrollDirection,
  aheadPx: number,
): FilmstripIndexRange {
  const view = scrollportIndexRange(prefix, scrollLeft, viewportWidth)
  const count = prefix.length - 1
  if (count <= 0) {
    return view
  }
  if (direction === 1) {
    const aheadPxEnd = scrollLeft + Math.max(viewportWidth, 1) + aheadPx
    return {
      start: Math.max(0, view.start - WINDOW_BEHIND_SLOTS),
      end: indexFromScrollOffset(aheadPxEnd, prefix, 0) + 1,
    }
  }
  return {
    start: indexFromScrollOffset(scrollLeft - aheadPx, prefix, 0),
    end: Math.min(count, view.end + WINDOW_BEHIND_SLOTS),
  }
}

export function spacerWidthPx(
  aspects: readonly number[],
  reservedCount: number,
  defaultAspect = 1,
  height = THUMB_HEIGHT,
): number {
  const count = Math.max(aspects.length, reservedCount)
  if (count === 0) {
    return 0
  }
  let total = 0
  for (let i = 0; i < count; i += 1) {
    total += thumbStride(aspects[i] ?? defaultAspect, height)
  }
  return total
}

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

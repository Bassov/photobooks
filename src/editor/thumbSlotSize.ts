import { clamp } from '../lib/clamp'

export const THUMB_HEIGHT = 96
export const THUMB_GAP = 8
/** Default landscape width before aspect is known (legacy 3:2 at THUMB_HEIGHT). */
export const THUMB_WIDTH_DEFAULT = 144
export const THUMB_WIDTH_MIN = 48
export const THUMB_WIDTH_MAX = 288

export interface ThumbSlotSize {
  width: number
  height: number
}

/** Fixed-height filmstrip slot; width follows clamped aspect. */
export function thumbSlotSize(aspect: number): ThumbSlotSize {
  const safe = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const width = Math.round(
    clamp(THUMB_HEIGHT * safe, THUMB_WIDTH_MIN, THUMB_WIDTH_MAX),
  )
  return { width, height: THUMB_HEIGHT }
}

export function thumbStride(aspect: number): number {
  return thumbSlotSize(aspect).width + THUMB_GAP
}

/** Inclusive prefix sums of item strides (length = aspects.length + 1, [0]=0). */
export function buildStridePrefix(
  aspects: readonly number[],
): readonly number[] {
  const prefix = new Array<number>(aspects.length + 1)
  prefix[0] = 0
  for (let i = 0; i < aspects.length; i += 1) {
    const prev = prefix[i]
    const aspect = aspects[i]
    if (prev === undefined || aspect === undefined) {
      continue
    }
    prefix[i + 1] = prev + thumbStride(aspect)
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

export function spacerWidthPx(
  aspects: readonly number[],
  reservedCount: number,
  defaultAspect = 1,
): number {
  const count = Math.max(aspects.length, reservedCount, 1)
  let total = 0
  for (let i = 0; i < count; i += 1) {
    total += thumbStride(aspects[i] ?? defaultAspect)
  }
  return total
}

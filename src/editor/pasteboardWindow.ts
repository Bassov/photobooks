import { clamp } from '../lib/clamp'

export const PASTEBOARD_GAP_PX = 24

/** Subpixel clipping must not steal "active" from the spread above. */
const ACTIVE_RATIO_EPSILON = 0.02

export function pickActiveSpread(
  entries: readonly { id: string; ratio: number; index: number }[],
): string | null {
  let bestId: string | null = null
  let bestRatio = -1
  let bestIndex = Number.POSITIVE_INFINITY
  for (const entry of entries) {
    const nearlyTied = Math.abs(entry.ratio - bestRatio) <= ACTIVE_RATIO_EPSILON
    if (
      entry.ratio > bestRatio + ACTIVE_RATIO_EPSILON ||
      (nearlyTied && entry.index < bestIndex)
    ) {
      bestId = entry.id
      bestRatio = entry.ratio
      bestIndex = entry.index
    }
  }
  if (bestId === null || bestRatio <= 0) {
    return null
  }
  return bestId
}

export interface PasteboardWindow {
  readonly start: number
  readonly end: number
  readonly leadPx: number
  readonly tailPx: number
}

export function pasteboardStridePx(spreadHeightPx: number): number {
  if (!Number.isFinite(spreadHeightPx) || spreadHeightPx < 0) {
    return PASTEBOARD_GAP_PX
  }
  return spreadHeightPx + PASTEBOARD_GAP_PX
}

export function pasteboardWindow(input: {
  count: number
  stridePx: number
  scrollTop: number
  viewportPx: number
  overscanPx: number
}): PasteboardWindow {
  const count = Number.isFinite(input.count)
    ? Math.max(0, Math.floor(input.count))
    : 0
  const stride = input.stridePx
  if (count === 0 || !Number.isFinite(stride) || stride <= 0) {
    return { start: 0, end: 0, leadPx: 0, tailPx: 0 }
  }

  const total = count * stride
  const scrollTop = clamp(finiteOrZero(input.scrollTop), 0, total)
  const viewport = Math.max(0, finiteOrZero(input.viewportPx))
  const overscan = Math.max(0, finiteOrZero(input.overscanPx))
  const from = Math.max(0, scrollTop - overscan)
  const to = Math.min(total, scrollTop + viewport + overscan)
  let start = Math.floor(from / stride)
  let end = Math.ceil(to / stride)
  if (end <= start) {
    end = Math.min(count, start + 1)
  }
  start = Math.min(start, count)
  end = Math.min(Math.max(end, start), count)
  return {
    start,
    end,
    leadPx: start * stride,
    tailPx: (count - end) * stride,
  }
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

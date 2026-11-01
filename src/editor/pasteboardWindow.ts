import { clamp } from '../lib/clamp'

/**
 * Stack gap as a share of the spread height: 104 px under a 588 px spread
 * (wider than the kit's 44 / 588 so the page numbers and the new-spread pill
 * have room; Owner design change, design-r7-spreads M49). The gap scales with
 * zoom, so it looks the same relative to the pages at every zoom.
 */
export const STACK_GAP_RATIO = 104 / 588

/** Subpixel clipping must not steal "active" from the spread above. */
const ACTIVE_RATIO_EPSILON = 0.02

/**
 * Most visible spread; ties go to the lower index. The `current` active spread
 * keeps the mark while it is still tied for most visible: at a small Fit
 * several spreads are whole on screen, and a resize must not hand the mark
 * (and the refit centre) to the first of them.
 */
export function pickActiveSpread(
  entries: readonly { id: string; ratio: number; index: number }[],
  current: string | null = null,
): string | null {
  const best = mostVisibleSpread(entries)
  if (best === null) {
    return null
  }
  const kept = entries.find((entry) => entry.id === current)
  if (kept !== undefined && kept.ratio >= best.ratio - ACTIVE_RATIO_EPSILON) {
    return kept.id
  }
  return best.id
}

function mostVisibleSpread(
  entries: readonly { id: string; ratio: number; index: number }[],
): { id: string; ratio: number } | null {
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
  return { id: bestId, ratio: bestRatio }
}

export interface PasteboardWindow {
  readonly start: number
  readonly end: number
  readonly leadPx: number
  readonly tailPx: number
}

/**
 * Smallest spread height of the zoomed-out stack: a book too long to fit the
 * port stops here and scrolls.
 */
export const STACK_MIN_SPREAD_PX = 16

/** Gap under a spread `spreadHeightPx` tall; 0 without a spread. */
export function pasteboardGapPx(spreadHeightPx: number): number {
  if (!Number.isFinite(spreadHeightPx) || spreadHeightPx <= 0) {
    return 0
  }
  return spreadHeightPx * STACK_GAP_RATIO
}

export function pasteboardStridePx(spreadHeightPx: number): number {
  const gap = pasteboardGapPx(spreadHeightPx)
  return gap > 0 ? spreadHeightPx + gap : 0
}

/**
 * Overscan of the mounted window: one stride, or the whole stack once the
 * spreads are at the zoom-out floor (the whole-book overview mounts every
 * spread even when the stack is taller than the port).
 */
export function pasteboardOverscanPx(
  count: number,
  spreadHeightPx: number,
): number {
  const stride = pasteboardStridePx(spreadHeightPx)
  if (spreadHeightPx > 0 && spreadHeightPx <= STACK_MIN_SPREAD_PX + 0.5) {
    return Math.max(0, count) * stride
  }
  return stride
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
  return pasteboardWindowExtents(start, end, count, stride)
}

/** Max newly mounted spreads per paced expand step. */
export const PASTEBOARD_MAX_NEW_MOUNTS_PER_FRAME = 1

/**
 * One paced step from `current` toward `target`. Prefers filling
 * `viewportCover` before overscan fringe. Drops indices outside `target`
 * immediately; if there is no overlap, starts empty at `target.start`.
 */
export function pacePasteboardWindow(input: {
  current: PasteboardWindow
  target: PasteboardWindow
  viewportCover: PasteboardWindow
  maxNewMounts: number
  count: number
  stridePx: number
}): PasteboardWindow {
  const count = Number.isFinite(input.count)
    ? Math.max(0, Math.floor(input.count))
    : 0
  const stride = input.stridePx
  if (count === 0 || !Number.isFinite(stride) || stride <= 0) {
    return { start: 0, end: 0, leadPx: 0, tailPx: 0 }
  }

  const target = clampWindow(input.target, count)
  const current = clampWindow(input.current, count)
  const cover = clampWindow(input.viewportCover, count)

  let start: number
  let end: number
  if (current.end <= target.start || current.start >= target.end) {
    // No overlap with the new target window — start empty at the target edge.
    start = target.start
    end = target.start
  } else {
    // Drop indices that left the target; keep the overlap (cheap unmounts).
    start = Math.max(current.start, target.start)
    end = Math.min(current.end, target.end)
  }

  const maxNew = Number.isFinite(input.maxNewMounts)
    ? Math.max(0, Math.floor(input.maxNewMounts))
    : 0
  let budget = maxNew
  while (budget > 0 && (start > target.start || end < target.end)) {
    const coverBefore = Math.max(0, start - Math.max(cover.start, target.start))
    const coverAfter = Math.max(0, Math.min(cover.end, target.end) - end)
    const targetBefore = start - target.start
    const targetAfter = target.end - end
    if (coverBefore > 0 || coverAfter > 0) {
      if (coverBefore >= coverAfter) {
        start -= 1
      } else {
        end += 1
      }
    } else if (targetBefore >= targetAfter) {
      start -= 1
    } else {
      end += 1
    }
    budget -= 1
  }

  return pasteboardWindowExtents(start, end, count, stride)
}

export function pasteboardWindowsEqual(
  a: PasteboardWindow,
  b: PasteboardWindow,
): boolean {
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.leadPx === b.leadPx &&
    a.tailPx === b.tailPx
  )
}

/**
 * Expand `next` to include `forceIdx` when that index lies inside `target`.
 * Used so add-spread reveal mounts the new slot before paced overscan catches up.
 */
export function applyForceMountIndex(input: {
  next: PasteboardWindow
  forceIdx: number | null
  target: PasteboardWindow
  count: number
  stridePx: number
}): PasteboardWindow {
  const { forceIdx, target, count, stridePx } = input
  if (forceIdx === null || forceIdx < target.start || forceIdx >= target.end) {
    return input.next
  }
  const start = Math.min(input.next.start, forceIdx)
  const end = Math.max(input.next.end, forceIdx + 1)
  return pasteboardWindowExtents(start, end, count, stridePx)
}

/** Clear the force index once it is inside the mounted window. */
export function clearForceMountIndex(
  forceIdx: number | null,
  next: PasteboardWindow,
): number | null {
  if (forceIdx !== null && forceIdx >= next.start && forceIdx < next.end) {
    return null
  }
  return forceIdx
}

function pasteboardWindowExtents(
  start: number,
  end: number,
  count: number,
  stridePx: number,
): PasteboardWindow {
  return {
    start,
    end,
    leadPx: start * stridePx,
    tailPx: (count - end) * stridePx,
  }
}

function clampWindow(
  window: PasteboardWindow,
  count: number,
): PasteboardWindow {
  let start = Number.isFinite(window.start) ? Math.floor(window.start) : 0
  let end = Number.isFinite(window.end) ? Math.floor(window.end) : 0
  start = Math.min(Math.max(0, start), count)
  end = Math.min(Math.max(start, end), count)
  return { start, end, leadPx: window.leadPx, tailPx: window.tailPx }
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

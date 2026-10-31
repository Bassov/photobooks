import { SPREAD_PX_PER_MM } from '../render/frameBox'
import {
  PASTEBOARD_GAP_PX,
  PASTEBOARD_GAP_RATIO,
  pasteboardGapPx,
  pasteboardStridePx,
} from './pasteboardWindow'

export function resolveTrackedScrollTop(
  tracked: { top: number; epoch: number },
  camera: { scrollTop: number; epoch: number },
): number {
  return tracked.epoch >= camera.epoch ? tracked.top : camera.scrollTop
}

export function nextTrackedScroll(
  current: { top: number; epoch: number },
  top: number,
  epoch: number,
): { top: number; epoch: number } {
  return current.top === top && current.epoch === epoch
    ? current
    : { top, epoch }
}

export function nextViewportSize(
  current: { width: number; height: number },
  width: number,
  height: number,
): { width: number; height: number } {
  return current.width === width && current.height === height
    ? current
    : { width, height }
}

export function selectMarkedSpreadId(
  activeId: string | null,
  mounted: readonly string[],
): string | undefined {
  return activeId !== null && mounted.includes(activeId) ? activeId : mounted[0]
}

/**
 * Keep a just-added spread marked while the pin is held.
 * IntersectionObserver ratios must not clear the pin (slots often report 0
 * before enter). Pasteboard clears the pin on user scroll after reveal hold.
 * `null` clears both fields (same object shape as a held pin).
 */
export function resolvePreferredActiveId(preferredId: string | null): {
  activeId: string | null
  preferredId: string | null
} {
  return { activeId: preferredId, preferredId }
}

export function spreadActiveIndex(
  markedId: string | undefined,
  spreadIds: readonly string[],
): number {
  if (markedId === undefined) {
    return 0
  }
  const index = spreadIds.indexOf(markedId)
  return index < 0 ? 0 : index
}

export function widestPageCount(spreadCount: number): number {
  return spreadCount >= 2 ? 2 : 1
}

/**
 * Constant empty margin around the spread stack inside the scroll world.
 * Larger than any viewport so zoom/pan never hits a scroll clamp and the
 * anchor math stays linear in content space (kit camera has no clamp).
 */
export const PASTEBOARD_PAD_PX = 2400

/** Scroll offset into the stack (negative before the first slot is reached). */
export function stackScrollTop(scrollTop: number): number {
  return Math.max(0, scrollTop - PASTEBOARD_PAD_PX)
}

export function pasteboardWorldWidthPx(input: {
  viewportWidth: number
  trimWidthMm: number
  spreadCount: number
  pxPerMm: number
}): number {
  const widest = widestPageCount(input.spreadCount)
  const stackWidth = input.trimWidthMm * widest * input.pxPerMm
  return Math.max(input.viewportWidth, stackWidth)
}

/** Kit `stackGap`: the spread scales with zoom, the gap stays 44 screen px. */
export function pasteboardStrideAtZoom(
  trimHeightMm: number,
  zoom: number,
): number {
  return pasteboardStridePx(trimHeightMm * SPREAD_PX_PER_MM * zoom)
}

export function pasteboardSlotPaddingBottom(
  trimHeightMm: number,
  zoom: number,
): number {
  return pasteboardGapPx(trimHeightMm * SPREAD_PX_PER_MM * zoom)
}

/**
 * Stack y (px below the first spread's top) at zoom `to` of the point at `y`
 * at zoom `from`: a point on a spread keeps its place on that spread, a point
 * in a gap keeps its share of the gap. Above the stack it scales.
 */
export function stackContentYAtZoom(
  y: number,
  spreadHeightPx: number,
  from: number,
  to: number,
): number {
  const scale = to / from
  const fromSpread = spreadHeightPx * from
  const fromGap = pasteboardGapPx(fromSpread)
  const stride = fromSpread + fromGap
  if (!(y > 0) || !(fromSpread > 0) || !Number.isFinite(scale)) {
    return y * scale
  }
  const toSpread = spreadHeightPx * to
  const toGap = pasteboardGapPx(toSpread)
  const index = Math.floor(y / stride)
  const local = y - index * stride
  const onSpread = Math.min(local, fromSpread)
  return (
    index * (toSpread + toGap) +
    onSpread * scale +
    ((local - onSpread) * toGap) / fromGap
  )
}

/**
 * Largest zoom at which `count` spreads (`spreadHeightPx` tall at zoom 1)
 * and their gaps fit `viewportPx`; Infinity when there is nothing to fit.
 */
export function stackHeightFitZoom(
  count: number,
  spreadHeightPx: number,
  viewportPx: number,
): number {
  if (!(count > 0) || !(spreadHeightPx > 0) || !(viewportPx > 0)) {
    return Number.POSITIVE_INFINITY
  }
  const perSpread = viewportPx / count
  // Small spreads: the gap is a share of the spread, the stride is linear.
  const linear = perSpread / (spreadHeightPx * (1 + PASTEBOARD_GAP_RATIO))
  if (spreadHeightPx * linear * PASTEBOARD_GAP_RATIO <= PASTEBOARD_GAP_PX) {
    return linear
  }
  return (perSpread - PASTEBOARD_GAP_PX) / spreadHeightPx
}

export function pasteboardWindowKey(mountedIds: readonly string[]): string {
  return mountedIds.join('\0')
}

/** Parse an IntersectionObserver entry for pasteboard slot activation. */
export function readPasteboardSlotEntry(entry: {
  target: EventTarget | null
  intersectionRatio: number
}): { id: string; ratio: number; index: number } | null {
  if (!(entry.target instanceof HTMLElement)) {
    return null
  }
  const id = entry.target.dataset.spreadId
  const index = Number(entry.target.dataset.slotIndex)
  if (id === undefined || !Number.isFinite(index)) {
    return null
  }
  return { id, ratio: entry.intersectionRatio, index }
}

export function cancelPendingScrollFrame(frameId: number): number {
  if (frameId !== 0) {
    cancelAnimationFrame(frameId)
  }
  return 0
}

export function shouldRenderSpacer(extentPx: number): boolean {
  return extentPx > 0
}

/** Bind gallery drop when the scrollport ref has mounted. */
export function bindGalleryDrop(
  scroll: HTMLElement | null,
  install: (scroll: HTMLElement) => () => void,
): (() => void) | undefined {
  if (scroll === null) {
    return undefined
  }
  return install(scroll)
}

/**
 * Spread id for a pointer-down on the pasteboard background: the slot under the
 * target, else the slot whose row contains `clientY` (the gray beside a spread).
 * Controls (frames, gap, labels) keep their own behavior: `null`.
 */
export function pasteboardClickSpreadId(
  target: Element,
  clientY: number,
  slots: readonly Element[],
): string | null {
  if (target.closest('button, a, input, textarea, [role="button"]') !== null) {
    return null
  }
  const own = target.closest('[data-pasteboard-slot]')
  if (own !== null) {
    return own.getAttribute('data-spread-id')
  }
  for (const slot of slots) {
    const rect = slot.getBoundingClientRect()
    if (clientY >= rect.top && clientY < rect.bottom) {
      return slot.getAttribute('data-spread-id')
    }
  }
  return null
}

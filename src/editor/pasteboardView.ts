import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { PASTEBOARD_GAP_PX, pasteboardStridePx } from './pasteboardWindow'

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

/** Keep a just-added spread marked while its intersection ratio stays positive. */
export function resolvePreferredActiveId(
  preferredId: string | null,
  ratios: ReadonlyMap<string, number>,
): { activeId: string | null; preferredId: string | null } {
  if (preferredId === null) {
    return { activeId: null, preferredId: null }
  }
  const ratio = ratios.get(preferredId) ?? 0
  if (ratio > 0) {
    return { activeId: preferredId, preferredId }
  }
  return { activeId: null, preferredId: null }
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

export function pasteboardStrideAtZoom(
  trimHeightMm: number,
  zoom: number,
): number {
  return pasteboardStridePx(trimHeightMm * SPREAD_PX_PER_MM) * zoom
}

export function pasteboardSlotPaddingBottom(zoom: number): number {
  return PASTEBOARD_GAP_PX * zoom
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

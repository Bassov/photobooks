import { getSpreadPageCount, getSpreadSlotPageCount } from '../core'
import { PANEL_DEFAULTS } from '../ui/panelSize'
import { pasteboardWindow, type PasteboardWindow } from './pasteboardWindow'
import { requestSpreadReveal } from './photoRootSession'

const OVERSCAN_ROWS = 3

/** Kit thumb box never gets narrower than this spread aspect (kit `chrome.tsx` ThumbGrid). */
const THUMB_MIN_ASPECT = 1.6
/** List `pl-3 pr-1` plus row `p-2` on both sides. */
const LIST_INSET_X_PX = 12 + 4 + 16
/** Row `p-2` top and bottom, label `mt-1.5` and the `mb-1` gap between rows. */
const ROW_CHROME_Y_PX = 16 + 6 + 4
/** Label line: `text-2xs` (11px) at line-height 1.35. */
const LABEL_LINE_PX = 11 * 1.35

/**
 * Paper size (px) that fits `aspect` (width / height) inside a thumb box:
 * full box width for wide spreads, full box height for narrow ones.
 */
export function fitThumbPx(
  boxWidthPx: number,
  boxHeightPx: number,
  aspect: number,
): { widthPx: number; heightPx: number } {
  const widthPx = Math.min(boxWidthPx, boxHeightPx * aspect)
  return { widthPx, heightPx: widthPx / aspect }
}

export interface ThumbCardStyle {
  box: { aspectRatio: string }
  inner: { width: string; aspectRatio: string }
}

/**
 * Kit list card (`chrome.tsx` ThumbItem): a box at least 1.6:1 with the
 * `ratio` (width / height) paper centred in it, full width from 1.6:1 up.
 */
export function thumbCardStyle(ratio: number): ThumbCardStyle {
  const box = Math.max(ratio, THUMB_MIN_ASPECT)
  return {
    box: { aspectRatio: String(box) },
    inner: {
      width: `${String((ratio / box) * 100)}%`,
      aspectRatio: String(ratio),
    },
  }
}

interface Trim {
  widthMm: number
  heightMm: number
}

/** Kit `coverW(bk) / bk.h`: back · spine · front over the page height. */
export function coverCardRatio(trim: Trim, spineMm: number): number {
  return (2 * trim.widthMm + spineMm) / trim.heightMm
}

/** Two pastedown pages over the page height. */
export function endpaperCardRatio(trim: Trim): number {
  return (2 * trim.widthMm) / trim.heightMm
}

export interface SpreadsRowGeometry {
  /** Thumb box width (row inner width). */
  boxWidthPx: number
  /** Paper size inside the thumb box (real spread aspect). */
  thumbWidthPx: number
  thumbHeightPx: number
  /** Thumb box height (the paper is centred in it). */
  boxHeightPx: number
  /** Fixed row stride (row + gap) so the list can be windowed. */
  rowPx: number
}

/**
 * Slot width / height of the first spread (page 1 keeps a spread-wide slot in
 * a book of two spreads or more), or the 2:1 default while the book has none.
 */
export function firstSlotAspect(
  first: { spreadWidthMm: number; spreadHeightMm: number } | undefined,
  spreadCount: number,
): number {
  if (first === undefined) {
    return 2
  }
  const widen =
    getSpreadSlotPageCount(0, spreadCount) / getSpreadPageCount(0, spreadCount)
  return (first.spreadWidthMm * widen) / first.spreadHeightMm
}

/**
 * Kit row sizing for a list `listWidthPx` wide (scrollport client width) and a
 * spread of `aspect` = width / height. A non-positive width (unmeasured)
 * falls back to `fallbackWidthPx`.
 */
export function spreadsRowGeometry(
  listWidthPx: number,
  aspect: number,
  fallbackWidthPx = PANEL_DEFAULTS.left,
): SpreadsRowGeometry {
  const list = listWidthPx > 0 ? listWidthPx : fallbackWidthPx
  const boxWidthPx = Math.max(0, list - LIST_INSET_X_PX)
  const boxAspect = Math.max(aspect, THUMB_MIN_ASPECT)
  const boxHeightPx = boxWidthPx / boxAspect
  // Fills the box width from 1.6:1 up; narrower spreads centre inside the box.
  const thumbWidthPx = boxHeightPx * aspect
  return {
    boxWidthPx,
    thumbWidthPx,
    thumbHeightPx: thumbWidthPx / aspect,
    boxHeightPx,
    rowPx: boxHeightPx + LABEL_LINE_PX + ROW_CHROME_Y_PX,
  }
}

export function scrollPasteboardToSpread(spreadId: string): void {
  requestSpreadReveal(spreadId)
}

/** Active spread when it still exists, else the first spread. */
export function selectedSpreadId(
  activeId: string | null,
  spreadIds: readonly string[],
): string | null {
  return spreadIds.find((id) => id === activeId) ?? spreadIds[0] ?? null
}

/** Spread to select after `removedId` is deleted: next, else previous. */
export function neighbourAfterDelete(
  spreadIds: readonly string[],
  removedId: string,
): string | null {
  const at = spreadIds.indexOf(removedId)
  if (at < 0) {
    return null
  }
  return spreadIds[at + 1] ?? spreadIds[at - 1] ?? null
}

export function canDeleteSpread(spreadCount: number): boolean {
  return spreadCount > 1
}

export function spreadsListWindow(
  count: number,
  scrollTop: number,
  viewportPx: number,
  rowPx: number,
): PasteboardWindow {
  return pasteboardWindow({
    count,
    stridePx: rowPx,
    scrollTop,
    viewportPx,
    overscanPx: OVERSCAN_ROWS * rowPx,
  })
}

/**
 * Scroll offset that brings row `index` fully into the viewport, or null.
 * `leadPx`: rows above the spreads in the same scroller (Cover, Endpaper).
 */
export function scrollTopToReveal(
  index: number,
  scrollTop: number,
  viewportPx: number,
  rowPx: number,
  leadPx = 0,
): number | null {
  // -1: no selection (empty list) — nothing to reveal.
  if (index < 0) {
    return null
  }
  const top = leadPx + index * rowPx
  const bottom = top + rowPx
  if (top < scrollTop) {
    return top
  }
  if (bottom > scrollTop + viewportPx) {
    return Math.max(0, bottom - viewportPx)
  }
  return null
}

export type SpreadsKeyAction =
  | { kind: 'move'; delta: -1 | 1 }
  | { kind: 'add' }
  | { kind: 'duplicate' }
  | { kind: 'delete' }
  | { kind: 'none' }

export function spreadsKeyAction(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
}): SpreadsKeyAction {
  const mod = event.ctrlKey || event.metaKey
  if (mod && event.key === 'Enter') return { kind: 'add' }
  if (mod && event.key.toLowerCase() === 'd') return { kind: 'duplicate' }
  if (mod) return { kind: 'none' }
  if (event.key === 'ArrowUp') return { kind: 'move', delta: -1 }
  if (event.key === 'ArrowDown') return { kind: 'move', delta: 1 }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    return { kind: 'delete' }
  }
  return { kind: 'none' }
}

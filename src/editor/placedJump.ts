import { pageLabel, placementsOfAsset, type Place } from '../core'
import { getBookStoreSnapshot } from './bookStore'
import { isCoverSelected, setCoverSelected } from './coverSelection'
import { exitCropMode } from './cropMode'
import { flashEditorStatus } from './editorStatus'
import { getSelectedEndpaper, setEndpaperSelected } from './endpaperSelection'
import { getFrameSource, setFrameSource } from './frameSelection'
import { setLeftPanelTab } from './leftPanelTabStore'
import { nudgeBoxIntoPort, spreadBoxContained } from './pasteboardReveal'
import { getActiveSpreadId, requestSpreadReveal } from './photoRootSession'
import { commitTextEdit } from './textEditStore'

/** How long the `Placed …` status stays (Designer placed-badge spec, Jump 5). */
export const PLACED_STATUS_MS = 2500

/** A frame closer than this to the pasteboard port edge is nudged into view. */
const PORT_INSET_PX = 24

/** Frames to wait for the spread reveal to lay out the target frame. */
const REVEAL_WAIT_FRAMES = 30

/** Spread-list position of the cover row (the front endpaper row is −1). */
const COVER_POSITION = -2

const COVER_LABELS = {
  front: 'Cover',
  spine: 'Cover · spine',
  back: 'Cover · back',
} as const

/** Spread-list label of a place: `Page 1`, `Pages 2–3`, `Cover · spine`, `Endpaper · back`. */
export function placeLabel(place: Place, spreadIds: readonly string[]): string {
  if (place.kind === 'cover') {
    return COVER_LABELS[place.panel]
  }
  if (place.kind === 'endpaper') {
    return `Endpaper · ${place.side}`
  }
  const pages = pageLabel(spreadIds.indexOf(place.spreadId), spreadIds.length)
  return `${pages.includes('–') ? 'Pages' : 'Page'} ${pages}`
}

/** B2: `Placed on <label>` for one place, `Placed i of n · <label>` for more. */
export function placedStatus(
  index: number,
  count: number,
  label: string,
): string {
  return count === 1
    ? `Placed on ${label}`
    : `Placed ${String(index + 1)} of ${String(count)} · ${label}`
}

/** Spread-list order: cover, front endpaper, spreads, back endpaper. */
function listPosition(place: Place, spreadIds: readonly string[]): number {
  if (place.kind === 'cover') {
    return COVER_POSITION
  }
  if (place.kind === 'endpaper') {
    return place.side === 'front' ? -1 : spreadIds.length
  }
  return spreadIds.indexOf(place.spreadId)
}

/** B3 "still the selection": that one frame, the cover, or that endpaper. */
function isSelected(place: Place): boolean {
  if (place.kind === 'cover') {
    return isCoverSelected()
  }
  if (place.kind === 'endpaper') {
    return getSelectedEndpaper() === place.side
  }
  const source = getFrameSource()
  return source?.spreadId === place.spreadId && source.frameId === place.frameId
}

/** Where the selection sits in the spread list (the selected row). */
function activePosition(spreadIds: readonly string[]): number {
  const endpaper = getSelectedEndpaper()
  if (isCoverSelected()) {
    return COVER_POSITION
  }
  if (endpaper !== null) {
    return listPosition({ kind: 'endpaper', side: endpaper }, spreadIds)
  }
  const active = getActiveSpreadId()
  return active === null ? COVER_POSITION : spreadIds.indexOf(active)
}

/**
 * B3: after the last jump (still the selection) the next place, wrapping;
 * otherwise the first place at or after the active row, else the first.
 */
function nextIndex(
  places: readonly Place[],
  last: Place | null,
  spreadIds: readonly string[],
): number {
  const key = JSON.stringify(last)
  const at =
    last !== null && isSelected(last)
      ? places.findIndex((place) => JSON.stringify(place) === key)
      : -1
  if (at >= 0) {
    return (at + 1) % places.length
  }
  const from = activePosition(spreadIds)
  return Math.max(
    0,
    places.findIndex((place) => listPosition(place, spreadIds) >= from),
  )
}

let last: { assetId: string; place: Place } | null = null
/** The frame the pending nudge waits for; a newer jump replaces it. */
let pendingNudge: object | null = null

/**
 * B4: once the reveal has laid the frame out (its rect held still for a
 * frame), scroll it into the port only when it is not already in view.
 */
function nudgeFrameWhenSettled(spreadId: string, frameId: string): void {
  const target = {}
  pendingNudge = target
  let previous = ''
  let frames = 0
  const step = (): void => {
    frames += 1
    const scroll = document.querySelector<HTMLElement>(
      '[data-testid="pasteboard-scroll"]',
    )
    const box = scroll
      ?.querySelector(
        `[data-spread-id="${CSS.escape(spreadId)}"] [data-frame-id="${CSS.escape(frameId)}"]`,
      )
      ?.getBoundingClientRect()
    const at = box === undefined ? '' : `${String(box.left)},${String(box.top)}`
    if (pendingNudge !== target) {
      return
    }
    if (scroll && box && at === previous) {
      const port = scroll.getBoundingClientRect()
      const inView = new DOMRect(
        port.x + PORT_INSET_PX,
        port.y + PORT_INSET_PX,
        port.width - 2 * PORT_INSET_PX,
        port.height - 2 * PORT_INSET_PX,
      )
      if (!spreadBoxContained(inView, box)) {
        nudgeBoxIntoPort(scroll, box)
      }
      return
    }
    previous = at
    if (frames < REVEAL_WAIT_FRAMES) {
      requestAnimationFrame(step)
    }
  }
  requestAnimationFrame(step)
}

function goTo(place: Place): void {
  if (place.kind === 'frame') {
    requestSpreadReveal(place.spreadId)
    setFrameSource({ spreadId: place.spreadId, frameId: place.frameId })
    nudgeFrameWhenSettled(place.spreadId, place.frameId)
    return
  }
  // The cover / endpaper rows of the pages list (SpreadsPanel, EndpaperRow).
  pendingNudge = null
  if (place.kind === 'cover') {
    setCoverSelected(true)
    return
  }
  setCoverSelected(false)
  setEndpaperSelected(place.side)
}

/**
 * "Show in the book" (Designer placed-badge spec, Jump 1–6): select the
 * asset's next place. Changes only selection and scroll: no history step,
 * no zoom change.
 */
export function jumpToPlacement(assetId: string): void {
  const { book } = getBookStoreSnapshot()
  const places = placementsOfAsset(book, assetId)
  const spreadIds = book.spreads.map((spread) => spread.id)
  const index = nextIndex(
    places,
    last?.assetId === assetId ? last.place : null,
    spreadIds,
  )
  const place = places[index]
  if (place === undefined) {
    return
  }
  setLeftPanelTab('pages')
  exitCropMode()
  commitTextEdit()
  goTo(place)
  last = { assetId, place }
  flashEditorStatus(
    placedStatus(index, places.length, placeLabel(place, spreadIds)),
    PLACED_STATUS_MS,
  )
}

export function resetPlacedJumpForTests(): void {
  last = null
}

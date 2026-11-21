import { pageLabel, placementsOfAsset, type Place } from '../core'
import { getBookStoreSnapshot } from './bookStore'
import { isCoverSelected, setCoverSelected } from './coverSelection'
import { exitCropMode } from './cropMode'
import { flashEditorStatus } from './editorStatus'
import { getSelectedEndpaper, setEndpaperSelected } from './endpaperSelection'
import { getFrameSource, setFrameSource } from './frameSelection'
import { setLeftPanelTab } from './leftPanelTabStore'
import { getActiveSpreadId, requestSpreadReveal } from './photoRootSession'
import { commitTextEdit } from './textEditStore'

/** How long the `Placed …` status stays (Designer placed-badge spec, Jump 5). */
export const PLACED_STATUS_MS = 2500

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

function goTo(place: Place): void {
  if (place.kind === 'frame') {
    // B4 (M145): the reveal scrolls each axis once, straight to the frame:
    // the least that puts it 24 px inside the port, or centred when larger.
    requestSpreadReveal(place.spreadId, place.frameId)
    setFrameSource({ spreadId: place.spreadId, frameId: place.frameId })
    return
  }
  // The cover / endpaper rows of the pages list (SpreadsPanel, EndpaperRow).
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

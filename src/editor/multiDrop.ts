import type { Book } from '../core'
import { dispatchBookOp, getBookStoreSnapshot } from './bookStore'
import { leftInFilmstripStatus, setEditorStatus } from './editorStatus'

export type MultiDropTarget =
  | { type: 'frame'; spreadId: string; frameId: string }
  | { type: 'gap'; insertIndex: number }

/** Dragged ids limited to the gallery (unknown ids dropped), in gallery order. */
export function orderedGalleryIds(
  book: Book,
  ids: readonly string[],
): string[] {
  const wanted = new Set(ids)
  return book.gallery.filter((id) => wanted.has(id))
}

/** Distinct wanted photos sitting in spreads the drop touched. */
export function placedInChangedSpreads(
  before: Book,
  after: Book,
  wanted: ReadonlySet<string | undefined>,
): number {
  const previous = new Map(before.spreads.map((spread) => [spread.id, spread]))
  const placed = new Set<string | undefined>()
  for (const spread of after.spreads) {
    if (previous.get(spread.id) === spread) {
      continue
    }
    for (const frame of spread.frames) {
      if (wanted.has(frame.assetId)) {
        placed.add(frame.assetId)
      }
    }
  }
  return placed.size
}

/**
 * Drop photos on a frame (fill it and the empty frames after it) or into a
 * gap (new spread). One book op, so one history step; leftovers are announced.
 */
export function dropAssets(
  target: MultiDropTarget,
  dragged: readonly string[],
): void {
  const before = getBookStoreSnapshot().book
  const ids = orderedGalleryIds(before, dragged)
  dispatchBookOp(
    target.type === 'frame'
      ? {
          type: 'fillSpread',
          spreadId: target.spreadId,
          frameId: target.frameId,
          assetIds: ids,
        }
      : {
          type: 'insertSpreadWithAssets',
          index: target.insertIndex,
          assetIds: ids,
        },
  )
  const placed = placedInChangedSpreads(
    before,
    getBookStoreSnapshot().book,
    new Set(ids),
  )
  if (placed < ids.length) {
    setEditorStatus(leftInFilmstripStatus(ids.length - placed))
  }
}

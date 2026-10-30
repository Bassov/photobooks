import { useSyncExternalStore, type DragEvent } from 'react'
import {
  dispatchBookOp,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { ASSET_DRAG_MIME } from './dropTargets'
import type { EndpaperSide } from './endpaperSelection'
import { useCoverPhotoUrl } from './useCoverPhotoUrl'
import './EndpaperCanvas.css'

function readBook() {
  return getBookStoreSnapshot().book
}

/**
 * Kit EndpaperSpread (uikit/src/sandbox/v7.tsx:78-85): two pastedown pages and
 * the gutter. A photo dropped from the filmstrip replaces the pattern.
 */
export function EndpaperCanvas({
  side,
  mini = false,
}: {
  side: EndpaperSide
  mini?: boolean
}) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const { widthMm, heightMm } = book.settings.trim
  const assetId = book.endpapers[side].assetId
  const url = useCoverPhotoUrl(assetId)
  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    if (event.dataTransfer.types.includes(ASSET_DRAG_MIME)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
  }
  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const dropped = event.dataTransfer.getData(ASSET_DRAG_MIME)
    if (dropped === '') {
      return
    }
    event.preventDefault()
    dispatchBookOp({ type: 'setEndpaperPhoto', side, assetId: dropped })
  }
  const paper = (
    <div
      className="endpaper-page"
      style={url === undefined ? undefined : { backgroundImage: `url(${url})` }}
    />
  )
  const spread = (
    <div
      className="endpaper-spread"
      data-testid={mini ? undefined : 'canvas-endpaper'}
      data-side={side}
      data-photo-id={assetId}
      style={{ aspectRatio: (2 * widthMm) / heightMm }}
      onDragOver={mini ? undefined : onDragOver}
      onDrop={mini ? undefined : onDrop}
    >
      {paper}
      {paper}
      <div aria-hidden="true" className="endpaper-gutter" />
      {mini ? null : (
        <span className="endpaper-label" data-side={side}>
          Pastedown · glued to {side} board
        </span>
      )}
    </div>
  )
  return mini ? (
    spread
  ) : (
    <div className="cover-stage" data-testid="endpaper-stage">
      {spread}
    </div>
  )
}

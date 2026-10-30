import { useSyncExternalStore, type DragEvent } from 'react'
import {
  getBookStoreSnapshot,
  dispatchBookOp,
  subscribeBookStore,
} from './bookStore'
import { ASSET_DRAG_MIME } from './dropTargets'
import { useCoverPhotoUrl } from './useCoverPhotoUrl'
import { coverLayout } from './coverLayout'
import './CoverCanvas.css'

function readBook() {
  return getBookStoreSnapshot().book
}

/**
 * Kit CoverSpread: back · spine · front on the canvas. Dropping a filmstrip
 * photo on the front sets the cover photo; the title text comes from the book.
 */
export function CoverCanvas({ mini = false }: { mini?: boolean }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const { cover, settings } = book
  const url = useCoverPhotoUrl(cover.front.assetId)
  const layout = coverLayout(settings.trim.widthMm, settings.trim.heightMm)
  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    if (event.dataTransfer.types.includes(ASSET_DRAG_MIME)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
  }
  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const assetId = event.dataTransfer.getData(ASSET_DRAG_MIME)
    if (assetId === '') {
      return
    }
    event.preventDefault()
    dispatchBookOp({ type: 'setCoverPhoto', assetId })
  }
  const id = (name: string): string | undefined => (mini ? undefined : name)
  const spread = (
    <div
      className="cover-spread"
      data-testid={id('canvas-cover')}
      data-mini={mini ? 'true' : undefined}
      style={{
        aspectRatio: layout.aspectRatio,
        width: mini ? '100%' : layout.fitWidth,
      }}
    >
      <div
        className="cover-back"
        data-testid={id('cover-back')}
        style={{ width: `${String(layout.pagePct)}%` }}
      >
        <div className="cover-back-text" data-testid={id('cover-back-text')}>
          {cover.back.text}
        </div>
      </div>
      <div
        className="cover-spine"
        data-testid={id('cover-spine')}
        style={{ width: `${String(layout.spinePct)}%` }}
      >
        <span className="cover-spine-text" data-testid={id('cover-spine-text')}>
          <em>{cover.spine.text}</em>
        </span>
      </div>
      <div
        className="cover-front"
        data-testid={id('cover-front')}
        data-photo-id={cover.front.assetId}
        style={{
          width: `${String(layout.pagePct)}%`,
          backgroundImage: url === undefined ? undefined : `url(${url})`,
        }}
        onDragOver={mini ? undefined : onDragOver}
        onDrop={mini ? undefined : onDrop}
      >
        <div className="cover-front-text" data-testid={id('cover-front-text')}>
          <em>{cover.front.text}</em>
        </div>
      </div>
    </div>
  )
  return mini ? (
    spread
  ) : (
    <div className="cover-stage" data-testid="cover-stage">
      {spread}
    </div>
  )
}

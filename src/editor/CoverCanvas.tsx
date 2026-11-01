import { useSyncExternalStore, type DragEvent } from 'react'
import { bookSpineWidthMm } from '../core'
import {
  getBookStoreSnapshot,
  dispatchBookOp,
  subscribeBookStore,
} from './bookStore'
import { ASSET_DRAG_MIME } from './dropTargets'
import { useTierPreviewUrl } from './useTierPreviewUrl'
import { COVER_WRAP_MM, coverLayout } from './coverLayout'
import './CoverCanvas.css'

function readBook() {
  return getBookStoreSnapshot().book
}

function PanelLabel({ text }: { text: string }) {
  return (
    <span
      className="cover-panel-label"
      data-testid={`cover-label-${text.toLowerCase()}`}
    >
      {text}
    </span>
  )
}

/**
 * Kit CoverSpread: back · spine · front on the canvas. Dropping a filmstrip
 * photo on the front sets the cover photo; the title text comes from the book.
 * With `tierSlot` the front photo upgrades to the working preview like a page
 * frame; without it (spread-list row) it stays on the filmstrip thumb.
 */
export function CoverCanvas({
  mini = false,
  tierSlot,
}: {
  mini?: boolean
  tierSlot?: string
}) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const { cover, settings } = book
  const url = useTierPreviewUrl(cover.front.assetId, tierSlot)
  const { style: look } = cover
  const layout = coverLayout(
    settings.trim.widthMm,
    settings.trim.heightMm,
    bookSpineWidthMm(book),
  )
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
      data-title-font={look.titleFont}
      data-material={look.material}
      data-finish={look.finish}
      style={{
        aspectRatio: layout.aspectRatio,
        width: mini ? '100%' : layout.fitWidth,
      }}
    >
      <div
        className="cover-back"
        data-testid={id('cover-back')}
        style={{
          width: `${String(layout.pagePct)}%`,
          background: look.backFill,
        }}
      >
        {mini ? null : <PanelLabel text="Back" />}
        <div className="cover-back-text" data-testid={id('cover-back-text')}>
          {cover.back.text}
        </div>
      </div>
      <div
        className="cover-spine"
        data-testid={id('cover-spine')}
        style={{ width: `${String(layout.spinePct)}%` }}
      >
        {mini ? null : <PanelLabel text="Spine" />}
        <span
          className="cover-spine-text"
          data-testid={id('cover-spine-text')}
          data-direction={look.spineDirection}
        >
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
        {mini ? null : <PanelLabel text="Front" />}
        <div className="cover-front-text" data-testid={id('cover-front-text')}>
          <em>{cover.front.text}</em>
        </div>
      </div>
      {mini ? null : (
        <>
          <div
            aria-hidden="true"
            className="cover-wrap-guide"
            data-testid="cover-safe"
            style={{
              inset: `${String(layout.wrapInsetYPct)}% ${String(layout.wrapInsetXPct)}%`,
            }}
          />
          <span className="cover-wrap-chip" data-testid="cover-wrap-chip">
            Wrap {COVER_WRAP_MM} mm
          </span>
        </>
      )}
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

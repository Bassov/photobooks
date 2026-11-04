import { useSyncExternalStore, type DragEvent } from 'react'
import { CoverView, type CoverEdit } from '../render/CoverView'
import {
  getBookStoreSnapshot,
  dispatchBookOp,
  subscribeBookStore,
} from './bookStore'
import { ASSET_DRAG_MIME } from './dropTargets'
import { useTierPreviewUrl } from './useTierPreviewUrl'

function readBook() {
  return getBookStoreSnapshot().book
}

const COVER_EDIT: CoverEdit = {
  onDragOver: (event: DragEvent<HTMLElement>): void => {
    if (event.dataTransfer.types.includes(ASSET_DRAG_MIME)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
  },
  onDrop: (event: DragEvent<HTMLElement>): void => {
    const assetId = event.dataTransfer.getData(ASSET_DRAG_MIME)
    if (assetId === '') {
      return
    }
    event.preventDefault()
    dispatchBookOp({ type: 'setCoverPhoto', assetId })
  },
}

/**
 * Kit CoverSpread on the canvas (CoverView over the book store). Dropping a
 * filmstrip photo on the front sets the cover photo; the title text comes from
 * the book. With `tierSlot` the front photo upgrades to the working preview
 * like a page frame; without it (spread-list row) it stays on the filmstrip thumb.
 */
export function CoverCanvas({
  mini = false,
  tierSlot,
}: {
  mini?: boolean
  tierSlot?: string
}) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const { url, tier } = useTierPreviewUrl(book.cover.front.assetId, tierSlot)
  return (
    <CoverView
      book={book}
      frontUrl={url}
      frontTier={tier}
      edit={mini ? undefined : COVER_EDIT}
    />
  )
}

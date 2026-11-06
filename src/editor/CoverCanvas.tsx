import { useSyncExternalStore, type DragEvent } from 'react'
import { CoverPainter, type CoverEdit } from '../render/CoverView'
import { dispatchBookOp, subscribeBookStore } from './bookStore'
import { readCover, readCoverGeometry } from './coverSelectors'
import { ASSET_DRAG_MIME } from './dropTargets'
import { useTierPreviewUrl } from './useTierPreviewUrl'

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
 * Kit CoverSpread on the canvas (CoverPainter over the book store). Dropping a
 * filmstrip photo on the front board or its wrap band sets the cover photo;
 * the title text comes from the book. With `tierSlot` the front photo upgrades
 * to the working preview like a page frame; without it (spread-list row) it
 * stays on the filmstrip thumb. Reads only the cover and its geometry, so a
 * page edit does not re-render it.
 */
export function CoverCanvas({
  mini = false,
  tierSlot,
}: {
  mini?: boolean
  tierSlot?: string
}) {
  const cover = useSyncExternalStore(subscribeBookStore, readCover, readCover)
  const geometry = useSyncExternalStore(
    subscribeBookStore,
    readCoverGeometry,
    readCoverGeometry,
  )
  const { url, tier } = useTierPreviewUrl(cover.front.assetId, tierSlot)
  return (
    <CoverPainter
      cover={cover}
      geometry={geometry}
      frontUrl={url}
      frontTier={tier}
      edit={mini ? undefined : COVER_EDIT}
    />
  )
}

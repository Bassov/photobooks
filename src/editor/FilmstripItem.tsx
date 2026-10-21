import { useEffect, useSyncExternalStore } from 'react'
import { GridListItem } from 'react-aria-components'
import { Badge } from '../ui/Badge'
import {
  getAssetAspectSnapshot,
  getAssetContentHash,
  getPlacementCountSnapshot,
  subscribeBookStore,
} from './bookStore'
import { ASSET_DRAG_MIME } from './dropTargets'
import { setSelectedAssetId } from './gallerySelection'
import { ensureThumb, getThumbUrl, subscribeThumb } from './thumbCache'
import { thumbSlotSize } from './thumbSlotSize'

function orientationLabel(aspect: number): 'portrait' | 'landscape' | 'square' {
  if (aspect < 0.95) {
    return 'portrait'
  }
  if (aspect > 1.05) {
    return 'landscape'
  }
  return 'square'
}

export function FilmstripItemView({
  id,
  name,
  offsetLeft,
}: {
  id: string
  name: string
  /** Left origin within the filmstrip window from actual-width prefix sums. */
  offsetLeft: number
}) {
  const thumbUrl = useSyncExternalStore(
    (listener) => subscribeThumb(id, listener),
    () => getThumbUrl(id),
    () => getThumbUrl(id),
  )
  const aspect = useSyncExternalStore(
    subscribeBookStore,
    () => getAssetAspectSnapshot(id),
    () => getAssetAspectSnapshot(id),
  )
  const contentHash = useSyncExternalStore(
    subscribeBookStore,
    () => getAssetContentHash(id),
    () => getAssetContentHash(id),
  )
  const placementCount = useSyncExternalStore(
    subscribeBookStore,
    () => getPlacementCountSnapshot(id),
    () => getPlacementCountSnapshot(id),
  )
  useEffect(() => {
    if (contentHash === undefined || contentHash.length === 0) {
      return
    }
    ensureThumb(id, contentHash)
  }, [id, contentHash])
  const { width, height } = thumbSlotSize(aspect)

  return (
    <GridListItem
      id={id}
      textValue={name}
      className="filmstrip-item"
      data-testid="filmstrip-item"
      data-asset-id={id}
      data-aspect={String(aspect)}
      data-orientation={orientationLabel(aspect)}
      data-offset-left={String(offsetLeft)}
      style={{
        position: 'absolute',
        top: 0,
        left: offsetLeft,
        width,
        height,
      }}
    >
      <div
        className="filmstrip-drag"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(ASSET_DRAG_MIME, id)
          event.dataTransfer.effectAllowed = 'copy'
          setSelectedAssetId(id)
        }}
      >
        {thumbUrl ? (
          <img
            className="filmstrip-thumb"
            data-testid="filmstrip-thumb"
            src={thumbUrl}
            alt=""
            decoding="async"
            width={width}
            height={height}
          />
        ) : (
          <div
            className="filmstrip-placeholder"
            data-testid="filmstrip-placeholder"
          />
        )}
        {placementCount > 0 ? (
          <Badge
            color="brand"
            size="sm"
            className="filmstrip-placed"
            data-testid="filmstrip-placed"
          >
            Placed
          </Badge>
        ) : null}
      </div>
    </GridListItem>
  )
}

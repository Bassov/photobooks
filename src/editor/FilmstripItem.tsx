import { memo, useEffect, useSyncExternalStore } from 'react'
import { GridListItem } from 'react-aria-components'
import { Badge } from '../ui/Badge'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { requestGalleryRemove } from './galleryRemoveRequest'
import {
  getAssetAspectSnapshot,
  getAssetCacheKey,
  getPlacementCountSnapshot,
  subscribeBookStore,
} from './bookStore'
import {
  ASSET_DRAG_MIME,
  ASSET_MULTI_MIME,
  encodeAssetIds,
} from './dropTargets'
import { filmstripImportJumpHighlightStyle } from './filmstripChromeStyles'
import {
  getFilmstripJumpHighlightId,
  subscribeFilmstripJump,
} from './filmstripJump'
import { getSelectedAssetIds, setSelectedAssetId } from './gallerySelection'
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

/**
 * Thumb, badge and remove button. Memoized apart from the slot geometry so a
 * committed filmstrip resize only re-renders the outer slot (CSS sizes the
 * thumb to 100%).
 */
const FilmstripItemBody = memo(function FilmstripItemBody({
  id,
  name,
  thumbUrl,
  placed,
}: {
  id: string
  name: string
  thumbUrl: string | undefined
  placed: boolean
}) {
  return (
    <div
      className="filmstrip-drag"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(ASSET_DRAG_MIME, id)
        event.dataTransfer.effectAllowed = 'copy'
        const selection = getSelectedAssetIds()
        if (selection.length > 1 && selection.includes(id)) {
          event.dataTransfer.setData(
            ASSET_MULTI_MIME,
            encodeAssetIds(selection),
          )
          return
        }
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
        />
      ) : (
        <div
          className="filmstrip-placeholder"
          data-testid="filmstrip-placeholder"
        />
      )}
      {placed ? (
        <Badge
          color="gray"
          size="sm"
          className="filmstrip-placed"
          data-testid="filmstrip-placed"
        >
          Placed
        </Badge>
      ) : null}
      <IconButton
        label={`Remove ${name} from gallery`}
        size="sm"
        tooltip={false}
        className="filmstrip-remove"
        data-testid="filmstrip-remove"
        onPress={() => {
          requestGalleryRemove(id, name)
        }}
      >
        <Icon name="delete" size={14} />
      </IconButton>
    </div>
  )
})

export function FilmstripItemView({
  id,
  name,
  offsetLeft,
  thumbHeight,
}: {
  id: string
  name: string
  /** Committed slot height (filmstrip size store). */
  thumbHeight: number
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
  const cacheKey = useSyncExternalStore(
    subscribeBookStore,
    () => getAssetCacheKey(id),
    () => getAssetCacheKey(id),
  )
  const placementCount = useSyncExternalStore(
    subscribeBookStore,
    () => getPlacementCountSnapshot(id),
    () => getPlacementCountSnapshot(id),
  )
  const jumpHighlightId = useSyncExternalStore(
    subscribeFilmstripJump,
    getFilmstripJumpHighlightId,
    getFilmstripJumpHighlightId,
  )
  useEffect(() => {
    ensureThumb(id, cacheKey)
  }, [id, cacheKey])
  const { width, height } = thumbSlotSize(aspect, thumbHeight)

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
      {...(jumpHighlightId === id ? { 'data-import-jump': '' } : {})}
      style={{
        position: 'absolute',
        top: 0,
        left: offsetLeft,
        width,
        height,
        ...(jumpHighlightId === id ? filmstripImportJumpHighlightStyle : {}),
      }}
    >
      <FilmstripItemBody
        id={id}
        name={name}
        thumbUrl={thumbUrl}
        placed={placementCount > 0}
      />
    </GridListItem>
  )
}

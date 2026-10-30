import {
  memo,
  useEffect,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { GridListItem } from 'react-aria-components'
import { Icon } from '../ui/Icon'
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
import { getRelinkStatus, subscribeRelink } from './relink/statusStore'
import { ensureThumb, getThumbUrl, subscribeThumb } from './thumbCache'
import { thumbSlotAspect } from './thumbSlotSize'

function orientationLabel(aspect: number): 'portrait' | 'landscape' | 'square' {
  if (aspect < 0.95) {
    return 'portrait'
  }
  if (aspect > 1.05) {
    return 'landscape'
  }
  return 'square'
}

/** Thumb and placed badge (CSS sizes the thumb to 100% of the slot). */
const FilmstripItemBody = memo(function FilmstripItemBody({
  id,
  name,
  thumbUrl,
  placed,
  missing,
}: {
  id: string
  name: string
  thumbUrl: string | undefined
  placed: boolean
  missing: boolean
}) {
  return (
    <div
      className="filmstrip-drag"
      title={name}
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
      ) : missing ? null : (
        <div
          className="filmstrip-placeholder"
          data-testid="filmstrip-placeholder"
        />
      )}
      {missing ? (
        <div
          className={
            thumbUrl ? 'filmstrip-missing is-overlay' : 'filmstrip-missing'
          }
          role="img"
          aria-label="Photo file is missing"
          data-testid="filmstrip-missing"
        >
          <Icon name="imageOff" size={16} />
        </div>
      ) : null}
      {placed ? (
        <span
          className="filmstrip-placed"
          role="img"
          aria-label="Placed in the book"
          title="Placed in the book"
          data-testid="filmstrip-placed"
        >
          <Icon name="check" size={14} />
        </span>
      ) : null}
    </div>
  )
})

/**
 * Slot geometry is CSS-only: height and width follow `--film-slot-h` on the
 * filmstrip window and origins come from the flex row, so a committed resize
 * commits one style on the window instead of re-rendering every item.
 */
export function FilmstripItemView({ id, name }: { id: string; name: string }) {
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
  const readMissing = () => getRelinkStatus(id) === 'missing'
  const missing = useSyncExternalStore(
    subscribeRelink,
    readMissing,
    readMissing,
  )
  useEffect(() => {
    ensureThumb(id, cacheKey)
  }, [id, cacheKey])
  return (
    <GridListItem
      id={id}
      textValue={name}
      className="filmstrip-item"
      data-testid="filmstrip-item"
      data-asset-id={id}
      data-aspect={String(aspect)}
      data-orientation={orientationLabel(aspect)}
      {...(jumpHighlightId === id ? { 'data-import-jump': '' } : {})}
      style={
        {
          '--slot-aspect': String(thumbSlotAspect(aspect)),
          ...(jumpHighlightId === id ? filmstripImportJumpHighlightStyle : {}),
        } as CSSProperties
      }
    >
      <FilmstripItemBody
        id={id}
        name={name}
        thumbUrl={thumbUrl}
        placed={placementCount > 0}
        missing={missing}
      />
    </GridListItem>
  )
}

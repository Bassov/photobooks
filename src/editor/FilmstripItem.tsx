import {
  memo,
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
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
import {
  getFilmstripRowFocus,
  noteFilmstripRowBlur,
  noteFilmstripRowFocus,
  ROW_FOCUS_VISIBLE,
  ROW_FOCUSED,
  ROW_TAB_STOP,
  subscribeFilmstripFocus,
  takeFilmstripPendingFocus,
} from './filmstripGridFocus'
import {
  getSelectedAssetIds,
  setSelectedAssetId,
  subscribeGallerySelection,
} from './gallerySelection'
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

function matchesFocusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible')
  } catch {
    return false
  }
}

/**
 * Slot geometry is CSS-only: height and width follow `--film-slot-h` on the
 * filmstrip window and origins come from the flex row, so a committed resize
 * commits one style on the window instead of re-rendering every item.
 * Memoized grid row: selection and focus are per-row booleans, so a window
 * shift renders only the rows that enter it.
 */
export const FilmstripItemView = memo(function FilmstripItemView({
  id,
  name,
}: {
  id: string
  name: string
}) {
  const readSelected = () => getSelectedAssetIds().includes(id)
  const selected = useSyncExternalStore(
    subscribeGallerySelection,
    readSelected,
    readSelected,
  )
  const readFocus = () => getFilmstripRowFocus(id)
  const focus = useSyncExternalStore(
    subscribeFilmstripFocus,
    readFocus,
    readFocus,
  )
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (takeFilmstripPendingFocus(id)) {
      rowRef.current?.focus({ preventScroll: true })
    }
  }, [id])
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
    <div
      ref={rowRef}
      role="row"
      aria-label={name}
      aria-selected={selected}
      tabIndex={(focus & ROW_TAB_STOP) === 0 ? -1 : 0}
      className="filmstrip-item"
      data-key={id}
      data-selection-mode="multiple"
      data-selected={selected || undefined}
      data-focused={(focus & ROW_FOCUSED) === 0 ? undefined : true}
      data-focus-visible={(focus & ROW_FOCUS_VISIBLE) === 0 ? undefined : true}
      // The row has no focusable descendants, so focus events are its own.
      onFocus={(event) => {
        noteFilmstripRowFocus(id, matchesFocusVisible(event.currentTarget))
      }}
      onBlur={() => {
        noteFilmstripRowBlur(id)
      }}
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
      <div role="gridcell" style={gridCellStyle}>
        <FilmstripItemBody
          id={id}
          name={name}
          thumbUrl={thumbUrl}
          placed={placementCount > 0}
          missing={missing}
        />
      </div>
    </div>
  )
})

const gridCellStyle: CSSProperties = { display: 'contents' }

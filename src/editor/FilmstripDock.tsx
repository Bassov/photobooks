import {
  startTransition,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { clearDropHover, setDropHover } from './dropHover'
import { setEditorStatus } from './editorStatus'
import {
  setFilmstripThumb,
  THUMB_MIN,
  THUMB_NAMES_MIN,
  thumbDragPx,
  thumbForKey,
  useFilmstripThumbHeight,
  useFilmstripThumbMax,
} from './filmstripSize'
import {
  isExternalFilesDrag,
  resolveDroppedFolder,
  STATUS_DROP_FILES_IGNORED,
  STATUS_DROP_FOLDER_ONLY,
} from './filmstripDropFolder'
import { Button as AriaButton } from 'react-aria-components'
import { AlertDialog } from '../ui/AlertDialog'
import { appInnerHeight, uiScale } from '../ui/uiScale'
import { Icon } from '../ui/Icon'
import { Menu, MenuItem, MenuPopover, MenuTrigger } from '../ui/Menu'
import { ToggleButton } from '../ui/ToggleButton'
import {
  getAssetDisplayName,
  getGalleryIdsSnapshot,
  getPlacedAssetIdsSnapshot,
  subscribeBookStore,
  subscribeGallery,
} from './bookStore'
import { FillBookButton } from './FillBookButton'
import { Filmstrip } from './Filmstrip'
import {
  cancelGalleryRemove,
  confirmGalleryRemove,
  getPendingGalleryRemoveId,
  subscribePendingGalleryRemove,
} from './galleryRemoveRequest'
import { warmNameCollator, type GallerySortKey } from './galleryView'
import { countLowResAssets } from './pageFillLowRes'

const SORT_LABELS: Record<GallerySortKey, string> = {
  captured: 'Date taken',
  name: 'File name',
  added: 'Added order',
}

function RemovePlacedDialog({ assetId }: { assetId: string }) {
  const name = getAssetDisplayName(assetId)
  return (
    <AlertDialog
      isOpen
      title="Remove a placed photo?"
      confirmLabel="Remove and empty frame"
      onCancel={cancelGalleryRemove}
      onConfirm={() => {
        confirmGalleryRemove(name)
      }}
    >
      “{name}” is used in the book. Removing it empties that frame. The file on
      disk is not touched.
    </AlertDialog>
  )
}

/**
 * Dock top-edge separator (walkthrough-ux-review §B, kit chrome.tsx
 * `ThumbResizer`): 9 px hit zone, 4 px drag steps written to storage once on
 * release, ↑/↓ ±8, Home / End, Enter or double-click back to `auto`.
 */
function ThumbResizer({ height, max }: { height: number; max: number }) {
  const drag = useRef<{ y: number; start: number; last: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize photos"
      aria-valuemin={THUMB_MIN}
      aria-valuemax={max}
      aria-valuenow={height}
      tabIndex={0}
      className="film-resizer"
      data-dragging={dragging || undefined}
      data-testid="thumb-resizer"
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { y: event.clientY, start: height, last: height }
        setDragging(true)
      }}
      onPointerMove={(event) => {
        const d = drag.current
        if (d === null) {
          return
        }
        // Same 4 px step: the store hook bails out, nothing re-renders.
        // Screen px → app px (÷ interface scale).
        d.last = thumbDragPx(
          d.start,
          (d.y - event.clientY) / uiScale(),
          appInnerHeight(),
        )
        setFilmstripThumb(d.last, false)
      }}
      onPointerUp={() => {
        const d = drag.current
        if (d === null) {
          return
        }
        drag.current = null
        setDragging(false)
        if (d.last !== d.start) {
          setFilmstripThumb(d.last)
        }
      }}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
      }}
      onDoubleClick={() => {
        setFilmstripThumb('auto')
      }}
      onKeyDown={(event) => {
        const next = thumbForKey(event.key, height, appInnerHeight())
        if (next === null) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        setFilmstripThumb(next)
      }}
    >
      <div className="film-resizer-line" />
      <div className="film-resizer-pill" data-testid="thumb-resizer-pill" />
      {dragging ? (
        <div className="film-resizer-chip" data-testid="thumb-resizer-chip">
          {`${String(height)} px`}
        </div>
      ) : null}
    </div>
  )
}

/** Kit bottom dock chrome wrapping the working product Filmstrip. */
export function FilmstripDock({
  onDropPhotoFolder,
  onChoosePhotoFolder,
  importDisabled = false,
}: {
  onDropPhotoFolder?: (directory: FileSystemDirectoryHandle) => Promise<void>
  onChoosePhotoFolder?: () => Promise<void>
  importDisabled?: boolean
}) {
  const gallery = useSyncExternalStore(
    subscribeGallery,
    getGalleryIdsSnapshot,
    getGalleryIdsSnapshot,
  )
  const placed = useSyncExternalStore(
    subscribeBookStore,
    getPlacedAssetIdsSnapshot,
    getPlacedAssetIdsSnapshot,
  )
  const pendingRemoveId = useSyncExternalStore(
    subscribePendingGalleryRemove,
    getPendingGalleryRemoveId,
    getPendingGalleryRemoveId,
  )
  const [sort, setSort] = useState<GallerySortKey>('added')
  const [unplacedOnly, setUnplacedOnly] = useState(false)
  const [externalDrag, setExternalDrag] = useState(false)
  const thumbHeight = useFilmstripThumbHeight()
  const thumbMaxPx = useFilmstripThumbMax()
  // First Intl.Collator use loads ICU data (tens of ms); pay it before the first sort pick.
  useEffect(() => {
    const id = setTimeout(warmNameCollator, 0)
    return () => {
      clearTimeout(id)
    }
  }, [])
  const count = gallery.length
  const used = gallery.filter((id) => placed.has(id)).length
  const shown = unplacedOnly ? count - used : count
  const shownIds = unplacedOnly
    ? gallery.filter((id) => !placed.has(id))
    : gallery
  const readLowRes = () => countLowResAssets(shownIds)
  const lowRes = useSyncExternalStore(
    subscribeBookStore,
    readLowRes,
    readLowRes,
  )

  return (
    <div
      className="editor-dock relative shrink-0"
      data-testid="dock"
      style={
        {
          '--film-thumb-h': `${String(thumbHeight)}px`,
          '--film-empty-h': `${String(thumbHeight)}px`,
        } as CSSProperties
      }
      data-names={thumbHeight >= THUMB_NAMES_MIN || undefined}
      onDragOver={(event) => {
        if (
          onDropPhotoFolder === undefined ||
          !isExternalFilesDrag(event.dataTransfer.types)
        ) {
          return
        }
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDropHover(event.currentTarget)
        setExternalDrag(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          clearDropHover()
          setExternalDrag(false)
        }
      }}
      onDrop={(event) => {
        if (
          onDropPhotoFolder === undefined ||
          !isExternalFilesDrag(event.dataTransfer.types)
        ) {
          return
        }
        event.preventDefault()
        clearDropHover()
        setExternalDrag(false)
        // Handles must be requested synchronously inside the drop event.
        const pending = resolveDroppedFolder(event.dataTransfer.items)
        void pending.then((result) => {
          if (result.kind === 'no-folder') {
            setEditorStatus(STATUS_DROP_FOLDER_ONLY)
            return
          }
          if (result.ignoredFiles > 0) {
            setEditorStatus(STATUS_DROP_FILES_IGNORED)
          }
          return onDropPhotoFolder(result.directory)
        })
      }}
    >
      <ThumbResizer height={thumbHeight} max={thumbMaxPx} />
      <div className="editor-dock-head flex h-10 items-center gap-3 px-3">
        <span
          className="editor-dock-meta text-sm tabular-nums"
          data-testid="film-head"
        >
          <span data-testid="placed-count">
            {unplacedOnly
              ? `Photos · ${String(shown)} of ${String(count)} · ${String(used)} used`
              : `Photos · ${String(count)} · ${String(used)} used`}
          </span>
          {lowRes > 0 ? (
            <span
              className="text-[var(--warning-ink)]"
              data-testid="lowres-count"
            >{` · ${String(lowRes)} low-res`}</span>
          ) : null}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <FillBookButton sort={sort} />
          <ToggleButton
            size="sm"
            className="film-chip inline-flex items-center gap-1.5"
            isSelected={unplacedOnly}
            onChange={(next) => {
              startTransition(() => {
                setUnplacedOnly(next)
              })
            }}
            data-testid="film-unplaced-only"
          >
            <Icon name="filter" size={14} className="size-3.5" />
            Unplaced
          </ToggleButton>
          <MenuTrigger>
            <AriaButton
              className="film-chip inline-flex cursor-default items-center gap-1.5"
              aria-label={`Sort photos: ${SORT_LABELS[sort]}`}
              data-testid="film-sort"
            >
              <Icon name="arrowDownUp" size={14} className="size-3.5" />
              {SORT_LABELS[sort]}
              <Icon name="chevronDown" size={14} className="size-3.5" />
            </AriaButton>
            <MenuPopover placement="top end" className="min-w-40">
              <Menu
                selectionMode="single"
                selectedKeys={[sort]}
                onAction={(key) => {
                  startTransition(() => {
                    setSort(key as GallerySortKey)
                  })
                }}
                data-testid="film-sort-menu"
              >
                {(Object.keys(SORT_LABELS) as GallerySortKey[]).map((id) => (
                  <MenuItem key={id} id={id} textValue={SORT_LABELS[id]}>
                    {SORT_LABELS[id]}
                  </MenuItem>
                ))}
              </Menu>
            </MenuPopover>
          </MenuTrigger>
          {onChoosePhotoFolder === undefined ? null : (
            <AriaButton
              className="film-chip film-add-folder inline-flex cursor-default items-center gap-1.5 rounded-full"
              isDisabled={importDisabled}
              onPress={() => {
                void onChoosePhotoFolder()
              }}
              data-testid="film-add-folder"
            >
              <Icon name="folderPlus" size={14} className="size-3.5" />
              Add folder…
            </AriaButton>
          )}
        </div>
      </div>
      <div className="mt-0 px-2 pb-1" data-testid="film-panel">
        <Filmstrip sort={sort} unplacedOnly={unplacedOnly} />
      </div>
      {externalDrag ? (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-[var(--select)]/15 text-sm font-medium outline-2 -outline-offset-2 outline-dashed outline-[#8E8E8E]"
          data-testid="film-drop-overlay"
        >
          Drop a folder to add its photos
        </div>
      ) : null}
      {pendingRemoveId === null ? null : (
        <RemovePlacedDialog assetId={pendingRemoveId} />
      )}
    </div>
  )
}

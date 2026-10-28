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
  FILMSTRIP_THUMB_MAX,
  FILMSTRIP_THUMB_MIN,
  FILMSTRIP_THUMB_STEP,
  getFilmstripThumbHeight,
  setFilmstripThumbHeight,
  subscribeFilmstripThumbHeight,
} from './filmstripSize'
import {
  isExternalFilesDrag,
  resolveDroppedFolder,
  STATUS_DROP_FILES_IGNORED,
  STATUS_DROP_FOLDER_ONLY,
} from './filmstripDropFolder'
import { useFilmstripResize, type FilmstripResize } from './useFilmstripResize'
import { Button as AriaButton } from 'react-aria-components'
import { AlertDialog } from '../ui/AlertDialog'
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
import { Filmstrip } from './Filmstrip'
import {
  cancelGalleryRemove,
  confirmGalleryRemove,
  getPendingGalleryRemoveId,
  subscribePendingGalleryRemove,
} from './galleryRemoveRequest'
import { warmNameCollator, type GallerySortKey } from './galleryView'

const SORT_LABELS: Record<GallerySortKey, string> = {
  added: 'Added order',
  captured: 'Capture time',
  name: 'Name',
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

const SLIDER_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

function ResizeSplitter({
  height,
  resize,
}: {
  height: number
  resize: FilmstripResize
}) {
  const startRef = useRef<{ y: number; height: number } | null>(null)
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize filmstrip"
      aria-valuemin={FILMSTRIP_THUMB_MIN}
      aria-valuemax={FILMSTRIP_THUMB_MAX}
      aria-valuenow={height}
      tabIndex={0}
      className="absolute inset-x-0 -top-[3px] z-10 h-1.5 cursor-ns-resize touch-none outline-none hover:bg-[var(--ring)] focus-visible:bg-[var(--ring)]"
      data-testid="film-splitter"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        startRef.current = { y: event.clientY, height }
      }}
      onPointerMove={(event) => {
        const start = startRef.current
        if (start !== null) {
          resize.preview(start.height + (start.y - event.clientY))
        }
      }}
      onPointerUp={() => {
        startRef.current = null
        resize.commit()
      }}
      onPointerCancel={() => {
        startRef.current = null
        resize.cancel()
      }}
      onKeyDown={(event) => {
        const dir =
          event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0
        if (dir !== 0) {
          event.preventDefault()
          setFilmstripThumbHeight(height + dir * FILMSTRIP_THUMB_STEP)
        }
      }}
    />
  )
}

/** Kit bottom dock chrome wrapping the working product Filmstrip. */
export function FilmstripDock({
  onDropPhotoFolder,
}: {
  onDropPhotoFolder?: (directory: FileSystemDirectoryHandle) => Promise<void>
}) {
  const dockRef = useRef<HTMLDivElement>(null)
  const resize = useFilmstripResize(dockRef)
  const thumbHeight = useSyncExternalStore(
    subscribeFilmstripThumbHeight,
    getFilmstripThumbHeight,
    getFilmstripThumbHeight,
  )
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

  return (
    <div
      ref={dockRef}
      className="editor-dock relative shrink-0 data-[drop-hover=true]:outline-2 data-[drop-hover=true]:-outline-offset-2 data-[drop-hover=true]:outline-[var(--select)]"
      data-testid="dock"
      style={{ '--film-thumb-h': `${String(thumbHeight)}px` } as CSSProperties}
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
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          clearDropHover()
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
      <ResizeSplitter height={thumbHeight} resize={resize} />
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
        </span>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="range"
            className="w-28 accent-[var(--select)]"
            aria-label="Thumbnail size"
            data-testid="film-size"
            min={FILMSTRIP_THUMB_MIN}
            max={FILMSTRIP_THUMB_MAX}
            step={FILMSTRIP_THUMB_STEP}
            defaultValue={thumbHeight}
            onChange={(event) => {
              resize.preview(Number(event.currentTarget.value))
            }}
            onPointerUp={resize.commit}
            onKeyUp={(event) => {
              if (SLIDER_KEYS.has(event.key)) {
                resize.commit()
              }
            }}
          />
          <MenuTrigger>
            <AriaButton
              className="film-chip inline-flex cursor-default items-center gap-1.5"
              aria-label={`Sort photos: ${SORT_LABELS[sort]}`}
              data-testid="film-sort"
            >
              <span>Sort:</span> {SORT_LABELS[sort]}
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
          <ToggleButton
            size="sm"
            className="film-chip"
            isSelected={unplacedOnly}
            onChange={(next) => {
              startTransition(() => {
                setUnplacedOnly(next)
              })
            }}
            data-testid="film-unplaced-only"
          >
            Unplaced only
          </ToggleButton>
        </div>
      </div>
      <div className="mt-0 px-2 pb-1" data-testid="film-panel">
        <Filmstrip sort={sort} unplacedOnly={unplacedOnly} />
      </div>
      {pendingRemoveId === null ? null : (
        <RemovePlacedDialog assetId={pendingRemoveId} />
      )}
    </div>
  )
}

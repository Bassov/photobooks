import {
  startTransition,
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { clearDropHover, setDropHover } from './dropHover'
import { setEditorStatus } from './editorStatus'
import { FILMSTRIP_EMPTY_HEIGHT, FILMSTRIP_THUMB_HEIGHT } from './filmstripSize'
import {
  isExternalFilesDrag,
  resolveDroppedFolder,
  STATUS_DROP_FILES_IGNORED,
  STATUS_DROP_FOLDER_ONLY,
} from './filmstripDropFolder'
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
      className="editor-dock relative shrink-0"
      data-testid="dock"
      style={
        {
          '--film-thumb-h': `${String(FILMSTRIP_THUMB_HEIGHT)}px`,
          '--film-empty-h': `${String(FILMSTRIP_EMPTY_HEIGHT)}px`,
        } as CSSProperties
      }
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
              className="film-chip inline-flex cursor-default items-center gap-1.5 rounded-full"
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

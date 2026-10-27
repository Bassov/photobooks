import {
  startTransition,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'
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

/** Kit bottom dock chrome wrapping the working product Filmstrip. */
export function FilmstripDock() {
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
  const shown = unplacedOnly
    ? gallery.filter((id) => !placed.has(id)).length
    : count

  return (
    <div className="editor-dock shrink-0" data-testid="dock">
      <div className="editor-dock-head flex h-10 items-center gap-3 px-3">
        <span
          className="editor-dock-meta text-sm tabular-nums"
          data-testid="film-head"
        >
          <span data-testid="placed-count">
            {unplacedOnly
              ? `Photos · ${String(shown)} of ${String(count)}`
              : `Photos · ${String(count)}`}
          </span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <MenuTrigger>
            <AriaButton
              className="pb-lib-quiet inline-flex cursor-default items-center gap-1.5 px-3"
              aria-label={`Sort photos: ${SORT_LABELS[sort]}`}
              data-testid="film-sort"
            >
              <span className="text-muted-foreground">Sort:</span>{' '}
              {SORT_LABELS[sort]}
              <Icon
                name="chevronDown"
                size={14}
                className="size-3.5 text-muted-foreground"
              />
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
            variant="outline"
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

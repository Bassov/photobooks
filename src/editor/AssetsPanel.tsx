import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type UIEvent,
} from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SegmentedControl } from '../ui/SegmentedControl'
import {
  ASSET_ROW_HEIGHT,
  buildAssetRows,
  rowWindow,
  sortAssetRows,
  usesLabel,
  type AssetRow,
  type AssetsSort,
} from './assetsPanelModel'
import {
  getAssetCacheKey,
  getAssetDisplayName,
  getBookStoreSnapshot,
  subscribeBookStore,
} from './bookStore'
import { setEditorStatus } from './editorStatus'
import { acceptModifiedAsset } from './relink/rescan'
import { getRelinkStatuses, subscribeRelink } from './relink/statusStore'
import { scrollPasteboardToSpread } from './spreadsPanelModel'
import { ensureThumb, getThumbUrl, subscribeThumb } from './thumbCache'

const SORTS = [
  { id: 'status', label: 'Status' },
  { id: 'uses', label: 'Uses' },
]

function RowThumb({ id, missing }: { id: string; missing: boolean }) {
  const url = useSyncExternalStore(
    (listener) => subscribeThumb(id, listener),
    () => getThumbUrl(id),
    () => getThumbUrl(id),
  )
  const cacheKey = useSyncExternalStore(
    subscribeBookStore,
    () => getAssetCacheKey(id),
    () => getAssetCacheKey(id),
  )
  useEffect(() => {
    if (!missing) {
      ensureThumb(id, cacheKey)
    }
  }, [id, cacheKey, missing])
  if (missing || !url) {
    return (
      <div
        className="assets-thumb assets-thumb-empty"
        data-testid="assets-thumb-placeholder"
      />
    )
  }
  return (
    <img
      className="assets-thumb"
      src={url}
      alt=""
      decoding="async"
      data-testid="assets-thumb"
    />
  )
}

const BADGE_COLOR = {
  ok: 'success',
  modified: 'warning',
  missing: 'error',
} as const

function AssetRowView({ row, top }: { row: AssetRow; top: number }) {
  const name = useSyncExternalStore(
    subscribeBookStore,
    () => getAssetDisplayName(row.assetId),
    () => getAssetDisplayName(row.assetId),
  )
  const jump = row.jumpSpreadId
  const body = (
    <>
      <RowThumb id={row.assetId} missing={row.status === 'missing'} />
      <span className="assets-text">
        <span className="assets-name">{name}</span>
        <span className="assets-uses">{usesLabel(row)}</span>
      </span>
    </>
  )
  return (
    <div
      role="listitem"
      className="assets-row"
      data-testid="assets-row"
      data-asset-id={row.assetId}
      data-status={row.status}
      style={{ top, height: ASSET_ROW_HEIGHT }}
    >
      {jump === null ? (
        <div className="assets-main">{body}</div>
      ) : (
        <button
          type="button"
          className="e7-item assets-main"
          data-testid="assets-jump"
          aria-label={`Jump to ${name}`}
          onClick={() => {
            scrollPasteboardToSpread(jump)
            setEditorStatus(
              `Jumped to ${name} on spread ${String(row.spreads[0])}`,
            )
          }}
        >
          {body}
        </button>
      )}
      {row.status === 'modified' ? (
        <Button
          size="sm"
          variant="secondary"
          data-testid="assets-update"
          onPress={() => {
            void acceptModifiedAsset(row.assetId).then((done) => {
              setEditorStatus(
                done
                  ? `${name} updated — previews refreshed, crop kept`
                  : `Rescan from the relink dialog to update ${name}`,
              )
            })
          }}
        >
          Update
        </Button>
      ) : (
        <Badge color={BADGE_COLOR[row.status]} dot data-testid="assets-status">
          {row.status}
        </Badge>
      )}
    </div>
  )
}

/** Assets tab: virtualized list of gallery photos with status, uses and spreads. */
export function AssetsPanel({ modeSwitch }: { modeSwitch?: ReactNode }) {
  const book = useSyncExternalStore(
    subscribeBookStore,
    () => getBookStoreSnapshot().book,
    () => getBookStoreSnapshot().book,
  )
  const statuses = useSyncExternalStore(
    subscribeRelink,
    getRelinkStatuses,
    getRelinkStatuses,
  )
  const [sort, setSort] = useState<AssetsSort>('status')
  const deferredBook = useDeferredValue(book)
  const deferredStatuses = useDeferredValue(statuses)
  const rows = useMemo(
    () => sortAssetRows(buildAssetRows(deferredBook, deferredStatuses), sort),
    [deferredBook, deferredStatuses, sort],
  )
  const [scroll, setScroll] = useState({ top: 0, height: 480 })
  const { start, end } = rowWindow(scroll.top, scroll.height, rows.length)

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    const next = { top: el.scrollTop, height: el.clientHeight }
    startTransition(() => {
      setScroll(next)
    })
  }

  return (
    <aside
      className="editor-assets flex h-full min-h-0 flex-col"
      data-testid="assets-panel"
    >
      {modeSwitch ? (
        <div className="shrink-0 px-3 pb-2 pt-3">{modeSwitch}</div>
      ) : null}
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-1">
        <SegmentedControl
          size="sm"
          label="Sort assets"
          items={SORTS}
          value={sort}
          onChange={(value) => {
            startTransition(() => {
              setSort(value === 'uses' ? 'uses' : 'status')
            })
          }}
        />
        <span className="text-2xs tabular-nums" data-testid="assets-count">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          data-testid="assets-empty"
          title="No photos yet"
          description="Add photos to the gallery to see their status here."
        />
      ) : (
        <div
          className="scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
          data-testid="assets-list"
          data-scrollport="assets-list"
          role="list"
          aria-label="Assets"
          ref={(el) => {
            if (
              el !== null &&
              el.clientHeight > 0 &&
              el.clientHeight !== scroll.height
            ) {
              setScroll((s) => ({ ...s, height: el.clientHeight }))
            }
          }}
          onScroll={onScroll}
        >
          <div
            className="relative"
            style={{ height: rows.length * ASSET_ROW_HEIGHT }}
          >
            {rows.slice(start, end).map((row, i) => (
              <AssetRowView
                key={row.assetId}
                row={row}
                top={(start + i) * ASSET_ROW_HEIGHT}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

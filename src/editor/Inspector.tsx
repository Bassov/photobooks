import { useEffect, useState, useSyncExternalStore } from 'react'
import { COVER_CROP, MAX_CROP_ZOOM, clampCrop } from '../core'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import {
  dispatchBookOp,
  getAssetAspectSnapshot,
  getAssetDisplayName,
  getBookStoreSnapshot,
  getPlacementCountSnapshot,
  subscribeBookStore,
} from './bookStore'
import {
  getCropTarget,
  getCropTargetKey,
  subscribeCropMode,
  type CropTarget,
} from './cropMode'
import { SUB, T } from './editorChromeTokens'
import { getFrameSource, subscribeFrameSelection } from './frameSelection'
import {
  framePhotoRows,
  inspectorView,
  spreadRows,
  spreadTitle,
  type InspectorRow,
} from './inspectorModel'
import { getActiveSpreadId, subscribeActiveSpreadId } from './photoRootSession'

const ZOOM_STEP = 0.01
const EMPTY_HINT = 'Select a spread or a photo to see its properties.'

function readBook() {
  return getBookStoreSnapshot().book
}

/** Kit InspectorPanel: BAR surface, quiet header, rows follow the selection. */
export function Inspector({ onCollapse }: { onCollapse?: () => void }) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  const frameSource = useSyncExternalStore(
    subscribeFrameSelection,
    getFrameSource,
    getFrameSource,
  )
  const activeId = useSyncExternalStore(
    subscribeActiveSpreadId,
    getActiveSpreadId,
    getActiveSpreadId,
  )
  const cropKey = useSyncExternalStore(
    subscribeCropMode,
    getCropTargetKey,
    getCropTargetKey,
  )
  const target = cropKey === '' ? null : getCropTarget()
  // Esc drops the spread view to the empty hint until another spread is picked.
  const [dismissed, setDismissed] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDismissed(getActiveSpreadId())
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  const view = inspectorView(book, frameSource, activeId, dismissed)

  let header = { name: 'Inspector', meta: '' }
  let rows: InspectorRow[] = []
  if (view.kind === 'spread') {
    header = { name: spreadTitle(view.spreadIndex), meta: 'Spread' }
    rows = spreadRows(view.spread)
  } else if (view.kind === 'frame') {
    const assetId = view.frame.assetId
    header = {
      name:
        assetId === undefined ? 'Empty frame' : getAssetDisplayName(assetId),
      meta: 'Photo',
    }
    rows = framePhotoRows(
      book,
      view.frame,
      view.spreadIndex,
      assetId === undefined ? 0 : getPlacementCountSnapshot(assetId),
    )
  }
  return (
    <section
      className="editor-inspector-panel flex min-h-full flex-col"
      aria-label="Inspector"
      data-testid="inspector-panel"
      data-inspector-view={view.kind}
      style={{ color: T }}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 pr-1.5 pl-3">
        <span
          className="min-w-0 truncate text-[13px] font-medium"
          data-testid="inspector-name"
        >
          {header.name}
        </span>
        {header.meta ? (
          <span className="text-xs" style={{ color: SUB }}>
            {header.meta}
          </span>
        ) : null}
        {onCollapse ? (
          <div className="ml-auto flex items-center" style={{ color: SUB }}>
            <IconButton
              label="Collapse inspector ]"
              size="sm"
              placement="left"
              onPress={onCollapse}
              data-testid="panel-collapse-right"
            >
              <Icon name="panelRight" />
            </IconButton>
          </div>
        ) : null}
      </header>
      <div className="px-3 pb-4">
        {view.kind === 'empty' ? (
          <p
            className="text-[12.5px] leading-snug"
            style={{ color: SUB }}
            data-testid="inspector-empty"
          >
            {EMPTY_HINT}
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12.5px]">
            {rows.map((row) => (
              <Row key={row.label} row={row} />
            ))}
          </dl>
        )}
        {target === null ? null : <FitAndCrop target={target} />}
      </div>
    </section>
  )
}

function Row({ row }: { row: InspectorRow }) {
  return (
    <>
      <dt style={{ color: SUB }}>{row.label}</dt>
      <dd className="truncate text-right tabular-nums" title={row.value}>
        {row.value}
      </dd>
    </>
  )
}

function useFrameCrop(target: CropTarget) {
  const book = useSyncExternalStore(subscribeBookStore, readBook, readBook)
  return book.spreads
    .find((spread) => spread.id === target.spreadId)
    ?.frames.find((item) => item.id === target.frameId)
}

/** Crop-mode controls (existing behavior; not the kit FitCrop section). */
function FitAndCrop({ target }: { target: CropTarget }) {
  const frame = useFrameCrop(target)
  if (frame?.assetId === undefined) {
    return null
  }
  const crop = frame.crop ?? COVER_CROP
  const atCover =
    crop.zoom === COVER_CROP.zoom &&
    crop.center.x === COVER_CROP.center.x &&
    crop.center.y === COVER_CROP.center.y
  const aspect = getAssetAspectSnapshot(frame.assetId)
  return (
    <section
      className="mt-4 flex flex-col gap-3"
      data-testid="inspector-fit-crop"
      data-crop-keep=""
      aria-label="Fit and crop"
    >
      <h4 className="text-2xs font-semibold tracking-[0.12em] uppercase">
        Fit &amp; crop
      </h4>
      <label className="flex flex-col gap-1 text-sm">
        <span>Zoom</span>
        <input
          type="range"
          data-testid="crop-zoom"
          min={1}
          max={MAX_CROP_ZOOM}
          step={ZOOM_STEP}
          value={crop.zoom}
          onChange={(event) => {
            dispatchBookOp({
              type: 'setCrop',
              spreadId: target.spreadId,
              frameId: target.frameId,
              crop: clampCrop(
                frame.rect,
                {
                  zoom: Number(event.currentTarget.value),
                  center: crop.center,
                },
                aspect,
              ),
            })
          }}
        />
      </label>
      <Button
        variant="secondary"
        size="sm"
        data-testid="crop-reset"
        isDisabled={atCover}
        onPress={() => {
          dispatchBookOp({
            type: 'resetCrop',
            spreadId: target.spreadId,
            frameId: target.frameId,
          })
        }}
      >
        Reset to cover
      </Button>
    </section>
  )
}

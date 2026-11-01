import { memo, useEffect, useSyncExternalStore } from 'react'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { SpreadView, type FrameControl } from '../render/SpreadView'
import type { ResolvedItem } from '../core'
import { setSpreadVisibleAssetIds } from '../photo/assetPool'
import { selectImageTier } from '../photo/imageTiers'
import { getCommittedZoom, subscribeCommitted } from './cameraStore'
import {
  getBookStoreSnapshot,
  getSpreadPaintSnapshot,
  subscribeSpread,
} from './bookStore'
import { GridOverlay } from './GridOverlay'
import { GuidesOverlay } from './GuidesOverlay'
import { TemplatePreviewOverlay } from './TemplatePreviewOverlay'
import { armFrameDragClick, activateFrame } from './galleryDrop'
import { setDragSource } from './dropHover'
import {
  getEditorStatus,
  setEditorStatus,
  STATUS_FRAME_DRAG,
} from './editorStatus'
import {
  encodeFrameDrag,
  FRAME_DRAG_MIME,
  isPointerActivation,
} from './dropTargets'
import { enterCropMode, getCropTarget, subscribeCropMode } from './cropMode'
import {
  frameControlLabel,
  getSpreadFrameSourceKey,
  setFrameSource,
  sourceFrameFilled,
  sourceFromKey,
  subscribeSpreadFrameSource,
} from './frameSelection'
import {
  clearSpreadTiers,
  getTierDisplaySnapshot,
  subscribeTierDisplay,
} from './tierDisplay'
import { holdDisplayTiers } from './holdDisplayTiers'
import { getThumbUrl, subscribeThumb } from './thumbCache'
import {
  getProblemRevisionSnapshot,
  missingAssetChecker,
  subscribeRelink,
} from './relink'
import {
  assetIdsOnSpread,
  desiredTiersForItems,
  isFramePressed,
  positiveDevicePixelRatio,
  resolveSpreadPreviewUrl,
  subscribeAssetIds,
  thumbSnapshotFor,
  tierDisplayKeyFor,
  tierNumberFromKey,
} from './spreadPreviewKeys'

/** Frame id in crop mode on this spread, else `''` (keeps other spreads quiet). */
function cropFrameOnSpread(spreadId: string): string {
  const target = getCropTarget()
  return target?.spreadId === spreadId ? target.frameId : ''
}

/** Committed crop zoom of a frame (1 = cover); the paint snapshot re-renders on change. */
function cropZoomOf(spreadId: string, frameId: string): number {
  const spread = getBookStoreSnapshot().book.spreads.find(
    (item) => item.id === spreadId,
  )
  return spread?.frames.find((item) => item.id === frameId)?.crop?.zoom ?? 1
}

export const ConnectedSpreadView = memo(function ConnectedSpreadView({
  spreadId,
  pxPerMm = SPREAD_PX_PER_MM,
  lowDpiBadge,
  editorLayer = true,
}: {
  spreadId: string
  pxPerMm?: number
  /** Editor layer (frame controls, grid, guides, template preview); off in Preview. */
  editorLayer?: boolean
  /** Overrides the DPI view flag (Preview passes `false`). */
  lowDpiBadge?: boolean
}) {
  const snapshot = useSyncExternalStore(
    (listener) => subscribeSpread(spreadId, listener),
    () => getSpreadPaintSnapshot(spreadId),
    () => getSpreadPaintSnapshot(spreadId),
  )
  const zoom = useSyncExternalStore(
    subscribeCommitted,
    getCommittedZoom,
    getCommittedZoom,
  )
  const frameSourceKey = useSyncExternalStore(
    (listener) => subscribeSpreadFrameSource(spreadId, listener),
    () => getSpreadFrameSourceKey(spreadId),
    () => getSpreadFrameSourceKey(spreadId),
  )
  const frameSource = sourceFromKey(spreadId, frameSourceKey)
  const cropFrameId = useSyncExternalStore(
    subscribeCropMode,
    () => cropFrameOnSpread(spreadId),
    () => cropFrameOnSpread(spreadId),
  )
  const spreadAssetIds =
    snapshot === undefined ? [] : assetIdsOnSpread(snapshot.resolved.items)
  // Per-spread keys: global tier/thumb emits must not re-render unrelated spreads.
  const tierDisplayKey = useSyncExternalStore(
    subscribeTierDisplay,
    () => tierDisplayKeyFor(spreadAssetIds, getTierDisplaySnapshot().urls),
    () => tierDisplayKeyFor(spreadAssetIds, getTierDisplaySnapshot().urls),
  )
  const thumbSnapshot = useSyncExternalStore(
    (listener) => subscribeAssetIds(spreadAssetIds, subscribeThumb, listener),
    () => thumbSnapshotFor(spreadAssetIds, getThumbUrl),
    () => thumbSnapshotFor(spreadAssetIds, getThumbUrl),
  )
  const relinkRevision = useSyncExternalStore(
    subscribeRelink,
    getProblemRevisionSnapshot,
    getProblemRevisionSnapshot,
  )

  useEffect(() => {
    if (snapshot === undefined) {
      clearSpreadTiers(spreadId)
      setSpreadVisibleAssetIds(spreadId, [])
      return
    }
    setSpreadVisibleAssetIds(
      spreadId,
      assetIdsOnSpread(snapshot.resolved.items),
    )
    const tiers = desiredTiersForItems(
      snapshot.resolved.items,
      zoom,
      positiveDevicePixelRatio(),
      SPREAD_PX_PER_MM,
      selectImageTier,
    )
    const releaseTiers = holdDisplayTiers(spreadId, tiers)
    return () => {
      releaseTiers()
      setSpreadVisibleAssetIds(spreadId, [])
    }
  }, [snapshot, spreadId, zoom])

  if (snapshot === undefined) {
    return null
  }
  const frameControlFor = (item: ResolvedItem): FrameControl => {
    const filled = item.assetId !== undefined
    const frame = { spreadId, frameId: item.frameId }
    const pressed = isFramePressed(frameSourceKey, item.frameId)
    const control: FrameControl = {
      label: frameControlLabel(
        filled,
        frameSource,
        frame,
        // Another spread keeps the move wording (its key does not track
        // whether the selected frame is empty).
        frameSource === null ||
          frameSourceKey === '' ||
          sourceFrameFilled(frameSource),
      ),
      onActivate: (event) => {
        activateFrame(
          spreadId,
          item.frameId,
          filled,
          isPointerActivation(event),
        )
      },
    }
    if (pressed) {
      control.pressed = true
    }
    if (filled) {
      control.onDoubleActivate = () => {
        setFrameSource(null)
        enterCropMode(spreadId, item.frameId)
      }
    }
    if (cropFrameId === item.frameId) {
      control.cropActive = true
      control.cropZoom = cropZoomOf(spreadId, item.frameId)
    }
    if (filled) {
      control.onDragStart = (event) => {
        event.dataTransfer.setData(FRAME_DRAG_MIME, encodeFrameDrag(frame))
        event.dataTransfer.effectAllowed = 'move'
        armFrameDragClick()
        setEditorStatus(STATUS_FRAME_DRAG)
        // Kit canvas.tsx:106 clears on drag end; a drop result stays.
        document.addEventListener(
          'dragend',
          () => {
            if (getEditorStatus() === STATUS_FRAME_DRAG) {
              setEditorStatus('')
            }
          },
          { once: true },
        )
        const source =
          event.currentTarget.closest<HTMLElement>('[data-frame-id]')
        // After the browser snapshots the drag image, so the ghost stays opaque.
        setTimeout(() => {
          setDragSource(source)
        }, 0)
      }
    }
    return control
  }
  // Preview mounts no editor layer at all: no frame controls (selection,
  // handles, crop, drag), grid, guides or template preview.
  const editorProps = editorLayer
    ? {
        overlay: (
          <>
            <GridOverlay spreadId={spreadId} pxPerMm={pxPerMm} />
            <GuidesOverlay spreadId={spreadId} pxPerMm={pxPerMm} />
            <TemplatePreviewOverlay spreadId={spreadId} />
          </>
        ),
        frameControlFor,
      }
    : {}
  return (
    <SpreadView
      spreadId={spreadId}
      resolved={snapshot.resolved}
      pxPerMm={pxPerMm}
      lowDpiBadge={lowDpiBadge ?? false}
      {...editorProps}
      isMissingAsset={missingAssetChecker(relinkRevision)}
      previewUrlFor={(assetId) =>
        resolveSpreadPreviewUrl(
          assetId,
          tierDisplayKey,
          thumbSnapshot,
          snapshot.previewUrlFor(assetId),
        )
      }
      tierFor={(assetId) => tierNumberFromKey(tierDisplayKey, assetId)}
    />
  )
})

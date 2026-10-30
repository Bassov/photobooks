import { memo, useEffect, useSyncExternalStore } from 'react'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { SpreadView, type FrameControl } from '../render/SpreadView'
import { setSpreadVisibleAssetIds } from '../photo/assetPool'
import { IMAGE_TIERS, selectImageTier } from '../photo/imageTiers'
import { getTierUrl, requestTier, subscribeTier } from '../photo/tierCache'
import { getCommittedZoom, subscribeCommitted } from './cameraStore'
import {
  getAssetCacheKey,
  getBookStoreSnapshot,
  getSpreadPaintSnapshot,
  subscribeSpread,
} from './bookStore'
import { getDpiView, subscribeDpiView } from './dpiView'
import { GridOverlay } from './GridOverlay'
import { GuidesOverlay } from './GuidesOverlay'
import { armFrameDragClick, activateFrame } from './galleryDrop'
import { setDragSource } from './dropHover'
import {
  getEditorStatus,
  setEditorStatus,
  STATUS_FRAME_DRAG,
} from './editorStatus'
import { encodeFrameDrag, FRAME_DRAG_MIME } from './dropTargets'
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
  clearStaleDisplayedPreview,
  getTierDisplaySnapshot,
  maxDesiredTier,
  queueTierSwap,
  setSpreadTiers,
  subscribeTierDisplay,
} from './tierDisplay'
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
  queueCachedLadderTiers,
  resolveMaxDesiredTier,
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
  /** Editor-only guides layer; off in Preview. */
  editorLayer?: boolean
  /** Overrides the DPI view flag (Preview passes `false`). */
  lowDpiBadge?: boolean
}) {
  const snapshot = useSyncExternalStore(
    (listener) => subscribeSpread(spreadId, listener),
    () => getSpreadPaintSnapshot(spreadId),
    () => getSpreadPaintSnapshot(spreadId),
  )
  const dpiView = useSyncExternalStore(subscribeDpiView, getDpiView, getDpiView)
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
    setSpreadTiers(spreadId, tiers)
    const unsubs: (() => void)[] = []
    for (const [assetId, spreadTier] of tiers) {
      const tier = resolveMaxDesiredTier(assetId, spreadTier, maxDesiredTier)
      clearStaleDisplayedPreview(assetId, getTierUrl)
      unsubs.push(
        subscribeTier(assetId, tier, () => {
          const url = getTierUrl(assetId, tier)
          if (url !== undefined) {
            queueTierSwap(assetId, tier, url)
          }
        }),
      )
      requestTier(assetId, tier, getAssetCacheKey(assetId))
      queueCachedLadderTiers(
        assetId,
        tier,
        IMAGE_TIERS,
        getTierUrl,
        queueTierSwap,
      )
    }
    return () => {
      clearSpreadTiers(spreadId)
      setSpreadVisibleAssetIds(spreadId, [])
      for (const unsub of unsubs) {
        unsub()
      }
    }
  }, [snapshot, spreadId, zoom])

  if (snapshot === undefined) {
    return null
  }
  return (
    <SpreadView
      spreadId={spreadId}
      resolved={snapshot.resolved}
      pxPerMm={pxPerMm}
      lowDpiBadge={lowDpiBadge ?? dpiView}
      overlay={
        <>
          <GridOverlay spreadId={spreadId} pxPerMm={pxPerMm} />
          {editorLayer ? (
            <GuidesOverlay spreadId={spreadId} pxPerMm={pxPerMm} />
          ) : null}
        </>
      }
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
      frameControlFor={(item) => {
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
          onActivate: () => {
            activateFrame(spreadId, item.frameId, filled)
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
      }}
    />
  )
})

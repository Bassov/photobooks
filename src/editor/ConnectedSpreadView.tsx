import { memo, useEffect, useSyncExternalStore } from 'react'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { SpreadView, type FrameControl } from '../render/SpreadView'
import { selectImageTier } from '../photo/imageTiers'
import { getTierUrl, requestTier, subscribeTier } from '../photo/tierCache'
import { getCommittedZoom, subscribeCommitted } from './cameraStore'
import {
  getAssetContentHash,
  getSpreadPaintSnapshot,
  subscribeSpread,
} from './bookStore'
import { armFrameDragClick, activateFrame } from './galleryDrop'
import { encodeFrameDrag, FRAME_DRAG_MIME } from './dropTargets'
import {
  frameControlLabel,
  getSpreadFrameSourceKey,
  sourceFromKey,
  subscribeSpreadFrameSource,
} from './frameSelection'
import {
  getGalleryPhotoSelected,
  subscribeGalleryPhotoSelected,
} from './gallerySelection'
import {
  clearSpreadTiers,
  getTierDisplaySnapshot,
  maxDesiredTier,
  queueTierSwap,
  setSpreadTiers,
  subscribeTierDisplay,
} from './tierDisplay'
import { getThumbUrl, subscribeThumb } from './thumbCache'
import {
  assetIdsOnSpread,
  desiredTiersForItems,
  isFramePressed,
  positiveDevicePixelRatio,
  queueReadyTierIfCached,
  resolveMaxDesiredTier,
  resolveSpreadPreviewUrl,
  subscribeAssetIds,
  thumbSnapshotFor,
  tierDisplayKeyFor,
  tierNumberFromKey,
} from './spreadPreviewKeys'

export const ConnectedSpreadView = memo(function ConnectedSpreadView({
  spreadId,
  pxPerMm = SPREAD_PX_PER_MM,
}: {
  spreadId: string
  pxPerMm?: number
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
  const galleryPhotoSelected = useSyncExternalStore(
    subscribeGalleryPhotoSelected,
    getGalleryPhotoSelected,
    getGalleryPhotoSelected,
  )
  const frameSourceKey = useSyncExternalStore(
    (listener) => subscribeSpreadFrameSource(spreadId, listener),
    () => getSpreadFrameSourceKey(spreadId),
    () => getSpreadFrameSourceKey(spreadId),
  )
  const frameSource = sourceFromKey(spreadId, frameSourceKey)
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

  useEffect(() => {
    if (snapshot === undefined) {
      clearSpreadTiers(spreadId)
      return
    }
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
      unsubs.push(
        subscribeTier(assetId, tier, () => {
          const url = getTierUrl(assetId, tier)
          if (url !== undefined) {
            queueTierSwap(assetId, tier, url)
          }
        }),
      )
      requestTier(assetId, tier, getAssetContentHash(assetId))
      queueReadyTierIfCached(assetId, tier, getTierUrl, queueTierSwap)
    }
    return () => {
      clearSpreadTiers(spreadId)
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
            galleryPhotoSelected,
            frameSource,
            frame,
          ),
          onActivate: () => {
            activateFrame(spreadId, item.frameId, filled)
          },
        }
        if (pressed) {
          control.pressed = true
        }
        if (filled) {
          control.onDragStart = (event) => {
            event.dataTransfer.setData(FRAME_DRAG_MIME, encodeFrameDrag(frame))
            event.dataTransfer.effectAllowed = 'move'
            armFrameDragClick()
          }
        }
        return control
      }}
    />
  )
})

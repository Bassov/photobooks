import { memo, useEffect, useSyncExternalStore } from 'react'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { SpreadView, type FrameControl } from '../render/SpreadView'
import { selectImageTier } from '../photo/imageTiers'
import { getTierUrl, requestTier, subscribeTier } from '../photo/tierCache'
import { getCommittedZoom, subscribeCommitted } from './cameraStore'
import { getSpreadPaintSnapshot, subscribeSpread } from './bookStore'
import { armFrameDragClick, activateFrame } from './galleryDrop'
import { encodeFrameDrag, FRAME_DRAG_MIME } from './dropTargets'
import {
  frameControlLabel,
  getSpreadFrameSourceKey,
  subscribeSpreadFrameSource,
  type FrameSource,
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

const SOURCE_ON_ANOTHER_SPREAD: FrameSource = {
  spreadId: '',
  frameId: '',
}

function sourceFromKey(
  spreadId: string,
  key: string | null,
): FrameSource | null {
  if (key === null) {
    return null
  }
  if (key === '') {
    return SOURCE_ON_ANOTHER_SPREAD
  }
  return { spreadId, frameId: key }
}

function devicePixelRatio(): number {
  const ratio = globalThis.devicePixelRatio
  return typeof ratio === 'number' && ratio > 0 ? ratio : 1
}

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
  const tierSnapshot = useSyncExternalStore(
    subscribeTierDisplay,
    getTierDisplaySnapshot,
    getTierDisplaySnapshot,
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

  useEffect(() => {
    if (snapshot === undefined) {
      clearSpreadTiers(spreadId)
      return
    }
    const dpr = devicePixelRatio()
    const tiers = new Map<string, number>()
    for (const item of snapshot.resolved.items) {
      const assetId = item.assetId
      if (assetId === undefined) {
        continue
      }
      const edge =
        Math.max(item.rectMm.width, item.rectMm.height) * SPREAD_PX_PER_MM
      const tier = selectImageTier(edge * zoom, dpr)
      const prev = tiers.get(assetId)
      if (prev === undefined || tier > prev) {
        tiers.set(assetId, tier)
      }
    }
    setSpreadTiers(spreadId, tiers)
    const unsubs: (() => void)[] = []
    for (const assetId of tiers.keys()) {
      const tier = maxDesiredTier(assetId)
      if (tier === undefined) {
        continue
      }
      unsubs.push(
        subscribeTier(assetId, tier, () => {
          const url = getTierUrl(assetId, tier)
          if (url !== undefined) {
            queueTierSwap(assetId, tier, url)
          }
        }),
      )
      requestTier(assetId, tier)
      const ready = getTierUrl(assetId, tier)
      if (ready !== undefined) {
        queueTierSwap(assetId, tier, ready)
      }
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
        tierSnapshot.urls.get(assetId)?.url ?? snapshot.previewUrlFor(assetId)
      }
      tierFor={(assetId) => tierSnapshot.urls.get(assetId)?.tier}
      frameControlFor={(item) => {
        const filled = item.assetId !== undefined
        const frame = { spreadId, frameId: item.frameId }
        const pressed =
          frameSourceKey !== null &&
          frameSourceKey !== '' &&
          frameSourceKey === item.frameId
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

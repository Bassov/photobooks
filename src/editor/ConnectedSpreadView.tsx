import { memo, useEffect, useSyncExternalStore } from 'react'
import { SPREAD_PX_PER_MM } from '../render/frameBox'
import { SpreadView } from '../render/SpreadView'
import { selectImageTier } from '../photo/imageTiers'
import { getTierUrl, requestTier, subscribeTier } from '../photo/tierCache'
import { getCommittedZoom, subscribeCommitted } from './cameraStore'
import { getSpreadPaintSnapshot, subscribeSpread } from './bookStore'
import {
  clearSpreadTiers,
  getTierDisplaySnapshot,
  maxDesiredTier,
  queueTierSwap,
  setSpreadTiers,
  subscribeTierDisplay,
} from './tierDisplay'

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
    />
  )
})

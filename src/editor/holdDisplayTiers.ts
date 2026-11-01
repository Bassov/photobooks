import { IMAGE_TIERS } from '../photo/imageTiers'
import { getTierUrl, requestTier, subscribeTier } from '../photo/tierCache'
import { getAssetCacheKey } from './bookStore'
import {
  queueCachedLadderTiers,
  resolveMaxDesiredTier,
} from './spreadPreviewKeys'
import {
  clearSpreadTiers,
  clearStaleDisplayedPreview,
  maxDesiredTier,
  queueTierSwap,
  setSpreadTiers,
} from './tierDisplay'

/**
 * Note `tiers` (asset id → covering tier) under `slotId`, request each tier
 * (worker encode or DerivedCache hit) and queue its decoded swap into the
 * shared tier display. Returns the release for the slot's note and listeners.
 */
export function holdDisplayTiers(
  slotId: string,
  tiers: ReadonlyMap<string, number>,
): () => void {
  setSpreadTiers(slotId, tiers)
  const unsubs: (() => void)[] = []
  for (const [assetId, slotTier] of tiers) {
    const tier = resolveMaxDesiredTier(assetId, slotTier, maxDesiredTier)
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
    clearSpreadTiers(slotId)
    for (const unsub of unsubs) {
      unsub()
    }
  }
}

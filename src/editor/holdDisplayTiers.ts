import {
  capTierToSource,
  IMAGE_TIERS,
  selectImageTier,
  WORKING_PREVIEW_EDGE,
} from '../photo/imageTiers'
import { getTierUrl, requestTier, subscribeTier } from '../photo/tierCache'
import { getAssetCacheKey, getAssetPixelSizeSnapshot } from './bookStore'
import {
  positiveDevicePixelRatio,
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
 * shared tier display. A tier above the working preview also requests 1280
 * so the first upgrade lands fast. Returns the release for the slot's note
 * and listeners (the last listener aborts an in-flight job).
 */
export function holdDisplayTiers(
  slotId: string,
  tiers: ReadonlyMap<string, number>,
): () => void {
  const capped = new Map<string, number>()
  for (const [assetId, tier] of tiers) {
    capped.set(assetId, capTierToSource(tier, sourceLongEdge(assetId)))
  }
  setSpreadTiers(slotId, capped)
  const unsubs: (() => void)[] = []
  for (const [assetId, slotTier] of capped) {
    const tier = resolveMaxDesiredTier(assetId, slotTier, maxDesiredTier)
    clearStaleDisplayedPreview(assetId, getTierUrl)
    const steps =
      tier > WORKING_PREVIEW_EDGE ? [WORKING_PREVIEW_EDGE, tier] : [tier]
    for (const step of steps) {
      unsubs.push(
        subscribeTier(assetId, step, () => {
          const url = getTierUrl(assetId, step)
          if (url !== undefined) {
            queueTierSwap(assetId, step, url)
          }
        }),
      )
      requestTier(assetId, step, getAssetCacheKey(assetId))
    }
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

function sourceLongEdge(assetId: string): number | undefined {
  const size = getAssetPixelSizeSnapshot(assetId)
  return size === undefined ? undefined : Math.max(size.widthPx, size.heightPx)
}

let dragHold: { assetId: string; tier: number; release: () => void } | undefined
let dragSlot = 0

/**
 * While an asset is dragged, hold the tier a frame of `edgeCssPx` needs on
 * this screen (dragstart passes 0 → 1280) so it is decoded before the drop.
 * Only raises within a drag; the new hold lands before the old one releases
 * so shared tier jobs keep running.
 */
export function holdDragTier(assetId: string, edgeCssPx: number): void {
  const tier = selectImageTier(edgeCssPx, positiveDevicePixelRatio())
  if (dragHold?.assetId === assetId && dragHold.tier >= tier) {
    return
  }
  // Stryker disable next-line AssignmentOperator: any step keeps slot ids unique
  dragSlot += 1
  const release = holdDisplayTiers(
    `drag-tier:${String(dragSlot)}`,
    new Map([[assetId, tier]]),
  )
  dragHold?.release()
  dragHold = { assetId, tier, release }
}

/**
 * Linger after drag end: the dropped frame's spread subscribes in a later
 * React commit, and an earlier release would abort the job it is about to need.
 */
export const DRAG_TIER_LINGER_MS = 1000

/** End of an asset drag: drop the hold soon (shown previews stay displayed). */
export function releaseDragTier(): void {
  const hold = dragHold
  dragHold = undefined
  if (hold !== undefined) {
    setTimeout(hold.release, DRAG_TIER_LINGER_MS)
  }
}

import { useEffect, useSyncExternalStore } from 'react'
import { selectImageTier } from '../photo/imageTiers'
import { holdDisplayTiers } from './holdDisplayTiers'
import { getDisplayedPreview, subscribeTierDisplay } from './tierDisplay'
import { useCoverPhotoUrl } from './useCoverPhotoUrl'

/**
 * Photo URL outside a spread (cover): the decoded working preview once the
 * shared tier display shows it, else the filmstrip thumb. Without `slotId` it
 * registers no tier and stays on the thumb (inert thumbnails).
 */
export function useTierPreviewUrl(
  assetId: string | undefined,
  slotId: string | undefined,
): string | undefined {
  const thumbUrl = useCoverPhotoUrl(assetId)
  const readTierUrl = (): string | undefined =>
    assetId === undefined || slotId === undefined
      ? undefined
      : getDisplayedPreview(assetId)
  const tierUrl = useSyncExternalStore(
    subscribeTierDisplay,
    readTierUrl,
    readTierUrl,
  )
  useEffect(() => {
    if (assetId === undefined || slotId === undefined) {
      return
    }
    return holdDisplayTiers(slotId, new Map([[assetId, selectImageTier()]]))
  }, [assetId, slotId])
  return tierUrl ?? thumbUrl
}

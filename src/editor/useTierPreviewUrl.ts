import { useEffect, useSyncExternalStore } from 'react'
import { selectImageTier } from '../photo/imageTiers'
import { holdDisplayTiers } from './holdDisplayTiers'
import { getTierDisplaySnapshot, subscribeTierDisplay } from './tierDisplay'
import { useThumbUrl } from './useThumbUrl'

export interface TierPreview {
  url: string | undefined
  /** Edge of the shown working preview; undefined while the thumb shows. */
  tier: number | undefined
}

/**
 * Photo outside a spread (cover, endpaper): the decoded working preview once
 * the shared tier display shows it, else the filmstrip thumb. Without `slotId`
 * it registers no tier and stays on the thumb (inert thumbnails).
 */
export function useTierPreviewUrl(
  assetId: string | undefined,
  slotId: string | undefined,
): TierPreview {
  const thumbUrl = useThumbUrl(assetId)
  const readShown = () =>
    assetId === undefined || slotId === undefined
      ? undefined
      : getTierDisplaySnapshot().urls.get(assetId)
  const shown = useSyncExternalStore(subscribeTierDisplay, readShown, readShown)
  useEffect(() => {
    if (assetId === undefined || slotId === undefined) {
      return
    }
    return holdDisplayTiers(slotId, new Map([[assetId, selectImageTier()]]))
  }, [assetId, slotId])
  return shown ?? { url: thumbUrl, tier: undefined }
}

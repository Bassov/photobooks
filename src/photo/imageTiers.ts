export const IMAGE_TIERS = [320, 640, 1280, 2560] as const

export type ImageTier = (typeof IMAGE_TIERS)[number]

const LARGEST_TIER: ImageTier = 2560

/** Smallest long edge that covers `onScreenLongEdgePx * dpr`, else 2560. */
export function selectImageTier(
  onScreenLongEdgePx: number,
  dpr: number,
): ImageTier {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  const edge =
    Number.isFinite(onScreenLongEdgePx) && onScreenLongEdgePx > 0
      ? onScreenLongEdgePx
      : 0
  const need = edge * ratio
  for (const tier of IMAGE_TIERS) {
    if (tier >= need) {
      return tier
    }
  }
  return LARGEST_TIER
}

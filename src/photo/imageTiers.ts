/** Working pasteboard preview long edge (first ladder step). */
export const WORKING_PREVIEW_EDGE = 1280

/** HiDPI ladder step: frames whose device-pixel long edge exceeds 1280. */
export const HIDPI_PREVIEW_EDGE = 2560

export const IMAGE_TIERS = [WORKING_PREVIEW_EDGE, HIDPI_PREVIEW_EDGE] as const

/**
 * Smallest ladder step covering `cssPx × dpr` device pixels; 2560 above that
 * (deep zoom stays on 2560). No arguments → the working preview.
 */
export function selectImageTier(cssPx = 0, dpr = 1): number {
  const need = cssPx * dpr
  for (const tier of IMAGE_TIERS) {
    if (tier >= need) {
      return tier
    }
  }
  return HIDPI_PREVIEW_EDGE
}

/**
 * A source no larger than the working preview gains nothing from 2560 (the
 * worker never upscales non-cover sources); unknown size keeps the tier.
 */
export function capTierToSource(
  tier: number,
  sourceLongEdge: number | undefined,
): number {
  return (sourceLongEdge ?? Infinity) <= WORKING_PREVIEW_EDGE
    ? Math.min(tier, WORKING_PREVIEW_EDGE)
    : tier
}

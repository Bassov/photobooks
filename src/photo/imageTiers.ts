/** Working pasteboard preview long edge (only zoom/preview tier). */
export const WORKING_PREVIEW_EDGE = 1280

export const IMAGE_TIERS = [WORKING_PREVIEW_EDGE] as const

export type ImageTier = (typeof IMAGE_TIERS)[number]

/**
 * Pasteboard preview size. Always the working edge — intermediate ladder
 * steps (640/2560) were removed; zoom sharpness beyond 1280 is acceptable.
 */
export function selectImageTier(): ImageTier {
  return WORKING_PREVIEW_EDGE
}

/** Kit override badge (Designer PO3): 66.42 × 16.84 px, inset 4 px. */
const BADGE_FULL_WIDTH_PX = 67
const BADGE_INSET_PX = 4
const BADGE_MIN_HEIGHT_PX = 24.84
const BADGE_ICON_MIN_WIDTH_PX = 26

export type OverrideBadgeFit = 'full' | 'icon' | 'none'

/**
 * What a copy's frame of `widthPx` × `heightPx` screen px shows: the full
 * "override" badge, the icon alone, or nothing (M85 chip pattern).
 */
export function overrideBadgeFit(
  widthPx: number,
  heightPx: number,
): OverrideBadgeFit {
  if (heightPx < BADGE_MIN_HEIGHT_PX) {
    return 'none'
  }
  if (widthPx >= BADGE_FULL_WIDTH_PX + 2 * BADGE_INSET_PX) {
    return 'full'
  }
  return widthPx >= BADGE_ICON_MIN_WIDTH_PX ? 'icon' : 'none'
}

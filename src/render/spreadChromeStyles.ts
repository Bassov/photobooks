import type { CSSProperties } from 'react'

/**
 * Pressed move-source ring is painted by CSS `::after` (inset box-shadow) so it
 * stays above the photo at every layout zoom. Layout style is unchanged.
 */
export const spreadFrameSelectedStyle: CSSProperties = {}

export function spreadFrameControlStyle(
  layout: CSSProperties,
  pressed: boolean,
): CSSProperties {
  return pressed ? { ...layout, ...spreadFrameSelectedStyle } : layout
}

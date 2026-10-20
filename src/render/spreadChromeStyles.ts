import type { CSSProperties } from 'react'

/** Selected frame outline — `--select`, distinct from `:focus-visible` `--ring`. */
export const spreadFrameSelectedStyle: CSSProperties = {
  outline: '3px solid var(--select)',
  outlineOffset: -3,
}

export function spreadFrameControlStyle(
  layout: CSSProperties,
  pressed: boolean,
): CSSProperties {
  return pressed ? { ...layout, ...spreadFrameSelectedStyle } : layout
}

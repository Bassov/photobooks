/** Display-only spine proportion (kit `SPINE` 1.2 cm); print width is P4 `cover-editor`. */
export const COVER_SPINE_MM = 12

/** Display-only wrap (kit "Wrap 15 mm"); the print value is P4 `cover-editor`. */
export const COVER_WRAP_MM = 15

export interface CoverLayout {
  /** `aspect-ratio` of the whole cover, back · spine · front. */
  aspectRatio: string
  /** Width that fits the stage (a size container) without scrolling. */
  fitWidth: string
  /** Panel widths in percent of the cover. */
  pagePct: number
  spinePct: number
  /** Wrap guide inset from the cover edge, percent of height / width. */
  wrapInsetYPct: number
  wrapInsetXPct: number
}

export function coverLayout(pageWMm: number, pageHMm: number): CoverLayout {
  const coverW = 2 * pageWMm + COVER_SPINE_MM
  return {
    aspectRatio: `${String(coverW)} / ${String(pageHMm)}`,
    fitWidth: `min(100cqw, 100cqh * ${String(coverW / pageHMm)})`,
    pagePct: (pageWMm / coverW) * 100,
    spinePct: (COVER_SPINE_MM / coverW) * 100,
    wrapInsetYPct: (COVER_WRAP_MM / pageHMm) * 100,
    wrapInsetXPct: (COVER_WRAP_MM / coverW) * 100,
  }
}

/**
 * Effective print resolution of a photo covering one cover panel (cover fit,
 * so the tighter axis limits it), divided by the crop zoom.
 */
export function coverPanelPpi(
  photoPx: { widthPx: number; heightPx: number },
  panelMm: { widthMm: number; heightMm: number },
  zoom: number,
): number {
  const perMm = Math.min(
    photoPx.widthPx / panelMm.widthMm,
    photoPx.heightPx / panelMm.heightMm,
  )
  return Math.round((perMm * 25.4) / zoom)
}

/** Display-only spine proportion (kit `SPINE` 1.2 cm); print width is P4 `cover-editor`. */
export const COVER_SPINE_MM = 12

export interface CoverLayout {
  /** `aspect-ratio` of the whole cover, back · spine · front. */
  aspectRatio: string
  /** Width that fits the stage (a size container) without scrolling. */
  fitWidth: string
  /** Panel widths in percent of the cover. */
  pagePct: number
  spinePct: number
}

export function coverLayout(pageWMm: number, pageHMm: number): CoverLayout {
  const coverW = 2 * pageWMm + COVER_SPINE_MM
  return {
    aspectRatio: `${String(coverW)} / ${String(pageHMm)}`,
    fitWidth: `min(100cqw, 100cqh * ${String(coverW / pageHMm)})`,
    pagePct: (pageWMm / coverW) * 100,
    spinePct: (COVER_SPINE_MM / coverW) * 100,
  }
}

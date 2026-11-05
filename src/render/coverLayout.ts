import type { CoverGeometry } from '../core/print/coverGeometry'
import type { RectMm } from '../core/geometry/types'

/** Box in percent of its parent (left / top / width / height). */
export interface PctBox {
  left: number
  top: number
  width: number
  height: number
}

/** Designer cover-editor spec: the printed sheet in percent of its box. */
export interface CoverLayout {
  /** `aspect-ratio` of the printed sheet (cover plus the wrap band). */
  sheetAspectRatio: string
  /** Sheet width that fits the stage (a size container) without scrolling. */
  sheetFitWidth: string
  /** `aspect-ratio` of the closed cover, back · spine · front. */
  aspectRatio: string
  /** Closed cover inside the sheet. */
  cover: PctBox
  /** Panel widths in percent of the closed cover. */
  pagePct: number
  spinePct: number
  /** Sheet paint stops: back ends at `spineFrom`, spine at `spineTo`. */
  spineFromPct: number
  spineToPct: number
  hingeBack: PctBox
  hingeFront: PctBox
  safeBack: PctBox
  safeFront: PctBox
  /** Band height (top / bottom strips) and width (side strips), sheet %. */
  bandYPct: number
  bandXPct: number
  /** Front photo overflow past the board: top / bottom (of trim height), outer side (of trim width). */
  photoOverflowYPct: number
  photoOverflowXPct: number
  /** Spine width and spine text length as fractions of the closed cover width. */
  spineFrac: number
  spineLenFrac: number
  /** Band height as a fraction of trim height: labels sit under the sheet. */
  bandOfTrim: number
  /** Sheet x fraction where the front board starts (photo drops from here). */
  frontDropFrom: number
}

function pctBox(rect: RectMm, sheetW: number, sheetH: number): PctBox {
  return {
    left: (rect.x / sheetW) * 100,
    top: (rect.y / sheetH) * 100,
    width: (rect.width / sheetW) * 100,
    height: (rect.height / sheetH) * 100,
  }
}

export function coverLayout(geometry: CoverGeometry): CoverLayout {
  const { trimW, trimH, spine, wrap, safe, coverW, sheetW, sheetH, rects } =
    geometry
  const box = (rect: RectMm) => pctBox(rect, sheetW, sheetH)
  return {
    sheetAspectRatio: `${String(sheetW)} / ${String(sheetH)}`,
    sheetFitWidth: `min(100cqw, 100cqh * ${String(sheetW / sheetH)})`,
    aspectRatio: `${String(coverW)} / ${String(trimH)}`,
    cover: box(rects.cover),
    pagePct: (trimW / coverW) * 100,
    spinePct: (spine / coverW) * 100,
    spineFromPct: (rects.spine.x / sheetW) * 100,
    spineToPct: ((rects.spine.x + spine) / sheetW) * 100,
    hingeBack: box(rects.hingeBack),
    hingeFront: box(rects.hingeFront),
    safeBack: box(rects.safeBack),
    safeFront: box(rects.safeFront),
    bandYPct: (wrap / sheetH) * 100,
    bandXPct: (wrap / sheetW) * 100,
    photoOverflowYPct: (wrap / trimH) * 100,
    photoOverflowXPct: (wrap / trimW) * 100,
    spineFrac: spine / coverW,
    spineLenFrac: (trimH - 2 * safe) / coverW,
    bandOfTrim: wrap / trimH,
    frontDropFrom: rects.front.x / sheetW,
  }
}

const SAME_KEYS = [
  'trimW',
  'trimH',
  'spine',
  'wrap',
  'hinge',
  'safe',
  'pages',
  'printedPages',
  'profileName',
  'source',
] as const

/** Every drawn or shown value is equal (the rects derive from these). */
export function sameCoverGeometry(a: CoverGeometry, b: CoverGeometry): boolean {
  return SAME_KEYS.every((key) => a[key] === b[key])
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

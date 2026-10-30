import type { NormalizedRect, RectMm } from './types'

/** Book-editor default thresholds until `print-profiles` supplies them. */
export const DPI_WARN = 200
export const DPI_MIN = 150

const MM_PER_INCH = 25.4

export interface LowDpi {
  dpi: number
  /** `min`: below the minimum; `warn`: below the warning threshold only. */
  level: 'warn' | 'min'
}

/**
 * Effective print resolution of the photo inside its frame: source pixels
 * covered by the frame width over the frame width in inches. `cropRect` is the
 * source-space window from `sourceCropRect`; `widthPx` / `heightPx` are the
 * EXIF-oriented asset dimensions.
 */
export function frameDpi(
  rectMm: RectMm,
  cropRect: NormalizedRect,
  quarterTurns: number,
  widthPx: number,
  heightPx: number,
): number {
  const turned = quarterTurns % 2 === 1
  // The window is in unturned source space; the frame width maps to its
  // height when the photo is turned a quarter.
  const sourcePx = turned
    ? cropRect.height * heightPx
    : cropRect.width * widthPx
  return (sourcePx * MM_PER_INCH) / rectMm.width
}

export function lowDpi(dpi: number): LowDpi | undefined {
  if (!Number.isFinite(dpi) || dpi >= DPI_WARN) {
    return undefined
  }
  return { dpi: Math.round(dpi), level: dpi < DPI_MIN ? 'min' : 'warn' }
}

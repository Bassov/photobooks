import type { Frame } from '../schema'
import type { NormalizedRect, RectMm } from './types'

const DEFAULT_CROP = { zoom: 1, center: { x: 0.5, y: 0.5 } } as const

/**
 * Cover-fit crop window in normalized source space, then zoomed around center.
 */
export function sourceCropRect(
  frameRect: RectMm,
  crop: Frame['crop'] | undefined,
  aspectRatio: number,
  fit: Frame['fit'] = 'fill',
): NormalizedRect {
  const { zoom, center } = crop ?? DEFAULT_CROP
  const frameAspect = frameRect.width / frameRect.height
  const imageAspect = aspectRatio > 0 ? aspectRatio : 1

  // Fill (cover) shows the smaller window; fit (contain) the larger one, so
  // the window exceeds the image on one axis and the photo is letterboxed.
  // Stryker disable next-line EqualityOperator: equal aspects give the same window either way
  const wide = imageAspect > frameAspect
  const coverW = wide ? frameAspect / imageAspect : 1
  const coverH = wide ? 1 : imageAspect / frameAspect
  const baseW = fit === 'fit' ? 1 / coverH : coverW
  const baseH = fit === 'fit' ? 1 / coverW : coverH

  const width = baseW / zoom
  const height = baseH / zoom
  return {
    x: place(center.x, width),
    y: place(center.y, height),
    width,
    height,
  }
}

/** Window start on one axis: inside the image, or centered when larger. */
function place(center: number, size: number): number {
  // Stryker disable next-line EqualityOperator: at size 1 both branches return 0
  return size >= 1 ? (1 - size) / 2 : clamp(center - size / 2, 0, 1 - size)
}

export const MAX_CROP_ZOOM = 8

type Crop = NonNullable<Frame['crop']>

/**
 * Effective crop: zoom within [1, MAX_CROP_ZOOM] and center moved so the
 * window stays inside the image (no empty edges).
 */
export function clampCrop(
  frameRect: RectMm,
  crop: Crop,
  aspectRatio: number,
  fit: Frame['fit'] = 'fill',
): Crop {
  const zoom = clamp(crop.zoom, 1, MAX_CROP_ZOOM)
  const rect = sourceCropRect(
    frameRect,
    { zoom, center: crop.center },
    aspectRatio,
    fit,
  )
  return {
    zoom,
    center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min
  }
  if (value > max) {
    return max
  }
  return value
}

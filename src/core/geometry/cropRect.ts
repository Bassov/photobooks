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
): NormalizedRect {
  const { zoom, center } = crop ?? DEFAULT_CROP
  const frameAspect = frameRect.width / frameRect.height
  const imageAspect = aspectRatio > 0 ? aspectRatio : 1

  let baseW: number
  let baseH: number
  if (imageAspect > frameAspect) {
    baseW = frameAspect / imageAspect
    baseH = 1
  } else {
    baseW = 1
    baseH = imageAspect / frameAspect
  }

  const width = baseW / zoom
  const height = baseH / zoom
  const x = clamp(center.x - width / 2, 0, 1 - width)
  const y = clamp(center.y - height / 2, 0, 1 - height)
  return { x, y, width, height }
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
): Crop {
  const zoom = clamp(crop.zoom, 1, MAX_CROP_ZOOM)
  const rect = sourceCropRect(
    frameRect,
    { zoom, center: crop.center },
    aspectRatio,
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

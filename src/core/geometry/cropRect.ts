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

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min
  }
  if (value > max) {
    return max
  }
  return value
}

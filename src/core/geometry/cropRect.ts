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
  const quarterTurns = crop?.quarterTurns ?? 0
  const shown = shownCropRect(frameRect, crop, aspectRatio, fit)
  return quarterTurns > 0 ? unturn(shown, quarterTurns) : shown
}

/**
 * The crop window in the turned (displayed) image, where `crop.center` lives.
 * With a fine rotation the photo must still cover the rotated frame: the
 * center is clamped so the frame's rotated bounding box stays inside the image.
 */
export function shownCropRect(
  frameRect: RectMm,
  crop: Frame['crop'] | undefined,
  aspectRatio: number,
  fit: Frame['fit'] = 'fill',
): NormalizedRect {
  const quarterTurns = crop?.quarterTurns ?? 0
  const sourceAspect = aspectRatio > 0 ? aspectRatio : 1
  const imageAspect = quarterTurns % 2 === 1 ? 1 / sourceAspect : sourceAspect
  const { zoom, center } = crop ?? DEFAULT_CROP
  const angle = (Math.abs(crop?.straightenDeg ?? 0) * Math.PI) / 180
  // Fit letterboxes, so a rotated photo never needs the extra cover scale.
  const straighten = fit !== 'fit' && angle > 0
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  const box = straighten
    ? {
        width: frameRect.width * cos + frameRect.height * sin,
        height: frameRect.width * sin + frameRect.height * cos,
      }
    : frameRect
  const boxAspect = box.width / box.height

  // Fill (cover) shows the smaller window; fit (contain) the larger one, so
  // the window exceeds the image on one axis and the photo is letterboxed.
  const coverW = Math.min(1, boxAspect / imageAspect)
  const coverH = Math.min(1, imageAspect / boxAspect)
  const baseW = fit === 'fit' ? 1 / coverH : coverW
  const baseH = fit === 'fit' ? 1 / coverW : coverH

  // The padded window holds the rotated frame's bounding box; the frame's own
  // window is concentric and smaller by the box-to-frame ratio.
  const padW = baseW / zoom
  const padH = baseH / zoom
  const width = straighten ? (padW * frameRect.width) / box.width : padW
  const height = straighten ? (padH * frameRect.height) / box.height : padH
  return {
    x: place(center.x, padW) + (padW - width) / 2,
    y: place(center.y, padH) + (padH - height) / 2,
    width,
    height,
  }
}

/** Map a rect in the clockwise-turned image back to unturned source space. */
function unturn(r: NormalizedRect, quarterTurns: number): NormalizedRect {
  switch (quarterTurns) {
    case 1:
      return { x: r.y, y: 1 - r.x - r.width, width: r.height, height: r.width }
    case 2:
      return {
        x: 1 - r.x - r.width,
        y: 1 - r.y - r.height,
        width: r.width,
        height: r.height,
      }
    default:
      return { x: 1 - r.y - r.height, y: r.x, width: r.height, height: r.width }
  }
}

/** Window start on one axis: inside the image, or centered when larger. */
function place(center: number, size: number): number {
  const slack = 1 - size
  return (
    clamp(center - size / 2, 0, Math.max(slack, 0)) + Math.min(slack, 0) / 2
  )
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
  const rect = shownCropRect(frameRect, { ...crop, zoom }, aspectRatio, fit)
  return {
    ...crop,
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

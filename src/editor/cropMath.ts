import {
  clampCrop,
  MAX_CROP_ZOOM,
  shownCropRect,
  type Frame,
  type RectMm,
} from '../core'

type Crop = NonNullable<Frame['crop']>

export interface FramePx {
  width: number
  height: number
}

/** Wheel notch → zoom factor; scrolling up (negative deltaY) zooms in. */
export function cropWheelFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.0015)
}

/** Move the photo by (dx, dy) layout px inside a frame drawn at `framePx`. */
export function panCrop(
  rect: RectMm,
  crop: Crop,
  aspect: number,
  framePx: FramePx,
  dx: number,
  dy: number,
  fit?: Frame['fit'],
): Crop {
  const window = shownCropRect(rect, crop, aspect, fit)
  // The photo is turned by the straighten angle on screen; undo it so the
  // drag moves the photo under the pointer.
  const angle = ((crop.straightenDeg ?? 0) * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const localX = dx * cos + dy * sin
  const localY = dy * cos - dx * sin
  return clampCrop(
    rect,
    {
      ...crop,
      center: {
        x:
          window.x + window.width / 2 - (localX / framePx.width) * window.width,
        y:
          window.y +
          window.height / 2 -
          (localY / framePx.height) * window.height,
      },
    },
    aspect,
    fit,
  )
}

export type PhotoCorner = 'nw' | 'ne' | 'sw' | 'se'

/** Fit zoom at which a Fit photo covers the frame (fit window / fill window). */
export function fitCoverZoom(rect: RectMm, crop: Crop, aspect: number): number {
  const at = { ...crop, zoom: 1 }
  return (
    shownCropRect(rect, at, aspect, 'fit').width /
    shownCropRect(rect, at, aspect, 'fill').width
  )
}

/**
 * Corner-drag scale (direct crop): the photo grows or shrinks aspect-locked
 * about the opposite corner (`fromCentre`: its centre) so the dragged corner
 * follows `point` (frame-local mm) along the diagonal. Fill never goes below
 * cover; Fit may shrink to fit, and past cover it becomes Fill.
 */
export function scaleCrop(
  rect: RectMm,
  crop: Crop,
  aspect: number,
  fit: Frame['fit'],
  corner: PhotoCorner,
  point: { x: number; y: number },
  fromCentre: boolean,
): { crop: Crop; fit: NonNullable<Frame['fit']> } {
  const window = shownCropRect(rect, crop, aspect, fit)
  // The photo in frame-local mm.
  const width = rect.width / window.width
  const height = rect.height / window.height
  const left = -window.x * width
  const top = -window.y * height
  const cx = corner.endsWith('e') ? 1 : 0
  const cy = corner.startsWith('s') ? 1 : 0
  const ax = fromCentre ? 0.5 : 1 - cx
  const ay = fromCentre ? 0.5 : 1 - cy
  const vx = (cx - ax) * width
  const vy = (cy - ay) * height
  const px = point.x - (left + ax * width)
  const py = point.y - (top + ay * height)
  const cover = fit === 'fit' ? fitCoverZoom(rect, crop, aspect) : 1
  // Zoom limits (cover / fit at 1, 8× in Fill) bound the scale itself, so the
  // anchor corner stays put at a limit instead of the clamp sliding the photo.
  const scale = Math.min(
    (MAX_CROP_ZOOM * cover) / crop.zoom,
    Math.max(1 / crop.zoom, (px * vx + py * vy) / (vx * vx + vy * vy)),
  )
  const zoom = crop.zoom * scale
  const nextFit = fit === 'fit' && zoom <= cover ? 'fit' : 'fill'
  const next = {
    ...crop,
    // Same window in Fill: the cover ratio converts a Fit zoom.
    zoom: fit === 'fit' && nextFit === 'fill' ? zoom / cover : zoom,
    center: {
      x: ax + (window.x + window.width / 2 - ax) / scale,
      y: ay + (window.y + window.height / 2 - ay) / scale,
    },
  }
  return { crop: clampCrop(rect, next, aspect, nextFit), fit: nextFit }
}

/** Zoom around the frame center; never below cover. */
export function zoomCrop(
  rect: RectMm,
  crop: Crop,
  aspect: number,
  factor: number,
  fit?: Frame['fit'],
): Crop {
  const window = shownCropRect(rect, crop, aspect, fit)
  return clampCrop(
    rect,
    {
      ...crop,
      zoom: crop.zoom * factor,
      center: {
        x: window.x + window.width / 2,
        y: window.y + window.height / 2,
      },
    },
    aspect,
    fit,
  )
}

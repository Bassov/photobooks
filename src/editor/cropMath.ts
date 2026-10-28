import { clampCrop, sourceCropRect, type Frame, type RectMm } from '../core'

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
  const window = sourceCropRect(rect, crop, aspect, fit)
  return clampCrop(
    rect,
    {
      zoom: crop.zoom,
      center: {
        x: window.x + window.width / 2 - (dx / framePx.width) * window.width,
        y: window.y + window.height / 2 - (dy / framePx.height) * window.height,
      },
    },
    aspect,
    fit,
  )
}

/** Zoom around the frame center; never below cover. */
export function zoomCrop(
  rect: RectMm,
  crop: Crop,
  aspect: number,
  factor: number,
  fit?: Frame['fit'],
): Crop {
  const window = sourceCropRect(rect, crop, aspect, fit)
  return clampCrop(
    rect,
    {
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

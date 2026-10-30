import { clampCrop, shownCropRect, type Frame, type RectMm } from '../core'

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

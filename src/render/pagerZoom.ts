import { clamp } from '../lib/clamp'

/**
 * Lightbox zoom layer state: `translate(x px, y px) scale(z)` with
 * `transform-origin: 0 0` on a wrapper around the slide's fitted box.
 */
export interface Zoom {
  z: number
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

/** Viewport CSS px. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Insets {
  top: number
  bottom: number
  side: number
}

export const ZOOM_MAX = 3
/** `+` / `-` keys. */
export const ZOOM_STEP = 1.5
/** Double-click / double-tap and the Zoom chip. */
export const ZOOM_TOGGLE = 2
/** After a gesture, z below this snaps back to 1. */
export const ZOOM_SNAP = 1.02
export const FIT_INSETS = { top: 64, bottom: 48, side: 64, sideTouch: 8 }

const WHEEL_RATE = 0.01
const WHEEL_LINE_PX = 16
const DOM_DELTA_LINE = 1

/** Hover devices keep room for the side arrows; touch gets 8 px. */
export function fitInsets(hover: boolean): Insets {
  return {
    top: FIT_INSETS.top,
    bottom: FIT_INSETS.bottom,
    side: hover ? FIT_INSETS.side : FIT_INSETS.sideTouch,
  }
}

/** Viewport minus the insets. */
export function fitArea(view: Size, insets: Insets): Rect {
  return {
    x: insets.side,
    y: insets.top,
    w: Math.max(0, view.w - 2 * insets.side),
    h: Math.max(0, view.h - insets.top - insets.bottom),
  }
}

/** Largest rect with `content`'s ratio inside the fit area, centred in it. */
export function fitBox(content: Size, view: Size, insets: Insets): Rect {
  const area = fitArea(view, insets)
  const scale = Math.min(area.w / content.w, area.h / content.h)
  // Rounding may put the limiting side an ulp past the area; z = 1 must fit.
  const w = Math.min(area.w, content.w * scale)
  const h = Math.min(area.h, content.h * scale)
  return {
    x: area.x + (area.w - w) / 2,
    y: area.y + (area.h - h) / 2,
    w,
    h,
  }
}

/**
 * One axis: painted size ≤ the area → centred (the box is centred in the
 * area, so its centre stays put); larger → the painted span covers the area.
 */
function clampAxis(
  pan: number,
  z: number,
  boxStart: number,
  boxSize: number,
  areaStart: number,
  areaSize: number,
): number {
  const painted = boxSize * z
  if (painted <= areaSize) {
    return (boxSize - painted) / 2
  }
  const max = areaStart - boxStart
  return clamp(pan, max + areaSize - painted, max)
}

export function clampPan(zoom: Zoom, box: Rect, area: Rect): Zoom {
  return {
    z: zoom.z,
    x: clampAxis(zoom.x, zoom.z, box.x, box.w, area.x, area.w),
    y: clampAxis(zoom.y, zoom.z, box.y, box.h, area.y, area.h),
  }
}

/**
 * Scale by `factor` (z kept in [1, ZOOM_MAX]) so the content point under
 * (px, py) stays under it, then clamp the pan.
 */
export function zoomAt(
  zoom: Zoom,
  factor: number,
  px: number,
  py: number,
  box: Rect,
  area: Rect,
): Zoom {
  const z = clamp(zoom.z * factor, 1, ZOOM_MAX)
  const k = z / zoom.z
  const ox = px - box.x
  const oy = py - box.y
  return clampPan(
    { z, x: ox - (ox - zoom.x) * k, y: oy - (oy - zoom.y) * k },
    box,
    area,
  )
}

/** Ctrl/⌘ + wheel and trackpad pinch; line-mode deltas count 16 px. */
export function wheelFactor(deltaY: number, deltaMode: number): number {
  const px = deltaMode === DOM_DELTA_LINE ? deltaY * WHEEL_LINE_PX : deltaY
  return Math.exp(-px * WHEEL_RATE)
}

/** Gesture end: a near-1 zoom snaps to the fitted view. */
export function settle(zoom: Zoom): Zoom {
  return zoom.z < ZOOM_SNAP ? { z: 1, x: 0, y: 0 } : zoom
}

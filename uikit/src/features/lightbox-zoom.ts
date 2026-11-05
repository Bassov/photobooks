/* Lightbox zoom model (Designer site-lightbox §3–§4): kit copy of prod `src/render/pagerZoom.ts` — the kit never imports `src/`. */
export type Zoom = { z: number; x: number; y: number }
export type Size = { w: number; h: number }
export type Rect = { x: number; y: number; w: number; h: number }
export type Insets = { top: number; bottom: number; side: number }

export const ZOOM_MAX = 3
export const ZOOM_STEP = 1.5
export const ZOOM_TOGGLE = 2
export const ZOOM_SNAP = 1.02
export const FIT_INSETS = { top: 64, bottom: 48, side: 64, sideTouch: 8 }
export const Z1: Zoom = { z: 1, x: 0, y: 0 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Hover devices keep room for the side arrows; touch gets 8 px. */
export const fitInsets = (hover: boolean): Insets => ({ top: FIT_INSETS.top, bottom: FIT_INSETS.bottom, side: hover ? FIT_INSETS.side : FIT_INSETS.sideTouch })

/** Viewport minus the insets. */
export const fitArea = (view: Size, i: Insets): Rect => ({ x: i.side, y: i.top, w: Math.max(0, view.w - 2 * i.side), h: Math.max(0, view.h - i.top - i.bottom) })

/** Largest rect with `content`'s ratio inside the fit area, centred in it. */
export function fitBox(content: Size, view: Size, insets: Insets): Rect {
  const a = fitArea(view, insets)
  const s = Math.min(a.w / content.w, a.h / content.h)
  const w = Math.min(a.w, content.w * s), h = Math.min(a.h, content.h * s)
  return { x: a.x + (a.w - w) / 2, y: a.y + (a.h - h) / 2, w, h }
}

/** One axis: painted size ≤ the area → centred; larger → the painted span covers the area. */
function clampAxis(pan: number, z: number, boxStart: number, boxSize: number, areaStart: number, areaSize: number) {
  const painted = boxSize * z
  if (painted <= areaSize) return (boxSize - painted) / 2
  const max = areaStart - boxStart
  return clamp(pan, max + areaSize - painted, max)
}

export const clampPan = (zoom: Zoom, box: Rect, area: Rect): Zoom => ({ z: zoom.z, x: clampAxis(zoom.x, zoom.z, box.x, box.w, area.x, area.w), y: clampAxis(zoom.y, zoom.z, box.y, box.h, area.y, area.h) })

/** Scale by `factor` (z kept in [1, ZOOM_MAX]) so the content point under (px, py) stays under it, then clamp the pan. */
export function zoomAt(zoom: Zoom, factor: number, px: number, py: number, box: Rect, area: Rect): Zoom {
  const z = clamp(zoom.z * factor, 1, ZOOM_MAX), k = z / zoom.z
  const ox = px - box.x, oy = py - box.y
  return clampPan({ z, x: ox - (ox - zoom.x) * k, y: oy - (oy - zoom.y) * k }, box, area)
}

/** Ctrl/⌘ + wheel and trackpad pinch; line-mode deltas count 16 px. */
export const wheelFactor = (deltaY: number, deltaMode: number) => Math.exp(-(deltaMode === 1 ? deltaY * 16 : deltaY) * 0.01)

/** Gesture end: a near-1 zoom snaps to the fitted view. */
export const settle = (zoom: Zoom): Zoom => (zoom.z < ZOOM_SNAP ? Z1 : zoom)

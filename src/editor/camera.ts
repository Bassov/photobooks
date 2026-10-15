import { SPREAD_PX_PER_MM } from '../render/frameBox'

const CSS_PX_PER_INCH = 96
const MM_PER_INCH = 25.4
export const ZOOM_STEP = 2 ** 0.25
const WHEEL_ZOOM_GAIN = 0.0015
const MAX_PHYSICAL_ZOOM_RATIO = 4

export interface CameraPoint {
  readonly x: number
  readonly y: number
}

export interface ZoomFrame {
  zoom: number
  scrollLeft: number
  scrollTop: number
  translateX: number
  translateY: number
  scale: number
}

function physicalPxPerMm(): number {
  return CSS_PX_PER_INCH / MM_PER_INCH
}

/** Multiplier on `SPREAD_PX_PER_MM` that is 100% physical size. */
export function physicalZoom(): number {
  return physicalPxPerMm() / SPREAD_PX_PER_MM
}

export function zoomPercent(zoom: number): number {
  const basis = physicalZoom()
  if (!Number.isFinite(zoom) || !(basis > 0)) {
    return 0
  }
  return Math.round((zoom / basis) * 100)
}

export function formatZoomPercent(zoom: number): string {
  return `${String(zoomPercent(zoom))}%`
}

export function clampZoom(
  zoom: number,
  minZoom: number,
  maxZoom: number,
): number {
  const min = Number.isFinite(minZoom) ? minZoom : 1
  let max = Number.isFinite(maxZoom) ? maxZoom : min
  if (max < min) {
    max = min
  }
  if (!Number.isFinite(zoom) || zoom < min) {
    return min
  }
  if (zoom > max) {
    return max
  }
  return zoom
}

export function zoomLimits(input: {
  fitSpread: number
  fitWidth: number
  fitStack: number
}): { minZoom: number; maxZoom: number } {
  const minZoom = input.fitStack > 0 ? input.fitStack : 1
  const floors = [physicalZoom() * MAX_PHYSICAL_ZOOM_RATIO, minZoom]
  if (input.fitSpread > 0) {
    floors.push(input.fitSpread)
  }
  if (input.fitWidth > 0) {
    floors.push(input.fitWidth)
  }
  let maxZoom = minZoom
  for (const floor of floors) {
    if (floor > maxZoom) {
      maxZoom = floor
    }
  }
  return { minZoom, maxZoom }
}

export function zoomAtPoint(
  input: {
    zoom: number
    scrollLeft: number
    scrollTop: number
    anchorX: number
    anchorY: number
    factor: number
    minZoom: number
    maxZoom: number
  },
  out: ZoomFrame,
): ZoomFrame {
  const start = input.zoom > 0 && Number.isFinite(input.zoom) ? input.zoom : 1
  const factor =
    Number.isFinite(input.factor) && input.factor > 0 ? input.factor : 1
  const zoom = clampZoom(start * factor, input.minZoom, input.maxZoom)
  const scale = zoom / start
  const contentX = input.scrollLeft + input.anchorX
  const contentY = input.scrollTop + input.anchorY
  out.zoom = zoom
  out.scale = scale
  out.scrollLeft = contentX * scale - input.anchorX
  out.scrollTop = contentY * scale - input.anchorY
  out.translateX = contentX * (1 - scale)
  out.translateY = contentY * (1 - scale)
  return out
}

function pointerDistance(a: CameraPoint, b: CameraPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function pinchZoom(
  input: {
    zoom: number
    scrollLeft: number
    scrollTop: number
    startA: CameraPoint
    startB: CameraPoint
    currentA: CameraPoint
    currentB: CameraPoint
    minZoom: number
    maxZoom: number
  },
  out: ZoomFrame,
): ZoomFrame {
  const start = pointerDistance(input.startA, input.startB)
  const current = pointerDistance(input.currentA, input.currentB)
  const factor = start > 0 && Number.isFinite(current) ? current / start : 1
  return zoomAtPoint(
    {
      zoom: input.zoom,
      scrollLeft: input.scrollLeft,
      scrollTop: input.scrollTop,
      anchorX: (input.currentA.x + input.currentB.x) / 2,
      anchorY: (input.currentA.y + input.currentB.y) / 2,
      factor,
      minZoom: input.minZoom,
      maxZoom: input.maxZoom,
    },
    out,
  )
}

export function fitZoom(input: {
  contentWidthPx: number
  contentHeightPx: number
  viewportWidth: number
  viewportHeight: number
  mode: 'contain' | 'width'
}): number {
  const width = input.contentWidthPx
  const viewportWidth = input.viewportWidth
  if (!(width > 0) || !(viewportWidth > 0)) {
    return 1
  }
  const widthZoom = viewportWidth / width
  if (input.mode === 'width') {
    return widthZoom
  }
  const height = input.contentHeightPx
  const viewportHeight = input.viewportHeight
  if (!(height > 0) || !(viewportHeight > 0)) {
    return widthZoom
  }
  const heightZoom = viewportHeight / height
  return widthZoom < heightZoom ? widthZoom : heightZoom
}

export function fitStackZoom(input: {
  stackWidthPx: number
  stackHeightPx: number
  viewportWidth: number
  viewportHeight: number
}): number {
  return fitZoom({
    contentWidthPx: input.stackWidthPx,
    contentHeightPx: input.stackHeightPx,
    viewportWidth: input.viewportWidth,
    viewportHeight: input.viewportHeight,
    mode: 'contain',
  })
}

export function stepZoom(
  zoom: number,
  direction: 1 | -1,
  minZoom: number,
  maxZoom: number,
): number {
  const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP
  return clampZoom(zoom * factor, minZoom, maxZoom)
}

export function wheelZoomFactor(deltaY: number): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) {
    return 1
  }
  return Math.exp(-deltaY * WHEEL_ZOOM_GAIN)
}

export function centerSpreadScroll(input: {
  spreadLeftPx: number
  spreadTopPx: number
  spreadWidthPx: number
  spreadHeightPx: number
  viewportWidth: number
  viewportHeight: number
  contentWidth: number
  contentHeight: number
}): { scrollLeft: number; scrollTop: number } {
  const rawLeft =
    input.spreadLeftPx + input.spreadWidthPx / 2 - input.viewportWidth / 2
  const rawTop =
    input.spreadTopPx + input.spreadHeightPx / 2 - input.viewportHeight / 2
  const maxLeft = Math.max(0, input.contentWidth - input.viewportWidth)
  const maxTop = Math.max(0, input.contentHeight - input.viewportHeight)
  return {
    scrollLeft: boundScroll(rawLeft, maxLeft),
    scrollTop: boundScroll(rawTop, maxTop),
  }
}

function boundScroll(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0
  }
  if (value > max) {
    return max
  }
  return value
}

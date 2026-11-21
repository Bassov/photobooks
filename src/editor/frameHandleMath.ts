import { MIN_FRAME_EDGE_MM, type RectMm } from '../core'

export const RESIZE_HANDLES = [
  'nw',
  'n',
  'ne',
  'w',
  'e',
  'sw',
  's',
  'se',
] as const

export type ResizeHandle = (typeof RESIZE_HANDLES)[number]

export const ROTATE_HANDLE = 'rotate'

/** Shift while rotating snaps to this step (degrees). */
const ROTATE_STEP_DEG = 15

function axisSign(handle: ResizeHandle, plus: string, minus: string): number {
  if (handle.includes(plus)) {
    return 1
  }
  return handle.includes(minus) ? -1 : 0
}

/**
 * New rect for a handle drag. `dx` / `dy` is the pointer travel in spread mm.
 * The travel is projected on the frame's own axes, so rotated frames resize
 * along their edges and the opposite edge (or the centre with `fromCenter`)
 * stays put in the spread. `keepRatio` keeps the aspect; edges stop at the
 * minimum size.
 */
export function resizeRectByHandle(
  rect: RectMm,
  rotationDeg: number,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  options: { keepRatio: boolean; fromCenter: boolean },
): RectMm {
  const theta = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const localX = dx * cos + dy * sin
  const localY = -dx * sin + dy * cos
  const sx = axisSign(handle, 'e', 'w')
  const sy = axisSign(handle, 's', 'n')
  const grow = options.fromCenter ? 2 : 1
  let width = rect.width + sx * localX * grow
  let height = rect.height + sy * localY * grow
  if (options.keepRatio) {
    // A corner follows the larger edge; an edge handle drives both.
    const scale = Math.max(
      sx === 0 ? 0 : width / rect.width,
      sy === 0 ? 0 : height / rect.height,
    )
    const floor = Math.max(
      MIN_FRAME_EDGE_MM / rect.width,
      MIN_FRAME_EDGE_MM / rect.height,
    )
    const factor = Math.max(scale, floor)
    width = rect.width * factor
    height = rect.height * factor
  }
  width = Math.max(width, MIN_FRAME_EDGE_MM)
  height = Math.max(height, MIN_FRAME_EDGE_MM)
  // Local centre shift: the fixed edge stays, the centre moves half the growth.
  const shiftX = options.fromCenter ? 0 : (sx * (width - rect.width)) / 2
  const shiftY = options.fromCenter ? 0 : (sy * (height - rect.height)) / 2
  const centerX = rect.x + rect.width / 2 + shiftX * cos - shiftY * sin
  const centerY = rect.y + rect.height / 2 + shiftX * sin + shiftY * cos
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  }
}

/** Angle (degrees, clockwise from +x) of a point seen from a centre. */
export function pointerAngleDeg(
  centerX: number,
  centerY: number,
  x: number,
  y: number,
): number {
  return (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI
}

/** Free rotation snaps to a quarter turn this close to it (degrees). */
const ROTATE_SNAP_DEG = 2

/**
 * Walkthrough-ux-review §A: an angle in (−180, 180]; `step` (Shift) rounds it
 * to 15°, else it snaps to 0 / 90 / 180 / −90 within ±2°.
 */
export function snapRotationDeg(deg: number, step: boolean): number {
  const angle = halfTurnRange(deg)
  if (step) {
    return halfTurnRange(Math.round(angle / ROTATE_STEP_DEG) * ROTATE_STEP_DEG)
  }
  const quarter = Math.round(angle / 90) * 90
  return Math.abs(angle - quarter) <= ROTATE_SNAP_DEG
    ? halfTurnRange(quarter)
    : angle
}

function halfTurnRange(deg: number): number {
  return deg - Math.ceil((deg - 180) / 360) * 360
}

/** Rotation after dragging the rotate handle (see `snapRotationDeg`). */
export function rotatedDeg(
  startDeg: number,
  startPointerDeg: number,
  pointerDeg: number,
  snap: boolean,
): number {
  return snapRotationDeg(startDeg + pointerDeg - startPointerDeg, snap)
}

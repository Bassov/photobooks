import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { CameraMotionBlur } from '@remotion/motion-blur'
import { cameraAt, cameraSpeed } from './Springs.js'

/** Motion blur (180° shutter, 10 samples) on every move faster than 12 px/frame (spec v2 G5; v1 was 40). */
export const BLUR = { shutterAngle: 180, samples: 10 }
export const BLUR_SPEED = 12

/** Spec v2 G5 parallax: how far each layer follows the camera's travel since the shot's first frame. */
export const PARALLAX = { ground: 0.9, plane: 1, cursor: 1.03, drag: 1.03 }

/** A dragged photo: 62 % of the target frame's width, this shadow, tilt ≤ 3° from its velocity. */
export const DRAG = {
  share: 0.62,
  shadow: '0 30px 60px -20px rgb(0 0 0 / 0.45)',
  maxTilt: 3,
  tiltPerPx: 0.15,
}
export const dragWidth = (targetW) => DRAG.share * targetW
/** Tilt in degrees for a horizontal velocity `vx` (output px/frame). */
export const dragTilt = (vx) =>
  Math.max(-DRAG.maxTilt, Math.min(DRAG.maxTilt, vx * DRAG.tiltPerPx))

/** Motion blur on listed `shot.fast` ranges and wherever the camera moves faster than BLUR_SPEED. */
export function isFast(shot, frame) {
  const listed = (shot.fast ?? []).some((r) => frame >= r.from && frame < r.to)
  return listed || (frame > shot.from && cameraSpeed(shot, frame) > BLUR_SPEED)
}

/**
 * Camera transform of a layer that follows the camera by factor `k` (PARALLAX): scale and translation travel k × as
 * far from the shot's first frame as the plane does. One scale for both axes (G1). k = 1 is `cameraAt`.
 */
export function layerAt(shot, frame, k = 1) {
  const now = cameraAt(shot, frame)
  if (k === 1) return now
  const start = cameraAt(shot, shot.from)
  return {
    s: start.s * (now.s / start.s) ** k,
    tx: start.tx + k * (now.tx - start.tx),
    ty: start.ty + k * (now.ty - start.ty),
  }
}

/**
 * The plane (`plane.w × plane.h` px: a clip's CSS viewport, or a motion-built layout) under the crop camera of `shot`
 * (`cameraAt`, Springs.js). Frames are absolute: use it on the reel's own timeline (`offset` = the enclosing
 * Sequence's `from` if there is one). `layer` picks the parallax factor (default the plane). The children are drawn
 * in plane px and must take their time from `useCurrentFrame()`, so the motion blur can re-sample them.
 */
export const Camera = ({
  shot,
  plane,
  offset = 0,
  layer = 'plane',
  children,
}) => {
  const frame = useCurrentFrame() + offset
  const content = (
    <Plane shot={shot} plane={plane} offset={offset} k={PARALLAX[layer] ?? 1}>
      {children}
    </Plane>
  )
  if (!isFast(shot, frame)) return content
  return (
    <CameraMotionBlur shutterAngle={BLUR.shutterAngle} samples={BLUR.samples}>
      {content}
    </CameraMotionBlur>
  )
}

const Plane = ({ shot, plane, offset, k, children }) => {
  const frame = useCurrentFrame() + offset
  const { s, tx, ty } = layerAt(shot, frame, k)
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: plane.w,
          height: plane.h,
          transformOrigin: '0 0',
          transform: `translate(${tx}px, ${ty}px) scale(${s})`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}

/** Plane point → output px at `frame` (for the cursor, the focus box and the safe-zone checks). */
export function toOutput(shot, frame, p, k = 1) {
  const { s, tx, ty } = layerAt(shot, frame, k)
  return { x: p.x * s + tx, y: p.y * s + ty }
}

/** Plane box → output box at `frame`. */
export function boxToOutput(shot, frame, box, k = 1) {
  const { s, tx, ty } = layerAt(shot, frame, k)
  return { x: box.x * s + tx, y: box.y * s + ty, w: box.w * s, h: box.h * s }
}

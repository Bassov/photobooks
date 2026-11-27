import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { CameraMotionBlur } from '@remotion/motion-blur'
import { cameraAt, isFast } from './Springs.js'

/** Motion blur on whip pans, zoom-throughs and photo flights only (spec §2): 180° shutter, 10 samples. */
export const BLUR = { shutterAngle: 180, samples: 10 }

/**
 * The plane (`plane.w × plane.h` px: a clip's CSS viewport, or a motion-built layout) under the crop camera of `shot`
 * (`cameraAt`, Springs.js). Frames are absolute: use it on the reel's own timeline (`offset` = the enclosing
 * Sequence's `from` if there is one). The children are drawn in plane px and must take their time from
 * `useCurrentFrame()`, so the motion blur can re-sample them.
 */
export const Camera = ({ shot, plane, offset = 0, children }) => {
  const frame = useCurrentFrame() + offset
  const content = (
    <Plane shot={shot} plane={plane} offset={offset}>
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

const Plane = ({ shot, plane, offset, children }) => {
  const frame = useCurrentFrame() + offset
  const { s, tx, ty } = cameraAt(shot, frame)
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
export function toOutput(shot, frame, p) {
  const { s, tx, ty } = cameraAt(shot, frame)
  return { x: p.x * s + tx, y: p.y * s + ty }
}

/** Plane box → output box at `frame`. */
export function boxToOutput(shot, frame, box) {
  const { s, tx, ty } = cameraAt(shot, frame)
  return { x: box.x * s + tx, y: box.y * s + ty, w: box.w * s, h: box.h * s }
}

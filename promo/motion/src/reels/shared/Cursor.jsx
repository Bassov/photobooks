import React from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { CURSOR, cursorAt } from './Springs.js'

// Arrow path in a 12 × 19 box, hotspot (the tip) at 0,0.
const ARROW = 'M0 0 L0 16.2 L4.1 12.4 L6.9 18.6 L9.3 17.5 L6.6 11.5 L12 11.4 Z'
const ARROW_H = 18.6

/**
 * The pointer drawn by Remotion (clips never contain it): an arrow 46 px tall at output whatever the crop scale,
 * fill #1A1918, 2.5 px white stroke, soft shadow, hotspot at the tip. `track` is in output px (Springs.js
 * `cursorAt`: minimum-jerk glide with arc, 6 px overshoot, spring settle, 0.92 click squeeze; no rings).
 * Or pass `at = { x, y, scale }` when the reel maps a capture pointer path itself.
 */
export const Cursor = ({ track, at }) => {
  const frame = useCurrentFrame()
  const p = at ?? cursorAt(track, frame)
  const k = CURSOR.height / ARROW_H
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg
        width={14 * k}
        height={20.6 * k}
        viewBox="-1 -1 14 20.6"
        style={{
          position: 'absolute',
          left: p.x - k,
          top: p.y - k,
          overflow: 'visible',
          transformOrigin: `${k}px ${k}px`,
          transform: `scale(${p.scale ?? 1})`,
          filter: 'drop-shadow(0 2px 6px rgb(0 0 0 / 0.35))',
        }}
      >
        <path
          d={ARROW}
          fill={CURSOR.fill}
          stroke={CURSOR.stroke}
          strokeWidth={CURSOR.strokeWidth / k}
          strokeLinejoin="round"
        />
      </svg>
    </AbsoluteFill>
  )
}

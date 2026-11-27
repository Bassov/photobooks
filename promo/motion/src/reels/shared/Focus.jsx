import React from 'react'
import { AbsoluteFill } from 'remotion'
import { HEIGHT, WIDTH } from './beats.js'

/**
 * Spec v2 G4 «Focus»: over the plane a dark layer #09090A with a hard hole at the action box, plus a second layer
 * with the same hole blurred σ 60 px, so the dimming starts at the box edge and nothing glows around it. Blur only
 * outside the box + 60 px. Opacities per reel: hard / soft layer, blur px.
 */
export const FOCUS = {
  a: { hard: 0.22, soft: 0.25, blur: 4 },
  b: { hard: 0.5, soft: 0.76, blur: 8 },
  c: { hard: 0.3, soft: 0.35, blur: 0 },
}
export const FOCUS_INK = '#09090A'
/** σ of the soft hole and the sharp margin around the box (px). */
export const FOCUS_SOFT = 60
export const FOCUS_CLEAR = 60

// The outer rect overshoots the frame so the soft hole's blur never fades the frame edges.
const OVER = 4 * FOCUS_SOFT

/**
 * SVG mask (alpha) the size of the frame: opaque everywhere except a hole at `box` grown by `grow` px. `sigma` > 0
 * blurs the hole's edge. The SVG is WIDTH × HEIGHT, so `mask-size: 100% 100%` on a frame-sized layer keeps its
 * aspect (G1).
 */
export function holeMask(box, { grow = 0, sigma = 0 } = {}) {
  const x = box.x - grow
  const y = box.y - grow
  const w = box.w + 2 * grow
  const h = box.h + 2 * grow
  const d =
    `M${-OVER} ${-OVER}H${WIDTH + OVER}V${HEIGHT + OVER}H${-OVER}Z` +
    `M${x} ${y}V${y + h}H${x + w}V${y}Z`
  const filter = sigma
    ? `<filter id="f" filterUnits="userSpaceOnUse" x="${-2 * OVER}" y="${-2 * OVER}" ` +
      `width="${WIDTH + 4 * OVER}" height="${HEIGHT + 4 * OVER}">` +
      `<feGaussianBlur stdDeviation="${sigma}"/></filter>`
    : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" ` +
    `viewBox="0 0 ${WIDTH} ${HEIGHT}">${filter}` +
    `<path d="${d}" fill="#fff" fill-rule="evenodd"${sigma ? ' filter="url(#f)"' : ''}/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const masked = (mask) => ({
  maskImage: mask,
  WebkitMaskImage: mask,
  maskSize: '100% 100%',
  WebkitMaskSize: '100% 100%',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
})

/**
 * One action point per frame. `box` (output px, follows rects.json) is the action box; null = no focus. `render`
 * draws the content: once, plus a blurred copy outside the box + 60 px when the reel blurs (A, B).
 * Designer decision 2026-11-28: no focus where the ground shows in a full-width band (W, PDF-sheet and phone shots):
 * pass `box = null` there. An empty `data-focus` box marks the hole for reels-render.mjs check 11, which fails a
 * focus on a W shot or on a frame that shows a `sheet`, `phone` or `screen`.
 */
export const Focus = ({ reel, box, render }) => {
  if (!box) return <AbsoluteFill>{render()}</AbsoluteFill>
  const look = FOCUS[reel] ?? FOCUS.a
  return (
    <AbsoluteFill>
      <AbsoluteFill>{render()}</AbsoluteFill>
      <div
        data-focus=""
        style={{
          position: 'absolute',
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
        }}
      />
      {look.blur > 0 && (
        <AbsoluteFill
          style={{
            ...masked(holeMask(box, { grow: FOCUS_CLEAR })),
            filter: `blur(${look.blur}px)`,
          }}
        >
          {render()}
        </AbsoluteFill>
      )}
      <AbsoluteFill
        style={{
          ...masked(holeMask(box)),
          background: FOCUS_INK,
          opacity: look.hard,
        }}
      />
      <AbsoluteFill
        style={{
          ...masked(holeMask(box, { sigma: FOCUS_SOFT })),
          background: FOCUS_INK,
          opacity: look.soft,
        }}
      />
    </AbsoluteFill>
  )
}

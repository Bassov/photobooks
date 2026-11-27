import React from 'react'
import { AbsoluteFill } from 'remotion'
import { HEIGHT, WIDTH, reelConfig } from './beats.js'

export const FOCUS_PAD = 24
export const FOCUS_FEATHER = 40
const RADIUS = 28

/** SVG mask: a rounded rect on `box` + 24 px, feathered 40 px, white = sharp. */
export function focusMask(box) {
  const x = box.x - FOCUS_PAD
  const y = box.y - FOCUS_PAD
  const w = box.w + 2 * FOCUS_PAD
  const h = box.h + 2 * FOCUS_PAD
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
    `<filter id="f" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feGaussianBlur stdDeviation="${FOCUS_FEATHER / 2}"/></filter>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${RADIUS}" fill="#fff" filter="url(#f)"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * One action point per frame (spec §2 «Focus»). Outside `box` (output px, follows rects.json) the picture is dimmed
 * and blurred with the reel's values: A .80 + 4 px, B .35 + 8 px, C .70 without blur. `box` null = no focus.
 * `render` draws the content; it is called twice (dimmed base + sharp masked copy).
 */
export const Focus = ({ reel, box, render }) => {
  if (!box) return <AbsoluteFill>{render()}</AbsoluteFill>
  const { brightness, blur } = reelConfig(reel).focus
  const mask = focusMask(box)
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          filter: `brightness(${brightness})${blur ? ` blur(${blur}px)` : ''}`,
        }}
      >
        {render()}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          maskImage: mask,
          WebkitMaskImage: mask,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
        }}
      >
        {render()}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

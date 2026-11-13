/*
 * The carousel's and the slide paper's rules (slides.tsx), pure: the paper
 * box of a slide, the photo-paper layers, the slide under the strip's scroll
 * and the step of a tap.
 */
import type { CSSProperties } from 'react'

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")"
const SHEEN =
  'linear-gradient(100deg, rgb(255 255 255/.08), rgb(255 255 255/0) 40%)'
/**
 * Photo paper over a face: grain + sheen above the content. `x` / `w` place
 * the page under a paper-leaf strip so both stay continuous across strips.
 */
export function paperLayers(x = 0, w?: number): [CSSProperties, CSSProperties] {
  const box = w === undefined ? { left: 0, right: 0 } : { left: x, width: w }
  const layer: CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    pointerEvents: 'none',
    ...box,
  }
  return [
    {
      ...layer,
      backgroundImage: GRAIN,
      backgroundSize: '160px',
      mixBlendMode: 'multiply',
      opacity: 0.03,
    },
    { ...layer, background: SHEEN },
  ]
}

/**
 * The paper of a `kind` slide in a pw × ph slot: a whole spread is its own
 * height (pw / `ratio`) centred in the slot, except on the turn's `sheet`;
 * the cover has rounded corners.
 */
export function paperBox(
  kind: 'cover' | 'spread' | 'page',
  pw: number,
  ph: number,
  ratio: number,
  sheet: boolean,
): CSSProperties {
  const h = kind === 'spread' && !sheet ? pw / ratio : ph
  return {
    top: (ph - h) / 2,
    width: pw,
    height: h,
    borderRadius: kind === 'cover' ? 2 : undefined,
    ...(sheet && { left: 0, boxShadow: 'none' }),
  }
}

/** The slide nearest the strip's `scrollLeft` at `pitch`, within [0, n − 1]. */
export function stripSlide(scrollLeft: number, pitch: number, n: number) {
  return Math.max(0, Math.min(n - 1, Math.round(scrollLeft / pitch)))
}

/** A pointer at (x, y), at `t` ms. */
export interface Point {
  x: number
  y: number
  t: number
}

/**
 * The step of a tap (< 8 px, ≤ 350 ms) on a strip from `left`, `width` wide:
 * −1 on its left half, +1 on its right; null for a drag or a long press.
 */
export function tapStep(
  down: Point,
  up: Point,
  left: number,
  width: number,
): -1 | 1 | null {
  if (
    Math.abs(up.x - down.x) >= 8 ||
    Math.abs(up.y - down.y) >= 8 ||
    up.t - down.t > 350
  )
    return null
  return up.x - left < width / 2 ? -1 : 1
}

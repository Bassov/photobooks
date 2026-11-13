/*
 * The room's motion: the turn easings and the page turn's curl model
 * (kit site-book/turn.tsx), pure so the readers stay components only.
 * Everything is computed per call (no module-level work), so the models stay
 * plain functions of their inputs.
 */
import type { RoomSlide } from '../siteModel'
import type { CurlSheet } from './gl/curl'

/**
 * CSS cubic-bezier(x1, y1, x2, y2) at time t ∈ [0, 1]: Newton on x(u) = t
 * from u = t (x' > 0 for x1, x2 ∈ (0, 1), so it stays in [0, 1] and settles
 * to machine precision in 5 steps), then y(u).
 */
function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
): number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  let u = t
  for (let i = 0; i < 6; i++) {
    u -= (((ax * u + bx) * u + cx) * u - t) / ((3 * ax * u + 2 * bx) * u + cx)
  }
  return ((ay * u + by) * u + cy) * u
}
/** the scripted page turn: cubic-bezier(0.45, 0.05, 0.25, 1) */
export function TURN(t: number): number {
  return cubicBezier(0.45, 0.05, 0.25, 1, t)
}
/** settles and fades: cubic-bezier(0.2, 0.7, 0.2, 1) */
export function EASE(t: number): number {
  return cubicBezier(0.2, 0.7, 0.2, 1, t)
}

// the curl model (sheet coords: x right, y down, px). State { xm, beta, r }:
// the curl axis passes (xm, ph/2) with normal (cos β, sin β) to the free edge.
function rad(d: number): number {
  return (d * Math.PI) / 180
}
/** the lead of a grabbed corner at the start of a turn */
function b0(): number {
  return rad(15)
}
export interface Curl {
  xm: number
  beta: number
  r: number
}
/** the axis just touches the leading corner */
export function xmStart(pw: number, ph: number, beta: number): number {
  return pw + (ph / 2) * Math.tan(beta)
}
/** the curl is off the screen (sheet left = 16) */
export function xmEnd(r: number): number {
  return -r - 18
}

/** forward drag: grabbed point C (corner or edge), finger offset → state */
export function fromDrag(
  pw: number,
  ph: number,
  r: number,
  C: { x: number; y: number },
  corner: boolean,
  dx: number,
  dy: number,
): Curl {
  const P = { x: C.x + dx, y: C.y + dy }
  const vx = C.x - P.x
  const vy = corner ? C.y - P.y : 0
  const L0 = Math.hypot(vx, vy)
  const prog = Math.min(1, Math.max(0, vx / pw))
  let beta = L0 < 1 ? 0 : Math.atan2(vy, vx)
  // the grabbed corner leads, straightening as it turns
  if (corner) beta += (C.y > ph / 2 ? 1 : -1) * b0() * (1 - prog)
  const bmax = rad(25)
  beta = Math.max(-bmax, Math.min(bmax, beta))
  const nx = Math.cos(beta)
  const ny = Math.sin(beta)
  const L = Math.max(0, vx * nx + vy * ny)
  // past πr the folded corner sits under the finger
  const D = L < Math.PI * r ? L : (L + Math.PI * r) / 2
  const A = { x: C.x - nx * D, y: C.y - ny * D }
  return { xm: A.x - (ph / 2 - A.y) * Math.tan(beta), beta, r }
}

/** the scripted turn (tap, keys, Play): e is the eased progress 0..1 */
export function scripted(pw: number, ph: number, r: number, e: number): Curl {
  const from = xmStart(pw, ph, b0())
  return { xm: from + (xmEnd(r) - from) * e, beta: b0() * (1 - e), r }
}

/** The curl sheet of a slide (0-based printed pages). */
export function sheetOf(s: RoomSlide): CurlSheet {
  const p = s.page
  if (p === undefined) return { kind: 'cover' }
  if (p.side === 'both') {
    return { kind: 'spread', left: 2 * p.spread - 1, right: 2 * p.spread }
  }
  if (p.spread === 0) return { kind: 'page', page: 0 }
  return { kind: 'page', page: 2 * p.spread - 1 + (p.side === 'right' ? 1 : 0) }
}

/*
 * The page turn's gesture and paint rules (turn.tsx), pure: the flat CSS
 * fold's geometry, tap / drag / release decisions, the drag-follow and the
 * settle after a release.
 */
import type { RoomSlide } from '../siteModel'
import { EASE, fromDrag, scripted, TURN, xmEnd, type Curl } from './motion'

/** the curl canvas' overhang above and below the sheet (gl/curl.ts `OV`) */
export const OV = 24
/** a release looks at the moves of the last 80 ms */
const TRAIL_MS = 80
/** a drag's moves: (timeStamp, dx) */
export type Trail = readonly (readonly [number, number])[]

/** `top` moves (fade: fades out), `under` is uncovered; `gl`: the canvas draws it */
export interface Turn {
  top: number
  under: number
  dir: 'fwd' | 'back' | 'fade'
  gl?: boolean
}

/** the GL canvas' backing pixels per CSS px: the device ratio within 1..2 */
export function backingRatio(dpr: number): number {
  return Math.min(2, Math.max(1, dpr || 1))
}

/** the canvas' backing size: the stage width × the sheet with its overhangs */
export function canvasPx(
  w: number,
  ph: number,
  k: number,
): { width: number; height: number } {
  return { width: Math.round(w * k), height: Math.round((ph + 2 * OV) * k) }
}

/** the curl radius: board (the cover) 0.3·pw, paper 0.09·pw */
export function curlRadius(s: RoomSlide | undefined, pw: number): number {
  return (s?.page === undefined ? 0.3 : 0.09) * pw
}

/** The DOM paint of the live state (xm null: at rest). */
export interface SheetPaint {
  /** the stage's `data-xm`: '' at rest and in a fade */
  xm: string
  /** the top sheet's clip-path */
  clip: string
  /** the top sheet's opacity (a fade's xm) */
  opacity: string
  /** the flat fold's shadow and flap boxes (sheet left = 16); null at rest and in a fade */
  fold: {
    shadowLeft: number
    shadowWidth: number
    flapLeft: number
    flapWidth: number
  } | null
}

/** the top sheet clipped at xm, a ≤ 28 px shadow right of it, the cut mirrored left of it */
export function sheetPaint(
  pw: number,
  xm: number | null,
  dir: Turn['dir'] | undefined,
): SheetPaint {
  if (xm === null) return { xm: '', clip: '', opacity: '', fold: null }
  if (dir === 'fade') {
    return { xm: '', clip: '', opacity: String(xm), fold: null }
  }
  const cut = Math.max(0, pw - xm)
  return {
    xm: xm.toFixed(1),
    clip: `inset(0 ${String(Math.min(pw, cut))}px 0 0)`,
    opacity: '',
    fold: {
      shadowLeft: 16 + xm,
      shadowWidth: Math.min(cut, 28),
      flapLeft: 16 + 2 * xm - pw,
      flapWidth: cut,
    },
  }
}

/** a fade's top-sheet opacity at progress t */
export function fadeOpacity(t: number): number {
  return 1 - EASE(t)
}

/** a turn one step from `si` of n (null past either end): forward peels si, back lays si − 1 down */
export function stepTurn(si: number, d: 1 | -1, n: number): Turn | null {
  const i = si + d
  if (i < 0 || i >= n) return null
  return d === 1
    ? { top: si, under: i, dir: 'fwd' }
    : { top: i, under: si, dir: 'back' }
}

/** the slide a completed turn rests on: back lays `top` down, the others uncover `under` */
export function landing(t: Turn): number {
  return t.dir === 'back' ? t.top : t.under
}

/** the scripted turn at progress u (backward: the forward curve reversed) */
export function scriptAt(
  pw: number,
  ph: number,
  r: number,
  d: 1 | -1,
  u: number,
): Curl {
  return scripted(pw, ph, r, TURN(d === 1 ? u : 1 - u))
}

/** a drag's first verdict: dead (vertical first), wait, or a turn forward (leftward) / back */
export function dragIntent(
  dx: number,
  dy: number,
): 'dead' | 'wait' | 'fwd' | 'back' {
  if (Math.abs(dy) > 10) return 'dead'
  if (!(Math.abs(dx) > 10 && Math.abs(dx) > 1.5 * Math.abs(dy))) return 'wait'
  return dx < 0 ? 'fwd' : 'back'
}

/** a tap (< 8 px, ≤ 350 ms) at x on a stage `width` wide: the left half back, the right half on */
export function tapStep(
  dx: number,
  dy: number,
  ms: number,
  x: number,
  width: number,
): 1 | -1 | null {
  if (Math.abs(dx) >= 8 || Math.abs(dy) >= 8 || ms > 350) return null
  return x < width / 2 ? -1 : 1
}

/** the grabbed point: a top / bottom corner (outer quarters), else the edge at py */
export function grabPoint(
  pw: number,
  ph: number,
  py: number,
): { C: { x: number; y: number }; corner: boolean } {
  if (py < 0.25 * ph) return { C: { x: pw, y: 0 }, corner: true }
  if (py > 0.75 * ph) return { C: { x: pw, y: ph }, corner: true }
  return { C: { x: pw, y: py }, corner: false }
}

/**
 * A forward drag grabbed at py, the finger (dx, dy) off its start; xm stops
 * where the curl is off the screen. (The curl never passes the start, where
 * the axis just touches the leading corner: xm = xmStart(β) − D / cos β.)
 */
export function followFwd(
  pw: number,
  ph: number,
  r: number,
  py: number,
  dx: number,
  dy: number,
): Curl {
  const { C, corner } = grabPoint(pw, ph, py)
  const s = fromDrag(pw, ph, r, C, corner, dx, dy)
  return { ...s, xm: Math.max(xmEnd(r), s.xm) }
}

/** a backward drag from x0 on a stage w wide: the rest of the stage (to w − 16, ≥ 40 px) lays the sheet down */
export function followBack(
  pw: number,
  w: number,
  r: number,
  x0: number,
  dx: number,
): number {
  const end = xmEnd(r)
  const k = (pw - end) / Math.max(40, w - 16 - x0)
  return Math.max(end, Math.min(pw, end + dx * k))
}

/** the drag offsets of the last 80 ms, then (at, dx) */
export function pushTrail(trail: Trail, at: number, dx: number): Trail {
  return [...trail.filter(([t]) => at - t <= TRAIL_MS), [at, dx]]
}

/** the release velocity (px / ms) over the trail; a finger that rested 80 ms: 0 */
export function releaseVelocity(trail: Trail, at: number): number {
  const first = trail[0]
  const last = trail[trail.length - 1]
  if (first === undefined || last === undefined) return 0
  const [t0, d0] = first
  const [t1, d1] = last
  return at - t1 <= TRAIL_MS && t1 > t0 ? (d1 - d0) / (t1 - t0) : 0
}

/** a release completes the turn past half or on a fling its way (> 0.3 px/ms), never on a fling back */
export function releaseCompletes(
  dir: Turn['dir'],
  xm: number,
  pw: number,
  r: number,
  v: number,
): boolean {
  const end = xmEnd(r)
  const s = dir === 'fwd' ? -1 : 1
  const p = dir === 'fwd' ? (pw - xm) / (pw - end) : (xm - end) / (pw - end)
  return (p > 0.5 || s * v > 0.3) && !(s * v < -0.3)
}

/** reduced motion: a drag over 40 px its way crossfades */
export function reducedCompletes(dir: Turn['dir'], dx: number): boolean {
  return (dir === 'fwd' ? -dx : dx) > 40
}

/** after a release: xm runs to `to` over `ms` (160 + 440 per full turn), then rests on `target` */
export function settlePlan(
  t: Turn,
  complete: boolean,
  si: number,
  from: number,
  pw: number,
  r: number,
): { to: number; target: number; ms: number } {
  const end = xmEnd(r)
  const to = (t.dir === 'fwd') === complete ? end : pw
  const target = complete ? landing(t) : si
  return { to, target, ms: 160 + (440 * Math.abs(to - from)) / (pw - end) }
}

/** the settle at eased progress e: xm from → to, the lean back to 0 */
export function settleAt(
  from: number,
  to: number,
  beta0: number,
  e: number,
): { xm: number; beta: number } {
  return { xm: from + (to - from) * e, beta: beta0 * (1 - e) }
}

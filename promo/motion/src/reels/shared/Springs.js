// Springs, easing and the pure motion paths of the reels (spec §2 «Cursor», «Camera»). Plain JS, no JSX: the
// Remotion layers draw these values and scripts/reels-render.mjs checks the very same numbers in Node.
import { Easing, spring } from 'remotion'
import { FPS, HEIGHT, WIDTH } from './beats.js'

/** Spring weights: light = photo lands, medium = layout change / camera punch, heavy = book on shelf, end card. */
export const SPRINGS = {
  light: { mass: 0.6, stiffness: 220, damping: 13 },
  medium: { mass: 1, stiffness: 180, damping: 16 },
  heavy: { mass: 2.2, stiffness: 140, damping: 22 },
  cursor: { mass: 0.4, stiffness: 300, damping: 18 },
  text: { mass: 1, stiffness: 120, damping: 20 },
}

/** 0 → 1 (with overshoot) `frame` frames after the start; 0 before it. */
export function springAt(frame, weight) {
  if (frame < 0) return 0
  return spring({ frame, fps: FPS, config: SPRINGS[weight] })
}

/** Camera ease between crop keys. */
export const cameraEase = Easing.bezier(0.33, 0, 0.15, 1)

/** Minimum-jerk position profile, 0 → 1. */
export const minJerk = (t) => t * t * t * (10 - 15 * t + 6 * t * t)

const clamp01 = (t) => Math.min(1, Math.max(0, t))
const lerp = (a, b, t) => a + (b - a) * t

// ---------------------------------------------------------------- cursor

/** Glide duration in ms for a move of `distance` px: T = 180 + 120·log2(D/40 + 1). */
export const glideMs = (distance) => 180 + 120 * Math.log2(distance / 40 + 1)

export const CURSOR = {
  height: 46,
  fill: '#1A1918',
  stroke: '#FFFFFF',
  strokeWidth: 2.5,
  overshoot: 6,
  arc: 0.08,
  clickScale: 0.92,
  clickHold: 3,
  clickReturn: 4,
}

/**
 * Pointer position at `frame` for one move `{ start, to }` from `from`: minimum-jerk travel with a sin(πt)·0.08·D arc
 * perpendicular to the path to a point `overshoot` px past the target, then the cursor spring settles it back.
 * `overshoot` is in the path's own px (capture CSS px or output px).
 */
export function glideAt(from, move, frame, overshoot = CURSOR.overshoot) {
  const dx = move.to.x - from.x
  const dy = move.to.y - from.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0 || frame <= move.start) {
    return frame <= move.start ? { ...from } : { ...move.to }
  }
  const ux = dx / distance
  const uy = dy / distance
  const past = { x: move.to.x + ux * overshoot, y: move.to.y + uy * overshoot }
  const travel = (glideMs(distance) / 1000) * FPS
  const elapsed = frame - move.start
  if (elapsed < travel) {
    const t = elapsed / travel
    const p = minJerk(t)
    const arc = Math.sin(Math.PI * t) * CURSOR.arc * distance
    return {
      x: lerp(from.x, past.x, p) - uy * arc,
      y: lerp(from.y, past.y, p) + ux * arc,
    }
  }
  const settle = springAt(elapsed - travel, 'cursor')
  return {
    x: lerp(past.x, move.to.x, settle),
    y: lerp(past.y, move.to.y, settle),
  }
}

/** Frames a glide of `distance` px takes before the settle. */
export const glideFrames = (distance) => (glideMs(distance) / 1000) * FPS

/** Click response: 0.92 for 3 frames, back to 1 over 4. No rings. */
export function clickScaleAt(clicks, frame) {
  let scale = 1
  for (const c of clicks) {
    const k = frame - c
    if (k < 0) continue
    if (k < CURSOR.clickHold) scale = Math.min(scale, CURSOR.clickScale)
    else if (k < CURSOR.clickHold + CURSOR.clickReturn) {
      const t = (k - CURSOR.clickHold + 1) / CURSOR.clickReturn
      scale = Math.min(scale, lerp(CURSOR.clickScale, 1, t))
    }
  }
  return scale
}

/**
 * Cursor track `{ start: {x, y}, moves: [{ start, to }], clicks: [frame] }` → `{ x, y, scale }` at `frame`.
 * Moves are in time order; each starts where the previous one settled.
 */
export function cursorAt(track, frame, overshoot = CURSOR.overshoot) {
  let from = track.start
  let pos = { ...from }
  for (const move of track.moves ?? []) {
    if (frame <= move.start) break
    pos = glideAt(from, move, frame, overshoot)
    from = move.to
  }
  return { ...pos, scale: clickScaleAt(track.clicks ?? [], frame) }
}

// ---------------------------------------------------------------- camera

/** Default life of a shot that names none: 8 px/s drift and a 1 %/s push. */
export const CAMERA_LIFE = { drift: { x: -8, y: 0 }, push: 0.01 }
/** The camera is never still: per frame Δscale ≥ 0.0002 or Δtranslate ≥ 0.15 px. */
export const CAMERA_MIN = { scale: 0.0002, translate: 0.15 }
/** Motion blur only above this speed (output px per frame). */
export const BLUR_SPEED = 40

/**
 * The crop keys around `frame` and the eased progress between them. A shot's first key sits on `shot.from`, its last
 * on `shot.to`; keys in between name their reel frame `at` (a travel that ends before the shot does, then a push),
 * and each segment eases on its own. Two keys without `at` = one ease over the whole shot.
 */
function cameraSegment(shot, frame) {
  const keys = shot.cam.length > 1 ? shot.cam : [shot.cam[0], shot.cam[0]]
  const at = (k, i) =>
    i === 0 ? shot.from : i === keys.length - 1 ? (k.at ?? shot.to) : k.at
  let i = 1
  while (i < keys.length - 1 && frame >= at(keys[i], i)) i++
  const a = at(keys[i - 1], i - 1)
  const b = at(keys[i], i)
  if (!Number.isFinite(a) || !Number.isFinite(b))
    throw new Error(`${shot.id}: a middle camera key needs \`at\``)
  const e = cameraEase(clamp01((frame - a) / Math.max(1, b - a)))
  return { k0: keys[i - 1], k1: keys[i], e }
}

/**
 * Output transform of shot `shot` at `frame`: the crop `{cx, cy, w}` (plane px, 9:16) eased between `shot.cam[0]` and
 * `shot.cam[1]`, then drift (output px/s), push (fraction/s) and camera punches (`medium` spring, fraction).
 * Returns `{ s, tx, ty }`: plane point p lands at (p·s + t) in the 1080×1920 frame.
 */
export function cameraAt(shot, frame) {
  const local = frame - shot.from
  const { k0, k1, e } = cameraSegment(shot, frame)
  const cx = lerp(k0.cx, k1.cx, e)
  const cy = lerp(k0.cy, k1.cy, e)
  const w = lerp(k0.w, k1.w, e)
  const secs = local / FPS
  const drift = shot.drift ?? CAMERA_LIFE.drift
  const push = shot.push ?? CAMERA_LIFE.push
  let s = (WIDTH / w) * (1 + push * secs)
  for (const punch of shot.punches ?? []) {
    s *= 1 + punch.amount * springAt(frame - punch.frame, 'medium')
  }
  return {
    s,
    tx: WIDTH / 2 - cx * s + drift.x * secs,
    ty: HEIGHT / 2 - cy * s + drift.y * secs,
  }
}

/** The shot that owns `frame` (shots are back to back). */
export function shotAt(shots, frame) {
  return (
    shots.find((shot) => frame >= shot.from && frame < shot.to) ??
    shots[shots.length - 1]
  )
}

/** Output px per frame the picture moves at `frame` (translation of the frame centre plus the zoom at the edge). */
export function cameraSpeed(shot, frame) {
  const a = cameraAt(shot, frame - 1)
  const b = cameraAt(shot, frame)
  const centre = (c) => ({
    x: (WIDTH / 2 - c.tx) / c.s,
    y: (HEIGHT / 2 - c.ty) / c.s,
  })
  const ca = centre(a)
  const cb = centre(b)
  const pan = Math.hypot(ca.x - cb.x, ca.y - cb.y) * b.s
  const zoom = (Math.abs(b.s / a.s - 1) * Math.hypot(WIDTH, HEIGHT)) / 2
  return pan + zoom
}

/** True on whip pans, zoom-throughs and flights: listed `shot.fast` ranges, or measured speed > 40 px/frame. */
export function isFast(shot, frame) {
  const listed = (shot.fast ?? []).some((r) => frame >= r.from && frame < r.to)
  return listed || (frame > shot.from && cameraSpeed(shot, frame) > BLUR_SPEED)
}

/** Scale + offset that fits `rect` (w, h) inside `box` (contain, centred). */
export function fitBox(rect, box) {
  const s = Math.min(box.w / rect.w, box.h / rect.h)
  return {
    s,
    x: box.x + (box.w - rect.w * s) / 2,
    y: box.y + (box.h - rect.h * s) / 2,
  }
}

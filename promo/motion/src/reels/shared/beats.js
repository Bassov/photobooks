// Beat grids of the three reels (Designer promo-reels-3 spec §3–§5) and the helpers that put cuts and cues on them.
// Plain data + pure functions: Remotion (the reels), reels-audio.mjs and reels-render.mjs all import this file.

export const FPS = 30
export const WIDTH = 1080
export const HEIGHT = 1920
export const SAMPLE_RATE = 48000
/** Audio samples per video frame (48 kHz / 30 fps). */
export const SAMPLES_PER_FRAME = SAMPLE_RATE / FPS

/** Per reel: tempo, frames per beat, length, poster frame, focus / grain / background look (spec §2). */
export const REELS = {
  a: {
    id: 'a',
    bpm: 100,
    beatFrames: 18,
    frames: 540,
    poster: 525,
    focus: { brightness: 0.8, blur: 4 },
    grain: 0.1,
    background: 'photo',
  },
  b: {
    id: 'b',
    bpm: 90,
    beatFrames: 20,
    frames: 540,
    poster: 20,
    focus: { brightness: 0.35, blur: 8 },
    grain: 0.14,
    background: 'dusk',
  },
  c: {
    id: 'c',
    bpm: 128.57,
    beatFrames: 14,
    frames: 504,
    poster: 470,
    focus: { brightness: 0.7, blur: 0 },
    grain: 0.08,
    background: 'black',
  },
}

export const REEL_IDS = Object.keys(REELS)

export function reelConfig(reel) {
  const config = REELS[reel]
  if (!config) throw new Error(`unknown reel "${reel}" (a | b | c)`)
  return config
}

/** Frame of beat `beat` (half and quarter beats allowed) plus `offset` frames. */
export function beatFrame(reel, beat, offset = 0) {
  return Math.round(beat * reelConfig(reel).beatFrames) + offset
}

/** Cuts land on whole or half beats (C: multiples of 14 or 7). */
export function isCutOnGrid(reel, frame) {
  return (
    Number.isInteger(frame) && frame % (reelConfig(reel).beatFrames / 2) === 0
  )
}

/**
 * A cue is written as `{ beat, offset?, frame }`: on a whole / half / quarter beat plus a whole number of frames
 * (the spec's "b9 + 6 frames"). It is on the grid when that sum is exactly its frame.
 */
export function isCueOnGrid(reel, cue) {
  if (!Number.isInteger(cue.frame) || typeof cue.beat !== 'number') return false
  if (!Number.isInteger(cue.beat * 4)) return false
  const offset = cue.offset ?? 0
  return (
    Number.isInteger(offset) && beatFrame(reel, cue.beat, offset) === cue.frame
  )
}

/** A cue on beat `beat` (+ `offset` frames). */
export function cue(reel, beat, sfx, extra = {}) {
  const offset = extra.offset ?? 0
  return { beat, offset, frame: beatFrame(reel, beat, offset), sfx, ...extra }
}

/** Audio sample index of a frame. */
export const frameSample = (frame) => Math.round(frame * SAMPLES_PER_FRAME)

/** Sample index of beat `beat` (exact: every reel's beat is a whole number of frames). */
export function beatSample(reel, beat) {
  return Math.round(beat * reelConfig(reel).beatFrames * SAMPLES_PER_FRAME)
}

/** Still frames of the 0.5 s self-check sheet. */
export function sheetFrames(frames) {
  const step = FPS / 2
  return Array.from({ length: Math.ceil(frames / step) }, (_, k) => k * step)
}

export const SHEET_CELL = { w: 270, h: 480 }
export const SHEET_COLS = 6

export function sheetSize(frames) {
  const n = sheetFrames(frames).length
  return {
    width: SHEET_COLS * SHEET_CELL.w,
    height: Math.ceil(n / SHEET_COLS) * SHEET_CELL.h,
    cells: n,
  }
}

/** Safe zones (spec §2): points x ≤ 930, 250 ≤ y ≤ 1520; text also x ≥ 96; poster text inside y 240–1680. */
export const SAFE = {
  left: 96,
  right: 930,
  top: 250,
  bottom: 1520,
  posterTop: 240,
  posterBottom: 1680,
}

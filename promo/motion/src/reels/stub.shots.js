// Placeholder shot tables (the shot grid, scale classes and sound cues of spec §3–§5, no captured clips) so Root,
// reels-audio.mjs and reels-render.mjs run before the reel items add `a.shots.js` / `b.shots.js` / `c.shots.js`.
//
// Shot table contract (every `<x>.shots.js` default-exports one):
// {
//   reel: 'a' | 'b' | 'c', frames,                 // length in frames
//   plane: { w, h },                               // camera plane px (a clip's CSS viewport, or the stub plane)
//   shots: [{
//     id, from, to,                                // frames, back to back, from on the half-beat grid
//     scale: 'M' | 'Md' | 'W' | 'end',
//     cam: [{ cx, cy, w }, { cx, cy, w }],         // crop keys at shot start / end (plane px, 9:16)
//     drift?, push?, punches?: [{ frame, amount }], fast?: [{ from, to }],
//     breath?: { from, to },                       // the slow turn inside the breath shot (30–45 frames)
//     ui?: { clip, rate },                         // a kit clip: crop w 360–864, rate 1 (A2 rewind: -1)
//     photos?: [{ file, outW, srcW? }],            // the largest output width each photo reaches in the shot
//   }],
//   cues: [{ beat, offset, frame, sfx, x?, y? }],  // sfx: click | snap | rustle | whoosh | thud | key | riser | air
//                                                  // | tape | shimmer; x/y = click / drop point (output px)
//   cursor?: { start, moves: [{ start, to }], clicks: [frame] },   // output px
// }
import { cue, reelConfig } from './shared/beats.js'
import { glideFrames } from './shared/Springs.js'

const PLANE = { w: 1440, h: 2560 }
const CAM = {
  M: { cx: 720, cy: 1180, w: 440 },
  Md: { cx: 720, cy: 1280, w: 820 },
  W: { cx: 720, cy: 1280, w: 1300 },
  end: { cx: 720, cy: 1620, w: 1300 },
}

// [id, from beat, to beat, scale, extra]
const GRIDS = {
  a: [
    ['A1', 0, 2, 'M'],
    ['A2', 2, 4, 'Md'],
    ['A3', 4, 5, 'M'],
    ['A4', 5, 7, 'Md'],
    ['A5', 7, 9, 'M'],
    ['A6', 9, 12, 'W'],
    ['A7', 12, 13, 'M', { fastAtEnd: 8 }],
    ['A8', 13, 16, 'Md'],
    ['A9', 16, 19, 'W', { whipIn: true }],
    ['A10', 19, 21, 'M'],
    ['A11', 21, 26, 'Md', { breath: [21.5, 1300] }],
    ['A12', 26, 30, 'end'],
  ],
  b: [
    ['B1', 0, 2, 'M'],
    ['B2', 2, 4, 'Md'],
    ['B3', 4, 6, 'M'],
    ['B4', 6, 8, 'W'],
    ['B5', 8, 10, 'Md'],
    ['B6', 10, 13, 'W'],
    ['B7', 13, 16, 'Md'],
    ['B8', 16, 19, 'W'],
    ['B9', 19, 23, 'M', { breath: [20.5, 1300] }],
    ['B10', 23, 27, 'end'],
  ],
  c: [
    ['C1', 0, 2, 'M'],
    ['C2', 2, 4, 'Md'],
    ['C3', 4, 7, 'M'],
    ['C4', 7, 11, 'W'],
    ['C5', 11, 13, 'M', { whipIn: true }],
    ['C6', 13, 15, 'Md'],
    ['C7', 15, 17, 'W'],
    ['C8', 17, 21, 'Md', { whipIn: true }],
    ['C9', 21, 23, 'M'],
    ['C10', 23, 30, 'W', { breath: [26, 1300] }],
    ['C11', 30, 36, 'end'],
  ],
}

const at = (x, y) => ({ x, y })

const CUES = {
  a: (r) => [
    cue(r, 0, 'rustle', { offset: 4 }),
    cue(r, 2, 'whoosh'),
    cue(r, 4.5, 'click', at(600, 1180)),
    cue(r, 6, 'click', at(420, 1400)),
    cue(r, 8, 'snap', at(540, 900)),
    cue(r, 9, 'click', { offset: 6, ...at(300, 1350) }),
    cue(r, 10, 'shimmer'),
    cue(r, 12, 'whoosh'),
    // "Lake trip 2026" typed from b13 + 4 frames at 60 ms a letter (1.8 frames), each tick on a whole frame.
    ...Array.from({ length: 14 }, (_, k) =>
      cue(r, 13, 'key', { offset: 4 + Math.round(k * 1.8) }),
    ),
    cue(r, 16, 'whoosh'),
    cue(r, 17, 'thud'),
    cue(r, 18, 'click', at(560, 1000)),
    cue(r, 19, 'rustle'),
    cue(r, 21.5, 'rustle'),
  ],
  b: (r) => [
    cue(r, 3, 'click', at(300, 1450)),
    cue(r, 4, 'snap', at(540, 900)),
    cue(r, 7, 'snap', at(600, 800)),
    cue(r, 9, 'riser'),
    cue(r, 10, 'air'),
    cue(r, 12, 'riser'),
    cue(r, 13, 'air'),
    cue(r, 15, 'click', at(540, 1000)),
    cue(r, 15, 'riser'),
    cue(r, 16, 'air'),
    cue(r, 17, 'click', at(560, 980)),
    cue(r, 17, 'rustle'),
    cue(r, 20.5, 'rustle'),
  ],
  c: (r) => [
    cue(r, 0, 'click', { offset: 3, ...at(700, 1300) }),
    cue(r, 1, 'whoosh'),
    cue(r, 3.5, 'snap', at(540, 900)),
    ...[4.5, 5, 5.5, 6].flatMap((b) => [
      cue(r, b, 'click', at(640, 520)),
      cue(r, b, 'snap'),
    ]),
    cue(r, 7, 'click', at(260, 1420)),
    cue(r, 8, 'shimmer'),
    cue(r, 9, 'tape', at(820, 330)),
    cue(r, 9.5, 'click', at(260, 1420)),
    cue(r, 10, 'shimmer'),
    cue(r, 11, 'whoosh'),
    cue(r, 12, 'snap', at(540, 1000)),
    cue(r, 14, 'click', { offset: 7, ...at(780, 1200) }),
    ...[15, 15.5, 16].map((b) => cue(r, b, 'thud')),
    cue(r, 17, 'whoosh'),
    ...[17, 18, 19, 20].map((b) => cue(r, b, 'thud')),
    cue(r, 22, 'click', at(520, 1000)),
    cue(r, 23, 'rustle'),
    cue(r, 26, 'rustle'),
  ],
}

function buildShots(reel) {
  const { beatFrames } = reelConfig(reel)
  return GRIDS[reel].map(([id, b0, b1, scale, extra = {}]) => {
    const from = b0 * beatFrames
    const to = b1 * beatFrames
    const k0 = CAM[scale]
    const k1 = { ...k0, w: k0.w * 0.97, cy: k0.cy - 12 }
    const shot = { id, from, to, scale, cam: [k0, k1] }
    if (extra.breath) {
      const [beat, ms] = extra.breath
      const start = beat * beatFrames
      shot.breath = { from: start, to: start + Math.round((ms / 1000) * 30) }
    }
    if (extra.whipIn) shot.fast = [{ from, to: from + 4 }]
    if (extra.fastAtEnd) shot.fast = [{ from: to - extra.fastAtEnd, to }]
    if (scale === 'end') shot.push = 0.005
    return shot
  })
}

function buildCursor(cues) {
  const points = cues.filter((c) => c.sfx === 'click' && c.x != null)
  const start = { x: 820, y: 1480 }
  let from = start
  let free = 0
  const moves = []
  for (const c of points) {
    const to = { x: c.x, y: c.y }
    // Land (glide + ~4 settle frames) just before the click, never before the previous move ends.
    const travel = Math.ceil(
      glideFrames(Math.hypot(to.x - from.x, to.y - from.y)),
    )
    const begin = Math.max(free, c.frame - travel - 4)
    moves.push({ start: begin, to })
    free = begin + travel + 1
    from = to
  }
  return { start, moves, clicks: points.map((c) => c.frame) }
}

export function stubShots(reel) {
  const { frames } = reelConfig(reel)
  const cues = CUES[reel](reel)
  return {
    reel,
    frames,
    plane: PLANE,
    stub: true,
    shots: buildShots(reel),
    cues,
    cursor: buildCursor(cues),
  }
}

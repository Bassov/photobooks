// Reel B «Один снимок» shot table (Designer promo-reels-3 spec §4; contract in stub.shots.js). One hero, L68, followed
// from a full-frame macro into the filmstrip, onto spread 1, onto the cover, onto the PDF cover sheet, onto the site
// shelf and into the phone reader. There are no cuts: every context change keeps the hero's output rect where the
// previous context left it (`lock`), so the camera path reads as one move; three of them are rack focuses on a downbeat.
//
// Plain JS (Node imports it too: reels-audio.mjs / reels-render.mjs). The boxes below are CSS px measured from the
// capture logs of promo/reels/walks-b.mjs (promo/out/reels/clips/<clip>/<clip>.{rects,pointer}.json); the pointer paths
// are rebuilt from the walks' own steps with capture's `glidePath`, so the overlay cursor is the filmed path.
import { HEIGHT, WIDTH, cue, reelConfig } from './shared/beats.js'
import { cameraAt } from './shared/Springs.js'

const R = 'b'
const BEAT = reelConfig(R).beatFrames // 20
const b = (beat) => beat * BEAT

// ---------------------------------------------------------------- measured (CSS px of each clip's viewport)

/**
 * Hero photo: graded L68, 4000 × 2667 (promo/out/reels/photos/manifest.json reels.b). The walker stands at x 21–35 %
 * (measured on the graded file; the spec's 58 % is the backpack rocks), so the B1 crop centres on 30 %.
 */
export const HERO = { file: 'L68.jpg', w: 4000, h: 2667, walkerX: 0.3 }

export const CLIP = {
  'b-hero-drop': {
    frames: 98,
    plane: { w: 1280, h: 1440 },
    thumb: { x: 12, y: 1287, w: 183, h: 141 },
    frame: { x: 279, y: 401, w: 721, h: 512 },
  },
  'b-hero-cover': {
    frames: 144,
    plane: { w: 1280, h: 1440 },
    thumb: { x: 12, y: 1287, w: 183, h: 141 },
    frame: { x: 437, y: 443, w: 406, h: 288 },
    coverFront: { x: 656, y: 144, w: 170, h: 207 },
  },
  'b-site': {
    frames: 97,
    plane: { w: 1280, h: 1440 },
    // face-out book: rest, then lifted under the pointer (book3d box, clip frames 0 → 24); the room's closed cover
    // (pixel bbox of the frames 54–62, the GL cover is not a DOM box)
    face: { x: 319, y: 317, w: 336, h: 399 },
    lifted: { x: 312, y: 290, w: 349, h: 414 },
    liftFrames: [16, 24],
    room: { x: 357, y: 369, w: 580, h: 700 },
    roomFrame: 54,
  },
  'b-phone': {
    frames: 239,
    plane: { w: 390, h: 844 },
    paper: { x: 16, y: 180, w: 358, h: 448 },
  },
}

/** Walk steps of each clip (walks-b.mjs), for the pointer replay: start point, then glides / waits / down / up. */
const WALK = {
  'b-hero-drop': [
    ['at', 363.5, 1027.58],
    ['wait', 400],
    ['glide', 103.5, 1357.58],
    ['wait', 100],
    ['down'],
    ['wait', 70],
    ['glide', 640, 656.65, 640],
    ['up'],
  ],
  'b-hero-cover': [
    ['at', 103.5, 1357.58],
    ['wait', 1200],
    ['down'],
    ['wait', 70],
    ['glide', 741.39, 247.87, 700],
    ['up'],
  ],
  'b-site': [
    ['at', 873.5, 806.61],
    ['wait', 300],
    ['glide', 493.65, 506.61],
    ['wait', 500],
    ['down'],
    ['wait', 70],
    ['up'],
  ],
}

// ---------------------------------------------------------------- pointer replay (capture.mjs glidePath, verbatim)

const DT = 1000 / 30

export function glidePath(from, to, ms, bow = 0.08) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const D = Math.hypot(dx, dy)
  if (D < 0.5) return [{ ...to }]
  const T = ms ?? 180 + 120 * Math.log2(D / 40 + 1)
  const n = Math.max(2, Math.round(T / DT))
  const ux = dx / D
  const uy = dy / D
  const over = { x: to.x + ux * 6, y: to.y + uy * 6 }
  const pts = []
  for (let i = 1; i <= n; i++) {
    const s = i / n
    const e = s * s * s * (10 - 15 * s + 6 * s * s)
    const arc = Math.sin(Math.PI * s) * bow * D
    pts.push({
      x: from.x + (over.x - from.x) * e - uy * arc,
      y: from.y + (over.y - from.y) * e + ux * arc,
    })
  }
  let ox = over.x - to.x
  let oy = over.y - to.y
  let vx = 0
  let vy = 0
  const [m, k, c] = [0.4, 300, 18]
  for (let f = 0; f < 30; f++) {
    for (let sub = 0; sub < 8; sub++) {
      const h = DT / 1000 / 8
      vx += ((-k * ox - c * vx) / m) * h
      vy += ((-k * oy - c * vy) / m) * h
      ox += vx * h
      oy += vy * h
    }
    pts.push({ x: to.x + ox, y: to.y + oy })
    if (Math.hypot(ox, oy) < 0.05 && Math.hypot(vx, vy) < 1) break
  }
  pts.push({ ...to })
  return pts
}

/** Per clip frame: `{ x, y, down }` (CSS px), plus the frames of the down / up events. */
function replay(steps) {
  const frames = []
  const events = []
  let p = { x: 0, y: 0 }
  let down = false
  const push = () => frames.push({ ...p, down })
  for (const [op, ...a] of steps) {
    if (op === 'at') p = { x: a[0], y: a[1] }
    else if (op === 'wait')
      for (let i = Math.max(1, Math.round(a[0] / DT)); i > 0; i--) push()
    else if (op === 'glide')
      for (const q of glidePath(p, { x: a[0], y: a[1] }, a[2])) {
        p = q
        push()
      }
    else {
      down = op === 'down'
      events.push({ f: frames.length, type: op })
    }
  }
  return { frames, events }
}

export const POINTER = Object.fromEntries(
  Object.entries(WALK).map(([id, steps]) => [id, replay(steps)]),
)
const eventFrame = (id, type, k = 0) =>
  POINTER[id].events.filter((e) => e.type === type)[k].f

// ---------------------------------------------------------------- reel timing: which clip frame plays at a reel frame

/** Reel frame − offset = clip frame (rate 1). Each clip is placed so its action lands on the beat. */
export const OFFSET = {
  // drop (up) on b4 = 80
  'b-hero-drop': b(4) - eventFrame('b-hero-drop', 'up'),
  // drop on the cover on b7 = 140
  'b-hero-cover': b(7) - eventFrame('b-hero-cover', 'up'),
  // the room's closed cover is on screen at the b16 rack (clip frames 54–62); the click lands at 312 = b15.5 + 2
  'b-site': b(16) - 58,
  // tap on b18 = 360 (spec: b17; one beat later so the title page under the cover is on screen for ~half a beat
  // only); the cover opens (1000 ms) onto the title page; the breath drag starts on b19.5 = 390
  'b-phone': b(18) - 40, // b-phone.pointer.json: tap down on clip frame 40, breath drag down on 70
}

const box = (x, y, w, h) => ({ x, y, w, h })
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/** Plane box → output box of `shot` at `frame`. */
export function outBox(shot, frame, r) {
  const { s, tx, ty } = cameraAt(shot, frame)
  return box(r.x * s + tx, r.y * s + ty, r.w * s, r.h * s)
}

/** Crop key that puts plane box `r` (centre) onto output box `o` (width) at the shot's first frame. */
function lock(r, o) {
  const s = o.w / r.w
  const c = centre(r)
  const oc = centre(o)
  return {
    w: WIDTH / s,
    cx: (WIDTH / 2 - (oc.x - c.x * s)) / s,
    cy: (HEIGHT / 2 - (oc.y - c.y * s)) / s,
  }
}

/** Crop key showing plane box `r` at output width `outW`, its centre at output point `at`. */
function frameOn(r, outW, at = { x: WIDTH / 2, y: HEIGHT / 2 }) {
  const w = outW
  const h = (r.h / r.w) * outW
  return lock(r, box(at.x - w / 2, at.y - h / 2, w, h))
}

// ---------------------------------------------------------------- the PDF cover sheet (motion-built, §2 «PDF sheet»)

/** 14.8 × 21 cm book: back 148 + spine 7 + front 148 mm, 210 mm tall; Generic profile (bleed 3, marks 3 → 8 mm). */
export const SHEET = {
  trimW: 303,
  trimH: 210,
  spine: 7,
  spineX: 148,
  slugMm: 8,
  pxPerMm: 4,
}
const mm = (v) => v * SHEET.pxPerMm
/** The hero's frame on the front panel: the kit cover-front frame's place on its page (16 / 40 css of 203 × 288). */
export const SHEET_FRONT = box(
  mm(SHEET.slugMm + SHEET.spineX + SHEET.spine + 11.7),
  mm(SHEET.slugMm + 29.2),
  mm(124),
  mm(151),
)
/** Front panel up to the media edge: the crop marks there are part of the sharp area. */
export const SHEET_FRONT_MARKS = box(
  mm(SHEET.spineX + SHEET.spine),
  0,
  mm(148 + 2 * SHEET.slugMm),
  mm(SHEET.trimH + 2 * SHEET.slugMm),
)
export const SHEET_PLANE = {
  w: mm(SHEET.trimW + 2 * SHEET.slugMm),
  h: mm(SHEET.trimH + 2 * SHEET.slugMm),
}

// ---------------------------------------------------------------- shots

const HERO_PLANE = { w: HERO.w, h: HERO.h }
const heroCrop = (w) => ({
  cx: HERO.w * HERO.walkerX,
  cy: HERO.h / 2,
  w,
})
const D = CLIP['b-hero-drop']
const C = CLIP['b-hero-cover']
const S = CLIP['b-site']
const P = CLIP['b-phone']

const shots = []
const add = (shot) => {
  shots.push(shot)
  return shot
}
/** Hero output box at the end of `shot` (the frame the next context starts on). */
const endBox = (shot, r) => outBox(shot, shot.to, r)

// B1 0–2 M: the hero macro, full height (2667 px → 1920), centred on the walker, push 1.00 → 1.03.
const B1 = add({
  id: 'B1',
  from: 0,
  to: b(2),
  scale: 'M',
  context: 'hero',
  plane: HERO_PLANE,
  cam: [heroCrop((HERO.h * 9) / 16), heroCrop((HERO.h * 9) / 16 / 1.03)],
  push: 0,
  drift: { x: -9, y: 0 },
  // from b1.5 the photo shrinks into filmstrip thumb 1 (ReelB `heroShrink`)
  shrink: { from: b(1.5), to: b(2) },
})
// B2 2–4 Md: the editor (Md zoom); thumb 1 is the hero; grab (b2.5 + 2), drag, drop on b4.
const B2 = add({
  id: 'B2',
  from: b(2),
  to: b(4),
  scale: 'Md',
  context: 'b-hero-drop',
  plane: D.plane,
  ui: { clip: 'b-hero-drop', rate: 1 },
  cam: [
    { cx: 400, cy: 960, w: 800 },
    { cx: 410, cy: 950, w: 790 },
  ],
})
// B3 4–6 M: W clip with the hero already on spread 1: the landing overlay springs onto it; macro on the spread.
const B3 = add({
  id: 'B3',
  from: b(4),
  to: b(6),
  scale: 'M',
  context: 'b-hero-cover',
  plane: C.plane,
  ui: { clip: 'b-hero-cover', rate: 1 },
  cam: [
    frameOn(C.frame, 1000, { x: 540, y: 900 }),
    frameOn(C.frame, 900, { x: 540, y: 880 }),
  ],
  land: { from: b(4) },
  drift: { x: -6, y: -9 },
})
// B4 6–8 W: the camera rises up the W stack to the cover; the hero thumb comes up from below onto the cover front.
const B4 = add({
  id: 'B4',
  from: b(6),
  to: b(8),
  scale: 'W',
  context: 'b-hero-cover',
  plane: C.plane,
  ui: { clip: 'b-hero-cover', rate: 1 },
  cam: [B3.cam[1], { cx: 600, cy: 720, w: 800 }],
})
// B5 8–10 Md: push onto the cover.
const B5 = add({
  id: 'B5',
  from: b(8),
  to: b(10),
  scale: 'Md',
  context: 'b-hero-cover',
  plane: C.plane,
  ui: { clip: 'b-hero-cover', rate: 1 },
  cam: [B4.cam[1], { cx: 700, cy: 470, w: 612 }],
  push: 0.015,
})
// B6 10–13 W: rack focus on b10 → the cover PDF sheet; its front panel takes the hero's rect; the sheet slides left
// and the camera closes in on the front (its end size sets the site book's scale ≥ 1.35).
const B6 = add({
  id: 'B6',
  from: b(10),
  to: b(13),
  scale: 'W',
  context: 'pdf',
  plane: SHEET_PLANE,
  rack: b(10),
  cam: [
    lock(SHEET_FRONT, endBox(B5, C.coverFront)),
    frameOn(SHEET_FRONT, 480, { x: 470, y: 900 }),
  ],
  drift: { x: -14, y: 0 },
})
// B7 13–16 Md: rack focus on b13 → the site home, face-out B book (cover = hero); lift, click (b15.5 + 2): the room
// opens on the closed cover.
const B7 = add({
  id: 'B7',
  from: b(13),
  to: b(16),
  scale: 'Md',
  context: 'b-site',
  plane: S.plane,
  ui: { clip: 'b-site', rate: 1 },
  rack: b(13),
  cam: [
    lock(S.face, endBox(B6, SHEET_FRONT)),
    { cx: S.room.x + S.room.w / 2 - 20, cy: 720, w: 790 },
  ],
})
// B8 16–19 W: rack focus on b16 → the phone reader on the B cover; tap on b18 opens it (GL, 1000 ms).
const PHONE_W = {
  cx: 195,
  cy: (HEIGHT / 2 - 260) / (580 / 390),
  w: (390 * WIDTH) / 580,
}
const B8 = add({
  id: 'B8',
  from: b(16),
  to: b(19),
  scale: 'W',
  context: 'b-phone',
  plane: P.plane,
  ui: { clip: 'b-phone', rate: 1 },
  rack: b(16),
  cam: [lock(P.paper, endBox(B7, S.room)), PHONE_W],
})
// B9 19–23 M (breath): push into the page; from b19.5 (as soon as the cover has opened onto the title page, so the
// hero is off screen for about half a beat) one slow 1300 ms finger drag turns the next page: spread 1 = the hero.
const B9 = add({
  id: 'B9',
  from: b(19),
  to: b(23),
  scale: 'M',
  context: 'b-phone',
  plane: P.plane,
  ui: { clip: 'b-phone', rate: 1 },
  cam: [PHONE_W, frameOn(P.paper, 960, { x: 540, y: 900 })],
  push: 0.006,
  breath: { from: b(19.5), to: b(19.5) + 39 },
})
// B10 23–27 end: the camera holds (0.5 %/s push, drift) and the phone settles into y 250–940 on the heavy spring.
add({
  id: 'B10',
  from: b(23),
  to: b(27),
  scale: 'end',
  context: 'b-phone',
  plane: P.plane,
  cam: [B9.cam[1], B9.cam[1]],
  push: 0.005,
  drift: { x: -6, y: 0 },
  endFrom: B9,
})

// ---------------------------------------------------------------- photos shown (largest output width per shot)

B1.photos = [
  {
    file: HERO.file,
    outW: Math.ceil(HERO.w * cameraAt(B1, B1.to - 1).s),
    srcW: HERO.w,
  },
]
{
  // landing overlay: the hero cover-fits spread 1's frame (aspect 1.41 < 1.5, so the photo's height fills it)
  const fr = outBox(B3, B3.from, C.frame)
  B3.photos = [
    {
      file: HERO.file,
      outW: Math.ceil(fr.h * 1.06 * 1.1 * (HERO.w / HERO.h)),
      srcW: HERO.w,
    },
  ]
}
{
  const fr = outBox(B6, B6.to - 1, SHEET_FRONT)
  B6.photos = [
    {
      file: HERO.file,
      outW: Math.ceil(fr.h * (HERO.w / HERO.h)),
      srcW: HERO.w,
    },
  ]
}

// ---------------------------------------------------------------- cues (sound + click / drop points, output px)

const pointOut = (shot, frame, p) => {
  const o = outBox(shot, frame, box(p.x, p.y, 0, 0))
  return { x: Math.round(o.x), y: Math.round(o.y) }
}
const clipPointer = (id, reelFrame) =>
  POINTER[id].frames[reelFrame - OFFSET[id]]

const GRAB = b(2.5) + 2
const DROP = b(4)
const COVER_DROP = b(7)
const SITE_CLICK = b(15.5) + 2
const TAP = b(18)
if (GRAB !== eventFrame('b-hero-drop', 'down') + OFFSET['b-hero-drop'])
  throw new Error('b.shots: the grab is off its cue')
if (SITE_CLICK !== eventFrame('b-site', 'down') + OFFSET['b-site'])
  throw new Error('b.shots: the site click is off its cue')

const cues = [
  cue(R, 2, 'air'),
  cue(R, 2.5, 'click', {
    offset: 2,
    ...pointOut(B2, GRAB, clipPointer('b-hero-drop', GRAB)),
  }),
  cue(R, 4, 'snap', pointOut(B3, DROP, centre(C.frame))),
  cue(R, 7, 'snap', pointOut(B4, COVER_DROP, centre(C.coverFront))),
  cue(R, 9, 'riser'),
  cue(R, 10, 'air'),
  cue(R, 12, 'riser'),
  cue(R, 13, 'air'),
  cue(R, 15, 'riser'),
  cue(R, 15.5, 'click', {
    offset: 2,
    ...pointOut(B7, SITE_CLICK, clipPointer('b-site', SITE_CLICK)),
  }),
  cue(R, 16, 'air'),
  cue(R, 18, 'click', pointOut(B8, TAP, { x: 273, y: 404 })),
  cue(R, 18, 'rustle'),
  cue(R, 19.5, 'rustle'),
]

export default {
  reel: R,
  frames: reelConfig(R).frames,
  plane: D.plane,
  shots,
  cues,
}

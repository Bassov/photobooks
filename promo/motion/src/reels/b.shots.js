// Reel B «Один снимок» shot table, v2 (Designer promo-reels-v2 spec §1–§4 on top of promo-reels-3 §4; contract in
// stub.shots.js). One hero, L68, followed from a full-frame macro into the filmstrip, onto spread 1, onto the cover,
// onto the PDF cover sheet, onto the site shelf and into the phone reader. Every context change keeps the hero's output
// rect where the previous context left it (`lock`), so the camera path reads as one move.
//
// v2: the cut follows the track (b.beats.js, Tetrapod, 91.38 BPM, 552 frames): every cut is on a beat frame, the cover
// drop on the hero bar's downbeat (frame 158), the rack into the PDF sheet is a cut + impact on frame 236 (Designer
// review 4: it covers the track's 169 ms break at 7.71–7.88 s), the end card on the last downbeat (473).
// The editor book is full (walks-b.mjs `fullBook`), so the editor shots are photo-filled (G3).
//
// Plain JS (Node imports it too: reels-render.mjs). The boxes below are CSS px measured from the capture logs of
// promo/reels/walks-b.mjs (promo/out/reels/clips/<clip>/<clip>.{rects,pointer}.json); the pointer paths are rebuilt
// from the walks' own steps with capture's `glidePath`, so the overlay cursor is the filmed path.
import { HEIGHT, SAFE, WIDTH, gridBeatFrame } from './shared/beats.js'
import { cameraAt, shotAt } from './shared/Springs.js'
import BEATS from './b.beats.js'

const R = 'b'
/** Frame of beat `k` of the track grid (b(8) = 158, the hero bar's downbeat). */
export const b = (k) => gridBeatFrame(BEATS, k)

// ---------------------------------------------------------------- measured (CSS px of each clip's viewport)

/**
 * Hero photo: graded L68, 4000 × 2667 (promo/out/reels/photos/manifest.json reels.b). The walker stands at x 21–35 %
 * (measured on the graded file), so the B1 crop centres on 30 %.
 */
export const HERO = { file: 'L68.jpg', w: 4000, h: 2667, walkerX: 0.3 }

export const CLIP = {
  // v2 capture (full book): the strip is scrolled 40 px, so thumb 1 starts at x −28
  'b-hero-drop': {
    frames: 114,
    plane: { w: 1280, h: 1440 },
    thumb: { x: -28, y: 1287.15, w: 183, h: 140.85 },
    frame: { x: 279.4, y: 397.49, w: 721.2, h: 511.66 },
    events: { down: 40, up: 72 },
  },
  // the cover is the current spread at 872 CSS px (Designer review of PR #746: front frame ≥ 320 CSS px); the strip
  // is not scrolled here, thumb 1 starts at x 12. `cover` = the cover spread, `coverPage` = its front (right) page.
  'b-hero-cover': {
    frames: 179,
    plane: { w: 1280, h: 1440 },
    thumb: { x: 12, y: 1287.15, w: 183, h: 140.85 },
    cover: { x: 203.8, y: 104, w: 872.4, h: 618.93 },
    coverPage: { x: 640, y: 104, w: 436.2, h: 618.93 },
    coverFront: { x: 674.9, y: 190.65, w: 366.41, h: 445.63 },
    events: { down: 48, up: 82 },
  },
  'b-site': {
    frames: 97,
    plane: { w: 1280, h: 1440 },
    // face-out book: rest, then lifted under the pointer (book3d box, clip frames 0 → 24); the room's closed cover
    // (pixel bbox of the frames 54–62, the GL cover is not a DOM box)
    face: { x: 319.43, y: 317.37, w: 336, h: 399.24 },
    lifted: { x: 312.46, y: 290.14, w: 349.44, h: 414.03 },
    liftFrames: [14, 24],
    events: { down: 50, up: 52 },
    room: { x: 357, y: 369, w: 580, h: 700 },
    roomFrame: 54,
  },
  'b-phone': {
    frames: 251,
    plane: { w: 390, h: 844 },
    paper: { x: 16, y: 180, w: 358, h: 448 },
    // the hero spread on the phone: the reader shows a spread as a band across the page
    band: { x: 42, y: 292, w: 332, h: 223 },
    tap: { x: 273, y: 404 },
    // b-phone.pointer.json: tap down, breath drag down / up (clip frames)
    touch: { tap: 18, drag: 52, dragUp: 89 },
    // Read from the capture's frames (photo-like pixels of the paper / band, .cache-only script): the cover fills the
    // paper (≥ 0.9) until clip frame 25, its leaf is gone on 28; the title page alone until the drag lifts the leaf
    // (band 0.04 on 59), the band ≥ 0.9 from 90. The GL open (1000 ms) takes no drag before it lands (≈ 50).
    photo: { coverUntil: 25, bandFrom: 90 },
    // the same script on clip frames 59–89: the share of the band the lifting leaf has uncovered (from the right)
    reveal: {
      from: 59,
      share: [
        0.04, 0.08, 0.12, 0.18, 0.23, 0.26, 0.29, 0.31, 0.34, 0.37, 0.4, 0.42,
        0.45, 0.47, 0.49, 0.51, 0.53, 0.54, 0.55, 0.55, 0.55, 0.56, 0.56, 0.55,
        0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.74,
      ],
    },
    // B9 cuts on b18 to clip frame 46: the 18 clip frames (0.6 s) of the title page alone are left out
    skip: 18,
  },
}

/** Walk steps of each clip (walks-b.mjs), for the pointer replay: start point, then glides / waits / down / up. */
const WALK = {
  'b-hero-drop': [
    ['at', 323.5, 1027.58],
    ['wait', 400],
    ['glide', 63.5, 1357.58],
    ['wait', 100],
    ['down'],
    ['wait', 70],
    ['glide', 640, 653.32, 640],
    ['wait', 120],
    ['up'],
  ],
  'b-hero-cover': [
    ['at', 103.5, 1357.58],
    ['wait', 1600],
    ['down'],
    ['wait', 70],
    ['glide', 858.1, 413.46, 700],
    ['wait', 120],
    ['up'],
    // the pointer leaves B5's crop
    ['wait', 200],
    ['glide', 1118.1, 793.46, 600],
    ['wait', 2200],
  ],
  'b-site': [
    ['at', 873.65, 806.61],
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
// the replay must put down / up on the frames the capture logged (<clip>.pointer.json `events`)
for (const [id, c] of Object.entries(CLIP))
  for (const [type, f] of Object.entries(c.events ?? {}))
    if (eventFrame(id, type) !== f)
      throw new Error(
        `b.shots: ${id} ${type} replays on frame ${eventFrame(id, type)}, filmed on ${f}`,
      )

// ---------------------------------------------------------------- reel timing: which clip frame plays at a reel frame

/** The beats the actions land on (frames of the track grid). */
export const ACT = {
  drop: b(4), // 79: the hero lands on spread 1 (cut B2 → B3)
  coverDrop: b(8), // 158: the hero bar's downbeat
  pdf: b(12), // 236: cut + impact into the PDF sheet
  // 323: the room's closed cover (clip frames 54–62) is on screen until the rack into the phone on b17 (clip 62)
  siteClick: b(16) + 8,
  // 345: the phone tap, 10 frames after the phone appears (Designer review of PR #746: ≤ 2 beats); the cover opens
  // (GL, 1000 ms) and the drag turns the title page onto the hero spread right after, landing by frame ≈ 412
  tap: b(17) + 10,
  end: b(24), // 473: the last downbeat
}

/** Reel frame − offset = clip frame (rate 1). Each clip is placed so its action lands on its beat. */
export const OFFSET = {
  'b-hero-drop': ACT.drop - eventFrame('b-hero-drop', 'up'),
  'b-hero-cover': ACT.coverDrop - eventFrame('b-hero-cover', 'up'),
  'b-site': ACT.siteClick - eventFrame('b-site', 'down'),
  'b-phone': ACT.tap - CLIP['b-phone'].touch.tap,
}
/** Reel frame − offset = clip frame for B9 / B10: the phone clip resumes `skip` frames later after the b18 cut. */
export const PHONE_LATE = OFFSET['b-phone'] - CLIP['b-phone'].skip
/** Reel frame − offset = clip frame of `clip` at reel frame `f` (B9's cut on b18 skips the phone clip ahead). */
export const offsetAt = (clip, f) =>
  clip === 'b-phone' && f >= b(18) ? PHONE_LATE : OFFSET[clip]
/** The breath: the finger drag that turns the title page onto the hero (b-phone.pointer.json, down → up). */
export const BREATH = {
  from: PHONE_LATE + CLIP['b-phone'].touch.drag,
  frames: CLIP['b-phone'].touch.dragUp - CLIP['b-phone'].touch.drag,
}

const box = (x, y, w, h) => ({ x, y, w, h })
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
/** `r` scaled by `k` about its centre. */
const grow = (r, k) =>
  box(r.x - (r.w * (k - 1)) / 2, r.y - (r.h * (k - 1)) / 2, r.w * k, r.h * k)

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

/** The crop key of a camera state (push and drift at 0): the next shot starts exactly where `c` is (no cut). */
const keyOf = (c) => ({
  w: WIDTH / c.s,
  cx: (WIDTH / 2 - c.tx) / c.s,
  cy: (HEIGHT / 2 - c.ty) / c.s,
})

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
/** The front panel's trim box (v2 G3 B6: framed ≥ 800 px wide with its crop marks at top, right and bottom). */
export const SHEET_PANEL = box(
  mm(SHEET.slugMm + SHEET.spineX + SHEET.spine),
  mm(SHEET.slugMm),
  mm(148),
  mm(SHEET.trimH),
)
export const SHEET_PLANE = {
  w: mm(SHEET.trimW + 2 * SHEET.slugMm),
  h: mm(SHEET.trimH + 2 * SHEET.slugMm),
}
/** Panel width in output px at the end of B6 (spec ≥ 800). */
export const PANEL_OUT_W = 900

// ---------------------------------------------------------------- the phone (v2 G3 B8/B9: body 700 × 1482 at 190, 219)

/** Capture px → output: the screen's 672 px over the 390 px capture, at x 204, y 233. */
const PHONE_K = 672 / 390
const PHONE_SCREEN = { x: 204, y: 233 }
/** Crop showing the phone exactly at its spec box (capture px plane). */
export const PHONE_W = {
  cx: (WIDTH / 2 - PHONE_SCREEN.x) / PHONE_K,
  cy: (HEIGHT / 2 - PHONE_SCREEN.y) / PHONE_K,
  w: WIDTH / PHONE_K,
}

// ---------------------------------------------------------------- shots

const HERO_PLANE = { w: HERO.w, h: HERO.h }
/** 9:16 crop at zoom `z` over the full height, its top on the photo's top: the dark ground at the bottom stays under
 * G2's 96 rows. */
const heroCrop = (z) => ({
  cx: HERO.w * HERO.walkerX,
  cy: HERO.h / (2 * z),
  w: (HERO.h * 9) / 16 / z,
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
/** Clip frame of a shot's first frame (reels-render.mjs maps the clip's rects through `ui.start`). */
const ui = (clip, from) => ({ clip, rate: 1, start: from - OFFSET[clip] })

// B1 b0–b2 M: the hero macro, top-anchored 1.04 → 1.07 of full height, centred on the walker; from b1.5 it shrinks
// into thumb 1.
const B1 = add({
  id: 'B1',
  from: 0,
  to: b(2),
  scale: 'M',
  context: 'hero',
  plane: HERO_PLANE,
  cam: [heroCrop(1.04), heroCrop(1.07)],
  push: 0,
  drift: { x: -9, y: 0 },
  shrink: { from: b(1.5), to: b(2) },
})
// B2 b2–b4 Md: the full editor book (Md zoom); thumb 1 is the hero; grab, drag, drop on spread 1 on b4.
const B2 = add({
  id: 'B2',
  from: b(2),
  to: ACT.drop,
  scale: 'Md',
  context: 'b-hero-drop',
  plane: D.plane,
  ui: ui('b-hero-drop', b(2)),
  cam: [
    // the grab on thumb 1 stays inside the safe zone (y ≤ 1520)
    { cx: 400, cy: 980, w: 800 },
    { cx: 430, cy: 930, w: 770 },
  ],
})
// B2's last output width of the spread-1 frame: B3 cuts in ×1.5 on it (Designer review of PR #746: no cut between two
// framings of the same page under ×1.5).
const B2_FRAME_W = outBox(B2, B2.to - 1, D.frame).w
// B3 b4–b6 M: cut in ×1.5 on the drop (same clip): macro on spread 1 (≥ 1217 px wide, G3), the landing overlay
// springs onto it, the camera keeps pushing.
const B3 = add({
  id: 'B3',
  from: ACT.drop,
  to: b(6),
  scale: 'M',
  context: 'b-hero-drop',
  plane: D.plane,
  ui: ui('b-hero-drop', ACT.drop),
  cam: [
    frameOn(D.frame, 1.52 * B2_FRAME_W, { x: 540, y: 900 }),
    frameOn(D.frame, 1.6 * B2_FRAME_W, { x: 520, y: 880 }),
  ],
  land: { from: ACT.drop },
  drift: { x: -6, y: -9 },
})
// B4 b6–b9 W: cut to the cover (current, big zoom): the camera rises from spread 1 (the hero, under the cover) to the
// cover; the hero comes up from the strip onto the cover front and drops on b8 (the hero bar) ≥ 400 px wide.
const B4 = add({
  id: 'B4',
  from: b(6),
  to: b(9),
  scale: 'W',
  context: 'b-hero-cover',
  plane: C.plane,
  ui: ui('b-hero-cover', b(6)),
  cam: [
    { cx: centre(C.cover).x, cy: centre(C.cover).y + 420, w: 860 },
    frameOn(C.coverPage, 640, { x: 560, y: 860 }),
  ],
})
// B5 b9–b12 Md: cut in on b9 to the cover page, the hero's frame ≥ 950 px wide (G3, lit = inside the focus box =
// the cover page), pushing in and drifting while the pointer leaves the crop.
const B5_END_W = Math.min(1080, 2.95 * C.coverFront.w)
const B5 = add({
  id: 'B5',
  from: b(9),
  to: ACT.pdf,
  scale: 'Md',
  context: 'b-hero-cover',
  plane: C.plane,
  ui: ui('b-hero-cover', b(9)),
  cam: [
    frameOn(C.coverFront, 0.9 * B5_END_W, { x: 580, y: 900 }),
    frameOn(C.coverFront, B5_END_W, { x: 568, y: 870 }),
  ],
  push: 0,
  drift: { x: -14, y: 0 },
})
// B6 b12–b14 W: cut + impact on b12 → the cover PDF sheet; its front frame takes the hero's rect, then the camera
// frames the front panel + spine 900 px wide with the marks at top, right and bottom; the white sheet runs out left.
const B6 = add({
  id: 'B6',
  from: ACT.pdf,
  to: b(14),
  scale: 'W',
  context: 'pdf',
  plane: SHEET_PLANE,
  rack: ACT.pdf,
  cam: [
    lock(SHEET_FRONT, endBox(B5, C.coverFront)),
    lock(
      SHEET_PANEL,
      box(
        110,
        HEIGHT / 2 - (PANEL_OUT_W * SHEET_PANEL.h) / SHEET_PANEL.w / 2 - 20,
        PANEL_OUT_W,
        (PANEL_OUT_W * SHEET_PANEL.h) / SHEET_PANEL.w,
      ),
    ),
  ],
  drift: { x: -10, y: 0 },
})
// B7 b14–b17 M: rack on b14 → the site home, face-out B book (cover = hero); lift, click on b16: the room opens on
// the closed cover, framed one page ≥ 900 px wide.
const B7 = add({
  id: 'B7',
  from: b(14),
  to: b(17),
  // v1 §4: Md (B8 is the M push onto the phone's cover page)
  scale: 'Md',
  context: 'b-site',
  plane: S.plane,
  ui: ui('b-site', b(14)),
  rack: b(14),
  // the face-out cover starts at 1.2 × the sheet front's last rect (the rack hides the step) and grows to 960 wide
  // lifted (G3 M ≥ 0.45; UI scale 2.75 ≤ 3); the room's closed cover then overfills the frame until the rack on b17
  cam: [
    lock(S.face, grow(endBox(B6, SHEET_FRONT), 1.2)),
    frameOn(S.lifted, 960, { x: 540, y: 900 }),
  ],
})
// B8 b17–b18 M: cut on b17 → the phone reader on the B cover (= the hero), pushing one page 960 → 1065 px wide (G3);
// the tap 10 frames in opens the cover (GL, 1000 ms).
const B8_END_W = 1065
const B8 = add({
  id: 'B8',
  from: b(17),
  to: b(18),
  scale: 'M',
  context: 'b-phone',
  plane: P.plane,
  ui: ui('b-phone', b(17)),
  // a hard cut, no rack: at UI scale ≤ 3 the page (≤ 1074 px) has its edges in frame, and a rack would blur them
  // (check 10)
  cam: [
    frameOn(P.paper, 960, { x: 540, y: 900 }),
    frameOn(P.paper, B8_END_W, { x: 540, y: 900 }),
  ],
  push: 0,
  drift: { x: -6, y: 0 },
})
// B9 b18–b24 W (breath): cut on b18 as the cover's leaf leaves, pulling back ×1.5 to the phone (page 710 px),
// and the clip jumps the 0.6 s the title page sits alone while the GL open lands (CLIP skip); the finger drag
// (1000 ms) turns the title page onto the hero spread while the camera pushes into its band at UI scale ≈ 3 (the
// reader shows a spread as a band, ≤ 0.32 of the frame), held under the push until the end card.
const B9 = add({
  id: 'B9',
  from: b(18),
  to: ACT.end,
  scale: 'W',
  context: 'b-phone',
  plane: P.plane,
  ui: { clip: 'b-phone', rate: 1, start: b(18) - PHONE_LATE },
  cam: [
    frameOn(P.paper, B8_END_W / 1.5, { x: 540, y: 900 }),
    { cx: centre(P.band).x, cy: centre(P.band).y, w: WIDTH / 2.97 },
  ],
  // the drift keeps the held band moving until the end card (UI scale ≤ 3: no push)
  push: 0,
  drift: { x: 8, y: -8 },
  breath: { from: BREATH.from, to: BREATH.from + BREATH.frames },
})
// B10 b24–end: the phone pulls back to its 700 px body box under the text (the camera does it, so the clip's page
// rects map 1:1 for check 10) over the hero spread.
add({
  id: 'B10',
  from: ACT.end,
  to: BEATS.frames,
  scale: 'end',
  context: 'b-phone',
  plane: P.plane,
  ui: { clip: 'b-phone', rate: 1, start: ACT.end - PHONE_LATE },
  cam: [keyOf(cameraAt(B9, B9.to)), PHONE_W],
  push: 0.005,
  drift: { x: -9, y: 0 },
})

// A UI shot whose plane leaves ≥ 90 rows of ground above or below it (B2: the strip sits at the viewport's foot, the
// grab must stay in the safe zone) has no focus: the focus layers would push that ground under G2's level 28.
for (const s of shots.filter((x) => x.ui && x.context !== 'b-phone')) {
  for (let f = s.from; f < s.to && !s.groundBand; f++) {
    const c = cameraAt(s, f)
    const below = HEIGHT - (c.ty + s.plane.h * c.s)
    if (c.ty >= 90 || below >= 90) s.groundBand = true
  }
}

// ---------------------------------------------------------------- photos shown (largest output width per shot)

B1.photos = [
  {
    file: HERO.file,
    outW: Math.ceil(HERO.w * cameraAt(B1, B1.to - 1).s),
    srcW: HERO.w,
  },
]
{
  const fr = outBox(B3, B3.to - 1, D.frame)
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

// ---------------------------------------------------------------- cues (mix types, output px of click / drop points)

const pointOut = (shot, frame, p) => {
  // A grab just outside the frame (B4: the hero leaves the strip below-left) pans from the nearest edge.
  const o = outBox(shot, frame, box(p.x, p.y, 0, 0))
  const clamp = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)))
  const inside = o.x >= 0 && o.x <= WIDTH && o.y >= 0 && o.y <= HEIGHT
  // an on-screen point stays as it is (check 6 judges it); only an off-screen grab is pulled to the safe edge
  if (inside) return { x: Math.round(o.x), y: Math.round(o.y) }
  return {
    x: clamp(o.x, SAFE.left, SAFE.right),
    y: clamp(o.y, SAFE.top, SAFE.bottom),
  }
}
const clipPointer = (id, reelFrame) =>
  POINTER[id].frames[reelFrame - OFFSET[id]]

/** A cue at `frame`, written as the last beat at or before it + whole frames (beats.js gridCue). */
function cueAt(frame, type, extra = {}) {
  let k = 0
  while (b(k + 1) <= frame) k++
  return {
    beat: k,
    offset: frame - b(k),
    frame,
    type,
    ...extra,
  }
}

const GRAB = eventFrame('b-hero-drop', 'down') + OFFSET['b-hero-drop']
const COVER_GRAB = eventFrame('b-hero-cover', 'down') + OFFSET['b-hero-cover']
const SHRINK = B1.shrink.from + 4

const cues = [
  cueAt(SHRINK, 'swish', { x: 540 }),
  cueAt(GRAB, 'pick', pointOut(B2, GRAB, clipPointer('b-hero-drop', GRAB))),
  cueAt(ACT.drop, 'drop', pointOut(B3, ACT.drop, centre(D.frame))),
  cueAt(
    COVER_GRAB,
    'pick',
    pointOut(
      shotAt(shots, COVER_GRAB),
      COVER_GRAB,
      clipPointer('b-hero-cover', COVER_GRAB),
    ),
  ),
  cueAt(
    ACT.coverDrop,
    'drop',
    pointOut(B4, ACT.coverDrop, centre(C.coverFront)),
  ),
  cueAt(ACT.pdf, 'impact', { x: 540 }),
  cueAt(b(14), 'swish', { x: 540 }),
  cueAt(
    ACT.siteClick,
    'click',
    pointOut(B7, ACT.siteClick, clipPointer('b-site', ACT.siteClick)),
  ),
  cueAt(b(17), 'swish', { x: 540 }),
  cueAt(ACT.tap, 'click', pointOut(B8, ACT.tap, P.tap)),
  cueAt(ACT.tap + 3, 'cover', { x: 600 }),
  // the slow turn; no music `breath` duck here: it would run over the end card's last downbeat (473)
  cueAt(BREATH.from, 'pageSlow', { x: 620 }),
  cueAt(ACT.end, 'impact', { x: 540 }),
]

export default {
  reel: R,
  frames: BEATS.frames,
  beats: BEATS,
  poster: 20,
  plane: D.plane,
  shots,
  cues,
}

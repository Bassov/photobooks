// Reel A «Одна поездка» shot table (Designer promo-reels-3 §3; contract in stub.shots.js). 100 BPM, 18 frames a beat,
// 540 frames. Every UI shot plays its kit clip at rate 1 with a constant offset (clip frame = reel frame + offset); the
// offsets come from the captured pointer / key events (a.capture.js), and this module throws when an event the beat
// plan relies on missed its beat, so a re-capture can never drift silently.
import { cue, reelConfig } from './shared/beats.js'
import { cameraAt } from './shared/Springs.js'
import { CAPTURE } from './a.capture.js'

const REEL = 'a'
const { frames: FRAMES } = reelConfig(REEL)
export const PLANE = { w: 1280, h: 1440 }

/** Set A in kit order: kit photo pNN = SET_A[(NN - 1) % 20] (capture.mjs serves the reel's photos in set order). */
export const SET_A = [
  'L18',
  'L4',
  'L10',
  'L19',
  'L23',
  'L24',
  'L28',
  'L30',
  'L31',
  'L34',
  'L38',
  'L39',
  'L45',
  'L47',
  'L40',
  'L22',
  'L21',
  'L36',
  'L55',
  'L65',
]
export const photoOfKit = (n) => SET_A[(n - 1) % SET_A.length]

// ---------------------------------------------------------------- capture → offsets (asserted)

const events = (id, type) =>
  CAPTURE[id].events.filter((e) => e[1] === type).map((e) => e[0])
function offset(id, clipFrame, reelFrame, what) {
  if (!Number.isInteger(clipFrame))
    throw new Error(`a.shots: ${id} has no ${what} event (re-capture)`)
  return clipFrame - reelFrame
}
function expect(id, got, want, what) {
  if (got !== want)
    throw new Error(
      `a.shots: ${id} ${what} at clip frame ${got}, the beat wants ${want}`,
    )
}

/** Reel frame of every beat event (spec §3), the clip events that must land on them. */
export const BEAT = {
  turn: 8, // A1: the click's up, the leaf starts to turn (b0 + 8)
  choose: 81, // A3: Choose goes down, b4.5
  pick: 108, // A4: thumb 1 picked, b6
  drop: 144, // A5: the drop, b8
  chip: 168, // A6: chip click, b9 + 6
  enter: 180, // A6: Enter, b10
  firstKey: 238, // A8: first letter, b13 + 4
  leave: 288, // A9: the pointer leaves the lifted book, b16
  open: 342, // A10: the click that opens the room, b19
  breath: 387, // A11: the slow drag starts, b21.5
}

export const OFFSET = {
  'a-gl-turn': offset(
    'a-gl-turn',
    events('a-gl-turn', 'up')[0],
    BEAT.turn,
    'up',
  ),
  'a-drop': offset(
    'a-drop',
    events('a-drop', 'down')[0],
    BEAT.choose,
    'Choose',
  ),
  'a-fill': offset('a-fill', events('a-fill', 'down')[0], BEAT.chip, 'chip'),
  'a-cover': offset(
    'a-cover',
    events('a-cover', 'key')[0],
    BEAT.firstKey,
    'key',
  ),
  // the leave is a glide, not an event: the walk starts it at clip frame 2 (walks-a.mjs PLAN.shelf.leave)
  'a-shelf': 2 - BEAT.leave,
  'a-breath': offset(
    'a-breath',
    events('a-breath', 'down')[0],
    BEAT.breath,
    'drag',
  ),
}
{
  const [, pick] = events('a-drop', 'down')
  expect('a-drop', pick, BEAT.pick + OFFSET['a-drop'], 'thumb pick')
  expect(
    'a-drop',
    events('a-drop', 'up')[1],
    BEAT.drop + OFFSET['a-drop'],
    'drop',
  )
  expect(
    'a-fill',
    events('a-fill', 'key')[0],
    BEAT.enter + OFFSET['a-fill'],
    'Enter',
  )
  expect(
    'a-shelf',
    events('a-shelf', 'down')[0],
    BEAT.open + OFFSET['a-shelf'],
    'book click',
  )
  events('a-cover', 'key').forEach((f, k) =>
    expect(
      'a-cover',
      f,
      BEAT.firstKey + OFFSET['a-cover'] + 2 * k,
      `letter ${k + 1}`,
    ),
  )
}

/** A box [x, y, w, h] (CSS px) of `name` in clip `id` at clip frame `f` (`k`-th match for `all` targets). */
export function rectAt(id, name, f, k = 0) {
  const list = CAPTURE[id].rects[name]
  const r = list[Math.max(0, Math.min(list.length - 1, f))]
  return Array.isArray(r?.[0]) ? r[k] : r
}
const centre = ([x, y, w, h]) => ({ x: x + w / 2, y: y + h / 2 })

// ---------------------------------------------------------------- geometry the shots share (CSS px of the clips)

/** The open GL book in the reading room (reader views, books=1): both boards, measured on the captured frames. */
export const BOOK = { x: 64, y: 360, w: 1152, h: 705 }
/** The filmstrip thumbnails band of the editor dock. */
export const STRIP = { y: 1287, h: 141 }
/** A7: L18 on spread 1 in the filled W view (it was dropped there before the fill; the fill keeps it). */
export const L18_BOX = rectAt('a-fill', 'frame', 0)
/** A8: the cover's front board (L18) in the cover view. */
export const COVER_BOX = rectAt('a-cover', 'cover', 0)
/** A5: spread 1's big frame, the drop target. */
export const DROP_BOX = rectAt('a-drop', 'frame', BEAT.drop + OFFSET['a-drop'])

const pointerAt = (id, f) => {
  const p = CAPTURE[id].pointer
  const [x, y] = p[Math.max(0, Math.min(p.length - 1, f))]
  return { x, y }
}
const at = (p, w) => ({ cx: p.x, cy: p.y, w })

// ---------------------------------------------------------------- shots

const b = (beat) => beat * reelConfig(REEL).beatFrames
const choose = pointerAt('a-drop', BEAT.choose + OFFSET['a-drop'])
const pick = pointerAt('a-drop', BEAT.pick + OFFSET['a-drop'])
const ghost = pointerAt('a-drop', b(7) + OFFSET['a-drop'] + 4)
const dropC = centre(DROP_BOX)
const cover = centre(COVER_BOX)
const bookC = centre([BOOK.x, BOOK.y, BOOK.w, BOOK.h])

const shots = [
  {
    // macro on the lifting corner of the right page (L38 | L31 → the next spread), push 1.00 → 1.05
    id: 'A1',
    from: 0,
    to: b(2),
    scale: 'M',
    cam: [
      { cx: 960, cy: 760, w: 420 },
      { cx: 952, cy: 756, w: 400 },
    ],
    ui: { clip: 'a-gl-turn', rate: 1, offset: OFFSET['a-gl-turn'] },
    bg: 'L38',
  },
  {
    // rewind: 8 frames of the turn backwards, then the filled editor un-fills (cards fly back into the strip) while
    // the camera pulls back w 480 → 810
    id: 'A2',
    from: b(2),
    to: b(4),
    scale: 'Md',
    cam: [
      { cx: 900, cy: 720, w: 480 },
      { cx: 640, cy: 720, w: 810 },
    ],
    fast: [{ from: b(2), to: b(2) + 8 }],
    ui: { clip: 'a-gl-turn', rate: -1, from: 27 },
    rewind: 8,
    bg: 'L38',
  },
  {
    id: 'A3',
    from: b(4),
    to: b(5),
    scale: 'M',
    cam: [
      at({ x: choose.x - 30, y: choose.y - 40 }, 420),
      at({ x: choose.x - 20, y: choose.y - 30 }, 400),
    ],
    ui: { clip: 'a-drop', rate: 1, offset: OFFSET['a-drop'] },
    focus: 'choose',
    cursor: true,
    bg: 'L18',
  },
  {
    // whip-out zoom from the button to the editor; the camera sits low and left so thumb 1 (the pick) is in the safe
    // zone: the dock's bottom edge shows over the blurred photo
    id: 'A4',
    from: b(5),
    to: b(7),
    scale: 'Md',
    // the 6-frame whip-out runs inside the plane (pullOut): the crop already sits where the pick lands on b6
    cam: [
      { cx: 405, cy: 1000, w: 810 },
      { cx: 405, cy: 996, w: 792 },
    ],
    pullOut: {
      box: [choose.x - 220, choose.y - 386, 400, 711],
      frames: 6,
      whip: true,
    },
    fast: [{ from: b(5), to: b(5) + 6 }],
    ui: { clip: 'a-drop', rate: 1, offset: OFFSET['a-drop'] },
    focus: 'pick',
    cursor: true,
    bg: 'L18',
  },
  {
    // the drag arrives on spread 1's big frame (tracking the ghost, 4-frame lag), L18 lands with the light spring
    id: 'A5',
    from: b(7),
    to: b(9),
    scale: 'M',
    cam: [at(ghost, 460), at({ x: dropC.x, y: dropC.y + 10 }, 450)],
    punches: [{ frame: BEAT.drop, amount: 0.015 }],
    ui: { clip: 'a-drop', rate: 1, offset: OFFSET['a-drop'] },
    focus: 'drop',
    cursor: true,
    land: { photo: 'L18', at: BEAT.drop, box: DROP_BOX },
    bg: 'L18',
  },
  {
    // W: spread list + chip row, chip click b9 + 6, Enter b10: every spread fills; push 1.00 → 1.04
    id: 'A6',
    from: b(9),
    to: b(12),
    scale: 'W',
    cam: [
      { cx: 640, cy: 850, w: 810 },
      { cx: 640, cy: 846, w: 782 },
    ],
    ui: { clip: 'a-fill', rate: 1, offset: OFFSET['a-fill'] },
    cursor: true,
    bg: 'L18',
  },
  {
    // zoom-through ×4 into L18 over 8 frames (blur), then the full-res graded L18 fills the frame and drifts
    id: 'A7',
    from: b(12),
    to: b(13),
    scale: 'M',
    // centred on the plane: the zoom-through carries L18 to the plane centre, then the photo covers the plane
    cam: [
      { cx: PLANE.w / 2, cy: PLANE.h / 2, w: 810 },
      { cx: PLANE.w / 2 - 6, cy: PLANE.h / 2, w: 790 },
    ],
    fast: [{ from: b(12), to: b(12) + 8 }],
    still: { clip: 'a-fill', frame: CAPTURE['a-fill'].frames - 1 },
    through: { box: L18_BOX, frames: 8, zoom: 4, photo: 'L18' },
    bg: 'L18',
  },
  {
    // the cover view (L18 on the front): it starts on L18 filling the frame (match) and pulls out; the title types in
    id: 'A8',
    from: b(13),
    to: b(16),
    scale: 'Md',
    cam: [
      { cx: cover.x - 150, cy: cover.y, w: 810 },
      { cx: cover.x - 150, cy: cover.y - 6, w: 795 },
    ],
    fast: [{ from: b(16) - 3, to: b(16) }],
    ui: { clip: 'a-cover', rate: 1, offset: OFFSET['a-cover'] },
    pullOut: { box: COVER_BOX, frames: 12 },
    whipOut: 3,
    focus: 'cover',
    bg: 'L18',
  },
  {
    // whip pan in from A8, the lifted book settles (pointer leaves b16), the pointer comes back to click it on b19
    id: 'A9',
    from: b(16),
    to: b(19),
    scale: 'W',
    // the shelf sits in the middle of the frame (the site's empty page below it stays out of the crop)
    cam: [
      { cx: 640, cy: 560, w: 810 },
      { cx: 630, cy: 556, w: 784 },
    ],
    fast: [{ from: b(16), to: b(16) + 4 }],
    ui: { clip: 'a-shelf', rate: 1, offset: OFFSET['a-shelf'] },
    whipIn: 4,
    cursor: true,
    bg: 'L18',
  },
  {
    // macro on the cover board turning open (same take)
    id: 'A10',
    from: b(19),
    to: b(21),
    scale: 'M',
    cam: [
      { cx: 560, cy: 640, w: 420 },
      { cx: 556, cy: 636, w: 404 },
    ],
    ui: { clip: 'a-shelf', rate: 1, offset: OFFSET['a-shelf'] },
    cursor: true,
    bg: 'L18',
  },
  {
    // breath: the reading room on L10 | L36, the next leaf dragged slowly across (1300 ms), it lands on L18
    id: 'A11',
    from: b(21),
    to: b(26),
    scale: 'Md',
    cam: [
      { cx: bookC.x, cy: bookC.y, w: 864 },
      { cx: bookC.x - 4, cy: bookC.y, w: 850 },
    ],
    push: 0.006,
    breath: { from: BEAT.breath, to: BEAT.breath + 39 },
    ui: { clip: 'a-breath', rate: 1, offset: OFFSET['a-breath'] },
    focus: 'book',
    cursor: true,
    bg: 'L10',
  },
  {
    // end card over the continuing take: the book eases into the box above the text (heavy spring)
    id: 'A12',
    from: b(26),
    to: FRAMES,
    scale: 'end',
    cam: [
      { cx: bookC.x - 4, cy: bookC.y, w: 850 },
      { cx: bookC.x - 4, cy: bookC.y, w: 846 },
    ],
    push: 0.005,
    ui: { clip: 'a-breath', rate: 1, offset: OFFSET['a-breath'] },
    endBook: BOOK,
    bg: 'L18',
  },
]

// ---------------------------------------------------------------- A2 cards (filled editor → strip)

const filled = CAPTURE['a-filled'].cards
/** The filled view's visible frames above the dock, each flying to its thumbnail (2-frame stagger). */
export const CARDS = filled.frames
  .filter((c) => c.p && c.box[1] + c.box[3] * 0.25 < STRIP.y)
  .map((c, k) => {
    const row = filled.rows.find((r) => r.p === c.p)
    return {
      photo: photoOfKit(c.p),
      from: c.box,
      to: row?.box ?? [PLANE.w + 40, STRIP.y, 160, STRIP.h],
      start: b(2) + 8 + 3 + 2 * k,
      spin: k % 2 ? -4 : 4,
    }
  })
/** The strip folds right → left over the last 6 frames of A2. */
export const FOLD = { from: b(4) - 6, frames: 6 }

// ---------------------------------------------------------------- photos shown (check 3: never above source px)

const bgOutW = (file) => {
  // the background photo at cover × 1.2 of 1080 × 1920
  const portrait = ['L4', 'L10', 'L24', 'L34', 'L40'].includes(file)
  return Math.ceil(portrait ? 1920 * 1.2 * 0.71 : 1920 * 1.2 * 1.5)
}
for (const s of shots) {
  const list = [{ file: `${s.bg}.jpg`, outW: bgOutW(s.bg) }]
  const sMax = Math.max(cameraAt(s, s.from).s, cameraAt(s, s.to - 1).s)
  if (s.land)
    list.push({
      file: `${s.land.photo}.jpg`,
      outW: Math.ceil(s.land.box[2] * 1.06 * sMax),
    })
  // the held L18 card of the drag (ReelA Ghost, at most 250 plane px wide)
  if (s.id === 'A4' || s.id === 'A5')
    list.push({ file: 'L18.jpg', outW: Math.ceil(250 * sMax) })
  if (s.through)
    list.push({
      file: `${s.through.photo}.jpg`,
      outW: Math.ceil(PLANE.h * 1.5 * sMax),
    })
  if (s.id === 'A2')
    for (const c of CARDS)
      list.push({
        file: `${c.photo}.jpg`,
        outW: Math.ceil(c.from[2] * 1.1 * sMax),
      })
  s.photos = list
}

// ---------------------------------------------------------------- cues (sound + the click / drop points of check 6)

const out = (frame, p) => {
  const s = shots.find((x) => frame >= x.from && frame < x.to)
  const c = cameraAt(s, frame)
  return { x: Math.round(p.x * c.s + c.tx), y: Math.round(p.y * c.s + c.ty) }
}
const ptr = (id, reelFrame) =>
  out(reelFrame, pointerAt(id, reelFrame + OFFSET[id]))

const cues = [
  cue(REEL, 0, 'rustle', { offset: BEAT.turn }),
  cue(REEL, 2, 'whoosh'),
  ...CARDS.map((c) => cue(REEL, 2, 'tick', { offset: c.start + 13 - b(2) })),
  cue(REEL, 4.5, 'click', ptr('a-drop', BEAT.choose)),
  cue(REEL, 5, 'riser'),
  cue(REEL, 6, 'click', ptr('a-drop', BEAT.pick)),
  cue(REEL, 8, 'snap', ptr('a-drop', BEAT.drop)),
  cue(REEL, 9, 'click', { offset: 6, ...ptr('a-fill', BEAT.chip) }),
  cue(REEL, 10, 'rustle'),
  cue(REEL, 10, 'shimmer'),
  cue(REEL, 12, 'whoosh'),
  ...Array.from({ length: 14 }, (_, k) =>
    cue(REEL, 13, 'key', { offset: 4 + 2 * k }),
  ),
  cue(REEL, 16, 'whoosh', { offset: -3 }),
  cue(REEL, 17, 'thud'),
  cue(REEL, 19, 'click', ptr('a-shelf', BEAT.open)),
  cue(REEL, 19, 'rustle', { offset: 4 }),
  cue(REEL, 21.5, 'rustle'),
]

export default {
  reel: REEL,
  frames: FRAMES,
  plane: PLANE,
  shots,
  cues,
}

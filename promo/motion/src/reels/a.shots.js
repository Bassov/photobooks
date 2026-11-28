// Reel A v2 «Одна поездка» shot table (Designer promo-reels-v2 spec §3–§4 item 3, on promo-reels-3 §3; contract in
// stub.shots.js). Cut to the track the gate picked (a.capture.js GRID = a.beats.json): every cut and cue sits on its
// beat grid (a.plan.js), the hero downbeat (b8) carries Fill book's Enter. Every UI shot plays its kit clip at rate 1
// with a constant offset (clip frame = reel frame + OFFSET); the offsets come from the captured pointer / key events,
// and this module throws when an event the plan relies on missed its beat, so a re-capture never drifts silently.
import { HEIGHT, WIDTH, gridCue } from './shared/beats.js'
import { cameraAt } from './shared/Springs.js'
import { CAPTURE, GRID } from './a.capture.js'
import { planA } from './a.plan.js'

const REEL = 'a'
export const BEAT = planA(GRID)
const FRAMES = BEAT.frames
/** Every reel A clip is filmed in a 1280 × 1440 CSS viewport (site and editor) at DPR 3. */
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
function offsetOf(id, clipFrame, reelFrame, what) {
  if (!Number.isInteger(clipFrame))
    throw new Error(`a.shots: ${id} has no ${what} event (re-capture)`)
  return clipFrame - reelFrame
}
function expect(id, got, want, what) {
  if (got !== want)
    throw new Error(
      `a.shots: ${id} ${what} at clip frame ${got}, the beat wants ${want} (re-run the walks)`,
    )
}

/** clip frame = reel frame + OFFSET[clip]. */
export const OFFSET = {
  // reel frame 0 shows the leaf `turnLead` frames after the click's up (G6: the reel opens mid-turn)
  'a-gl-turn': events('a-gl-turn', 'up')[0] + BEAT.turnLead,
  'a-drop': offsetOf('a-drop', events('a-drop', 'down')[0], BEAT.pick, 'pick'),
  'a-fill': offsetOf('a-fill', events('a-fill', 'key')[0], BEAT.enter, 'Enter'),
  'a-shelf': offsetOf(
    'a-shelf',
    events('a-shelf', 'down')[0],
    BEAT.open,
    'book click',
  ),
  'a-breath': offsetOf(
    'a-breath',
    events('a-breath', 'down')[0],
    BEAT.breath,
    'drag',
  ),
}
expect(
  'a-drop',
  events('a-drop', 'up')[0],
  BEAT.drop + OFFSET['a-drop'],
  'drop',
)
expect(
  'a-drop',
  events('a-drop', 'down')[1],
  BEAT.chip + OFFSET['a-drop'],
  'chip',
)
expect(
  'a-fill',
  events('a-fill', 'down')[0],
  BEAT.chip + OFFSET['a-fill'],
  'chip',
)
// every clip frame a UI shot shows exists (a clamp would freeze the take)
const covers = (id, from, to) => {
  const a = from + OFFSET[id]
  const b = to - 1 + OFFSET[id]
  if (a < 0 || b >= CAPTURE[id].frames)
    throw new Error(
      `a.shots: ${id} holds clip frames 0–${CAPTURE[id].frames - 1}, reel ${from}–${to - 1} needs ${a}–${b}`,
    )
}

// Frames may be fractional (the motion blur samples between frames): boxes take the nearest clip frame, the pointer
// interpolates.
const nearest = (list, f) =>
  list[Math.max(0, Math.min(list.length - 1, Math.round(f)))]
/** A box [x, y, w, h] (CSS px) of `name` in clip `id` at clip frame `f` (`k`-th match for `all` targets). */
export function rectAt(id, name, f, k = 0) {
  const r = nearest(CAPTURE[id].rects[name], f)
  return Array.isArray(r?.[0]) ? r[k] : r
}
/** Every box of an `all` target in clip `id` at clip frame `f`. */
export function rectsAt(id, name, f) {
  const r = nearest(CAPTURE[id].rects[name], f)
  return Array.isArray(r?.[0]) ? r : r ? [r] : []
}
export const pointerAt = (id, f) => {
  const p = CAPTURE[id].pointer
  const c = Math.max(0, Math.min(p.length - 1, f))
  const [x0, y0] = p[Math.floor(c)]
  const [x1, y1] = p[Math.ceil(c)]
  const t = c - Math.floor(c)
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t }
}
const centre = ([x, y, w, h]) => ({ x: x + w / 2, y: y + h / 2 })

// ---------------------------------------------------------------- geometry the shots share (CSS px of the clips)

/** The open GL book in the reading room (reader views, books=1): the page block, inside the boards' teal edge. */
export const BOOK = { x: 64, y: 369, w: 1152, h: 690 }
/**
 * A10: the end card's cut of the open book, just inside the page block (the reader draws the book in perspective,
 * so its outer edges slant and the gutter's board notch shows at the top). Off-centre from the gutter by 5 px, so
 * check 10's centre column runs down the right page, not the gutter's shading.
 */
export const END_CUT = { x: 120, y: 392, w: 1050, h: 656 }
/** A3–A5: spread 1's full-bleed frame, the drop target (a-drop). */
export const DROP_BOX = rectAt('a-drop', 'frame', BEAT.drop + OFFSET['a-drop'])
/** The dock's thumbnails (a-drop frame 0; every editor clip shares the dock). */
export const ROWS = rectsAt('a-drop', 'row', 0)
/** A6: the face-out Lake trip book (its cover is the L18 photo). */
export const FACE = rectAt('a-shelf', 'face', BEAT.open + OFFSET['a-shelf'])

/**
 * Photos the GL reader shows (CSS px, measured on the captured frames; the reader draws them in WebGL, so no DOM
 * box exists). `from` = first clip frame the photo is uncovered (the turning leaf hides it before).
 */
export const READER_PHOTOS = {
  // Pages 14–15 after A1's turn: the right page's 2 × 2 grid (the right column shows from the first frame)
  'a-gl-turn': [
    { box: [940, 423, 200, 265], from: 0 },
    { box: [947, 716, 206, 279], from: 0 },
    { box: [914, 423, 226, 265], from: 21 },
    { box: [922, 716, 231, 279], from: 21 },
    { box: [680, 423, 218, 272], from: 21 },
    { box: [681, 716, 223, 283], from: 21 },
  ],
}
{
  // a-breath, relative to the drag's down (D), read off the captured frames: Page 5's photo rides the lifting leaf
  // (foreshortened towards the gutter until the leaf stands at D+20), Page 6 (L18, full bleed) on the leaf's back
  // opens out from the gutter until it lands (D+40); Page 4 shows until the leaf covers it, Page 7 as it is uncovered
  const D = events('a-breath', 'down')[0]
  READER_PHOTOS['a-breath'] = [
    { box: [688, 436, 448, 544], from: 0, to: D },
    { box: [688, 436, 448, 544], from: D, to: D + 20, fold: 'close' },
    { box: [138, 436, 452, 548], from: 0, to: D + 40 },
    { box: [79, 371, 560, 684], from: D + 20, to: D + 40, fold: 'open' },
    { box: [742, 420, 398, 279], from: D + 20, to: D + 30 },
    { box: [742, 707, 411, 290], from: D + 20, to: D + 30 },
    { box: [686, 420, 454, 279], from: D + 30 },
    { box: [688, 707, 465, 290], from: D + 30 },
    { box: [79, 371, 560, 684], from: D + 40 },
  ]
}
/** The reader's gutter (CSS px): a turning leaf's photo is foreshortened towards it. */
const GUTTER_X = 640
/** Reader photo boxes (CSS px) clip `id` shows at clip frame `f`. */
export const readerPhotosAt = (id, f) =>
  (READER_PHOTOS[id] ?? [])
    .filter((p) => f >= p.from && (p.to == null || f < p.to))
    .map(({ box: [x, y, w, h], fold, from, to }) => {
      if (!fold) return [x, y, w, h]
      const t = (f - from) / (to - from)
      const u = fold === 'close' ? 1 - t : t
      const a = GUTTER_X + (x - GUTTER_X) * u
      const b = GUTTER_X + (x + w - GUTTER_X) * u
      return [Math.min(a, b), y, Math.abs(b - a), h]
    })

// ---------------------------------------------------------------- shots

const C = BEAT.cuts // [b0, b2, b4, b6, b8, b10, b12, b14, b16, b20]
const ui = (clip, from) => ({ clip, rate: 1, start: from + OFFSET[clip] })
const at = (p, w, dy = 0) => ({ cx: p.x, cy: p.y + dy, w })

const pick = pointerAt('a-drop', BEAT.pick + OFFSET['a-drop'])
const dropC = centre(DROP_BOX)
const faceC = centre(FACE)
const bookC = { x: BOOK.x + BOOK.w / 2, y: BOOK.y + BOOK.h / 2 }
/** A crop `w` wide that puts plane point `p` at output height `y` (frame centre column). */
const placeAt = (p, w, y) => ({ cx: p.x, cy: p.y + ((960 - y) * w) / 1080, w })
/** The reader's two pages (CSS px): A9 follows the leaf from the right page's centre to the left one's. */
const PAGE_R = { x: 928, y: bookC.y }
const PAGE_L = { x: 359, y: bookC.y }

const shots = [
  {
    // macro on the right page as the lifted leaf of Pages 12–13 falls away to the left: the 2 × 2 grid of Pages
    // 14–15 is uncovered; the crop drifts left with the leaf
    id: 'A1',
    from: C[0],
    to: C[1],
    scale: 'M',
    cam: [
      { cx: 975, cy: 711, w: 370 },
      { cx: 945, cy: 716, w: 384 },
    ],
    push: 0.004,
    // the drift goes the crop's way (the default −8 px/s cancels the eased pan at its end: frozen frames, check 4)
    drift: { x: 8, y: 0 },
    ui: { clip: 'a-gl-turn', rate: 1, start: OFFSET['a-gl-turn'] },
    cursor: true,
    bg: 'L38',
  },
  {
    // the rewind: the filled book (a-filled, the state A3–A5 build) holds half a bar, then from b3 its photos lift
    // off and fly back into the strip; the crop pushes in a little
    id: 'A2',
    from: C[1],
    to: C[2],
    scale: 'Md',
    cam: [
      { cx: 640, cy: 760, w: 760 },
      { cx: 640, cy: 789, w: 730 },
    ],
    ui: { clip: 'a-filled', rate: 1, start: 0 },
    still: { clip: 'a-filled', frame: 0 },
    bg: 'L18',
  },
  {
    // the empty book: thumb 1 (L18) picked on the cut (b4), the held photo rides the pointer to spread 1's frame and
    // lands on b5 (light spring); the camera travels with it from the strip
    id: 'A3',
    from: C[2],
    to: C[3],
    scale: 'M',
    // the travel ends 2 frames before the drop (Designer review 1, finding 4): the drop box sits centred at
    // y 712 (≤ 120 px above the 800 the review asks: the crop's top stays under the frame's rotate knob, which sits on
    // the layout pill's text) when the photo lands, then the punch and a push. The start crop sits on the plane's
    // bottom edge at w 376: the pick (on the thumb's upper edge, walks-a.mjs) then clears the bottom safe zone
    cam: [
      {
        cx: Math.max(pick.x + 150, 190),
        cy: PLANE.h - (376 * 8) / 9 - 0.5,
        w: 376,
      },
      { ...placeAt(dropC, 396, 712), at: BEAT.drop - 2 },
      placeAt(dropC, 384, 718),
    ],
    punches: [{ frame: BEAT.drop, amount: 0.015 }],
    ui: ui('a-drop', C[2]),
    focus: 'drag',
    cursor: true,
    land: { photo: 'L18', at: BEAT.drop, box: DROP_BOX },
    // the ground shows under the dock on the pick: a light ground (L18's dark water reads as a black band)
    bg: 'L10',
  },
  {
    // down to the strip: L18's lower half with its pan handle, the strip and the Fill book chip, clicked on b7.
    // The chip sits 177 px above the plane's bottom edge, so its click clears the bottom safe zone (y ≤ 1520) only
    // at w ≤ 478 with the crop inside the plane (Designer review 1, finding 3); framed so from the cut, since a
    // travel from the photo would be a blurred whip over the handle (check 10)
    id: 'A4',
    from: C[3],
    to: C[4],
    scale: 'Md',
    cam: [
      // w 464–468 on the plane's bottom edge: the chip click at y ≤ 1514 and the pan handle ≥ 24 px below the top
      { cx: 726, cy: 1023, w: 468 },
      { cx: 720, cy: 1025, w: 464 },
    ],
    push: 0.004,
    ui: ui('a-drop', C[3]),
    cursor: true,
    bg: 'L10',
  },
  {
    // W on the hero downbeat (b8): Enter, every spread fills
    id: 'A5',
    from: C[4],
    to: C[5],
    scale: 'W',
    // inside the plane and under the editor top bar (Designer review 1: w 700, cy 670–818, spreads ≈ 625 px)
    cam: [
      { cx: 640, cy: 745, w: 700 },
      { cx: 640, cy: 742, w: 676 },
    ],
    ui: ui('a-fill', C[4]),
    cursor: true,
    bg: 'L18',
  },
  {
    // the shelf: the face-out Lake trip book (L18 on the cover) settles; the pointer comes back and clicks it on b12
    id: 'A6',
    from: C[5],
    to: C[6],
    scale: 'M',
    cam: [at(faceC, 400, 10), at(faceC, 384)],
    ui: ui('a-shelf', C[5]),
    focus: 'face',
    cursor: true,
    bg: 'L18',
  },
  {
    // cut on the click into the reading room: Pages 4–5, the lake page; the crop eases right towards the gutter
    id: 'A7',
    from: C[6],
    to: C[7],
    scale: 'Md',
    cam: [
      { cx: 364, cy: 712, w: 520 },
      { cx: 392, cy: 712, w: 504 },
    ],
    ui: ui('a-breath', C[6]),
    bg: 'L10',
  },
  {
    // macro: the hand drifts onto the right page's outer edge, the corner lifts
    id: 'A8',
    from: C[7],
    to: C[8],
    scale: 'M',
    cam: [
      { cx: 975, cy: 745, w: 420 },
      { cx: 1000, cy: 748, w: 400 },
    ],
    ui: ui('a-breath', C[7]),
    cursor: true,
    bg: 'L10',
  },
  {
    // the breath, one page (G3): the next leaf dragged slowly across (1300 ms) under a music dip; the crop (page
    // ≈ 943 px wide, the pager below the crop) follows the leaf from the right page to the left one until it lands
    // on L18 (Page 6), then pushes in on that page to the end card
    id: 'A9',
    from: C[8],
    to: C[9],
    scale: 'Md',
    cam: [
      at(PAGE_R, 660),
      { ...at(PAGE_L, 648), at: BEAT.breath + 40 },
      at(PAGE_L, 566),
    ],
    push: 0.012,
    breath: { from: BEAT.breath, to: BEAT.breath + 39 },
    ui: ui('a-breath', C[8]),
    cursor: true,
    bg: 'L10',
  },
  {
    // end card: the open book (the take's last frame) eases into the box above the text (heavy spring)
    id: 'A10',
    from: C[9],
    to: FRAMES,
    scale: 'end',
    cam: [at(bookC, 836), at(bookC, 832)],
    push: 0.005,
    still: { clip: 'a-breath', frame: C[9] - 1 + OFFSET['a-breath'] },
    endBook: END_CUT,
    bg: 'L18',
  },
]
for (const s of shots.filter((x) => x.ui && !x.still))
  covers(s.ui.clip, s.from, s.to)

/** The editor's top bar (CSS px of the editor clips): Designer G3 keeps it out of frame. */
export const EDITOR_BAR = 48
const EDITOR_CLIPS = new Set(['a-filled', 'a-drop', 'a-fill'])
/** The plane box (CSS px) the crop of `shot` shows at `frame`. */
export const cropAt = (shot, frame) => {
  const c = cameraAt(shot, frame)
  return [-c.tx / c.s, -c.ty / c.s, (WIDTH - c.tx) / c.s, (HEIGHT - c.ty) / c.s]
}
// Designer G3 (review 1): a clip shot's crop never leaves the 1280 × 1440 plane (no hard edge of the take over the
// ground); editor shots also keep the top bar out. Every frame, with drift, push and punches.
for (const s of shots.filter((x) => x.ui && !x.endBook)) {
  const top = EDITOR_CLIPS.has(s.ui.clip) ? EDITOR_BAR : 0
  for (let f = s.from; f < s.to; f++) {
    const [x0, y0, x1, y1] = cropAt(s, f)
    if (
      x0 < -1e-6 ||
      y0 < top - 1e-6 ||
      x1 > PLANE.w + 1e-6 ||
      y1 > PLANE.h + 1e-6
    )
      throw new Error(
        `a.shots: ${s.id} frame ${f} crop ${[x0, y0, x1, y1].map(Math.round).join(',')} leaves the plane (top ${top})`,
      )
  }
}

// ---------------------------------------------------------------- A2 cards (filled editor → strip)

const filled = CAPTURE['a-filled'].cards
const DOCK_Y = ROWS[0][1]
/** The filled view's photo frames wholly above the dock, each flying to its thumbnail (3-frame stagger from b3). */
export const CARDS = filled.frames
  .filter((c) => c.p && c.box[1] + c.box[3] <= DOCK_Y)
  .map((c, k) => {
    const row = filled.rows.find((r) => r.p === c.p)
    return {
      photo: photoOfKit(c.p),
      from: c.box,
      to: row?.box ?? [PLANE.w + 40, DOCK_Y, 160, ROWS[0][3]],
      start: BEAT.cardsFrom + 3 * k,
      spin: k % 2 ? -4 : 4,
    }
  })
/** The filled frames that stay put (partly under the dock), cut at the dock (photo boxes). */
export const FILLED_STAY = filled.frames
  .filter((c) => c.p && c.box[1] + c.box[3] > DOCK_Y && c.box[1] < DOCK_Y)
  .map(({ box: [x, y, w] }) => [x, y, w, DOCK_Y - y])
/** The filled strip's thumbnails in view (photos under the cards). */
export const FILLED_ROWS = filled.rows
  .filter((r) => r.box[0] < PLANE.w)
  .map((r) => r.box)

// ---------------------------------------------------------------- photos shown (check 3: never above source px)

const bgOutW = (file) => {
  // the background photo at cover × 1.2 of 1080 × 1920
  const portrait = ['L4', 'L10', 'L24', 'L34', 'L40'].includes(file)
  return Math.ceil(portrait ? 1920 * 1.2 * 0.71 : 1920 * 1.2 * 1.5)
}
/** The held photo while it rides the pointer (spec v2 G5 DRAG: 62 % of the target frame's width, plane px). */
export const GHOST_W = 0.62 * DROP_BOX[2]
/**
 * Where the hand holds the photo (plane px from its centre, at GHOST_W): the walk releases off the frame's centre
 * (the pan handle's spot), so the held photo hangs this far up-left of the pointer and lands concentric with the frame.
 */
const release = pointerAt('a-drop', BEAT.drop + OFFSET['a-drop'])
export const GRIP = { x: release.x - dropC.x, y: release.y - dropC.y }
for (const s of shots) {
  const list = [{ file: `${s.bg}.jpg`, outW: bgOutW(s.bg) }]
  const sMax = Math.max(cameraAt(s, s.from).s, cameraAt(s, s.to - 1).s)
  if (s.land)
    list.push(
      {
        file: `${s.land.photo}.jpg`,
        outW: Math.ceil(s.land.box[2] * 1.06 * sMax),
      },
      { file: 'L18.jpg', outW: Math.ceil(GHOST_W * 1.03 * sMax) },
    )
  if (s.id === 'A2')
    for (const c of CARDS)
      list.push({
        file: `${c.photo}.jpg`,
        outW: Math.ceil(c.from[2] * 1.1 * sMax),
      })
  s.photos = list
}

// ---------------------------------------------------------------- cues (sound + the click / drop points of check 6)

/** Output px of clip `id`'s pointer at reel `frame`, through shot `shot`'s camera. */
const ptr = (
  id,
  frame,
  shot = shots.find((x) => frame >= x.from && frame < x.to),
) => {
  const p = pointerAt(id, frame + OFFSET[id])
  const c = cameraAt(shot, frame)
  return { x: Math.round(p.x * c.s + c.tx), y: Math.round(p.y * c.s + c.ty) }
}
const shot = (id) => shots.find((s) => s.id === id)

const cues = [
  // 2 frames in: the sample's attack needs a pre-roll the reel's first frame cannot give (12f)
  gridCue(GRID, 0, 'page', { offset: 2 }),
  gridCue(GRID, 3, 'flutter'),
  gridCue(GRID, 4, 'pick', ptr('a-drop', BEAT.pick)),
  gridCue(GRID, 5, 'drop', ptr('a-drop', BEAT.drop)),
  gridCue(GRID, 7, 'click', ptr('a-drop', BEAT.chip)),
  gridCue(GRID, 8, 'key'),
  gridCue(GRID, 8, 'fill', { offset: 3 }),
  gridCue(GRID, 10, 'wood'),
  // the shelf click is the cut into the room: its point is where A6's camera leaves it
  gridCue(GRID, 12, 'click', ptr('a-shelf', BEAT.open, shot('A6'))),
  gridCue(GRID, 12, 'cover', { offset: 3 }),
  gridCue(GRID, 16, 'pageSlow'),
  gridCue(GRID, 16, 'breath', { frames: BEAT.end - BEAT.breath }),
  gridCue(GRID, 20, 'impact'),
]

export default {
  reel: REEL,
  frames: FRAMES,
  plane: PLANE,
  poster: FRAMES - 5,
  grid: GRID,
  shots,
  cues,
}

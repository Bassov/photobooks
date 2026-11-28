// Reel A v2 «Одна поездка» capture walks (Designer promo-reels-v2 spec §4 item 3, on promo-reels-3 §3): the real kit
// filmed in real time on capture.mjs's frame-stepped clock. Every action is timed in whole frames so it lands on the
// reel frame the beat plan (promo/motion/src/reels/a.plan.js) gives it on the track's own grid
// (promo/out/reels/sound/a.beats.json), once a.shots.js maps the clip with a constant offset at rate 1: `at(P, n)`
// waits until the clip holds `n` frames, glides are counted with capture's own `glidePath`.
//
//   node promo/reels/capture.mjs --clip a-gl-turn,a-filled,a-drop,a-fill,a-shelf,a-breath
//   node promo/reels/walks-a.mjs --bridge     clips → promo/out/reels/clips/a/<clip>.mp4 + <clip>.rects.json (busy +
//                                            geometry log) and the generated data module promo/motion/src/reels/
//                                            a.capture.js (with the beat grid the walks were timed to)
//
// The bridge exists because capture.mjs writes JPEG frames + dom.json per clip directory, while reels-render.mjs stages
// `clips/<reel>/*.{mp4,webm}` and reads `clips/<reel>/<clip>.rects.json` (`frames[].busy`, check 5; `geom:*`, check 10).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { planA } from '../motion/src/reels/a.plan.js'

// capture.mjs imports this module for its CLIPS table, so its walk helpers (editorBook, zoomSpread, glidePath, MD, W)
// load lazily, before each walk's setup: a static import would be a cycle that breaks `--bridge`.
let K = null
const capture = async () => (K ??= await import('./capture.mjs'))

const HERE = path.dirname(new URL(import.meta.url).pathname)
const REPO = path.resolve(HERE, '..', '..')
const CLIPS_OUT = path.join(REPO, 'promo', 'out', 'reels', 'clips')
const BEATS = path.join(REPO, 'promo', 'out', 'reels', 'sound', 'a.beats.json')
const DT = 1000 / 30

// Selectors (strings only: capture.mjs's own consts are not initialised yet while this module evaluates).
const SPREAD = '[data-testid="canvas"] [data-current]'
const FRAME = `${SPREAD} [data-testid="frame"]`
const ALL_FRAMES = '[data-testid="canvas"] [data-testid="frame"]'
const ROW = '[data-testid="filmstrip"] [role="row"]'
const CHIP = '[data-testid="demo"] [data-testid="film-fill-book"]'
const PAN = '[data-testid="crop-grabber"]'
/** a-drop's pick point below the thumb's top edge (CSS px). */
const PICK_DY = 10
/** a-drop's release point from spread 1's frame centre (CSS px). */
const DROP_OFF = { x: 110, y: 80 }
const COVER = '[data-testid="cover-front"]'
const FACE = '[data-testid="ss9-book"][data-kind="face"]'
const READER = '[data-testid="ps-reader"]'
const SITE = (q) => `/index.html?theme=procreate-light#/full/personal-site?${q}`

/** The beat plan on the track the gate picked for reel A (read when a walk runs, so `--list` needs no sound). */
let PLAN_A = null
function plan() {
  if (PLAN_A) return PLAN_A
  if (!fs.existsSync(BEATS))
    throw new Error(
      `no ${path.relative(REPO, BEATS)}: run node promo/reels/sound.mjs (track gate) first`,
    )
  PLAN_A = planA(JSON.parse(fs.readFileSync(BEATS, 'utf8')))
  return PLAN_A
}

/** Reel frame each clip's frame 0 maps to (clip frame = reel frame − START). */
const START = {
  // A2's base (empty spreads, full strip) from b2; A3 picks on b4, drops on b5; A4 clicks the chip on b7
  'a-drop': () => plan().cuts[1],
  // A6 opens 8 frames after the pointer started leaving the lifted book
  'a-shelf': () => plan().leave - 2,
  // A7 (the room, cut on the shelf click, b12), A8 from b14 (the hand reaches), A9's drag on b16
  'a-breath': () => plan().cuts[6] - 4,
}

// ---------------------------------------------------------------- frame-exact helpers

/** Frames the clip holds so far (capture counts one per `wait` frame and one per glide point). */
const clock = new WeakMap()
const now = (P) => clock.get(P) ?? 0
const tick = (P, n) => clock.set(P, now(P) + n)
const begin = (P) => clock.set(P, 0)

async function waitF(P, n) {
  if (n <= 0) return
  await P.wait(n * DT)
  tick(P, n)
}
/** Wait until the clip holds `n` frames; throws when the walk is already past it (the beat would slip). */
async function at(P, n, what) {
  if (now(P) > n)
    throw new Error(`${what}: clip already at frame ${now(P)}, wanted ${n}`)
  await waitF(P, n - now(P))
}
const glideLen = (P, to, ms, bow) =>
  K.glidePath({ x: P.ptr.x, y: P.ptr.y }, to, ms, bow).length
async function glide(P, to, ms, bow) {
  const n = glideLen(P, to, ms, bow)
  await P.glide(to.x, to.y, ms, bow)
  tick(P, n)
}
/** Glide so that the pointer settles on `to` and goes down exactly at frame `f` (click down 70 ms → 2 frames). */
async function clickAt(P, to, f, what, ms) {
  const n = glideLen(P, to, ms)
  await at(P, f - n - 3, `${what} glide`)
  await glide(P, to, ms)
  await waitF(P, 3)
  await P.down()
  await waitF(P, 2)
  await P.up()
}

/** Off camera, real time: a drag the kit's DnD sees (many small moves). */
async function setupDrag(P, from, to) {
  const a = await P.center(from)
  const b = await P.center(to)
  await P.moveTo(a.x, a.y)
  await P.down()
  for (let i = 1; i <= 16; i++) {
    const t = i / 16
    await P.moveTo(a.x + (b.x - a.x) * t + 2, a.y + (b.y - a.y) * t - 2)
    await P.page.waitForTimeout(24)
  }
  await P.moveTo(b.x, b.y)
  await P.page.waitForTimeout(120)
  await P.up()
  await P.settle(500)
}

async function addFolder(P) {
  await P.page.locator('[data-testid="demo-add-folder"]').first().click()
  await P.settle(600)
  await K.chooseButton(P.page).click()
  await P.settle(900)
}

/**
 * Off camera: scroll the canvas (its scrolling ancestor) until spread 1's full-bleed frame (the widest frame, L18)
 * has its top at `y`. Returns that frame's top. (Scrolling moves the editor's current spread, so the frame is
 * found by size, not by `[data-current]`.)
 */
async function panSpreadTo(P, y) {
  const widest = () =>
    P.page.evaluate((sel) => {
      const all = [...document.querySelectorAll(sel)]
      const el = all.sort(
        (a, b) =>
          b.getBoundingClientRect().width - a.getBoundingClientRect().width,
      )[0]
      return el ? el.getBoundingClientRect().y : null
    }, ALL_FRAMES)
  for (let round = 0; round < 4; round++) {
    const top = await widest()
    const dy = top - y
    if (Math.abs(dy) < 0.5) return top
    const how = await P.page.evaluate(
      ([sel, by]) => {
        let el = document.querySelector(sel)
        while (el && el !== document.body) {
          const st = getComputedStyle(el)
          if (
            /(auto|scroll)/.test(st.overflowY) &&
            el.scrollHeight > el.clientHeight + 1
          ) {
            el.scrollTop += by
            return el.getAttribute('data-testid') ?? el.className
          }
          el = el.parentElement
        }
        return null
      },
      [SPREAD, dy],
    )
    if (!how) throw new Error('a-filled: no scrolling ancestor of the spread')
    await P.settle(500)
  }
  return widest()
}

async function openReader(P, view) {
  await P.page.goto(`${P.base}${SITE('books=1&book=lake-trip')}`)
  await P.page.waitForSelector(READER)
  await P.settle(1500)
  // the deep link rests on the cover; the turns to `view` happen off camera, one leaf at a time
  for (let v = 0; v < view; v++) {
    await P.page.keyboard.press('ArrowRight')
    await P.settle(1300)
  }
  const label = await P.page
    .locator('[data-testid="ps-reader-live"]')
    .first()
    .textContent()
  return label?.trim()
}

/** Writes `<clip>.<name>.json` next to the clip's own logs (extra data ReelA needs). */
function extra(id, name, data) {
  fs.writeFileSync(
    path.join(CLIPS_OUT, id, `${id}.${name}.json`),
    JSON.stringify(data) + '\n',
  )
}

/** Which kit photo (pNN) each visible canvas frame and filmstrip row shows, with its box (CSS px). */
function photoBoxes(P) {
  return P.page.evaluate(
    ([frameSel, rowSel, spreadSel]) => {
      const photo = (el) => {
        const img = el.querySelector('img')
        const s =
          img?.currentSrc ||
          img?.src ||
          getComputedStyle(el).backgroundImage ||
          ''
        const m = /p(\d\d)\.jpg/.exec(s)
        return m ? +m[1] : null
      }
      const box = (el) => {
        const r = el.getBoundingClientRect()
        return [r.x, r.y, r.width, r.height].map((v) => +v.toFixed(2))
      }
      const vis = (el) => {
        const r = el.getBoundingClientRect()
        return r.bottom > 0 && r.top < innerHeight && r.width > 0
      }
      const all = (sel) =>
        [...document.querySelectorAll(sel)]
          .filter(vis)
          .map((el) => ({ box: box(el), p: photo(el) }))
      return {
        frames: all(frameSel),
        rows: all(rowSel),
        current: box(document.querySelector(spreadSel)),
      }
    },
    [ALL_FRAMES, ROW, SPREAD],
  )
}

// ---------------------------------------------------------------- walks

export const WALKS_A = {
  'a-gl-turn': {
    reel: 'a',
    viewport: 'site',
    about:
      'A1: GL reader (books=1, Lake trip) on Pages 12–13, a click on the right half turns the leaf; the reel starts on the lifted leaf',
    targets: [
      { name: 'reader', sel: READER },
      { name: 'canvas', sel: '[data-testid="ps-reader-canvas"]' },
    ],
    async setup(P) {
      const label = await openReader(P, 7)
      if (!/Pages 12/.test(label ?? ''))
        throw new Error(`reader shows "${label}", wanted Pages 12–13`)
      const c = await P.center(P.page.locator(READER).first())
      // hover near the right page's lower outer corner: the kit lifts the corner
      await P.moveTo(c.x + 470, c.y + 230)
      await P.settle(600)
    },
    async act(P) {
      begin(P)
      await at(P, 6, 'turn click')
      await P.down()
      await waitF(P, 2)
      await P.up()
      // the reel shows clip frames up + lead … up + lead + A1's length
      const { cuts, turnLead } = plan()
      await waitF(P, turnLead + cuts[1] + 4)
    },
  },
  'a-filled': {
    reel: 'a',
    viewport: 'editor',
    about:
      'A2 cards: the Md editor after Fill book (frame boxes + photos), filmed still for its rects',
    targets: [
      { name: 'spread', sel: SPREAD },
      { name: 'frame', sel: FRAME, all: true },
      { name: 'row', sel: ROW, all: true },
    ],
    async setup(P) {
      await K.editorBook(P, 'a')
      await K.zoomSpread(P, K.MD)
      await addFolder(P)
      // the book A3 + A5 make: L18 dropped on spread 1, then Fill book (A2 rewinds this state into the strip)
      const y0 = (await P.page.locator(SPREAD).first().boundingBox()).y
      await setupDrag(
        P,
        P.page.locator(ROW).first(),
        P.page.locator(FRAME).first(),
      )
      await P.page.locator(CHIP).first().click()
      await P.settle(500)
      await P.page.keyboard.press('Enter')
      await P.settle(1200)
      // Fill selects the first page, which scrolls the canvas: pan back so spread 1 sits where a-drop has it
      const y1 = await panSpreadTo(P, y0)
      if (Math.abs(y1 - y0) > 1)
        throw new Error(`a-filled: spread 1 at y ${y1}, a-drop has it at ${y0}`)
      await P.moveTo(P.rest.x, P.rest.y)
      await P.settle(400)
    },
    async act(P) {
      begin(P)
      await waitF(P, 6)
    },
    async check(P) {
      const data = await photoBoxes(P)
      if (!data.frames.some((f) => f.p))
        throw new Error('a-filled: no photo found in the canvas frames')
      extra('a-filled', 'cards', data)
    },
  },
  'a-drop': {
    reel: 'a',
    viewport: 'editor',
    about:
      'A2 base + A3 + A4: Md editor, folder added (full strip, empty spreads); L18 picked on b4, dropped on spread 1 on b5; the Fill book chip on b7',
    targets: [
      { name: 'spread', sel: SPREAD },
      { name: 'frame', sel: FRAME, all: true },
      { name: 'row', sel: ROW, all: true },
      { name: 'chip', sel: CHIP },
      // the dropped photo's round pan handle (A3 end, A4): capture.mjs's shared GEOM_TARGETS do not name it, so
      // ReelA tags it `data-geom="handle"` on every frame it shows and check 10 measures it there
      { name: 'pan', sel: PAN, all: true },
    ],
    async setup(P) {
      await K.editorBook(P, 'a')
      await K.zoomSpread(P, K.MD)
      await addFolder(P)
      await P.moveTo(P.rest.x, P.rest.y)
      await P.settle(400)
    },
    async act(P) {
      begin(P)
      const { pick, drop, chip } = plan()
      const s = START['a-drop']()
      // the hand comes in from the right and goes down on thumb 1 exactly on the pick
      // on the thumb's upper edge (row top + 10 px): the strip sits 153 px above the plane's bottom, and A3's crop
      // stays inside the plane, so only a point this high clears the bottom safe zone at a crop scale ≤ 3
      const row = await P.page.locator(ROW).first().boundingBox()
      const a = { x: row.x + row.width / 2, y: row.y + PICK_DY }
      await clickDown(P, a, pick - s, 'pick', 520)
      // the drag arrives (glide + its spring settle) and goes up exactly on the drop, one beat after the pick
      // released off the frame's centre: the kit puts the photo's pan handle there, and a pointer resting on it
      // would hide the handle check 10 measures
      const c = await P.center(P.page.locator(FRAME).first())
      const t = { x: c.x + DROP_OFF.x, y: c.y + DROP_OFF.y }
      const gap = drop - pick
      let ms = 760
      while (ms > 300 && 2 + glideLen(P, t, ms) + 1 > gap) ms -= 20
      await waitF(P, 2)
      await glide(P, t, ms)
      await at(P, drop - s, 'drop')
      await P.up()
      await waitF(P, 4)
      // then the Fill book chip, down on b7
      await clickAt(
        P,
        await P.center(P.page.locator(CHIP).first()),
        chip - s,
        'chip',
      )
      await at(P, plan().enter - s + 3, 'A4 end')
    },
  },
  'a-fill': {
    reel: 'a',
    viewport: 'editor',
    about:
      'A5: W zoom on the cover and the first spreads (L18 on spread 1, as A3 left it), chip click, Enter on the hero downbeat: every spread fills',
    targets: [
      { name: 'spread', sel: SPREAD },
      { name: 'frame', sel: ALL_FRAMES, all: true },
      { name: 'chip', sel: CHIP },
    ],
    async setup(P) {
      await K.editorBook(P, 'a')
      await addFolder(P)
      await setupDrag(
        P,
        P.page.locator(ROW).first(),
        P.page.locator(FRAME).first(),
      )
      await K.zoomSpread(P, K.W)
      const c = await P.center(P.page.locator(CHIP).first())
      await P.moveTo(c.x + 260, c.y - 300)
      await P.settle(400)
    },
    async act(P) {
      begin(P)
      const { chip, enter, cuts } = plan()
      const chipDown = 30
      await clickAt(
        P,
        await P.center(P.page.locator(CHIP).first()),
        chipDown,
        'chip',
      )
      await at(P, chipDown + enter - chip, 'Enter')
      await P.key('Enter')
      await waitF(P, cuts[5] - enter + 4)
    },
  },
  'a-shelf': {
    reel: 'a',
    viewport: 'site',
    about:
      'A6: site books=6, the pointer leaves the lifted Lake trip book, it settles; the pointer comes back and clicks it on b12 (the reel cuts into the reading room on the click)',
    targets: [
      { name: 'face', sel: FACE },
      { name: 'reader', sel: READER },
    ],
    async setup(P) {
      await P.page.goto(`${P.base}${SITE('books=6')}`)
      await P.page.waitForSelector(FACE)
      await P.settle(1500)
      const b = await P.center(P.page.locator(FACE).first())
      await P.moveTo(b.x, b.y)
      await P.settle(800)
    },
    async act(P) {
      begin(P)
      const { leave, open, cuts } = plan()
      const s = START['a-shelf']()
      const b = await P.center(P.page.locator(FACE).first())
      await at(P, leave - s, 'leave')
      await glide(P, { x: b.x + 300, y: b.y + 170 })
      await clickAt(P, b, open - s, 'book click')
      await at(P, cuts[7] - s + 4, 'A7 end')
    },
  },
  'a-breath': {
    reel: 'a',
    viewport: 'site',
    about:
      'A7 + A8 + A9 + end: the reading room on Pages 4–5 from 4 frames before b12, the hand reaches the right page, the next leaf dragged slowly across in 1300 ms from b16',
    targets: [
      { name: 'reader', sel: READER },
      { name: 'canvas', sel: '[data-testid="ps-reader-canvas"]' },
    ],
    async setup(P) {
      const label = await openReader(P, 3)
      if (!/Pages 4/.test(label ?? ''))
        throw new Error(`reader shows "${label}", wanted Pages 4–5`)
      const c = await P.center(P.page.locator(READER).first())
      await P.moveTo(c.x + 640, c.y + 300)
      await P.settle(600)
    },
    async act(P) {
      begin(P)
      const { breath, breathMs, end, cuts } = plan()
      const s = START['a-breath']()
      const c = await P.center(P.page.locator(READER).first())
      // A7 holds the room; on A8 the hand drifts onto the right page's outer edge and waits there (the corner
      // lifts), then the slow drag
      await at(P, cuts[7] - s + 2, 'reach')
      await glide(P, { x: c.x + 500, y: c.y + 40 }, 800)
      await at(P, breath - s, 'breath down')
      await P.down()
      // flat bow: a straight, slow hand across the spread
      await glide(P, { x: c.x - 470, y: c.y + 10 }, breathMs, 0.01)
      await P.up()
      await at(P, end - s + 12, 'breath end')
    },
  },
}

/** Glide onto `to` and go down exactly at frame `f` (held: a drag follows). */
async function clickDown(P, to, f, what, ms) {
  const n = glideLen(P, to, ms)
  await at(P, f - n - 3, `${what} glide`)
  await glide(P, to, ms)
  await waitF(P, 3)
  await P.down()
}

for (const walk of Object.values(WALKS_A)) {
  const setup = walk.setup
  walk.setup = async (P) => {
    await capture()
    return setup(P)
  }
}

// ---------------------------------------------------------------- bridge: clips → reels-render's inputs

const REMOTION =
  process.env.REMOTION_BIN ??
  path.join(REPO, 'promo', 'motion', 'node_modules', '.bin', 'remotion')
const CAPTURE_JS = path.join(
  REPO,
  'promo',
  'motion',
  'src',
  'reels',
  'a.capture.js',
)
/** The per-frame boxes ReelA / a.shots.js read (the full logs stay in clips/a/<clip>.rects.json). */
const KEEP = {
  'a-gl-turn': ['geom:page'],
  'a-drop': ['frame', 'row', 'chip', 'pan'],
  'a-fill': ['frame'],
  'a-shelf': ['face', 'geom:page'],
  'a-breath': ['geom:page'],
}
/** The grid fields a.shots.js needs (beats.json is gitignored; the walks were timed to this one). */
const GRID_KEYS = [
  'track',
  'title',
  'sha256',
  'bpm',
  'period',
  'start',
  'frames',
  'bars',
  'liftBar',
  'liftDb',
  'downbeats',
  'beats',
]
const r1 = (v) => Math.round(v * 10) / 10
const rect = (r) => (r ? r.map(r1) : null)

function encode(id, dir, out) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'))
  const res = spawnSync(
    REMOTION,
    [
      'ffmpeg',
      '-y',
      '-v',
      'error',
      '-framerate',
      '30',
      '-i',
      path.join(dir, meta.frameFiles),
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '14',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      out,
    ],
    { encoding: 'utf8' },
  )
  if (res.status !== 0)
    throw new Error(`encode ${id}: ${res.stderr || res.stdout || res.error}`)
  return meta
}

function bridge() {
  const outDir = path.join(CLIPS_OUT, 'a')
  fs.mkdirSync(outDir, { recursive: true })
  const grid = JSON.parse(fs.readFileSync(BEATS, 'utf8'))
  planA(grid)
  const data = {}
  for (const id of Object.keys(WALKS_A)) {
    const dir = path.join(CLIPS_OUT, id)
    const read = (n) =>
      JSON.parse(fs.readFileSync(path.join(dir, `${id}.${n}.json`), 'utf8'))
    const meta = encode(id, dir, path.join(outDir, `${id}.mp4`))
    if (!meta.ok) throw new Error(`${id}: capture failed: ${meta.failures}`)
    // check 9 reads the clip's own meta (viewport × DPR) next to the staged file
    fs.copyFileSync(
      path.join(dir, `${id}.json`),
      path.join(outDir, `${id}.json`),
    )
    const rects = read('rects')
    const dom = read('dom')
    const pointer = read('pointer')
    // check 5's log: the capture's per-frame DOM hits (progressbar / *-running* / spinner) as `busy`
    fs.writeFileSync(
      path.join(outDir, `${id}.rects.json`),
      JSON.stringify({
        fps: rects.fps,
        viewport: rects.viewport,
        frames: rects.frames.map((fr, k) => ({
          f: fr.f,
          busy: dom.frames[k]?.bad ?? ['unlogged'],
          rects: fr.rects,
        })),
      }) + '\n',
    )
    const names = KEEP[id] ?? []
    data[id] = {
      frames: meta.frames,
      viewport: { w: meta.viewport.width, h: meta.viewport.height },
      pointer: pointer.frames.map((p) => [r1(p.x), r1(p.y)]),
      events: pointer.events.map((e) => [e.f, e.type, e.key ?? null]),
      rects: Object.fromEntries(
        names.map((n) => [
          n,
          rects.frames.map((fr) => {
            const r = fr.rects[n]
            return Array.isArray(r?.[0]) ? r.map(rect) : rect(r)
          }),
        ]),
      ),
    }
    const cards = path.join(dir, `${id}.cards.json`)
    if (fs.existsSync(cards))
      data[id].cards = JSON.parse(fs.readFileSync(cards, 'utf8'))
    console.log(`${id}: ${meta.frames} frames → clips/a/${id}.mp4`)
  }
  const keep = Object.fromEntries(GRID_KEYS.map((k) => [k, grid[k]]))
  fs.writeFileSync(
    CAPTURE_JS,
    '// Generated by `node promo/reels/walks-a.mjs --bridge` from the reel A capture (do not edit): per clip its\n' +
      '// frame count, CSS viewport, pointer path [x, y] per frame, pointer / key events [frame, type, key] and the\n' +
      '// boxes [x, y, w, h] (CSS px) of the targets its walk names, per frame; GRID = the beats.json the walks were\n' +
      '// timed to (promo/out/reels/sound/a.beats.json).\n' +
      `export const GRID = ${JSON.stringify(keep)}\n` +
      `export const CAPTURE = ${JSON.stringify(data)}\n`,
  )
  console.log(`→ ${path.relative(REPO, CAPTURE_JS)} (track ${grid.track})`)
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  if (process.argv.includes('--bridge')) bridge()
  else console.log('usage: node promo/reels/walks-a.mjs --bridge')
}

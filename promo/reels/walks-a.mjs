// Reel A «Одна поездка» capture walks (Designer promo-reels-3 §3): the real kit filmed in real time on capture.mjs's
// frame-stepped clock. Every action is timed in whole frames so it lands on reel A's beat grid (100 BPM, 18 frames a
// beat) once ReelA.jsx maps the clip with a constant offset at rate 1: `at(P, n)` waits until the clip holds `n`
// frames, glides are counted with capture's own `glidePath`.
//
//   node promo/reels/capture.mjs --clip a-gl-turn,a-drop,a-filled,a-fill,a-cover,a-shelf,a-breath
//   node promo/reels/walks-a.mjs --bridge     clips → promo/out/reels/clips/a/<clip>.mp4 + <clip>.rects.json (busy log)
//                                            and the generated data module promo/motion/src/reels/a.capture.js
//
// The bridge exists because capture.mjs writes JPEG frames + dom.json per clip directory, while reels-render.mjs stages
// `clips/<reel>/*.{mp4,webm}` and reads `clips/<reel>/<clip>.rects.json` `frames[].busy` (check 5).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// capture.mjs imports this module for its CLIPS table, so its walk helpers (editorBook, zoomSpread, chooseButton,
// glidePath, MD, W) load lazily, before each walk's setup: a static import would be a cycle that breaks `--bridge`.
let K = null
const capture = async () => (K ??= await import('./capture.mjs'))

const HERE = path.dirname(new URL(import.meta.url).pathname)
const REPO = path.resolve(HERE, '..', '..')
const CLIPS_OUT = path.join(REPO, 'promo', 'out', 'reels', 'clips')
const DT = 1000 / 30

// Selectors (strings only: capture.mjs's own consts are not initialised yet while this module evaluates).
const SPREAD = '[data-testid="canvas"] [data-current]'
const FRAME = `${SPREAD} [data-testid="frame"]`
const ROW = '[data-testid="filmstrip"] [role="row"]'
const CHIP = '[data-testid="demo"] [data-testid="film-fill-book"]'
const COVER = '[data-testid="cover-front"]'
const FACE = '[data-testid="ss9-book"][data-kind="face"]'
const READER = '[data-testid="ps-reader"]'
const SITE = (q) => `/index.html?theme=procreate-light#/full/personal-site?${q}`

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

// ---------------------------------------------------------------- walks

/** Beat plan, in clip frames (ReelA maps clip frame = reel frame + offset; the offsets come from these events). */
export const PLAN = {
  // A1/A2: click on the right half at f6 (down) → the leaf turns; A1 starts 6 frames after the up.
  glTurn: { view: 7, down: 6 },
  // A3–A5: Choose down at reel b4.5 (81), the thumb pick at b6 (108), the drop (up) at b8 (144) → 27 and 36 frames apart.
  drop: { chooseDown: 50, pickGap: 27, dropGap: 36 },
  // A6: chip down at b9 + 6 (168), Enter at b10 (180).
  fill: { chipDown: 36, enterGap: 12, tail: 46 },
  // A8: first letter at b13 + 4 (238), two frames a letter (60 ms on the 33.3 ms clock).
  cover: { firstKey: 4, tail: 26 },
  // A9/A10: the pointer leaves the lifted book at b16 (288) and clicks it at b19 (342), the cut to A10's macro, where
  // the cover turns (1000 ms). Two glides with their spring settles need ~51 frames, so b18 is out of reach.
  shelf: { leave: 2, clickGap: 54, tail: 50 },
  // A11/A12: the slow drag starts at b21.5 (387), 9 frames into A11 (378), and the take runs to the reel's end (540).
  breath: { view: 3, down: 9, ms: 1300, length: 165 },
}

export const WALKS_A = {
  'a-gl-turn': {
    reel: 'a',
    viewport: 'site',
    about:
      'A1 + A2 rewind: GL reader (books=1, Lake trip) on L38 | L31, a click on the right half turns the leaf',
    targets: [
      { name: 'reader', sel: READER },
      { name: 'canvas', sel: '[data-testid="ps-reader-canvas"]' },
    ],
    async setup(P) {
      const label = await openReader(P, PLAN.glTurn.view)
      if (!/Pages 12/.test(label ?? ''))
        throw new Error(`reader shows "${label}", wanted Pages 12–13`)
      const c = await P.center(P.page.locator(READER).first())
      // hover near the right page's lower outer corner: the kit lifts the corner
      await P.moveTo(c.x + 470, c.y + 230)
      await P.settle(600)
    },
    async act(P) {
      begin(P)
      await at(P, PLAN.glTurn.down, 'turn click')
      await P.down()
      await waitF(P, 2)
      await P.up()
      await waitF(P, 52)
    },
  },
  'a-drop': {
    reel: 'a',
    viewport: 'editor',
    about:
      'A2 base + A3–A5: empty editor (Md), Add folder, Choose on b4.5, the strip is full on the next frame, L18 dragged onto spread 1 from b6, dropped on b8',
    targets: [
      { name: 'spread', sel: SPREAD },
      { name: 'frame', sel: FRAME, all: true },
      { name: 'row', sel: ROW, all: true },
      { name: 'choose', sel: '[role=dialog] button:last-of-type' },
    ],
    async setup(P) {
      await K.editorBook(P, 'a')
      await K.zoomSpread(P, K.MD)
      await P.moveTo(P.rest.x, P.rest.y)
    },
    async act(P) {
      begin(P)
      // f0–f3: the empty editor (A2's last state)
      await waitF(P, 4)
      await P.page.locator('[data-testid="demo-add-folder"]').first().click()
      await waitF(P, 18)
      const b = await P.center(K.chooseButton(P.page))
      await P.moveTo(b.x - 160, b.y + 120)
      const { chooseDown, pickGap, dropGap } = PLAN.drop
      await clickAt(P, b, chooseDown, 'Choose')
      // the pick: down on thumb 1 exactly pickGap frames after Choose went down
      const a = await P.center(P.page.locator(ROW).first())
      const pick = chooseDown + pickGap
      // a quick hand move from the button to thumb 1: the spec glide, shortened until it fits the beat
      const dist = Math.hypot(a.x - P.ptr.x, a.y - P.ptr.y)
      let gms = 180 + 120 * Math.log2(dist / 40 + 1)
      while (gms > 300 && now(P) + glideLen(P, a, gms) > pick) gms -= 20
      await at(P, pick - glideLen(P, a, gms), 'pick glide')
      await glide(P, a, gms)
      await P.down()
      await waitF(P, 2)
      // the drag (600–900 ms) arrives and goes up exactly dropGap frames after the pick
      const t = await P.center(P.page.locator(FRAME).first())
      let ms = 800
      while (ms > 600 && 2 + glideLen(P, t, ms) + 2 > dropGap) ms -= 20
      await glide(P, t, ms)
      await at(P, pick + dropGap, 'drop')
      await P.up()
      await waitF(P, 26)
    },
  },
  'a-filled': {
    reel: 'a',
    viewport: 'editor',
    about:
      'A2 cards: the same Md editor after Fill book (frame boxes + photos), filmed still for its rects',
    targets: [
      { name: 'spread', sel: SPREAD },
      { name: 'frame', sel: FRAME, all: true },
      { name: 'row', sel: ROW, all: true },
    ],
    async setup(P) {
      await K.editorBook(P, 'a')
      await K.zoomSpread(P, K.MD)
      await addFolder(P)
      await P.page.locator(CHIP).first().click()
      await P.settle(500)
      await P.page.keyboard.press('Enter')
      await P.settle(1200)
      await P.moveTo(P.rest.x, P.rest.y)
    },
    async act(P) {
      begin(P)
      await waitF(P, 6)
    },
    async check(P) {
      // which photo sits in which box (visible frames of the canvas and filmstrip rows), for the A2 card flights
      const data = await P.page.evaluate(
        ([spreadSel, rowSel]) => {
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
            frames: all('[data-testid="canvas"] [data-testid="frame"]'),
            rows: all(rowSel),
            current: box(document.querySelector(spreadSel)),
          }
        },
        [SPREAD, ROW],
      )
      if (!data.frames.some((f) => f.p))
        throw new Error('a-filled: no photo found in the canvas frames')
      extra('a-filled', 'cards', data)
    },
  },
  'a-fill': {
    reel: 'a',
    viewport: 'editor',
    about:
      'A6 + A7 still: W zoom on the first spreads (L18 on spread 1, as A5 left it), chip click on b9 + 6, Enter on b10: every spread fills',
    targets: [
      { name: 'spread', sel: SPREAD },
      { name: 'frame', sel: FRAME, all: true },
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
      const { chipDown, enterGap, tail } = PLAN.fill
      await clickAt(
        P,
        await P.center(P.page.locator(CHIP).first()),
        chipDown,
        'chip',
      )
      await at(P, chipDown + enterGap, 'Enter')
      await P.key('Enter')
      await waitF(P, tail)
    },
  },
  'a-cover': {
    reel: 'a',
    viewport: 'editor',
    about:
      'A8: the cover (L18) at Md zoom, its front title typed from b13 + 4, a letter every 2 frames',
    targets: [
      { name: 'spread', sel: SPREAD },
      { name: 'cover', sel: COVER },
    ],
    async setup(P) {
      await K.editorBook(P, 'a', 'cover')
      await addFolder(P)
      await setupDrag(
        P,
        P.page.locator(ROW).first(),
        P.page.locator(COVER).first(),
      )
      // the front title field lives in the inspector: show it for this take, clear the prefilled title, keep the caret
      const tog = P.page
        .locator('[data-testid="demo"] [data-testid="toggle-r"]')
        .first()
      if ((await tog.getAttribute('aria-pressed')) !== 'true') await tog.click()
      await P.settle(400)
      const input = P.page.locator('[data-testid="cover-text-front"]').first()
      await input.fill('')
      await input.focus()
      await P.moveTo(P.rest.x, P.rest.y)
      await P.settle(400)
    },
    async act(P) {
      begin(P)
      await at(P, PLAN.cover.firstKey, 'first letter')
      for (const ch of 'Lake trip 2026') {
        await P.type(ch)
        tick(P, 2)
      }
      await waitF(P, PLAN.cover.tail)
    },
  },
  'a-shelf': {
    reel: 'a',
    viewport: 'site',
    about:
      'A9 + A10: site books=6, the pointer leaves the lifted Lake trip book, comes back and clicks it: the cover turns',
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
      const { leave, clickGap, tail } = PLAN.shelf
      const b = await P.center(P.page.locator(FACE).first())
      await at(P, leave, 'leave')
      await glide(P, { x: b.x + 260, y: b.y + 150 })
      await clickAt(P, b, leave + clickGap, 'book click')
      await waitF(P, tail)
    },
  },
  'a-breath': {
    reel: 'a',
    viewport: 'site',
    about:
      'A11 + A12: the reading room on L10 | L36, the next leaf dragged slowly across in 1300 ms, it lands on L18 | L22 · L28',
    targets: [
      { name: 'reader', sel: READER },
      { name: 'canvas', sel: '[data-testid="ps-reader-canvas"]' },
    ],
    async setup(P) {
      const label = await openReader(P, PLAN.breath.view)
      if (!/Pages 4/.test(label ?? ''))
        throw new Error(`reader shows "${label}", wanted Pages 4–5`)
      const c = await P.center(P.page.locator(READER).first())
      await P.moveTo(c.x + 500, c.y + 40)
      await P.settle(600)
    },
    async act(P) {
      begin(P)
      const { down, ms, length } = PLAN.breath
      const c = await P.center(P.page.locator(READER).first())
      await at(P, down, 'breath down')
      await P.down()
      // flat bow: a straight, slow hand across the spread
      await glide(P, { x: c.x - 470, y: c.y + 10 }, ms, 0.01)
      await P.up()
      await at(P, length, 'breath end')
    },
  },
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
const KEEP = { 'a-drop': ['frame'], 'a-fill': ['frame'], 'a-cover': ['cover'] }
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
  const data = {}
  for (const id of Object.keys(WALKS_A)) {
    const dir = path.join(CLIPS_OUT, id)
    const read = (n) =>
      JSON.parse(fs.readFileSync(path.join(dir, `${id}.${n}.json`), 'utf8'))
    const meta = encode(id, dir, path.join(outDir, `${id}.mp4`))
    if (!meta.ok) throw new Error(`${id}: capture failed: ${meta.failures}`)
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
  fs.writeFileSync(
    CAPTURE_JS,
    '// Generated by `node promo/reels/walks-a.mjs --bridge` from the reel A capture (do not edit): per clip its\n' +
      '// frame count, CSS viewport, pointer path [x, y] per frame, pointer / key events [frame, type, key] and the\n' +
      '// boxes [x, y, w, h] (CSS px) of the targets its walk names, per frame.\n' +
      `export const CAPTURE = ${JSON.stringify(data)}\n`,
  )
  console.log(`→ ${path.relative(REPO, CAPTURE_JS)}`)
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  if (process.argv.includes('--bridge')) bridge()
  else console.log('usage: node promo/reels/walks-a.mjs --bridge')
}

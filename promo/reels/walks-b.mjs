// Reel B «Один снимок» capture walks (Designer promo-reels-3 spec §4): the hero L68 (kit p01) is followed from the
// filmstrip onto spread 1, onto the cover, onto the site shelf and into the phone reader. capture.mjs spreads `walksB()`
// into its CLIPS table; the filmed timing is chosen so that, with the shot table's clip offsets
// (promo/motion/src/reels/b.shots.js), every grab, drop, click and tap lands on its beat.
//
//   node promo/reels/capture.mjs --clip b-hero-drop,b-hero-cover,b-site,b-phone
//   node promo/reels/walks-b.mjs --stage     encode the frames + logs for reels-render.mjs (promo/out/reels/clips/b/)
//
// `--stage` bridges capture's output (clips/<id>/frames/*.jpg + logs) to what reels-render.mjs reads
// (clips/b/<id>.mp4 and clips/b/<id>.rects.json whose frames carry `busy` = the capture DOM log's `bad` list).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  FILM,
  FRAME,
  MD,
  SPREAD,
  W,
  chooseButton,
  editorBook,
  zoomSpread,
} from './capture.mjs'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const CLIPS_DIR = path.resolve(HERE, '../out/reels/clips')
const REMOTION = path.resolve(HERE, '../motion/node_modules/.bin/remotion')

// Selectors are functions, not consts: capture.mjs imports this module and calls walksB() while building CLIPS, before
// this module's own top-level consts exist (the import is circular; function declarations are hoisted).
function COVER() {
  return '[data-testid="canvas"] [data-testid="spread"][data-spread="0"]'
}
function COVER_FRONT() {
  return `${COVER()} [data-testid="frame"]`
}
function FACE() {
  return '[data-testid="ss9-book"][data-kind="face"]'
}
function SITE(P) {
  return `${P.base}/index.html?theme=procreate-light#/full/personal-site?books=6`
}

/** Editor book with the reel B photos in the strip (Add folder → Choose), current spread = spread 1 (`p1`). */
async function stripBook(P) {
  await editorBook(P, 'b', 'p1')
  await P.page.locator('[data-testid="demo-add-folder"]').first().click()
  await P.settle(600)
  await chooseButton(P.page).click()
  await P.settle(900)
  if (!(await P.page.locator(FILM).count()))
    throw new Error('filmstrip has no rows after Choose')
}

/** Off camera, in real time: drag `from` onto `to` with a few intermediate pointer moves (the kit's drag needs them). */
async function dropOffCamera(P, from, to) {
  const a = await P.center(from)
  const b = await P.center(to)
  await P.moveTo(a.x, a.y)
  await P.down()
  for (let k = 1; k <= 12; k++) {
    await P.moveTo(a.x + ((b.x - a.x) * k) / 12, a.y + ((b.y - a.y) * k) / 12)
    await P.page.waitForTimeout(16)
  }
  await P.page.waitForTimeout(120)
  await P.up()
  await P.settle(500)
}

/** Filmed drag: down, a 2-frame grip, one glide of `ms` onto `to`, up (§2: drag 600–900 ms). */
async function dragTo(P, to, ms) {
  const b = await P.center(to)
  await P.down()
  await P.wait(70)
  await P.glide(b.x, b.y, ms)
  await P.up()
}

function heroThumb(P) {
  return P.page.locator(FILM).first()
}
function editorTargets() {
  return [
    { name: 'spread', sel: SPREAD },
    { name: 'frame', sel: FRAME, all: true },
    { name: 'cover', sel: COVER() },
    { name: 'coverFront', sel: COVER_FRONT(), all: true },
    { name: 'row', sel: FILM, all: true },
    { name: 'filmstrip', sel: '[data-testid="filmstrip"]' },
  ]
}

/** The reel B clip entries for capture.mjs `CLIPS` (§4 B2–B10). */
export function walksB() {
  return {
    'b-hero-drop': {
      reel: 'b',
      viewport: 'editor',
      about:
        'B2: Md zoom, the strip full; the pointer grabs the hero (thumb 1) and drops it on spread 1’s full-spread frame',
      targets: editorTargets(),
      async setup(P) {
        await stripBook(P)
        await zoomSpread(P, MD)
        const t = await P.center(heroThumb(P))
        await P.moveTo(t.x + 260, t.y - 330)
      },
      async act(P) {
        await P.wait(400)
        await P.glide(...Object.values(await P.center(heroThumb(P))))
        await P.wait(100)
        await dragTo(P, P.page.locator(FRAME).first(), 640)
        await P.wait(1000)
      },
      async check(P) {
        const src = await P.page
          .locator(`${FRAME} img`)
          .first()
          .getAttribute('src')
        if (!/p01/.test(src ?? ''))
          throw new Error(`spread 1 frame shows ${src}, wanted the hero p01`)
      },
    },
    'b-hero-cover': {
      reel: 'b',
      viewport: 'editor',
      about:
        'B3–B5: W zoom, the hero already on spread 1 (off camera); thumb 1 dragged up onto the cover front',
      targets: editorTargets(),
      async setup(P) {
        await stripBook(P)
        await dropOffCamera(P, heroThumb(P), P.page.locator(FRAME).first())
        await zoomSpread(P, W)
        const t = await P.center(heroThumb(P))
        await P.moveTo(t.x, t.y)
      },
      async act(P) {
        await P.wait(1200)
        await dragTo(P, P.page.locator(COVER_FRONT()).first(), 700)
        await P.wait(2600)
      },
      async check(P) {
        const src = await P.page
          .locator(`${COVER_FRONT()} img`)
          .first()
          .getAttribute('src')
        if (!/p01/.test(src ?? ''))
          throw new Error(`cover front shows ${src}, wanted the hero p01`)
      },
    },
    'b-site': {
      reel: 'b',
      viewport: 'site',
      about:
        'B7: site books=6, the face-out B book (cover = hero) lifts under the pointer, click: the room opens',
      targets: [
        { name: 'face', sel: FACE() },
        { name: 'book3d', sel: '[data-testid="book3d"]' },
        { name: 'reader', sel: '[data-testid="ps-reader"]' },
        { name: 'readerGl', sel: '[data-testid="ps-reader-canvas"]' },
      ],
      async setup(P) {
        await P.page.goto(SITE(P))
        await P.page.waitForSelector(FACE())
        await P.settle(1500)
        const f = await P.center(P.page.locator(FACE()).first())
        await P.moveTo(f.x + 380, f.y + 300)
      },
      async act(P) {
        await P.wait(300)
        await P.glide(
          ...Object.values(await P.center(P.page.locator(FACE()).first())),
        )
        await P.wait(500)
        await P.down()
        await P.wait(70)
        await P.up()
        await P.wait(1500)
      },
    },
    'b-phone': {
      reel: 'b',
      viewport: 'phone',
      about:
        'B8–B10: phone, the reader on the B cover (opened off camera); tap opens the cover onto the title page, one slow 1300 ms finger drag turns it onto spread 1 = the hero',
      targets: [
        { name: 'stage', sel: '[data-testid="pt-stage"]' },
        { name: 'paper', sel: '[data-testid="ps-paper"]', all: true },
      ],
      async setup(P) {
        // Spread 1 of the face-out book (its full-spread frame, data-si 2) is kit p10; reel B feeds it the hero, as the
        // editor walks put the hero on spread 1. The rewritten request still goes through capture's server (graded L68).
        await P.page.route(/\/photos\/p10\.jpg(\?.*)?$/, (route) =>
          route.fallback({
            url: route.request().url().replace('/p10.jpg', '/p01.jpg'),
          }),
        )
        await P.page.goto(SITE(P))
        await P.page.waitForSelector(FACE())
        await P.settle(1500)
        const f = await P.center(P.page.locator(FACE()).first())
        await P.moveTo(f.x, f.y)
        await P.down()
        await P.page.waitForTimeout(70)
        await P.up()
        await P.settle(2000)
        const st = await P.page
          .locator('[data-testid="pt-stage"]')
          .boundingBox()
        if (!st) throw new Error('phone reader did not open')
        await P.moveTo(st.x + st.width * 0.7, st.y + st.height * 0.5)
      },
      async act(P) {
        await P.wait(1330)
        await P.down()
        await P.wait(70)
        await P.up()
        // the cover opens (GL, 1000 ms); the breath starts on b19.5 = 30 frames after the tap, as the open settles
        await P.wait(930)
        const stage = P.page.locator('[data-testid="pt-stage"]')
        P.openedSi = await stage.getAttribute('data-si')
        // the breath: one slow finger drag to the left turns the title page onto spread 1 (the hero)
        const st = await stage.boundingBox()
        const y = st.y + st.height * 0.5
        await P.moveTo(st.x + st.width * 0.92, y)
        await P.down()
        await P.glide(st.x + st.width * 0.08, y, 1300, 0.01)
        await P.up()
        await P.wait(4100)
      },
      async check(P) {
        const si = await P.page
          .locator('[data-testid="pt-stage"]')
          .getAttribute('data-si')
        if (P.openedSi !== '1' || si !== '2')
          throw new Error(
            `tap should open the cover (data-si 1, got ${P.openedSi}) and the drag turn onto spread 1 (2, got ${si})`,
          )
      },
    },
  }
}

// ---------------------------------------------------------------- --stage: capture output → reels-render inputs

function stage() {
  if (!fs.existsSync(REMOTION))
    throw new Error(
      'promo/motion deps missing: pnpm -C promo/motion install --ignore-workspace',
    )
  const dest = path.join(CLIPS_DIR, 'b')
  fs.mkdirSync(dest, { recursive: true })
  for (const id of Object.keys(walksB())) {
    const dir = path.join(CLIPS_DIR, id)
    const meta = JSON.parse(
      fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'),
    )
    if (!meta.ok) throw new Error(`${id}: capture failed: ${meta.failures[0]}`)
    const dom = JSON.parse(
      fs.readFileSync(path.join(dir, `${id}.dom.json`), 'utf8'),
    )
    const rects = JSON.parse(
      fs.readFileSync(path.join(dir, `${id}.rects.json`), 'utf8'),
    )
    // busy = the capture's per-frame no-progress scan (progressbar, spinner, *-running*), frame for frame
    const busy = new Map(dom.frames.map((fr) => [fr.f, fr.bad]))
    rects.frames = rects.frames.map((fr) => ({ ...fr, busy: busy.get(fr.f) }))
    fs.writeFileSync(
      path.join(dest, `${id}.rects.json`),
      JSON.stringify(rects) + '\n',
    )
    // Every frame kept (-g 1 would bloat; -g 15 keeps OffthreadVideo seeks cheap), DPR 3 pixels untouched.
    encode(id, dir, path.join(dest, `${id}.mp4`), ['-crf', '12', '-g', '15'])
    // The 0.5 s sheet's proxy (ReelB.jsx ClipFrame): DPR 1, every frame a keyframe.
    encode(id, dir, path.join(dest, `${id}.sheet.mp4`), [
      '-vf',
      'scale=iw/3:ih/3:flags=lanczos',
      '-crf',
      '16',
      '-g',
      '1',
    ])
    console.log(
      `${id}: ${meta.frames} frames → clips/b/${id}.mp4 (+ .sheet.mp4) + rects (busy from the DOM log)`,
    )
  }
}

function encode(id, dir, out, args) {
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
      path.join(dir, 'frames', '%06d.jpg'),
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      ...args,
      '-pix_fmt',
      'yuv420p',
      out,
    ],
    { encoding: 'utf8', maxBuffer: 64 << 20 },
  )
  if (res.status !== 0)
    throw new Error(`${id}: ffmpeg failed: ${res.stderr || res.stdout}`)
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  if (process.argv.includes('--stage')) stage()
  else console.log('usage: node promo/reels/walks-b.mjs --stage')
}

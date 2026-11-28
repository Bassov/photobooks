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
function SPREAD1() {
  return '[data-testid="canvas"] [data-testid="spread"][data-spread="1"]'
}
function SPREAD1_FRAME() {
  return `${SPREAD1()} [data-testid="frame"]`
}
function FACE() {
  return '[data-testid="ss9-book"][data-kind="face"]'
}
/** B4/B5 film the cover at this spread width (CSS px): front frame ≈ 370 CSS px (Designer review, PR #746). */
const COVER_ZOOM = [860, 900]
/** The sample author on the phone's title page (no "Your Name" placeholder on screen). */
const PHONE_AUTHOR = 'Mara Lind'
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
  // v2: the kit takes a drop on a filled frame only after a short dwell (as dropOffCamera)
  await P.wait(120)
  await P.up()
  return b
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
    // v2 G3: photo share = every filled frame on the canvas and every strip thumb (reels-render.mjs check 11)
    {
      name: 'geom:photo',
      sel: '[data-testid="canvas"] [data-testid="frame"]:has(img), [data-testid="filmstrip"] [role="row"] img',
      all: true,
    },
  ]
}

const srcOf = (P, sel) =>
  P.page.locator(`${sel} img`).first().getAttribute('src')

/**
 * v2 G3: the B book is full (Fill book, off camera), so the editor shots are photo-filled; the hero (p01) then must not
 * already sit on spread 1 (or, with `cover`, on the cover front): another strip photo goes there first, so the filmed
 * drop is the hero replacing it.
 */
async function fullBook(P) {
  await P.page
    .locator('[data-testid="demo"] [data-testid="film-fill-book"]')
    .first()
    .click()
  await P.settle(500)
  await P.page.keyboard.press('Enter')
  await P.settle(1200)
  // Fill book puts the hero (p01) on the cover front and makes the cover current: p03 goes onto the cover instead,
  // then spread 1 (its full-spread frame, p02) is made current again.
  if (/p01/.test((await srcOf(P, COVER_FRONT())) ?? ''))
    await dropOffCamera(
      P,
      P.page.locator(FILM).nth(2),
      P.page.locator(COVER_FRONT()).first(),
    )
  for (const sel of [COVER_FRONT(), SPREAD1_FRAME()])
    if (/p01/.test((await srcOf(P, sel)) ?? ''))
      throw new Error(`${sel} still shows the hero after Fill book`)
  await P.page.keyboard.press('Escape')
  for (let k = 0; k < 4; k++) {
    if (await P.page.locator(`${SPREAD1()}[data-current]`).count()) break
    const cover = await P.page.locator(`${COVER()}[data-current]`).count()
    // the canvas viewport's keys: ← / → step the current spread while nothing is selected (focus off the chip)
    await P.page.evaluate(() => document.activeElement?.blur())
    await P.page.keyboard.press('Escape')
    await P.page.keyboard.press(cover ? 'ArrowRight' : 'ArrowLeft')
    await P.settle(300)
  }
  await P.moveTo(P.rest.x, P.rest.y)
  if (!(await P.page.locator(`${SPREAD1()}[data-current]`).count()))
    throw new Error('spread 1 is not current after Fill book')
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
        await fullBook(P)
        await zoomSpread(P, MD)
        const t = await P.center(heroThumb(P))
        await P.moveTo(t.x + 260, t.y - 330)
      },
      async act(P) {
        await P.wait(400)
        await P.glide(...Object.values(await P.center(heroThumb(P))))
        await P.wait(100)
        await dragTo(P, P.page.locator(FRAME).first(), 640)
        // B3 films the landed hero at UI scale 2.2: no selection handles on it
        await P.page.keyboard.press('Escape')
        await P.wait(1400)
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
        'B4–B5: the cover current at a big zoom (front frame ≥ 340 CSS px), the hero already on spread 1 (off camera); thumb 1 dragged up onto the cover front',
      targets: editorTargets(),
      async setup(P) {
        await stripBook(P)
        await fullBook(P)
        await dropOffCamera(P, heroThumb(P), P.page.locator(FRAME).first())
        // v2 check 10: no selection handles on spread 1 (the landing overlay and the drag would hide them)
        await P.page.evaluate(() => document.activeElement?.blur())
        await P.page.keyboard.press('Escape')
        await P.settle(300)
        if (await P.page.locator('[data-testid="photo-handle"]').count())
          throw new Error('spread 1 frame still selected')
        // Designer review (PR #746): the cover is the hero's stage in B4/B5, so it is the current spread and big
        for (let k = 0; k < 4; k++) {
          if (await P.page.locator(`${COVER()}[data-current]`).count()) break
          await P.page.evaluate(() => document.activeElement?.blur())
          await P.page.keyboard.press('Escape')
          await P.page.keyboard.press('ArrowLeft')
          await P.settle(300)
        }
        if (!(await P.page.locator(`${COVER()}[data-current]`).count()))
          throw new Error('the cover is not current')
        await zoomSpread(P, COVER_ZOOM)
        const front = await P.page.locator(COVER_FRONT()).first().boundingBox()
        if (!front || front.width < 340)
          throw new Error(`cover front ${front?.width} CSS px wide, want ≥ 340`)
        const t = await P.center(heroThumb(P))
        await P.moveTo(t.x, t.y)
      },
      async act(P) {
        // the reel plays this clip over B4–B5; the cover drop lands on the hero bar's downbeat
        await P.wait(1600)
        const c = await dragTo(P, P.page.locator(COVER_FRONT()).first(), 700)
        // v2 check 10: the drop leaves no selection (its round handles straddle the cover's edges in B5's crop) and
        // the pointer leaves the cover
        await P.page.keyboard.press('Escape')
        await P.wait(200)
        // the pointer leaves B5's crop (down-right), so B5 is the cover alone
        await P.glide(c.x + 260, c.y + 380, 600)
        await P.wait(2200)
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
        { name: 'geom:photo', sel: FACE(), all: true },
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
        'B8–B10: phone, the reader on the B cover (opened off camera); a tap 10 frames after the phone appears opens the cover onto the title page (author set), a 1000 ms finger drag right after the open turns it onto spread 1 = the hero',
      targets: [
        { name: 'stage', sel: '[data-testid="pt-stage"]' },
        { name: 'paper', sel: '[data-testid="ps-paper"]', all: true },
        {
          name: 'geom:photo',
          sel: '[data-testid="pt-sheet"][data-role="top"] img',
          all: true,
        },
      ],
      async setup(P) {
        // Designer review (PR #746): no placeholder copy on the title page. capture's name swap leaves the kit
        // author as "Your Name"; this clip's B book gets a sample author instead.
        await P.page.route(/\/assets\/[^?]*\.js(\?.*)?$/, async (route) => {
          const res = await route.fetch()
          const js = (await res.text()).split('Your Name').join(PHONE_AUTHOR)
          await route.fulfill({ response: res, body: js })
        })
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
        // Designer review (PR #746): the tap comes 10 frames after the phone appears (B8)
        await P.wait(600)
        await P.down()
        await P.wait(70)
        await P.up()
        // the cover opens (GL, 1000 ms); the drag starts as soon as it lands (a press during the open would drag the
        // cover's leaf), so the title page is on screen for ≈ 0.6 s only
        await P.wait(1070)
        const stage = P.page.locator('[data-testid="pt-stage"]')
        P.openedSi = await stage.getAttribute('data-si')
        // the breath: one slow finger drag to the left turns the title page onto spread 1 (the hero)
        const st = await stage.boundingBox()
        const y = st.y + st.height * 0.5
        await P.moveTo(st.x + st.width * 0.92, y)
        await P.down()
        await P.glide(st.x + st.width * 0.08, y, 1000, 0.01)
        await P.up()
        // B9 resumes the clip 0.6 s later (b.shots.js CLIP skip): the clip runs to the reel's last frame
        await P.wait(5400)
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

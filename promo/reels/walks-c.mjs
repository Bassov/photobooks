// Reel C «Без ожидания» capture walks (promo-reels-3 spec §5): the clip entries capture.mjs spreads into CLIPS, plus
// `--pack`, which turns the filmed clips into what the Remotion side reads.
//
//   node promo/reels/capture.mjs --clip c-open,c-drop,c-layouts,c-fill,c-cover,c-print,c-shelf
//   node promo/reels/walks-c.mjs --pack
//
// Every walk is real time on the capture clock. v2: the reel cuts on its track's beats (c.beats.json, Warm Fuzz at
// 126.51 BPM: 14.23 frames a beat), so a walk keeps the spacing between its own actions within a frame of the grid
// (7 frames a half-beat, 14 a beat); c.shots.js lines the clip up with the beat by its pointer events. One action per
// clip: a hard cut between clips needs no continuity of the pointer. Editor clips run with the strip's largest thumbs
// and log the visible photos as `geom:photo` (v2 G3, check 11).
//
// `--pack` (needs ffmpeg: $FFMPEG, else the one Remotion ships in promo/motion/node_modules) writes per clip
// `clips/c/<id>.mp4` (H.264, every frame at DPR 3), `clips/c/<id>.rects.json` (the rects log plus `busy` = the
// frame's no-progress scan, read by reels-render.mjs check 5) and rewrites the generated `CLIP_DATA` block of
// promo/motion/src/reels/c.shots.js (pointer path, events and the rects the reel uses, CSS px).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const CLIPS_DIR = path.resolve(HERE, '../out/reels/clips')
const SHOTS = path.resolve(HERE, '../motion/src/reels/c.shots.js')
const DT = 1000 / 30

// capture.mjs imports this file, so its helpers are loaded lazily (no import cycle at module evaluation)
const cap = () => import('./capture.mjs')

const FILM = '[data-testid="filmstrip"] [role="row"]'
const SPREAD = '[data-testid="canvas"] [data-current]'
const FRAME = `${SPREAD} [data-testid="frame"]`
const FILL = '[data-testid="demo"] [data-testid="film-fill-book"]'
const COVER = '[data-testid="cover-sheet"]'
const BOOK = '[data-testid="ss9-book"]'
const READER = '[data-testid="ps-reader"]'

/** Frame counter over the capture helpers: every filmed frame comes from `wait` or `glide`, so the count is exact. */
function clock(P, glidePath) {
  let f = 0
  const T = {
    get f() {
      return f
    },
    async wait(n) {
      if (n <= 0) return
      await P.wait(n * DT)
      f += n
    },
    async to(target, what = 'action') {
      if (target < f)
        throw new Error(`${what}: at frame ${f}, wanted ${target}`)
      await T.wait(target - f)
    },
    /** Frames a glide to `p` takes (travel + settle), on the spec path. */
    frames: (p, ms, bow) =>
      glidePath({ x: P.ptr.x, y: P.ptr.y }, p, ms, bow).length,
    async glide(p, ms, bow) {
      const n = T.frames(p, ms, bow)
      await P.glide(p.x, p.y, ms, bow)
      f += n
    },
    /** A click: down on this frame, up 2 frames (70 ms) later. */
    async click() {
      await P.down()
      await T.wait(2)
      await P.up()
    },
  }
  return T
}

const mid = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
async function box(P, sel, k = 0) {
  const b = await P.page.locator(sel).nth(k).boundingBox()
  if (!b) throw new Error(`no box for ${sel} #${k}`)
  return b
}

/** Editor with the C book, the 412-item folder added (off camera) and the current item zoomed to `zoom`. */
async function editorFull(P, item, zoom) {
  const c = await cap()
  await c.editorBook(P, 'c', item)
  await bigThumbs(P)
  await P.page.locator('[data-testid="demo-add-folder"]').first().click()
  await P.settle(600)
  await c.chooseButton(P.page).click()
  await P.settle(900)
  if (zoom) await c.zoomSpread(P, zoom === 'md' ? c.MD : c.W)
  await P.settle(300)
  return c
}

/** Off camera: wheel-zoom (kit step ×1.1, to the pointer) until `sel` is `lo`–`hi` CSS px wide. Asserted. */
async function zoomBox(P, sel, [lo, hi]) {
  for (let k = 0; k < 40; k++) {
    const b = await box(P, sel)
    if (b.width >= lo && b.width <= hi) return b.width
    const c = mid(b)
    await P.page.mouse.move(c.x, c.y)
    await P.page.mouse.wheel(0, b.width < lo ? -100 : 100)
    await P.settle(150)
  }
  throw new Error(`${sel} not zoomed into ${lo}–${hi} px`)
}

/** Off camera: drag strip row `row` onto point `to` (no filming, real time). */
async function placeOff(P, row, to) {
  const a = mid(await box(P, FILM, row))
  await P.moveTo(a.x, a.y)
  await P.down()
  await P.page.waitForTimeout(120)
  for (let k = 1; k <= 12; k++) {
    await P.moveTo(a.x + ((to.x - a.x) * k) / 12, a.y + ((to.y - a.y) * k) / 12)
    await P.page.waitForTimeout(16)
  }
  await P.page.waitForTimeout(120)
  await P.up()
  await P.settle(500)
}

/** Off camera: no selection (frame or cover title) and no text selection, the pointer back at rest. */
async function deselect(P) {
  await P.moveTo(P.rest.x, P.rest.y)
  await P.page.keyboard.press('Escape')
  await P.settle(150)
  await P.page.keyboard.press('Escape')
  await P.page.evaluate(() => window.getSelection()?.removeAllRanges())
  await P.settle(300)
}

/** Front board of the cover sheet: the right part of `cover-sheet` (back | spine | front). */
async function coverFront(P) {
  const b = await box(P, COVER)
  return { x: b.x + b.width * 0.76, y: b.y + b.height * 0.5 }
}

/** promo-reels-v2 G3 / check 11: the visible photos of an editor clip (placed frames, the cover's front board, the
 *  strip's thumbs), logged as `geom:photo` boxes for the photo share. */
const PHOTO_EDITOR = {
  name: 'geom:photo',
  sel: `[data-testid="canvas"] [data-testid="frame"]:has(img), [data-testid="canvas"] [class*="group/front"][data-photo-id], [data-testid="filmstrip"] img`,
  all: true,
}
/** The site case: the face-out covers are photos (the spines are cloth). */
const PHOTO_SITE = {
  name: 'geom:photo',
  sel: `${BOOK}[data-kind="face"]`,
  all: true,
}

const editorTargets = (extra = []) => [
  { name: 'spread', sel: SPREAD },
  { name: 'frame', sel: FRAME, all: true },
  { name: 'filmstrip', sel: '[data-testid="filmstrip"]' },
  { name: 'row', sel: FILM, all: true },
  { name: 'dialog', sel: '[role=dialog]' },
  PHOTO_EDITOR,
  ...extra,
]

/** Off camera: the strip's thumbs at the kit's largest size (dock edge resizer, End = max: 240 px at 1440 tall), so
 *  the photos carry the editor shots (v2 G3). */
async function bigThumbs(P) {
  const r = P.page.locator('[data-testid="thumb-resizer"]').first()
  await r.focus()
  await P.page.keyboard.press('End')
  await r.evaluate((e) => e.blur())
  await P.settle(300)
  const h = await r.getAttribute('aria-valuenow')
  if (Number(h) < 200) throw new Error(`strip thumbs ${h} px after End`)
}

/** The reel's rows: thumb 1 = T7 (the working book's cover photo). At the largest thumbs only 4 rows are in view, so
 *  the cover take's first front photo is thumb 2 (a drag from an off-screen row does nothing). */
const ROW_T7 = 0
const ROW_FRONT = 1

/** Site clip: `books=30` puts two face-out covers on the case (v2 G3: the photos carry the shelf). */
const SHELF_BOOKS = 30
/** c-shelf clip frames of the two clicked turns past the title, the breath drag's press and the teaser turn's click
 *  (c.shots.js reads the events back). */
const SHELF_OPEN_TURNS = [144, 172]
const SHELF_BREATH = 217
const SHELF_TURN = 322

/**
 * Off camera, before the site loads: the case shows every cover once and every title once (Designer review of #748).
 * The kit's placeholders (books 13+) take cover `p${k % 21 + 1}`, so the first one ("Quiet harbour", face-out on the
 * second shelf) wears p01 = T7, the working book's cover; the kit's own sample "Desert road" (2024, a spine on the top
 * shelf) shares the reel's title. The served bundle gets the placeholder covers shifted by two photos (p03, p14, p20
 * for the three placeholder face-outs) and that sample book renamed; each rewrite must match once.
 */
async function shelfFeed(P) {
  const rewrites = [
    [/cover:`p\$\{(\w+)\((\w+)%21\+1\)\}`/g, 'cover:`p${$1(($2+2)%21+1)}`'],
    [/(id:`desert-road`,title:)`Desert road`/g, '$1`White dunes`'],
  ]
  await P.page.route(/\/assets\/kit\.js(\?|$)/, async (route) => {
    const res = await route.fetch()
    let js = await res.text()
    for (const [re, to] of rewrites) {
      const n = js.match(re)?.length ?? 0
      if (n !== 1)
        throw new Error(`c-shelf feed: ${re} matched ${n} times in kit.js`)
      js = js.replace(re, to)
    }
    await route.fulfill({ response: res, body: js })
  })
}

export const WALKS_C = {
  'c-open': {
    reel: 'c',
    viewport: 'editor',
    about:
      'C2: the pointer on Choose in the 412-photo folder picker, click on frame 3, the strip (largest thumbs) is full on the next frame',
    targets: editorTargets([
      // the clicked button itself (`Select "Photobooks"`, capture.mjs chooseButton): the C2 focus box
      { name: 'choose', sel: '[data-reel-choose]' },
    ]),
    async setup(P) {
      const c = await cap()
      await c.editorBook(P, 'c')
      await bigThumbs(P)
      await P.page.locator('[data-testid="demo-add-folder"]').first().click()
      await P.settle(600)
      await c
        .chooseButton(P.page)
        .evaluate((e) => e.setAttribute('data-reel-choose', ''))
      const b = await P.center(c.chooseButton(P.page))
      await P.moveTo(b.x, b.y)
    },
    async act(P) {
      const { glidePath } = await cap()
      const T = clock(P, glidePath)
      await T.to(3)
      await T.click()
      await T.wait(24)
    },
    async check(P) {
      if (!(await P.page.locator(FILM).count()))
        throw new Error('filmstrip has no rows after Choose')
    },
  },
  'c-drop': {
    reel: 'c',
    viewport: 'editor',
    about:
      'C2: Md zoom, the pointer picks T7 (thumb 1) and drags it onto spread 1’s big frame (800 ms)',
    targets: editorTargets(),
    async setup(P) {
      await editorFull(P, 'p1', 'md')
      const a = mid(await box(P, FILM, ROW_T7))
      await P.moveTo(a.x + 70, a.y - 90)
    },
    async act(P) {
      const { glidePath } = await cap()
      const T = clock(P, glidePath)
      await T.wait(2)
      const a = mid(await box(P, FILM, ROW_T7))
      await T.glide(a)
      await T.wait(2)
      await P.down()
      await T.wait(3)
      await T.glide({ x: a.x + 12, y: a.y - 8 }, 130)
      // off the frame's centre: the round move handle comes up there on the release, clear of the pointer (check 10)
      const f = await box(P, FRAME, 0)
      const to = { x: f.x + f.width * 0.64, y: f.y + f.height * 0.66 }
      await T.glide(to, 800)
      await T.wait(3)
      await P.up()
      // Escape with the release: a full-bleed frame's rotate handle sits on the layout pill's text (a product issue),
      // where no frame of it reads as a clean circle (check 10's edge search meets the letters: w/h 1.10–1.23 over
      // frames 64–70 of the first take); the layouts and fill takes deselect as well
      await P.key('Escape')
      await T.wait(45)
    },
  },
  'c-layouts': {
    reel: 'c',
    viewport: 'editor',
    about:
      'C3: T7 on spread 1 (off camera), the pointer on the layout pill’s Next: four clicks 233 ms apart, each layout instant',
    targets: editorTargets([
      { name: 'pill', sel: '[data-testid="layout-cycle"]' },
      { name: 'next', sel: '[data-testid="layout-cycle-next"]' },
    ]),
    async setup(P) {
      await editorFull(P, 'p1', 'md')
      await placeOff(P, ROW_T7, mid(await box(P, FRAME, 0)))
      // drop the frame selection: its rotate handle sits on the pill once a layout puts the frame at the top
      await P.page.keyboard.press('Escape')
      await P.settle(300)
      const n = mid(await box(P, '[data-testid="layout-cycle-next"]'))
      await P.moveTo(n.x + 40, n.y + 60)
    },
    async act(P) {
      const { glidePath } = await cap()
      const T = clock(P, glidePath)
      await T.wait(6)
      const n = mid(await box(P, '[data-testid="layout-cycle-next"]'))
      await T.glide(n)
      await T.wait(3)
      for (let k = 0; k < 4; k++) {
        await T.to(T.f + (k ? 5 : 0))
        await T.click()
      }
      await T.wait(24)
    },
  },
  'c-fill': {
    reel: 'c',
    viewport: 'editor',
    about:
      'C5: W zoom, Fill book chip → Enter on the hero downbeat: every spread fills at once',
    targets: editorTargets([
      { name: 'chip', sel: FILL },
      { name: 'canvas', sel: '[data-testid="canvas"]' },
    ]),
    async setup(P) {
      await editorFull(P, 'p1', 'w')
      await placeOff(P, ROW_T7, mid(await box(P, FRAME, 0)))
      // no frame selection: the W shot is about the fill, not one frame's handles
      await P.page.keyboard.press('Escape')
      await P.settle(300)
      const c = mid(await box(P, FILL))
      await P.moveTo(c.x - 150, c.y - 110)
    },
    async act(P) {
      const { glidePath } = await cap()
      const T = clock(P, glidePath)
      const chip = mid(await box(P, FILL))
      await T.glide(chip)
      await T.wait(3)
      const start = T.f
      await T.click() // chip: popover
      // c.shots.js: chip on b11, Enter on b12 (the track's lift bar): 14 frames apart on this grid
      await T.to(start + 14)
      await P.key('Enter') // fill
      await T.wait(40)
    },
  },
  'c-cover': {
    reel: 'c',
    viewport: 'editor',
    about:
      'C6: the cover current (thumb 2 on the front, off camera, nothing selected); T7 (thumb 1, the shelf cover) dragged up from the strip onto the front board',
    targets: editorTargets([
      { name: 'cover', sel: COVER },
      { name: 'front', sel: `${COVER} [class*="group/front"]` },
    ]),
    async setup(P) {
      await editorFull(P, 'cover', null)
      await zoomBox(P, COVER, [900, 1000])
      await placeOff(P, ROW_FRONT, await coverFront(P))
      if (
        !(await P.page
          .locator(`${COVER} [class*="group/front"][data-photo-id]`)
          .count())
      )
        throw new Error('c-cover: the front has no photo after the setup')
      await deselect(P)
      const a = mid(await box(P, FILM, ROW_T7))
      await P.moveTo(a.x - 60, a.y - 70)
    },
    async act(P) {
      const { glidePath } = await cap()
      const T = clock(P, glidePath)
      const a = mid(await box(P, FILM, ROW_T7))
      await T.glide(a)
      await T.wait(2)
      await P.down()
      await T.wait(3)
      await T.glide({ x: a.x + 8, y: a.y - 12 }, 130)
      await T.glide(await coverFront(P), 800)
      await T.wait(3)
      await P.up()
      await T.wait(30)
    },
  },
  'c-print': {
    reel: 'c',
    viewport: 'editor',
    about:
      'C6: filled book, Print in the top bar → the print dialog → Export pressed; filming stops on the press, before the job runs',
    targets: editorTargets([
      { name: 'print', sel: '[data-testid="demo-print"]' },
      { name: 'printDialog', sel: '[data-testid="print-dialog"]' },
      { name: 'go', sel: '[data-testid="print-go"]' },
    ]),
    async setup(P) {
      // the cover gets its photo first (as C6 left it), so the dialog's Check has no "Front cover has no photo" row
      await editorFull(P, 'cover', null)
      await zoomBox(P, COVER, [900, 1000])
      await placeOff(P, ROW_T7, await coverFront(P))
      await deselect(P)
      await P.page.locator(FILL).first().click()
      await P.settle(500)
      await P.page.keyboard.press('Enter')
      await P.settle(900)
      // the dialog opens with a ~800 ms preflight check that shows a loader: that part stays off camera (§2: no
      // loader in frame), the clip starts once the check is done with the pointer still on the Print pill
      const p = mid(await box(P, '[data-testid="demo-print"]'))
      await P.moveTo(p.x, p.y)
      await P.page.mouse.click(p.x, p.y)
      await P.page.locator('[data-testid="print-go"]').waitFor()
      await P.page.waitForFunction(
        () =>
          !document.querySelector('.animate-spin, [class*="lucide-loader"]'),
      )
      await P.settle(400)
    },
    async act(P) {
      const { glidePath } = await cap()
      const T = clock(P, glidePath)
      await T.wait(4)
      const g = mid(await box(P, '[data-testid="print-go"]'))
      await T.glide(g)
      await T.wait(3)
      // down only: the export starts on release, so the clip ends on the pressed frame (spec §5 C6: cut before running)
      await P.down()
      await T.wait(7)
    },
  },
  'c-shelf': {
    reel: 'c',
    viewport: 'site',
    about:
      'C9–C12 + C1: site books=30 case (plates), the pointer lifts "Desert road", click: the room opens (cover 1000 ms), two clicked turns to pages 4–5, a slow 1300 ms drag turn back onto the full-bleed 2–3 (breath), the open book holds for the end card, then one clicked page turn (the C1 teaser)',
    targets: [
      { name: 'books', sel: BOOK, all: true },
      { name: 'desert', sel: `${BOOK}[data-kind="face"]` },
      { name: 'reader', sel: READER },
      { name: 'canvas', sel: '[data-testid="ps-reader-canvas"]' },
      PHOTO_SITE,
    ],
    async setup(P) {
      await shelfFeed(P)
      await P.page.goto(
        `${P.base}/index.html?theme=procreate-light#/full/personal-site?books=${SHELF_BOOKS}`,
      )
      await P.page.waitForSelector(BOOK)
      // no clipped lead line at the crop's top edge (C9 / C10): the lead keeps its place, the case does not move
      await P.page.addStyleTag({
        content: '[data-testid="site-lead"] { visibility: hidden; }',
      })
      await P.settle(1500)
      const books = await P.page.$$eval(BOOK, (els) =>
        els.map((e) => ({
          kind: e.getAttribute('data-kind'),
          label: e.getAttribute('aria-label'),
          text: e.textContent?.slice(0, 40),
        })),
      )
      console.log(`c-shelf books: ${JSON.stringify(books)}`)
      await P.moveTo(P.rest.x, P.rest.y)
    },
    async act(P) {
      const { glidePath } = await cap()
      const T = clock(P, glidePath)
      await T.wait(60) // the plate the C8 drops are cut from
      const face = mid(await box(P, `${BOOK}[data-kind="face"]`))
      await T.glide(face)
      // c.shots.js (SHELF): the click is reel b25 − 1, C10's last frame (clip frame 100, mapping + 255); C11 cuts in later in the take with
      // its own mapping, so the breath drag (b29) can follow the two turns past the title spread
      await T.to(100, 'shelf click') // hover lift until then
      await T.click()
      await T.wait(10)
      const r = await box(P, READER)
      const y = r.y + r.height * 0.5
      // the cover turns for 1000 ms (to ~130); two clicked turns (820 ms each) pass the title spread and the full-bleed
      // desert spread (2–3) to the framed 4–5, so the breath can turn back onto 2–3
      const turn = { x: r.x + r.width * 0.86, y: r.y + r.height * 0.62 }
      await T.glide(turn)
      await T.to(SHELF_OPEN_TURNS[0], 'turn to 2–3')
      await T.click()
      await T.to(SHELF_OPEN_TURNS[1], 'turn to 4–5')
      await T.click()
      const grab = { x: r.x + r.width * 0.14, y }
      await T.to(SHELF_BREATH - 3 - T.frames(grab), 'glide to the page')
      await T.glide(grab)
      await T.to(SHELF_BREATH, 'breath drag')
      await P.down()
      await T.glide({ x: r.x + r.width * 0.86, y }, 1300, 0.01)
      await P.up()
      // the end card plays over the open 2–3 (clip frames ~247–304); the hand stays off the pages until then
      await T.to(SHELF_TURN - 2 - T.frames(turn), 'end card hold')
      // C1 teaser: one clicked turn (820 ms) of the right page
      await T.glide(turn)
      await T.to(SHELF_TURN, 'teaser turn')
      await T.click()
      await T.wait(40)
    },
  },
}

// ---------------------------------------------------------------- --pack

const ROUND = (v) => Math.round(v * 10) / 10
const roundBox = (b) => (b ? b.map(ROUND) : null)
/** rects the reel reads; `all` targets keep their first few boxes */
const KEEP_ALL = 6
/** The targets c.shots.js reads, per clip (the rest stay in the full rects.json). */
const USED = {
  'c-open': ['choose', 'dialog', 'filmstrip'],
  'c-drop': ['frame', 'spread'],
  'c-layouts': ['next', 'pill', 'spread'],
  'c-fill': ['chip', 'spread', 'filmstrip', 'dialog', 'canvas'],
  'c-cover': ['front', 'cover'],
  'c-print': ['printDialog', 'dialog', 'go'],
  'c-shelf': ['books', 'desert', 'canvas', 'reader'],
}

function ffmpegBin() {
  if (process.env.FFMPEG) return process.env.FFMPEG
  const pnpmDir = path.resolve(HERE, '../motion/node_modules/.pnpm')
  const dir = fs.existsSync(pnpmDir)
    ? fs
        .readdirSync(pnpmDir)
        .find((d) => d.startsWith('@remotion+compositor-linux-x64-gnu'))
    : null
  if (!dir) throw new Error('no ffmpeg: set FFMPEG or install promo/motion')
  return path.join(
    pnpmDir,
    dir,
    'node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg',
  )
}

function pack() {
  const ffmpeg = ffmpegBin()
  const outDir = path.join(CLIPS_DIR, 'c')
  fs.mkdirSync(outDir, { recursive: true })
  const data = {}
  for (const id of Object.keys(WALKS_C)) {
    const dir = path.join(CLIPS_DIR, id)
    const read = (n) =>
      JSON.parse(fs.readFileSync(path.join(dir, `${id}.${n}`), 'utf8'))
    const meta = read('json')
    if (!meta.ok)
      throw new Error(
        `${id}: clip failed (${meta.failures.length}); re-capture`,
      )
    const rects = read('rects.json')
    const pointer = read('pointer.json')
    const dom = read('dom.json')
    const mp4 = path.join(outDir, `${id}.mp4`)
    const r = spawnSync(
      ffmpeg,
      [
        '-y',
        '-v',
        'error',
        '-framerate',
        '30',
        '-i',
        path.join(
          dir,
          'frames',
          `%06d.${meta.frameFiles.endsWith('png') ? 'png' : 'jpg'}`,
        ),
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '14',
        // a keyframe every half second: Remotion seeks each frame, and a far seek in a 3840×4320 clip with x264's
        // default 250-frame GOP decodes past its 28 s delayRender timeout on a loaded machine
        '-g',
        '15',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        mp4,
      ],
      {
        env: { ...process.env, LD_LIBRARY_PATH: path.dirname(ffmpeg) },
        encoding: 'utf8',
      },
    )
    if (r.status !== 0)
      throw new Error(`${id}: ffmpeg failed: ${r.stderr || r.error}`)
    // DPR-1 copy for the motion-blur frames only (ReelC `lo`): 10 blur samples of the 3840×4320 clip cost ≈ 40 s a
    // frame in Remotion (its 30 s per-frame timeout); under a 1600 px whip the blurred picture can't show the difference.
    const lo = spawnSync(
      ffmpeg,
      [
        '-y',
        '-v',
        'error',
        '-i',
        mp4,
        '-vf',
        `scale=${meta.viewport.width}:${meta.viewport.height}:flags=area`,
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '16',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        path.join(outDir, `${id}.lo.mp4`),
      ],
      {
        env: { ...process.env, LD_LIBRARY_PATH: path.dirname(ffmpeg) },
        encoding: 'utf8',
      },
    )
    if (lo.status !== 0)
      throw new Error(`${id}: ffmpeg (lo) failed: ${lo.stderr || lo.error}`)
    const frames = rects.frames.map((fr, k) => ({
      ...fr,
      busy: dom.frames[k]?.bad ?? ['no DOM log'],
    }))
    fs.writeFileSync(
      path.join(outDir, `${id}.rects.json`),
      JSON.stringify({ ...rects, frames }) + '\n',
    )
    const names = rects.targets
      .map((t) => t.name)
      .filter((n) => USED[id].includes(n))
    data[id] = {
      frames: meta.frames,
      vp: [meta.viewport.width, meta.viewport.height],
      events: pointer.events.map((e) => [
        e.f,
        e.type,
        ROUND(e.x),
        ROUND(e.y),
        e.key ?? null,
      ]),
      ptr: pointer.frames.map((p) => [ROUND(p.x), ROUND(p.y), p.down ? 1 : 0]),
      rects: Object.fromEntries(
        names.map((n) => {
          const all = rects.targets.find((t) => t.name === n).all
          // run-length: [[first frame, box], …], a new entry only when the box changes
          const runs = []
          for (const fr of rects.frames) {
            const v = all
              ? (fr.rects[n] ?? []).slice(0, KEEP_ALL).map(roundBox)
              : roundBox(fr.rects[n])
            const last = runs.at(-1)
            if (!last || JSON.stringify(last[1]) !== JSON.stringify(v))
              runs.push([fr.f, v])
          }
          return [n, runs]
        }),
      ),
    }
    console.log(
      `${id}: ${meta.frames} frames → ${path.relative(process.cwd(), mp4)} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB)`,
    )
  }
  const src = fs.readFileSync(SHOTS, 'utf8')
  const open = '// <clip-data generated by promo/reels/walks-c.mjs --pack>'
  const close = '// </clip-data>'
  const a = src.indexOf(open)
  const b = src.indexOf(close)
  if (a < 0 || b < a)
    throw new Error(`c.shots.js has no ${open} … ${close} block`)
  const lines = Object.entries(data).map(
    ([id, d]) => `  '${id}': ${JSON.stringify(d)},`,
  )
  const block = `${open}\n// prettier-ignore\nexport const CLIP_DATA = {\n${lines.join('\n')}\n}\n`
  fs.writeFileSync(SHOTS, src.slice(0, a) + block + src.slice(b))
  console.log(`c.shots.js: CLIP_DATA for ${lines.length} clips`)
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  if (process.argv.includes('--pack')) pack()
  else
    console.log(
      'usage: node promo/reels/walks-c.mjs --pack (film first: node promo/reels/capture.mjs --clip <id>,…)',
    )
}

// Reel C «Без ожидания» capture walks (promo-reels-3 spec §5): the clip entries capture.mjs spreads into CLIPS, plus
// `--pack`, which turns the filmed clips into what the Remotion side reads.
//
//   node promo/reels/capture.mjs --clip c-open,c-drop,c-layouts,c-fill-undo,c-cover,c-print,c-shelf
//   node promo/reels/walks-c.mjs --pack
//
// Every walk is real time on the capture clock. The reel cuts hard on its beat grid (14 frames), so a walk only has to
// keep the spacing between its own actions on the grid (multiples of 7 frames); c.shots.js lines the clip up with the
// beat by its pointer events. One action per clip: a hard cut between clips needs no continuity of the pointer.
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

/** Front board of the cover sheet: the right part of `cover-sheet` (back | spine | front). */
async function coverFront(P) {
  const b = await box(P, COVER)
  return { x: b.x + b.width * 0.76, y: b.y + b.height * 0.5 }
}

const editorTargets = (extra = []) => [
  { name: 'spread', sel: SPREAD },
  { name: 'frame', sel: FRAME, all: true },
  { name: 'filmstrip', sel: '[data-testid="filmstrip"]' },
  { name: 'row', sel: FILM, all: true },
  { name: 'dialog', sel: '[role=dialog]' },
  ...extra,
]

/** The reel's rows: thumb 1 = T7 (the working book's cover photo), thumb 6 = T14 (photos.json set order). */
const ROW_T7 = 0
const ROW_T14 = 5

export const WALKS_C = {
  'c-open': {
    reel: 'c',
    viewport: 'editor',
    about:
      'C1: the pointer on Choose in the 412-photo folder picker, click on frame 3 (strip full on the next frame), glide to the strip, a fast wheel flick through it',
    targets: editorTargets([
      { name: 'choose', sel: '[role=dialog] button:last-of-type' },
    ]),
    async setup(P) {
      const c = await cap()
      await c.editorBook(P, 'c')
      await P.page.locator('[data-testid="demo-add-folder"]').first().click()
      await P.settle(600)
      const b = await P.center(c.chooseButton(P.page))
      await P.moveTo(b.x, b.y)
    },
    async act(P) {
      const { glidePath } = await cap()
      const T = clock(P, glidePath)
      await T.to(3)
      await T.click()
      await T.wait(3)
      const s = await box(P, '[data-testid="filmstrip"]')
      await T.glide({ x: s.x + s.width * 0.62, y: s.y + s.height * 0.55 })
      // the flick: one wheel notch per frame, fast then easing off (a human fling on a trackpad)
      for (const dy of [
        180, 360, 520, 600, 600, 520, 420, 320, 240, 160, 100, 60,
      ]) {
        await P.page.mouse.wheel(0, dy)
        await T.wait(1)
      }
      await T.wait(20)
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
      const to = mid(await box(P, FRAME, 0))
      await T.glide(to, 800)
      await T.wait(3)
      await P.up()
      await T.wait(30)
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
      const n = mid(await box(P, '[data-testid="layout-cycle-next"]'))
      await P.moveTo(n.x + 40, n.y + 60)
    },
    async act(P) {
      const { glidePath } = await cap()
      const T = clock(P, glidePath)
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
  'c-fill-undo': {
    reel: 'c',
    viewport: 'editor',
    about:
      'C4: W zoom, Fill book chip → Enter (every spread fills), Ctrl+Z (all empty again), chip → Enter (fills again)',
    targets: editorTargets([
      { name: 'chip', sel: FILL },
      { name: 'canvas', sel: '[data-testid="canvas"]' },
    ]),
    async setup(P) {
      await editorFull(P, 'p1', 'w')
      await placeOff(P, ROW_T7, mid(await box(P, FRAME, 0)))
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
      await T.to(start + 14)
      await P.key('Enter') // fill
      await T.to(start + 28)
      await P.key('Control+z') // undo
      await T.to(start + 35)
      await T.click() // chip again
      await T.to(start + 42)
      await P.key('Enter') // fill again
      await T.wait(24)
    },
  },
  'c-cover': {
    reel: 'c',
    viewport: 'editor',
    about:
      'C5: the cover current (T7 on the front, off camera); T14 (thumb 6) dragged up from the strip onto the front board',
    targets: editorTargets([
      { name: 'cover', sel: COVER },
      { name: 'front', sel: `${COVER} [class*="group/front"]` },
    ]),
    async setup(P) {
      await editorFull(P, 'cover', null)
      await zoomBox(P, COVER, [900, 1000])
      await placeOff(P, ROW_T7, await coverFront(P))
      await P.moveTo(P.rest.x, P.rest.y)
      await P.settle(300)
      const a = mid(await box(P, FILM, ROW_T14))
      await P.moveTo(a.x - 60, a.y - 70)
    },
    async act(P) {
      const { glidePath } = await cap()
      const T = clock(P, glidePath)
      const a = mid(await box(P, FILM, ROW_T14))
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
      await editorFull(P, 'p1', 'md')
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
      await T.wait(2)
    },
  },
  'c-shelf': {
    reel: 'c',
    viewport: 'site',
    about:
      'C8–C11: site books=6 case (plates), the pointer lifts "Desert road", click: the room opens (cover 1000 ms), a slow 1300 ms drag turn (breath), then the open book holds for the end card',
    targets: [
      { name: 'books', sel: BOOK, all: true },
      { name: 'desert', sel: `${BOOK}[data-kind="face"]` },
      { name: 'reader', sel: READER },
      { name: 'canvas', sel: '[data-testid="ps-reader-canvas"]' },
    ],
    async setup(P) {
      await P.page.goto(
        `${P.base}/index.html?theme=procreate-light#/full/personal-site?books=6`,
      )
      await P.page.waitForSelector(BOOK)
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
      // c.shots.js: the click is reel b23 and the breath drag b26.5 on one mapping (clip frame + 222), so the
      // click is clip frame 100 and the drag starts 49 frames later; the hand heads for the page while the cover opens
      await T.to(100, 'shelf click') // hover lift until then
      await T.click()
      await T.wait(10)
      const r = await box(P, READER)
      const y = r.y + r.height * 0.5
      const grab = { x: r.x + r.width * 0.88, y }
      await T.to(149 - 3 - T.frames(grab), 'glide to the page')
      await T.glide(grab)
      await T.to(149, 'breath drag')
      await P.down()
      await T.glide({ x: r.x + r.width * 0.14, y }, 1300, 0.01)
      await P.up()
      await T.wait(100) // the end card plays over the open book
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
  'c-fill-undo': ['chip', 'spread', 'filmstrip', 'dialog'],
  'c-cover': ['front'],
  'c-print': ['printDialog', 'dialog'],
  'c-shelf': ['books', 'desert'],
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

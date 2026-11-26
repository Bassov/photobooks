// Promo video, step 1 of 2: record the real kit interactions as DPR-2 clips for the motion step (promo-video-motion).
// Usage: `pnpm uikit:build && node promo/capture.mjs [16x9|9x16 …]` → promo/out/clips/<format>/<NN-scene>.webm, a
// contact sheet promo/out/contact-sheet.png and promo/out/clips.json. See promo/README.md.
//
// How the clips reach DPR 2 at a steady 30 fps: Playwright's recordVideo (and the CDP screencast under its
// deviceScaleFactor emulation) delivers CSS-pixel frames (1440×900, padded grey to the video size), and a device-pixel
// screencast runs at only 3–10 fps here. So the browser runs with --force-device-scale-factor=2 and every clip is filmed
// frame by frame: the page clock (performance.now, Date, rAF time, timers, event timestamps, CSS / Web Animations) is
// stopped while a clip records, moved on by exactly 1/30 s, and a 2× screenshot is taken. The animations play at their
// real speed in the clip and nothing is zeroed; the run time only depends on the screenshot speed.
// The walk follows uikit/scripts/demo-capture.mjs (same selectors and order of the editor steps).
//
// `--stills` (carousel step, promo-carousel/spec.md «Tooling → Stills»): the same walk at --force-device-scale-factor=3,
// still on the frame-stepped clock but with no per-frame screenshots and no encoding; one lossless PNG per scene at its
// end-HOLD frame (Fill book: with its popover open) → promo/out/stills/<format>/<NN-scene>.png + promo/out/stills/stills.json.
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.dirname(new URL(import.meta.url).pathname)
const DIST = path.join(ROOT, '../uikit/dist')
const OUT = path.join(ROOT, 'out')
const ARGS = process.argv.slice(2)
const STILLS = ARGS.includes('--stills')
// device pixels per CSS pixel: 2 for clips; 3 for stills, so that no carousel crop is upscaled more than 1.1×
// (spec rule: crop CSS width × 3 ≥ 0.9 × box width)
const DSF = STILLS ? 3 : 2
const FPS = 30
const DT = 1000 / FPS
const HOLD = 500 // ms of still picture before and after each interaction (cut handles for the motion step)
const FIXED = Date.UTC(2026, 9, 29, 12, 0, 0) // same fixed date as demo-capture.mjs
const T0 = Date.now()
const log = (m) =>
  console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(3)} s] ${m}`)

// Spec «Layout values»: 16:9 = the 1440×900 kit window; 9:16 = the 900×860 window (editor scenes) and the 700×1000
// phone card (site scenes), filmed as a 390 px wide phone screen of the card's aspect (390×557).
const FORMATS = {
  '16x9': {
    app: { width: 1440, height: 900 },
    site: { width: 1440, height: 900, mobile: false },
  },
  '9x16': {
    app: { width: 900, height: 860 },
    site: { width: 390, height: 557, mobile: true },
  },
}

// Licences: only the CC0 sample photos p01–p21 (uikit/dist/photos/credits.json). photos/hi/* has no credits.json entry
// (and hi/c18 is the welcome fog photo, CC BY-SA): the server answers every photos/hi/<id>.jpg with a CC0 photo.
export const HI_SWAP = {
  c13: 'p05',
  c18: 'p09',
  c18b: 'p10',
  c25: 'p12',
  r2: 'p14',
  r6: 'p16',
  r7: 'p17',
  r8: 'p20',
  'x-tatra': 'p02',
  'x-valley': 'p21',
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webm': 'video/webm',
}
// The kit over http, not file://: the site's GL book needs a module import, which file:// blocks (gl/three.ts glWanted).
// /out/ serves promo/out for the contact sheet (same origin, so its canvas can be read back).
// SERVED: every image file the pages received (after the swap) and every hi photo asked for, for the licence check.
const SERVED = { images: new Set(), hiAsked: new Set() }
function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const hi = p.match(/^\/photos\/hi\/([\w-]+)\.jpg$/)
    if (hi) {
      SERVED.hiAsked.add(hi[1])
      p = `/photos/${HI_SWAP[hi[1]] ?? 'p01'}.jpg`
    }
    if (/\.(jpe?g|png|webp|avif|gif)$/i.test(p) && !p.startsWith('/out/'))
      SERVED.images.add(p)
    const file = p.startsWith('/out/')
      ? path.join(OUT, p.slice(5))
      : path.join(DIST, p === '/' ? 'index.html' : p)
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
      })
      res.end(buf)
    })
  })
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)))
}

// The page clock, installed before the kit's scripts. Real mode: virtual time follows the real clock. Film mode: it
// stands still until __advance(ms) moves it (due timers fire in order, running animations move on by ms).
function clockInit([fixed]) {
  const pn = performance.now.bind(performance)
  const nst = window.setTimeout.bind(window),
    nsi = window.setInterval.bind(window)
  let film = false,
    vt = pn(),
    rb = pn()
  const now = () => (film ? vt : vt + (pn() - rb))
  const start = now()
  const timers = new Map()
  let ids = 1
  const add = (f, ms, a, every) => {
    const id = ids++
    const d = Math.max(0, Number(ms) || 0)
    timers.set(id, { due: now() + d, f, a, every: every ? Math.max(1, d) : 0 })
    return id
  }
  // fire every timer due at or before `until`, earliest first, with the clock set to its due time
  const run = (until, setClock) => {
    for (;;) {
      let next
      for (const [id, t] of timers)
        if (t.due <= until && (!next || t.due < next[1].due)) next = [id, t]
      if (!next) return
      const [id, t] = next
      if (setClock) vt = Math.max(vt, t.due)
      if (t.every) t.due += t.every
      else timers.delete(id)
      try {
        if (typeof t.f === 'function') t.f(...t.a)
      } catch (e) {
        nst(() => {
          throw e
        })
      }
    }
  }
  nsi(() => {
    if (!film) run(now(), false)
  }, 4)
  window.setTimeout = (f, ms, ...a) => add(f, ms, a, false)
  window.setInterval = (f, ms, ...a) => add(f, ms, a, true)
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id)
  performance.now = now
  const D = Date
  class FD extends D {
    constructor(...a) {
      super(...(a.length ? a : [FD.now()]))
    }
    static now() {
      return Math.round(fixed + now() - start)
    }
  }
  window.Date = FD
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => raf(() => cb(now()))
  Object.defineProperty(Event.prototype, 'timeStamp', {
    get: () => now(),
    configurable: true,
  })
  let s = 42
  Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647
  window.__film = (on) => {
    if (on && !film) vt = now()
    if (!on && film) rb = pn()
    film = on
    for (const a of document.getAnimations()) {
      if (on && a.playState === 'running') hold(a)
      // a held animation resumes where it stands (play() on one at its end would rewind it)
      if (!on && a.__promo) ((a.__promo = false), a.play())
    }
  }
  const hold = (a) => {
    a.pause()
    a.__promo = true
  }
  window.__advance = (ms) => {
    const until = vt + ms
    run(until, true)
    vt = until
    // animations started since the last frame are held on their first frame, then moved on with the clock;
    // one that reaches its end is finished, so its `finished` promise and end events fire (exit animations wait on them)
    for (const a of document.getAnimations()) {
      if (!a.__promo && a.playState === 'running') hold(a)
      if (!a.__promo || a.playState !== 'paused') continue
      const t = (a.currentTime ?? 0) + ms
      if (t >= (a.effect?.getComputedTiming().endTime ?? Infinity)) {
        a.__promo = false
        a.finish()
      } else a.currentTime = t
    }
  }
}

// A visible cursor (headless screenshots have none); pointer-events: none, so it never takes a hit test.
function cursorInit() {
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div')
    c.id = 'promo-cursor'
    c.style.cssText =
      'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;display:none'
    c.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.5 14 L10.5 20.5 L13 19.4 L10.1 13 L16 13 Z" fill="#1A1918" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    document.documentElement.append(c)
    const at = (e) => {
      if (e.pointerType !== 'mouse') return
      c.style.display = 'block'
      c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`
    }
    addEventListener('pointermove', at, true)
    addEventListener('pointerdown', at, true)
    // during an HTML drag-and-drop the page gets drag events instead of pointer moves
    addEventListener(
      'dragover',
      (e) =>
        at({ pointerType: 'mouse', clientX: e.clientX, clientY: e.clientY }),
      true,
    )
  })
}

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG
  const base =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(os.homedir(), '.cache/ms-playwright')
  const dir =
    fs.existsSync(base) &&
    fs
      .readdirSync(base)
      .filter((d) => d.startsWith('ffmpeg-'))
      .sort()
      .at(-1)
  const bin =
    dir &&
    ['ffmpeg-linux', 'ffmpeg-mac', 'ffmpeg-win64.exe']
      .map((f) => path.join(base, dir, f))
      .find((f) => fs.existsSync(f))
  if (!bin)
    throw new Error(
      'ffmpeg not found: run `pnpm exec playwright install ffmpeg` or set FFMPEG',
    )
  return bin
}

// One JPEG per output frame → VP9 webm at 30 fps (Playwright's own ffmpeg build: image2pipe + mjpeg + libvpx-vp9).
function encode(frames, file) {
  const ff = spawn(
    ffmpegPath(),
    [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'image2pipe',
      '-c:v',
      'mjpeg',
      '-framerate',
      String(FPS),
      '-i',
      'pipe:0',
      '-an',
      '-c:v',
      'libvpx-vp9',
      '-pix_fmt',
      'yuv420p',
      '-b:v',
      '16M',
      '-deadline',
      'realtime',
      '-cpu-used',
      '6',
      '-row-mt',
      '1',
      '-threads',
      '4',
      '-tile-columns',
      '2',
      file,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  const done = new Promise((ok, ko) =>
    ff.on('exit', (c) => (c ? ko(new Error(`ffmpeg ${c} on ${file}`)) : ok())),
  )
  ;(async () => {
    for (const buf of frames)
      if (!ff.stdin.write(buf))
        await new Promise((ok) => ff.stdin.once('drain', ok))
    ff.stdin.end()
  })()
  return done
}

async function main() {
  const only = ARGS.filter((a) => !a.startsWith('--'))
  if (!fs.existsSync(path.join(DIST, 'index.html')))
    throw new Error('uikit/dist missing: run `pnpm uikit:build` first')
  const srv = await serve()
  const BASE = `http://127.0.0.1:${srv.address().port}`
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: [
      '--no-sandbox',
      `--force-device-scale-factor=${DSF}`,
      '--window-size=1440,900',
      '--font-render-hinting=none',
      '--force-color-profile=srgb',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
    ],
  })
  const clips = [],
    encodes = [],
    stills = []
  try {
    for (const [fmt, cfg] of Object.entries(FORMATS)) {
      if (only.length && !only.includes(fmt)) continue
      const dir = path.join(OUT, 'clips', fmt)
      const stillDir = path.join(OUT, 'stills', fmt)
      if (STILLS) fs.rmSync(stillDir, { recursive: true, force: true })
      else {
        fs.rmSync(dir, { recursive: true, force: true })
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.mkdirSync(stillDir, { recursive: true })
      for (const part of [editorWalk, siteWalk])
        await part({
          browser,
          BASE,
          fmt,
          cfg,
          dir,
          stillDir,
          clips,
          encodes,
          stills,
        })
    }
    if (!STILLS) {
      await Promise.all(encodes)
      log('encoded')
      await contactSheet(browser, BASE, clips)
    }
  } finally {
    await browser.close()
    srv.close()
  }
  if (STILLS) return writeStills(stills)
  fs.writeFileSync(
    path.join(OUT, 'clips.json'),
    JSON.stringify(clips, null, 1) + '\n',
  )
  for (const c of clips)
    console.log(`${c.file}  ${c.width}×${c.height}  ${c.duration.toFixed(2)} s`)
  log(
    `done: ${clips.length} clips, contact sheet ${path.relative(process.cwd(), path.join(OUT, 'contact-sheet.png'))}`,
  )
}

// promo/out/stills/stills.json for the carousel render step; a run of one format keeps the other format's entries.
// Then the licence check: every image the pages were served, and the hi photos that were asked for (all swapped).
function writeStills(stills) {
  const file = path.join(OUT, 'stills', 'stills.json')
  const ran = new Set(stills.map((s) => s.format))
  const kept = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8')).filter(
        (s) => !ran.has(s.format),
      )
    : []
  const all = [...kept, ...stills].sort((a, b) => a.file.localeCompare(b.file))
  fs.writeFileSync(file, JSON.stringify(all, null, 1) + '\n')
  for (const s of stills)
    console.log(`${s.file}  ${s.width}×${s.height}  DSF ${s.dsf}`)
  const images = [...SERVED.images].sort()
  const bad = images.filter((p) => /^\/photos\/hi\//.test(p))
  console.log(`images served: ${images.join(' ')}`)
  console.log(
    `hi photos asked for (each served as its CC0 swap): ${[...SERVED.hiAsked].sort().join(' ') || 'none'}`,
  )
  if (bad.length) throw new Error(`hi photos served unswapped: ${bad}`)
  log(`done: ${stills.length} stills, ${path.relative(process.cwd(), file)}`)
}

// PNG size from its IHDR chunk (bytes 16–23), so stills.json reports what was written.
const pngSize = (file) => {
  const b = fs.readFileSync(file)
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
}

// One page with its own CDP session: metrics override (CSS size; DPR stays the forced DSF), clock, cursor, film helpers.
async function openPage(browser, vp, ctl) {
  const ctx = await browser.newContext({
    viewport: null,
    locale: 'en-US',
    timezoneId: 'UTC',
    hasTouch: !!vp.mobile,
  })
  await ctx.addInitScript(clockInit, [FIXED])
  if (!vp.mobile) await ctx.addInitScript(cursorInit)
  const page = await ctx.newPage()
  // at DSF 3 the site's software-GL book renders 2.25× the pixels: a frame can take seconds
  page.setDefaultTimeout(STILLS ? 60000 : 8000)
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 0,
    mobile: !!vp.mobile,
  })
  if (vp.mobile)
    await cdp.send('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  let frames = null // the clip being filmed, or null (real time)
  const cost = { step: 0, shot: 0 }
  // page time: film frames while a clip records, else wait in real time
  const wait = async (ms) => {
    if (!frames) return page.waitForTimeout(ms)
    for (let i = Math.max(1, Math.round(ms / DT)); i > 0; i--) {
      const t = Date.now()
      // one rendering frame after the step, so React's work from the fired timers is on screen
      await page.evaluate(
        (dt) =>
          new Promise((ok) => {
            window.__advance(dt)
            requestAnimationFrame(() => ok())
          }),
        DT,
      )
      const t1 = Date.now()
      if (STILLS) {
        // stills: the clock still steps frame by frame (same picture as the clip), but only the end frame is kept
        frames.push(null)
        cost.step += t1 - t
        continue
      }
      const r = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 92,
        optimizeForSpeed: true,
      })
      frames.push(Buffer.from(r.data, 'base64'))
      cost.step += t1 - t
      cost.shot += Date.now() - t1
    }
  }
  const settle = async (ms = 350) => {
    await wait(ms)
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(
        [...document.images]
          .filter((i) => !i.complete)
          .map(
            (i) =>
              new Promise((r) => {
                i.onload = i.onerror = r
              }),
          ),
      )
    })
  }
  const rest = { x: vp.width - 40, y: vp.height - 40 }
  let at = rest
  // pointer path, eased, one move per frame
  const glide = async (x, y, ms = 500) => {
    const n = Math.max(2, Math.round(ms / DT)),
      from = at
    for (let i = 1; i <= n; i++) {
      const e = 0.5 - Math.cos((Math.PI * i) / n) / 2
      await page.mouse.move(
        from.x + (x - from.x) * e,
        from.y + (y - from.y) * e,
      )
      await wait(DT)
    }
    at = { x, y }
  }
  const center = async (loc) => {
    const b = await loc.boundingBox()
    if (!b) throw new Error('no box')
    return {
      x: Math.round(b.x + b.width / 2),
      y: Math.round(b.y + b.height / 2),
    }
  }
  const press = async (loc) => {
    const p = await center(loc)
    await glide(p.x, p.y, 450)
    await wait(100)
    await page.mouse.down()
    await wait(70)
    await page.mouse.up()
  }
  const drag = async (from, to, ms = 900) => {
    const a = await center(from)
    await glide(a.x, a.y, 450)
    await page.mouse.down()
    await wait(100)
    await glide(a.x + 12, a.y - 8, 130)
    const b = await center(to)
    await glide(b.x, b.y, ms)
    await wait(130)
    await page.mouse.up()
  }
  const touch = (type, pts) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: pts.map(([x, y]) => ({ x, y })),
    })
  // one finger from a to b, eased, one move per frame
  const swipe = async (a, b, ms = 400) => {
    await touch('touchStart', [[a.x, a.y]])
    const n = Math.round(ms / DT)
    for (let i = 1; i <= n; i++) {
      await wait(DT)
      const e = 0.5 - Math.cos((Math.PI * i) / n) / 2
      const x = Math.round(a.x + (b.x - a.x) * e)
      await touch('touchMove', [[x, Math.round(a.y + (b.y - a.y) * e)]])
    }
    await touch('touchEnd', [])
  }
  const tap = async (loc) => {
    const p = await center(loc)
    await touch('touchStart', [[p.x, p.y]])
    await wait(70)
    await touch('touchEnd', [])
  }
  // stills: one lossless PNG of the viewport (or of `loc`) as it stands, without the cursor overlay
  const snap = async (scene, loc) => {
    const file = path.join(ctl.stillDir, `${scene}.png`)
    await page.evaluate(() => {
      const c = document.getElementById('promo-cursor')
      if (c) c.style.visibility = 'hidden'
    })
    if (loc) await loc.screenshot({ path: file })
    else {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'))
    }
    await page.evaluate(() => {
      const c = document.getElementById('promo-cursor')
      if (c) c.style.visibility = ''
    })
    ctl.stills.push({
      format: ctl.fmt,
      scene,
      file: path.relative(ROOT, file),
      ...pngSize(file),
      dsf: DSF,
    })
    log(`${ctl.fmt}/${scene}: still ${path.relative(ROOT, file)}`)
  }
  // one clip: HOLD still, the interaction, HOLD still. Stills mode: the PNG is the end-HOLD frame, unless the scene
  // calls `still()` earlier (Fill book: the popover is the picture, not the spreads after it).
  const record = async (scene, act) => {
    const t = Date.now()
    frames = []
    cost.step = cost.shot = 0
    let snapped = false
    const still = async () => {
      if (STILLS && !snapped) await snap(scene)
      snapped = true
    }
    await page.evaluate(() => window.__film(true))
    await wait(HOLD)
    await act(still)
    await wait(HOLD)
    if (STILLS) await still()
    const shot = frames
    frames = null
    await page.evaluate(() => window.__film(false))
    if (STILLS) return
    const out = path.join(ctl.dir, `${scene}.webm`)
    const clip = {
      format: ctl.fmt,
      scene,
      file: path.relative(ROOT, out),
      width: vp.width * DSF,
      height: vp.height * DSF,
      duration: shot.length / FPS,
      frames: shot.length,
    }
    ctl.clips.push(clip)
    ctl.encodes.push(encode(shot, out))
    log(
      `${ctl.fmt}/${scene}: ${shot.length} frames (${clip.duration.toFixed(2)} s) in ${((Date.now() - t) / 1000).toFixed(0)} s` +
        ` (per frame: step ${Math.round(cost.step / shot.length)} ms, shot ${Math.round(cost.shot / shot.length)} ms)`,
    )
  }
  return {
    ctx,
    page,
    errs,
    wait,
    settle,
    glide,
    center,
    press,
    drag,
    swipe,
    tap,
    record,
    snap,
    rest,
  }
}

// Scenes 2–5 on #/demo: the demo-capture.mjs walk up to the new book, then the promo interactions.
async function editorWalk(ctl) {
  const { browser, BASE, fmt, cfg } = ctl
  const P = await openPage(browser, cfg.app, ctl)
  const { page, settle, wait, glide, press, drag, record, rest } = P
  const c = (sel) => page.locator(sel).first().click()
  const row = (i) =>
    page.locator('[data-testid="filmstrip"] [role="row"]').nth(i)
  // demo-capture drags row 5; in the 900 px window the strip is narrower, so take the first row from `want` down to 2
  // whose centre hit-tests to the row itself (not the inspector over it)
  const shownRow = async (want) => {
    for (let i = want; i >= 2; i--) {
      const hit = await row(i).evaluate((el) => {
        const b = el.getBoundingClientRect()
        return el.contains(
          document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
        )
      })
      if (hit) return row(i)
    }
    return row(2)
  }
  const FRAME = '[data-testid="canvas"] [data-current] [data-testid="frame"]'
  await page.goto(`${BASE}/index.html?theme=procreate-light#/demo`)
  await page.evaluate(() => window.__demo.reset())
  await settle(600)
  // off camera, in real time: library, book "Lake trip" (demo-capture steps 2–8)
  await c('[data-testid="create-library"]')
  await settle()
  await c('[data-testid="picker-select"]')
  await settle()
  await c('[data-testid="demo"] [data-testid="new-book"]')
  await settle()
  await page.locator('[role=dialog] input').first().fill('Lake trip')
  await c('[data-testid="create-book"]')
  await settle(600)
  await page.mouse.move(rest.x, rest.y)

  // 02: Add folder… → the folder picker → Choose: the filmstrip fills
  await record('02-add-folder', async () => {
    await press(page.locator('[data-testid="demo-add-folder"]'))
    await settle(600)
    await press(
      page
        .locator('[role=dialog]')
        .getByRole('button', { name: /Choose|Select|Use|Add/i })
        .last(),
    )
    await settle(1200)
    await glide(rest.x, rest.y, 500)
  })
  // 05 is filmed here (the walk's order): row 3's photo goes on the cover off camera, then the title types in at 60 ms/letter
  await c('[data-item="cover"]')
  await settle(250)
  await row(3).dragTo(page.locator('[data-testid="cover-front"]'))
  await settle(450)
  if (!(await page.locator('[data-testid="cover-text-front"]').count())) {
    await c('[data-item="cover"]')
    await settle(250)
  }
  await page.mouse.move(rest.x, rest.y)
  await settle(300)
  await record('05-cover-title', async () => {
    const title = page.locator('[data-testid="cover-text-front"]')
    await press(title)
    await wait(200)
    await title.selectText()
    for (const ch of 'Lake trip 2026') {
      await page.keyboard.type(ch)
      await wait(60)
    }
    await wait(300)
    await title.blur()
    await glide(rest.x, rest.y, 500)
    await settle(500)
  })
  const cover = page.locator('[data-testid="cover-front"]')
  if (STILLS) await P.snap('08-end-cover', cover)
  else
    await cover.screenshot({
      path: path.join(ctl.stillDir, '08-end-cover.png'),
    })
  // 03: a filmstrip thumbnail dragged into spread 1's frame
  await c('[data-item="p1"]')
  await settle(400)
  await record('03-drop-in-frame', async () => {
    await drag(await shownRow(5), page.locator(FRAME).first(), 900)
    await settle(700)
    await glide(rest.x, rest.y, 500)
  })
  await settle(2600) // the drop's status line clears
  // 04: the Fill book chip → its popover → Enter fills every spread; then one spread per beat (0.5 s) for the montage
  await record('04-fill-book', async (still) => {
    await press(
      page.locator('[data-testid="demo"] [data-testid="film-fill-book"]'),
    )
    await settle(700)
    await still() // the carousel's picture: the popover open over the spread
    await page.keyboard.press('Enter')
    await settle(900)
    for (const s of ['p2', 'p3', 'p4', 'p5']) {
      const it = page.locator(`[data-item="${s}"]`)
      if (await it.count()) {
        await press(it)
        await wait(330)
      }
    }
    await settle(300)
  })
  if (P.errs.length) console.warn(`${fmt} editor page errors:`, P.errs)
  await P.ctx.close()
}

// Scenes 6–7 on the personal site (12 books): shelf hover (desktop) / shelf scroll (phone); open a book, one turn / one swipe.
async function siteWalk(ctl) {
  const { browser, BASE, fmt, cfg } = ctl
  const vp = cfg.site
  const P = await openPage(browser, vp, ctl)
  const { page, settle, wait, glide, center, record, swipe, tap, rest } = P
  await page.goto(
    `${BASE}/index.html?theme=procreate-light#/full/personal-site?books=12`,
  )
  await page.waitForSelector('[data-testid="ss9-book"]')
  await settle(1500)
  const face = page
    .locator('[data-testid="ss9-book"][data-kind="face"]')
    .first()
  if (!vp.mobile) {
    await page.mouse.move(rest.x, rest.y)
    // 06: the pointer runs along the spines (each lifts) and rests on the face-out book (D18 lift)
    await record('06-site-shelf', async () => {
      const spines = page.locator('[data-testid="ss9-book"][data-kind="spine"]')
      const n = await spines.count()
      const a = await center(spines.nth(Math.min(5, n - 1)))
      await glide(a.x, a.y, 600)
      const b = await center(face)
      await glide(b.x, b.y, 700)
      await settle(900)
    })
    // 07: click → the reading room opens (the cover turns), one page turn by a click on the right page
    await record('07-book-turn', async () => {
      await page.mouse.down()
      await wait(70)
      await page.mouse.up()
      await settle(1500)
      const b = await page.locator('[data-testid="ps-reader"]').boundingBox()
      await glide(
        Math.round(b.x + b.width * 0.8),
        Math.round(b.y + b.height * 0.55),
        500,
      )
      await wait(150)
      await page.mouse.down()
      await wait(70)
      await page.mouse.up()
      await settle(1100)
    })
    const gl = await page.locator('[data-testid="site-room"] canvas').count()
    log(`${fmt} reading room: ${gl ? 'GL book' : 'CSS book (no WebGL2)'}`)
  } else {
    // 06: phones have no hover; the shelf scrolls a little under the thumb
    await record('06-site-shelf', async () => {
      await wait(300)
      const x = Math.round(vp.width / 2)
      const y = (f) => Math.round(vp.height * f)
      await swipe({ x, y: y(0.75) }, { x, y: y(0.45) }, 600)
      await settle(1000)
    })
    await page.evaluate(() =>
      document.querySelector('.ss-scroll')?.scrollTo(0, 0),
    )
    await settle(400)
    // 07: tap the face-out book → the reading room; one swipe turns the page
    await record('07-book-swipe', async () => {
      await tap(face)
      await settle(1500)
      const st = await page
        .locator('[data-testid="pt-stage"], [data-testid="ps-strip"]')
        .first()
        .boundingBox()
      const y = Math.round(st.y + st.height * 0.5)
      const x = (f) => Math.round(st.x + st.width * f)
      await swipe({ x: x(0.85), y }, { x: x(0.1), y }, 400)
      await settle(1000)
    })
  }
  if (P.errs.length) console.warn(`${fmt} site page errors:`, P.errs)
  await P.ctx.close()
}

const ffmpeg = (args) =>
  new Promise((ok) => {
    const p = spawn(ffmpegPath(), ['-hide_banner', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('exit', (code) => ok({ code, err }))
  })

// Each clip as written: size and duration read back from the webm, first / middle / last frame decoded by ffmpeg
// (Chrome's <video> seek lands on the first keyframe of these files), laid out in one PNG.
async function contactSheet(browser, BASE, clips) {
  const dir = path.join(OUT, 'contact')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const rows = []
  for (const c of clips) {
    const file = path.join(ROOT, c.file)
    const { err } = await ffmpeg(['-i', file])
    const size = err.match(/Video: vp9.*?, (\d+)x(\d+)/)
    const d = err.match(/Duration: (\d+):(\d+):([\d.]+)/)
    if (!size || !d) throw new Error(`${c.file}: not a VP9 webm`)
    c.width = Number(size[1])
    c.height = Number(size[2])
    c.duration = Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3])
    const imgs = []
    for (const [i, t] of [
      0,
      c.duration / 2,
      c.duration - 1.5 / FPS,
    ].entries()) {
      const name = `${c.format}-${c.scene}-${i}.png`
      const r = await ffmpeg([
        '-loglevel',
        'error',
        '-y',
        '-ss',
        t.toFixed(3),
        '-i',
        file,
        '-frames:v',
        '1',
        '-vf',
        'scale=-2:220',
        '-f',
        'image2',
        '-c:v',
        'png',
        path.join(dir, name),
      ])
      if (r.code) throw new Error(`${c.file}: no frame at ${t} s\n${r.err}`)
      imgs.push(`/out/contact/${name}`)
    }
    rows.push(
      `<div class="r"><p>${c.file} · ${c.width}×${c.height} · ${c.duration.toFixed(2)} s · first / middle / last frame</p>${imgs.map((s) => `<img src="${s}">`).join('')}</div>`,
    )
  }
  const html = `<meta charset="utf-8"><style>body{margin:0;padding:12px;background:#ECE8E1;font:14px sans-serif;color:#1A1918;width:max-content}.r{margin-bottom:12px}p{margin:0 0 6px}img{height:220px;margin-right:10px;vertical-align:top}</style>${rows.join('')}`
  fs.writeFileSync(path.join(dir, 'index.html'), html)
  const ctx = await browser.newContext({
    viewport: { width: 800, height: 600 },
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/out/contact/index.html`)
  await page.evaluate(() =>
    Promise.all([...document.images].map((i) => i.decode())),
  )
  await page.screenshot({
    path: path.join(OUT, 'contact-sheet.png'),
    fullPage: true,
    scale: 'css',
  })
  await ctx.close()
}

await main()

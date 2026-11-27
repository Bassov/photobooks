// Reels capture layer (promo-reels-3 §2 "Feeding the kit", "Capture", "Real time", "Cursor"): films the real kit
// (uikit/dist) at DPR 3 in tall viewports on a frame-stepped clock. Per reel the kit is served with its photos and names
// swapped for the reel's graded CC0 photos (promo/reels/photos.mjs output). Per clip it writes the frames, the element
// rects per frame, the pointer path and a DOM state log per frame. A clip fails (exit 1) when any frame shows a running
// job, a progress bar or a spinner. The cursor is not drawn into the frames: Remotion draws it from the pointer path.
//
//   pnpm uikit:build && node promo/reels/photos.mjs     (once)
//   node promo/reels/capture.mjs --clip <id>[,<id>…]    film these clips  (--list prints the walk table)
//   options: --png (lossless frames; default JPEG q 95)
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { WALKS_A } from './walks-a.mjs'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const DIST = path.resolve(HERE, '../../uikit/dist')
const PHOTOS = path.resolve(HERE, '../out/reels/photos')
const OUT = path.resolve(HERE, '../out/reels/clips')
const LIST = JSON.parse(fs.readFileSync(path.join(HERE, 'photos.json'), 'utf8'))
const ARGS = process.argv.slice(2)
const opt = (n) => {
  const i = ARGS.indexOf(n)
  return i >= 0 ? ARGS[i + 1] : undefined
}
const PNG = ARGS.includes('--png')
const DPR = 3
const FPS = 30
const DT = 1000 / FPS
const FIXED = Date.UTC(2026, 10, 27, 12, 0, 0)
const T0 = Date.now()
const log = (m) =>
  console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)} s] ${m}`)

/** §2 Capture: editor and site 1280×1440, phone 390×844 (mobile, touch). CSS px; frames are ×DPR. */
export const VIEWPORTS = {
  editor: { width: 1280, height: 1440 },
  site: { width: 1280, height: 1440 },
  phone: { width: 390, height: 844, mobile: true },
}

/** §2 Feeding the kit: per reel the book title and (C only) the 412-item demo gallery. The site owner is "Your Name". */
export const REELS = {
  a: { title: 'Lake trip 2026' },
  b: { title: 'Highlands 2026' },
  c: {
    title: 'Desert road',
    gallery: 412,
    gallerySets: ['Cdesert', 'Csurf', 'Ccity', 'Csnow'],
  },
}
const NAME_SWAPS = [
  ['Aleksandr Basov', 'Your Name'],
  ['A. Basov', 'Your Name'],
  ['Aleksandr’s', 'Your'],
  ['aleksandr.photos', 'yourname.photos'],
  ['aleksandr-books', 'your-books'],
  ['basov-photo', 'yourname-photo'],
  ['basov.photo', 'yourname.photo'],
  ['Aleksandr_Books', 'Your_Books'],
]
/** Strings that must be gone from every served script after the swaps (the book title is checked separately). */
const GONE = [/Aleksandr/i, /Basov/i, /https:\/\/stocksnap\.io/]
const OLD_TITLE = /Lake trip(?: 2026| ’26)?/g

// ---------------------------------------------------------------- photos and the swapped kit server

/** The reel's graded 2400 px kit photos in set order (p01 = the first photo of the reel's first set). */
function reelPhotos(reel) {
  const mf = path.join(PHOTOS, 'manifest.json')
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(mf, 'utf8'))
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
    throw new Error(
      'no promo/out/reels/photos/manifest.json: run node promo/reels/photos.mjs first',
    )
  }
  const items = manifest.reels?.[reel]
  if (!items?.length)
    throw new Error(
      `photos for reel ${reel} missing: run node promo/reels/photos.mjs --reel ${reel}`,
    )
  // every photo photos.json lists for the reel's sets must be graded: no silent cycling over a partial manifest
  const want = (LIST.reels?.[reel] ?? []).flatMap((set) =>
    LIST.sets[set].map((e) => e.src),
  )
  const have = new Set(items.map((it) => it.src))
  const missing = want.filter((s) => !have.has(s))
  if (missing.length)
    throw new Error(
      `reel ${reel}: manifest has ${items.length} of ${want.length} photos (missing ${missing.slice(0, 8).join(' ')}${missing.length > 8 ? ' …' : ''}): run node promo/reels/photos.mjs --reel ${reel}`,
    )
  const meta = new Map(
    Object.values(LIST.sets)
      .flat()
      .map((e) => [e.src, e]),
  )
  return items.map((it) => ({
    ...meta.get(it.src),
    file: path.join(PHOTOS, it.kit),
    kitW: it.kitW,
    kitH: it.kitH,
  }))
}

const HI = [
  'c13',
  'c18',
  'c18b',
  'c25',
  'r2',
  'r6',
  'r7',
  'r8',
  'x-tatra',
  'x-valley',
]
const q = (s) => `\`${String(s).replace(/[`\\$]/g, '')}\``

/** Rewrite the kit's demo gallery tuples (uikit/src/data.ts `raw`): credits = the real CC0 photo, sizes = the
 *  source's; C gets DSC_0001.JPG… names, 6000×4000, and is extended to `gallery` items (g021.jpg…). */
function rewriteGallery(js, reel, pool) {
  const cfg = REELS[reel]
  const tuple =
    /\[`(p\d\d)\.jpg`,`[^`]*`,[^,\]]+,[^,\]]+,![01],`[^`]*`,`[^`]*`,`[^`]*`\]/g
  let n = 0
  const row = (file, i, ph) => {
    const name = cfg.gallery
      ? `DSC_${String(i + 1).padStart(4, '0')}.JPG`
      : `IMG_${4102 + i * 7}.jpg`
    const [w, h] = cfg.gallery ? [6000, 4000] : [ph.w, ph.h]
    return `[${q(file)},${q(name)},${w},${h},!1,${q(ph.title.replace(/\.jpe?g$/i, ''))},${q(ph.author)},${q(ph.page)}]`
  }
  const out = js.replace(tuple, (m, id) => {
    const i = Number(id.slice(1)) - 1
    n++
    let s = row(`${id}.jpg`, i, pool[i % pool.length])
    if (cfg.gallery && id === 'p20')
      for (let k = 20; k < cfg.gallery; k++)
        s += `,${row(`g${String(k + 1).padStart(3, '0')}.jpg`, k, pool[k % pool.length])}`
    return s
  })
  // the p21 specimen (extraPhotos) is served as pool[20] too: its credit follows
  const p21 = pool[20 % pool.length]
  const extra = out.replace(
    /credit:\{title:`[^`]*`,author:`[^`]*`,url:`https:\/\/stocksnap\.io[^`]*`\}/g,
    () =>
      `credit:{title:${q(p21.title.replace(/\.jpe?g$/i, ''))},author:${q(p21.author)},url:${q(p21.page)}}`,
  )
  return { js: extra, tuples: n }
}

/** Serve uikit/dist with the reel's swaps. Every image answer is recorded; no kit photo original is ever served. */
async function serveReel(reel) {
  const photos = reelPhotos(reel)
  const cfg = REELS[reel]
  const pool = cfg.gallerySets
    ? photos.filter((p) => cfg.gallerySets.includes(p.set))
    : photos
  const jsCache = new Map()
  const swaps = { tuples: 0 }
  const served = [] // { path, file }
  const blocked = []
  const scriptFor = (file) => {
    if (jsCache.has(file)) return jsCache.get(file)
    let js = fs.readFileSync(file, 'utf8')
    for (const [a, b] of NAME_SWAPS) js = js.split(a).join(b)
    js = js.replace(OLD_TITLE, cfg.title)
    const g = rewriteGallery(js, reel, pool)
    js = g.js
    swaps.tuples += g.tuples
    // assert: the old strings are gone (the title may contain "Lake trip" itself, so look outside it)
    const rest = js.split(cfg.title).join('')
    for (const re of GONE)
      if (re.test(js))
        throw new Error(`${path.basename(file)}: ${re} still in the served JS`)
    if (/Lake trip/.test(rest))
      throw new Error(
        `${path.basename(file)}: old book title still in the served JS`,
      )
    jsCache.set(file, js)
    return js
  }
  const photoFor = (p) => {
    let m = p.match(/^\/photos\/(?:p|g)(\d+)\.jpg$/)
    if (m) return pool[(Number(m[1]) - 1) % pool.length]
    m = p.match(/^\/photos\/hi\/([\w-]+)\.jpg$/)
    if (m) return photos[(20 + Math.max(0, HI.indexOf(m[1]))) % photos.length]
    return null
  }
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    const ph = photoFor(p)
    let file
    if (ph) {
      file = ph.file
      served.push({ path: p, src: ph.src })
    } else if (
      /^\/(photos|guide)\//.test(p) &&
      /\.(jpe?g|png|webp|avif)$/i.test(p)
    ) {
      // kit photos we have no swap for, and the guide screenshots (they show p01–p21): never served
      blocked.push(p)
      res.writeHead(404).end()
      return
    } else {
      // only paths under uikit/dist are served (photo answers above come from the manifest, not the request)
      file = path.resolve(DIST, p === '/' ? 'index.html' : '.' + p)
      if (!file.startsWith(DIST + path.sep)) {
        res.writeHead(403).end()
        return
      }
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404).end()
        return
      }
      const ext = path.extname(file)
      if (ext === '.js') buf = Buffer.from(scriptFor(file))
      res.writeHead(200, {
        'content-type': MIME[ext] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      })
      res.end(buf)
    })
  })
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok))
  // swap every script up front so a bad swap fails before any clip is filmed
  for (const f of fs
    .readdirSync(path.join(DIST, 'assets'))
    .filter((f) => f.endsWith('.js')))
    scriptFor(path.join(DIST, 'assets', f))
  if (!swaps.tuples)
    throw new Error(
      'demo gallery tuples not found in the kit build (uikit/src/data.ts changed?)',
    )
  return {
    srv,
    base: `http://127.0.0.1:${srv.address().port}`,
    served,
    blocked,
    photos,
    pool,
    swaps,
  }
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

// ---------------------------------------------------------------- page clock (same model as promo/capture.mjs clockInit)

/** Virtual time: timers, rAF, performance.now, Date, event timestamps and CSS/WAAPI animations follow `__advance(ms)`
 *  while filming (`__film(true)`), real time otherwise. Math.random is seeded. */
function clockInit([fixed]) {
  const pn = performance.now.bind(performance)
  const nst = window.setTimeout.bind(window)
  const nsi = window.setInterval.bind(window)
  let film = false
  let vt = pn()
  let rb = pn()
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
  const hold = (a) => {
    a.pause()
    a.__promo = true
  }
  window.__film = (on) => {
    if (on && !film) vt = now()
    if (!on && film) rb = pn()
    film = on
    for (const a of document.getAnimations()) {
      if (on && a.playState === 'running') hold(a)
      if (!on && a.__promo) ((a.__promo = false), a.play())
    }
  }
  window.__advance = (ms) => {
    const until = vt + ms
    run(until, true)
    vt = until
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

/** Per-frame probe, installed in the page: element rects (CSS px, viewport space) and the DOM state, incl. the
 *  no-progress scan (§2: no [role=progressbar], no *-running* state, no spinner, no aria-busy). */
function probeInit() {
  const box = (el) => {
    const r = el.getBoundingClientRect()
    return r.width || r.height
      ? [
          +r.x.toFixed(2),
          +r.y.toFixed(2),
          +r.width.toFixed(2),
          +r.height.toFixed(2),
        ]
      : null
  }
  const desc = (el) => {
    const t = el.getAttribute('data-testid')
    return `${el.tagName.toLowerCase()}${t ? `[data-testid=${t}]` : ''}${el.id ? `#${el.id}` : ''}`
  }
  const RUN = /(^|[-_ ])running([-_ ]|$)/i
  window.__reelProbe = (targets) => {
    const rects = {}
    for (const { name, sel, all } of targets) {
      const els = [...document.querySelectorAll(sel)]
      rects[name] = all
        ? els.map(box).filter(Boolean)
        : els.length
          ? box(els[0])
          : null
    }
    const bad = []
    for (const el of document.querySelectorAll(
      '[role=progressbar], progress, [aria-busy=true]',
    ))
      bad.push(
        `${desc(el)} ${el.matches('[aria-busy=true]') ? 'aria-busy' : 'progressbar'}`,
      )
    for (const el of document.querySelectorAll(
      '.animate-spin, [class*="spinner"], [class*="lucide-loader"]',
    ))
      bad.push(`${desc(el)} spinner`)
    for (const el of document.querySelectorAll('*')) {
      for (const a of el.attributes) {
        if (a.name === 'class') {
          // class tokens only; Tailwind variants like data-[state=running]:… are styles, not state
          const tok = a.value
            .split(/\s+/)
            .find((c) => !/[[:]/.test(c) && RUN.test(c))
          if (tok) bad.push(`${desc(el)} class ${tok}`)
        } else if (
          (a.name.startsWith('data-') || a.name.startsWith('aria-')) &&
          RUN.test(a.value)
        )
          bad.push(`${desc(el)} ${a.name}=${a.value}`)
      }
    }
    const act = document.activeElement
    return {
      rects,
      dom: {
        hash: location.hash,
        dialogs: [
          ...document.querySelectorAll('[role=dialog], [role=alertdialog]'),
        ].map((d) => d.getAttribute('aria-label') || desc(d)),
        focus: act && act !== document.body ? desc(act) : null,
        bad,
      },
    }
  }
}

// ---------------------------------------------------------------- pointer (§2 Cursor: the overlay replays this path)

/** Spec glide: T = 180 + 120·log2(D/40 + 1) ms, minimum-jerk easing, arc sin(πt)·0.08·D perpendicular, 6 px overshoot
 *  past the target settling with spring {mass .4, stiffness 300, damping 18}. Returns one point per frame.
 *  `bow` overrides the 0.08 arc: finger swipes use a flat one, since the kit's swipe dies when |dy| > 10 comes first. */
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
  // settle: spring on the offset from the target, integrated per frame
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

// ---------------------------------------------------------------- one page with filming helpers

async function openPage(browser, vpName, server) {
  const vp = VIEWPORTS[vpName]
  const ctx = await browser.newContext({
    viewport: null,
    locale: 'en-US',
    timezoneId: 'UTC',
    hasTouch: !!vp.mobile,
  })
  await ctx.addInitScript(clockInit, [FIXED])
  await ctx.addInitScript(probeInit)
  const external = []
  // nothing leaves the machine: every request that is not the local kit server is aborted and recorded
  await ctx.route('**/*', (route) => {
    const u = route.request().url()
    if (
      u.startsWith(server.base) ||
      u.startsWith('data:') ||
      u.startsWith('blob:')
    )
      return route.continue()
    external.push(u)
    return route.abort()
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(30000)
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

  let shot = null // the clip being filmed, or null (setup, real time)
  const ptr = { x: vp.width - 40, y: vp.height - 40, down: false }
  const rest = { x: vp.width - 40, y: vp.height - 40 }

  // one frame: advance the clock, let it paint, probe, capture
  const frame = async () => {
    await page.evaluate(
      (dt) =>
        new Promise(
          (ok) => (window.__advance(dt), requestAnimationFrame(() => ok())),
        ),
      DT,
    )
    const f = shot.frames
    const pr = await page.evaluate((t) => window.__reelProbe(t), shot.targets)
    const r = await cdp.send(
      'Page.captureScreenshot',
      PNG ? { format: 'png' } : { format: 'jpeg', quality: 95 },
    )
    const file = path.join(
      shot.dir,
      'frames',
      `${String(f).padStart(6, '0')}.${PNG ? 'png' : 'jpg'}`,
    )
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'))
    shot.rects.push({ f, t: +(f * DT).toFixed(3), rects: pr.rects })
    shot.pointer.push({
      f,
      x: +ptr.x.toFixed(2),
      y: +ptr.y.toFixed(2),
      down: ptr.down,
    })
    shot.dom.push({ f, ...pr.dom })
    if (pr.dom.bad.length) shot.bad.push({ f, bad: pr.dom.bad })
    shot.frames++
  }
  const wait = async (ms) => {
    if (!shot) return page.waitForTimeout(ms)
    for (let i = Math.max(1, Math.round(ms / DT)); i > 0; i--) await frame()
  }
  const event = (type, extra = {}) =>
    shot?.events.push({
      f: shot.frames,
      type,
      x: +ptr.x.toFixed(2),
      y: +ptr.y.toFixed(2),
      ...extra,
    })
  const moveTo = async (x, y) => {
    ptr.x = x
    ptr.y = y
    if (vp.mobile) {
      if (ptr.down) await touch('touchMove', [[x, y]])
    } else await page.mouse.move(x, y)
  }
  // filmed: one move per frame on the spec path; setup: one jump
  const glide = async (x, y, ms, bow) => {
    if (!shot) return moveTo(x, y)
    for (const p of glidePath({ x: ptr.x, y: ptr.y }, { x, y }, ms, bow)) {
      await moveTo(p.x, p.y)
      await frame()
    }
  }
  const touch = (type, pts) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: pts.map(([x, y]) => ({
        x: Math.round(x),
        y: Math.round(y),
      })),
    })
  const down = async () => {
    ptr.down = true
    event('down')
    if (vp.mobile) await touch('touchStart', [[ptr.x, ptr.y]])
    else await page.mouse.down()
  }
  const up = async () => {
    ptr.down = false
    event('up')
    if (vp.mobile) await touch('touchEnd', [])
    else await page.mouse.up()
  }
  const center = async (loc) => {
    const b = await loc.boundingBox()
    if (!b) throw new Error(`no box for ${loc}`)
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }
  /** §2 Real time: click down 70 ms. */
  const press = async (loc, ms) => {
    const p = await center(loc)
    await glide(p.x, p.y, ms)
    await wait(100)
    await down()
    await wait(70)
    await up()
  }
  /** §2 Real time: drag 600–900 ms. */
  const drag = async (from, to, ms = 800) => {
    const a = await center(from)
    await glide(a.x, a.y)
    await down()
    await wait(100)
    await glide(a.x + 12, a.y - 8, 130)
    const b = await center(to)
    await glide(b.x, b.y, ms)
    await wait(130)
    await up()
  }
  /** §2 Real time: typing 60 ms per letter. */
  const type = async (text) => {
    for (const ch of text) {
      event('key', { key: ch })
      await page.keyboard.type(ch)
      await wait(60)
    }
  }
  const key = async (k) => {
    event('key', { key: k })
    await page.keyboard.press(k)
  }
  const settle = async (ms = 350) => {
    await wait(ms)
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(
        [...document.images]
          .filter((i) => !i.complete)
          .map((i) => new Promise((r) => (i.onload = i.onerror = r))),
      )
    })
  }
  /** Film `act` as clip `id`; `targets` = [{ name, sel, all? }] boxes logged per frame. */
  const film = async (id, targets, act) => {
    const dir = path.join(OUT, id)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(path.join(dir, 'frames'), { recursive: true })
    shot = {
      dir,
      targets,
      frames: 0,
      rects: [],
      pointer: [],
      events: [],
      dom: [],
      bad: [],
    }
    await page.evaluate(() => window.__film(true))
    try {
      await act()
    } finally {
      await page.evaluate(() => window.__film(false))
    }
    const s = shot
    shot = null
    return s
  }
  return {
    vp,
    vpName,
    ctx,
    page,
    cdp,
    errs,
    external,
    wait,
    settle,
    glide,
    moveTo,
    down,
    up,
    press,
    drag,
    type,
    key,
    center,
    film,
    rest,
    ptr,
  }
}

// ---------------------------------------------------------------- shared walk steps

const FILM = '[data-testid="filmstrip"] [role="row"]'
const SPREAD = '[data-testid="canvas"] [data-current]'
const FRAME = `${SPREAD} [data-testid="frame"]`

/** #/demo off camera, in real time: library → book with the reel's title (demo-capture steps 2–8), spreads list `[` and
 *  inspector `]` hidden, dock shown, pointer at rest. */
export async function editorBook(P, reel, item = 'p1') {
  const { page, settle } = P
  const c = (sel) => page.locator(sel).first().click()
  await page.goto(`${P.base}/index.html?theme=procreate-light#/demo`)
  await page.evaluate(() => window.__demo.reset())
  await settle(600)
  await c('[data-testid="create-library"]')
  await settle()
  await c('[data-testid="picker-select"]')
  await settle()
  await c('[data-testid="demo"] [data-testid="new-book"]')
  await settle()
  await page.locator('[role=dialog] input').first().fill(REELS[reel].title)
  await c('[data-testid="create-book"]')
  await settle(600)
  // the current spread is picked in the spreads list, before the list is hidden
  await c(`[data-item="${item}"]`)
  await settle(300)
  await panels(P)
}

async function panels(P) {
  const { page, settle } = P
  // the top bar's Panels toggles (`[` spreads, `\` dock, `]` inspector); aria-pressed is their state
  const want = { l: 'false', b: 'true', r: 'false' }
  const tog = (k) =>
    page.locator(`[data-testid="demo"] [data-testid="toggle-${k}"]`).first()
  for (const [k, v] of Object.entries(want))
    if ((await tog(k).getAttribute('aria-pressed')) !== v) await tog(k).click()
  await settle(300)
  for (const [k, v] of Object.entries(want))
    if ((await tog(k).getAttribute('aria-pressed')) !== v)
      throw new Error(`panel toggle-${k} is not aria-pressed=${v}`)
  await P.moveTo(P.rest.x, P.rest.y)
}

/** §2 Zoom: Md = current spread 700–740 CSS px wide, W = 400–440; zoom steps (×1.25) happen off camera. Asserted. */
export async function zoomSpread(P, [lo, hi]) {
  const { page, settle } = P
  const box = async () => page.locator(SPREAD).first().boundingBox()
  // kit steps: the zoom buttons ×1.25, the wheel ×1.1 (to the cursor; the cursor sits on the spread's centre).
  // Pick the fewest steps a·wheel + b·button that land inside the band, apply, re-measure.
  for (let round = 0; round < 3; round++) {
    const b0 = await box()
    const x = b0?.width ?? 0
    if (x >= lo && x <= hi) return x
    let best = null
    for (let a = -8; a <= 8; a++)
      for (let b = -6; b <= 6; b++) {
        const y = x * 1.1 ** a * 1.25 ** b
        const cost = Math.abs(a) + Math.abs(b)
        if (y >= lo + 3 && y <= hi - 3 && (!best || cost < best.cost))
          best = { a, b, cost }
      }
    if (!best) break
    for (let i = 0; i < Math.abs(best.b); i++) {
      await page
        .locator(`[data-testid="${best.b < 0 ? 'zoom-out' : 'zoom-in'}"]`)
        .first()
        .click()
      await settle(150)
    }
    const c = await box()
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2)
    for (let i = 0; i < Math.abs(best.a); i++) {
      await page.mouse.wheel(0, best.a < 0 ? 100 : -100)
      await settle(150)
    }
  }
  const x = (await box())?.width ?? 0
  if (x < lo || x > hi)
    throw new Error(`spread ${x.toFixed(0)} px wide, wanted ${lo}–${hi}`)
  return x
}
export const MD = [700, 740]
export const W = [400, 440]

export const chooseButton = (page) =>
  page
    .locator('[role=dialog]')
    .getByRole('button', { name: /Choose|Select|Use|Add/i })
    .last()

// ---------------------------------------------------------------- walk table

/** Clip id → { reel, viewport, about, targets, setup(P), act(P) }. `stub` walks land in promo-reel-a / b / c. */
export const CLIPS = {
  'a-folder-drop': {
    reel: 'a',
    viewport: 'editor',
    about:
      'A3–A5: Choose in the folder picker, the strip is full on the next frame, photo 1 dragged onto spread 1 (Md zoom)',
    targets: [
      { name: 'spread', sel: SPREAD },
      { name: 'frame', sel: FRAME, all: true },
      { name: 'filmstrip', sel: '[data-testid="filmstrip"]' },
      { name: 'row', sel: FILM, all: true },
      { name: 'dialog', sel: '[role=dialog]' },
      { name: 'choose', sel: '[role=dialog] button:last-of-type' },
    ],
    async setup(P) {
      await editorBook(P, 'a')
      await zoomSpread(P, MD)
      await P.page.locator('[data-testid="demo-add-folder"]').first().click()
      await P.settle(600)
      const b = await P.center(chooseButton(P.page))
      await P.moveTo(b.x - 160, b.y + 120)
    },
    async act(P) {
      await P.wait(200)
      await P.press(chooseButton(P.page))
      await P.wait(400)
      await P.drag(
        P.page.locator(FILM).first(),
        P.page.locator(FRAME).first(),
        800,
      )
      await P.wait(700)
      await P.glide(P.rest.x, P.rest.y)
    },
  },
  'c-gallery': {
    reel: 'c',
    viewport: 'editor',
    about:
      'C1: Choose on the 412-item folder, the strip is full on the next frame, a fast wheel flick through the strip',
    targets: [
      { name: 'filmstrip', sel: '[data-testid="filmstrip"]' },
      { name: 'row', sel: FILM, all: true },
      { name: 'count', sel: '[data-testid="placed-count"]' },
      { name: 'dialog', sel: '[role=dialog]' },
    ],
    async setup(P) {
      await editorBook(P, 'c')
      await P.page.locator('[data-testid="demo-add-folder"]').first().click()
      await P.settle(600)
      const b = await P.center(chooseButton(P.page))
      await P.moveTo(b.x, b.y)
    },
    async act(P) {
      await P.wait(100)
      await P.down()
      await P.wait(70)
      await P.up()
      await P.wait(400)
      const s = await P.center(
        P.page.locator('[data-testid="filmstrip"]').first(),
      )
      await P.glide(s.x, s.y)
      for (let i = 0; i < 10; i++) {
        await P.page.mouse.wheel(0, 260)
        await P.wait(DT)
      }
      await P.wait(600)
    },
    async check(P) {
      const n = await P.page.locator(FILM).count()
      if (!n) throw new Error('filmstrip has no rows after Choose')
    },
  },
  'site-shelf': {
    reel: 'a',
    viewport: 'site',
    about:
      'A9 base: site books=6, the pointer rests on the face-out book (lift), leaves, clicks it: the room opens',
    targets: [
      { name: 'face', sel: '[data-testid="ss9-book"][data-kind="face"]' },
      { name: 'books', sel: '[data-testid="ss9-book"]', all: true },
      { name: 'reader', sel: '[data-testid="ps-reader"]' },
    ],
    async setup(P) {
      await P.page.goto(
        `${P.base}/index.html?theme=procreate-light#/full/personal-site?books=6`,
      )
      await P.page.waitForSelector('[data-testid="ss9-book"]')
      await P.settle(1500)
    },
    async act(P) {
      const face = P.page
        .locator('[data-testid="ss9-book"][data-kind="face"]')
        .first()
      await P.press(face)
      await P.wait(1600)
    },
  },
  'phone-reader': {
    reel: 'b',
    viewport: 'phone',
    about:
      'B8 base: phone 390×844, tap the face-out book, the reader opens; one finger drag of the next page',
    targets: [
      { name: 'face', sel: '[data-testid="ss9-book"][data-kind="face"]' },
      { name: 'reader', sel: '[data-testid="ps-reader"]' },
      {
        name: 'stage',
        sel: '[data-testid="pt-stage"], [data-testid="ps-strip"]',
      },
    ],
    async setup(P) {
      await P.page.goto(
        `${P.base}/index.html?theme=procreate-light#/full/personal-site?books=6`,
      )
      await P.page.waitForSelector('[data-testid="ss9-book"]')
      await P.settle(1500)
      const b = await P.center(
        P.page.locator('[data-testid="ss9-book"][data-kind="face"]').first(),
      )
      await P.moveTo(b.x, b.y)
    },
    async act(P) {
      await P.wait(100)
      await P.down()
      await P.wait(70)
      await P.up()
      await P.settle(1500)
      const st = await P.page
        .locator('[data-testid="pt-stage"], [data-testid="ps-strip"]')
        .first()
        .boundingBox()
      if (st) {
        const y = st.y + st.height * 0.5
        await P.moveTo(st.x + st.width * 0.85, y)
        await P.down()
        await P.glide(st.x + st.width * 0.1, y, 1300, 0.01)
        await P.up()
        await P.wait(900)
      }
    },
    async check(P) {
      const si = await P.page
        .locator('[data-testid="pt-stage"]')
        .first()
        .getAttribute('data-si')
      if (si !== '1')
        throw new Error(
          `finger drag did not turn the page (pt-stage data-si=${si})`,
        )
    },
  },
  // Deliberate failure: Print → Export starts the PDF job, its pill shows data-state=running → the clip must exit 1.
  'selftest-running': {
    reel: 'a',
    viewport: 'editor',
    about:
      'no-progress self-test: Print → Export PDF is filmed while the job runs; the capture must fail (exit 1)',
    expectFail: true,
    targets: [{ name: 'print', sel: '[data-testid="demo-print"]' }],
    async setup(P) {
      await editorBook(P, 'a')
      await P.page.locator('[data-testid="demo-add-folder"]').first().click()
      await P.settle(600)
      await chooseButton(P.page).click()
      await P.settle(800)
      await P.page
        .locator('[data-testid="demo"] [data-testid="film-fill-book"]')
        .first()
        .click()
      await P.settle(500)
      await P.page.keyboard.press('Enter')
      await P.settle(900)
      await P.page.locator('[data-testid="demo-print"]').first().click()
      await P.page.locator('[data-testid="print-go"]').waitFor()
      await P.settle(1500)
    },
    async act(P) {
      await P.press(P.page.locator('[data-testid="print-go"]'))
      await P.wait(800)
    },
  },
  // Per-reel walks (promo-reel-a / b / c fill these in; §3–§5 shot tables)
  ...WALKS_A,
  'b-hero-drop': {
    reel: 'b',
    viewport: 'editor',
    stub: 'promo-reel-b',
    about: 'B2–B3: hero thumb 1 dragged onto spread 1',
  },
  'b-hero-cover': {
    reel: 'b',
    viewport: 'editor',
    stub: 'promo-reel-b',
    about: 'B4–B5: hero dragged onto cover-front',
  },
  'b-site': {
    reel: 'b',
    viewport: 'site',
    stub: 'promo-reel-b',
    about: 'B7: site books=6, lift + click on the B book',
  },
  'c-layouts': {
    reel: 'c',
    viewport: 'editor',
    stub: 'promo-reel-c',
    about: 'C2–C3: T7 drop, layout cycle ×4',
  },
  'c-fill-undo': {
    reel: 'c',
    viewport: 'editor',
    stub: 'promo-reel-c',
    about: 'C4: Fill book, Undo, Fill book (W)',
  },
  'c-cover-print': {
    reel: 'c',
    viewport: 'editor',
    stub: 'promo-reel-c',
    about: 'C5–C6: T14 onto the cover, Print → Export (cut before running)',
  },
  'c-shelf': {
    reel: 'c',
    viewport: 'site',
    stub: 'promo-reel-c',
    about: 'C8–C10: books=6 plates, Desert road lift + click, breath turn',
  },
}

// ---------------------------------------------------------------- run

async function runClip(browser, id, server) {
  const def = CLIPS[id]
  // the server is shared by the reel's clips: count only this clip's requests
  const s0 = server.served.length
  const b0 = server.blocked.length
  const P = await openPage(browser, def.viewport, server)
  P.base = server.base
  const t = Date.now()
  try {
    await def.setup(P)
    const s = await P.film(id, def.targets, () => def.act(P))
    if (def.check) await def.check(P)
    const vp = P.vp
    const meta = {
      fps: FPS,
      dpr: DPR,
      viewport: {
        name: def.viewport,
        width: vp.width,
        height: vp.height,
        mobile: !!vp.mobile,
      },
    }
    const failures = [
      ...s.bad.map((b) => `frame ${b.f}: ${b.bad.join('; ')}`),
      ...server.blocked
        .slice(b0)
        .map((p) => `blocked kit image requested: ${p}`),
      ...P.external.map((u) => `external request: ${u}`),
    ]
    const clip = {
      id,
      reel: def.reel,
      about: def.about,
      ...meta,
      frames: s.frames,
      duration: +(s.frames / FPS).toFixed(3),
      pixels: { width: vp.width * DPR, height: vp.height * DPR },
      frameFiles: `frames/%06d.${PNG ? 'png' : 'jpg'}`,
      title: REELS[def.reel].title,
      photos: [...new Set(server.served.slice(s0).map((x) => x.src))],
      pageErrors: P.errs,
      ok: failures.length === 0,
      failures,
    }
    const w = (name, data) =>
      fs.writeFileSync(
        path.join(s.dir, `${id}.${name}`),
        JSON.stringify(data) + '\n',
      )
    w('json', clip)
    w('rects.json', { ...meta, targets: def.targets, frames: s.rects })
    w('pointer.json', { ...meta, frames: s.pointer, events: s.events })
    w('dom.json', { ...meta, frames: s.dom })
    log(
      `${id}: ${s.frames} frames (${clip.duration} s) ${clip.pixels.width}×${clip.pixels.height} in ${((Date.now() - t) / 1000).toFixed(0)} s → ${path.relative(process.cwd(), s.dir)}`,
    )
    for (const f of failures.slice(0, 8)) log(`${id}: FAIL ${f}`)
    if (failures.length > 8) log(`${id}: … ${failures.length - 8} more`)
    return clip
  } finally {
    await P.ctx.close()
  }
}

async function main() {
  if (ARGS.includes('--list')) {
    for (const [id, d] of Object.entries(CLIPS))
      console.log(
        `${id.padEnd(18)} ${d.reel} ${d.viewport.padEnd(6)} ${d.stub ? `[stub → ${d.stub}] ` : ''}${d.about}`,
      )
    return
  }
  const ids = (opt('--clip') ?? '').split(',').filter(Boolean)
  if (!ids.length)
    throw new Error(
      'usage: node promo/reels/capture.mjs --clip <id>[,<id>…] | --list',
    )
  for (const id of ids) {
    if (!CLIPS[id]) throw new Error(`unknown clip ${id} (--list)`)
    if (CLIPS[id].stub)
      throw new Error(
        `clip ${id} is a stub: its walk lands in ${CLIPS[id].stub}`,
      )
  }
  if (!fs.existsSync(path.join(DIST, 'index.html')))
    throw new Error('uikit/dist missing: pnpm uikit:build')
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: [
      '--no-sandbox',
      `--force-device-scale-factor=${DPR}`,
      '--window-size=1280,1440',
      '--font-render-hinting=none',
      '--force-color-profile=srgb',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
    ],
  })
  const servers = new Map()
  const clips = []
  try {
    for (const id of ids) {
      const reel = CLIPS[id].reel
      if (!servers.has(reel)) {
        const s = await serveReel(reel)
        servers.set(reel, s)
        log(
          `reel ${reel}: kit served with ${s.photos.length} graded photos, gallery ${REELS[reel].gallery ?? 20}, title "${REELS[reel].title}" (${s.swaps.tuples} gallery tuples rewritten)`,
        )
      }
      clips.push(await runClip(browser, id, servers.get(reel)))
    }
  } finally {
    await browser.close()
    for (const s of servers.values()) s.srv.close()
  }
  const idx = path.join(OUT, 'index.json')
  let prev = {}
  try {
    prev = JSON.parse(fs.readFileSync(idx, 'utf8'))
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  for (const c of clips)
    prev[c.id] = {
      reel: c.reel,
      viewport: c.viewport.name,
      frames: c.frames,
      duration: c.duration,
      ok: c.ok,
      dir: c.id,
    }
  fs.writeFileSync(idx, JSON.stringify(prev, null, 1) + '\n')
  const failed = clips.filter((c) => !c.ok)
  for (const c of failed)
    log(
      `${c.id}: FAILED (${c.failures.length})${CLIPS[c.id].expectFail ? ' — expected, this is the no-progress self-test' : ''}`,
    )
  if (failed.length) process.exit(1)
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  main().catch((e) => {
    console.error(e.stack ?? e)
    process.exit(1)
  })
}

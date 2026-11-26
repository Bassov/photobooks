// Instagram carousels, step 2 of 2 (Designer spec promo-carousel/spec.md «Tooling → Compositor»): compose the 8 feed
// slides (1080×1350) and the 8 Stories frames (1080×1920) from the stills of `node promo/capture.mjs --stills`.
// Usage: `node promo/carousel.mjs [--sheet]` → promo/out/carousel/{feed,stories}/NN-<beat>.png, carousel.json (the
// measured layout) and, with --sheet, promo/out/carousel/contact-sheet.png. See promo/README.md «Carousels».
//
// One HTML page per slide at its final size, DPR 1, element screenshot (sRGB PNG). The pages load files only through a
// route allowlist: the stills listed in stills.json, the CC0 sample photos p01–p21 and the kit's Inter / Lora woff2.
// Any other request (photos/hi, the fog photo, the Designer's mockup PNGs) is refused and fails the run. Before each
// screenshot the script checks the fonts and measures the DOM boxes against the Spec; it exits 1 on any violation.
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.dirname(new URL(import.meta.url).pathname)
const STILLS = path.join(ROOT, 'out', 'stills')
const OUT = path.join(ROOT, 'out', 'carousel')
const FONTS = path.join(ROOT, '../uikit/src/fonts')
const PHOTOS = path.join(ROOT, '../uikit/public/photos')
const ORIGIN = 'http://carousel.local'
const SHEET = process.argv.includes('--sheet')
const T0 = Date.now()
const log = (m) =>
  console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(3)} s] ${m}`)

// ---- Data table (copied from the Designer's sheet.mjs; crops re-aimed at the capture.mjs stills).
// Crop = [x, y, w] in CSS px of the still's page (device px = CSS × the still's dsf); the crop height follows the box.
// Box = [left, top, width, height] in slide px. kind: win (framed window) | phone | card (tilted cover) | bleed.
const SRC = {
  strip: '16x9/02-add-folder',
  drop: '16x9/03-drop-in-frame',
  fill: '16x9/04-fill-book',
  cover: '16x9/05-cover-title',
  shelf: '16x9/06-site-shelf',
  spread: '16x9/07-book-turn',
  pshelf: '9x16/06-site-shelf',
  endcover: '16x9/08-end-cover',
}
const FEED = { w: 1080, h: 1350, head: [96, 112, 84], hook: 150 }
const STORY = { w: 1080, h: 1920, head: [80, 270, 80], hook: 290 }
const FWIN = [96, 400, 1080, 1040]
const SWIN = [60, 620, 960, 900]
const PHONE = [220, 600, 640, 920]
// the end-card cover: the whole cover element, trimmed top and bottom to the card's aspect
const CARD_CROP = [0, 20, 372]
const feed = [
  {
    beat: 'hook',
    head: ['Thousands of photos.', 'Not a single book.'],
    hook: [6, 196, 10, 8, 40],
    swipe: true,
    visual:
      'camera-roll collage of the CC0 sample photos p01–p21, tilted −4°, paper fade over the top 45 %',
  },
  {
    beat: 'add-folder',
    head: ['Add a folder —', 'every shot at hand.'],
    img: ['strip', [0, 280, 700], FWIN],
    visual:
      'the editor after Add folder: the page list and the filmstrip "Photos · 20"',
  },
  {
    beat: 'drag',
    head: ['Drag a photo in —', 'the spread is done.'],
    img: ['drop', [250, 70, 760], FWIN],
    visual: 'a photo just dropped into its frame, the layout pill above',
  },
  {
    beat: 'fill-book',
    head: ['The whole book —', 'in one click.'],
    img: ['fill', [430, 360, 520], FWIN],
    visual: 'the Fill book popover over a filled spread',
  },
  {
    beat: 'cover',
    head: ['Your cover,', 'your title.'],
    img: ['cover', [600, 110, 640], FWIN],
    visual: 'the cover with its photo and the title "Lake trip 2026"',
  },
  {
    beat: 'site',
    head: ['Print to PDF —', 'or your own site.'],
    img: ['shelf', [280, 130, 870], FWIN],
    visual: 'the personal site home: the shelf with the face-out book',
  },
  {
    beat: 'real-book',
    head: ['Like a <i>real book.</i>'],
    img: ['spread', [310, 60, 820], [0, 340, 1080, 1010], 'bleed'],
    visual: 'the open book in the site reader, one spread, full width',
  },
  {
    beat: 'cta',
    cta: 'feed',
    img: ['endcover', CARD_CROP, [540, 620, 456, 600], 'card'],
    visual:
      'wordmark, tag line, "Make your first book" button; the Lake trip cover leans in from the right',
  },
]
const stories = [
  {
    beat: 'hook',
    head: ['Thousands of photos.', 'Not a single book.'],
    hook: [5, 200, 10, 11, 30],
    visual:
      'camera-roll collage of the CC0 sample photos over the whole frame, paper fade over the top third',
  },
  {
    beat: 'add-folder',
    head: ['Add a folder —', 'every shot at hand.'],
    img: ['strip', [215, 600, 300], SWIN],
    visual: 'close-up of the filmstrip: "Photos · 20" and the first thumbnails',
  },
  {
    beat: 'drag',
    head: ['Drag a photo in —', 'the spread is done.'],
    img: ['drop', [300, 90, 560], SWIN],
    visual: 'close-up of the dropped photo in its frame',
  },
  {
    beat: 'fill-book',
    head: ['The whole book —', 'in one click.'],
    img: ['fill', [440, 370, 420], SWIN],
    visual: 'close-up of the Fill book popover',
  },
  {
    beat: 'cover',
    head: ['Your cover,', 'your title.'],
    img: ['cover', [660, 120, 460], SWIN],
    visual: 'close-up of the front cover with its title',
  },
  {
    beat: 'site',
    head: ['Print to PDF —', 'or your own site.'],
    img: ['pshelf', [1, 0, 387], PHONE, 'phone'],
    visual: 'a phone screen with the personal site shelf',
  },
  {
    beat: 'real-book',
    head: ['Like a', 'real book.'],
    img: ['spread', [160, 30, 1120], [0, 640, 1080, 780], 'bleed'],
    visual: 'the open book in the site reader, the whole spread, full width',
  },
  {
    beat: 'cta',
    cta: 'stories',
    img: ['endcover', CARD_CROP, [320, 600, 440, 580], 'card'],
    visual:
      'wordmark, tag line, the cover, a "Make your first book" button pointing at the link sticker',
  },
]
const SETS = [
  { name: 'feed', fmt: FEED, slides: feed },
  { name: 'stories', fmt: STORY, slides: stories },
]
// Stories frame 8: the link sticker goes here in the Instagram app; the PNG leaves it empty
const STICKER = [340, 1420, 400, 110]
// Spec safe zones (slide px)
const SAFE = {
  feed: { sides: 60, corner: [1080 - 200, 0, 200, 120] },
  stories: { sides: 60, top: 250, bottom: 340 },
}
const UPSCALE_MIN = 0.9 // device px of the crop ≥ 0.9 × box px (spec: crop CSS width × 3 ≥ 0.9 × box width)

// ---- Inputs
function loadStills() {
  const file = path.join(STILLS, 'stills.json')
  const list = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : []
  const byKey = {}
  for (const s of list)
    byKey[`${s.format}/${s.scene}`] = { ...s, abs: path.join(ROOT, s.file) }
  const missing = Object.values(SRC).filter(
    (k) => !byKey[k] || !fs.existsSync(byKey[k].abs),
  )
  if (missing.length) {
    console.error(
      `carousel: stills missing (${missing.join(', ')}).\nRun \`node promo/capture.mjs --stills\` first (needs \`pnpm uikit:build\`).`,
    )
    process.exit(1)
  }
  return byKey
}

const pngSize = (file) => {
  const b = fs.readFileSync(file)
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
}

// ---- Markup
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const CSS = `
@font-face{font-family:Lora;font-style:normal;font-weight:400 700;font-display:block;src:url('/fonts/lora-latin-wght-normal.woff2')}
@font-face{font-family:Lora;font-style:italic;font-weight:400 700;font-display:block;src:url('/fonts/lora-latin-wght-italic.woff2')}
@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:block;src:url('/fonts/inter-latin-wght-normal.woff2')}
html,body{margin:0;background:#C9C7C3}
#slide{position:relative;overflow:hidden;font-family:Inter;color:#393738;
  background:radial-gradient(120% 90% at 50% 35%,#F5F2EC 0%,#ECE8E1 60%,#E1DCD3 100%)}
.win,.phone,.card,.bleed{position:absolute;background-repeat:no-repeat;background-color:#E1DCD3}
.win{border-radius:24px;box-shadow:0 40px 80px -24px rgb(20 20 19/.28),0 8px 20px -8px rgb(20 20 19/.14),0 0 0 1px rgb(0 0 0/.06)}
.phone{border-radius:56px;box-shadow:0 40px 80px -24px rgb(20 20 19/.28),0 8px 20px -8px rgb(20 20 19/.14),0 0 0 1px rgb(0 0 0/.06)}
.card{border-radius:4px;transform:rotate(3deg);box-shadow:0 40px 80px -24px rgb(20 20 19/.32),0 8px 20px -8px rgb(20 20 19/.16)}
.roll{position:absolute;left:-60px;top:-40px;display:grid;transform:rotate(-4deg)}
.roll>div{background-size:cover;background-position:center;border-radius:6px}
.fade{position:absolute;inset:0;z-index:1}
.head{position:absolute;font-family:Lora;font-weight:400;line-height:1.08;letter-spacing:-.01em;color:#1A1918;z-index:2;white-space:nowrap}
.head i,.tag i{font-style:italic}
.swipe{position:absolute;right:72px;bottom:64px;z-index:2;font:500 32px/1 Inter;color:#1A1918;background:rgb(245 242 236/.92);
  padding:20px 30px;border-radius:9999px;box-shadow:0 8px 20px -8px rgb(20 20 19/.2);white-space:nowrap}
.endc{position:absolute;left:96px;top:150px;z-index:2}
.mark{font:400 120px/1 Lora;color:#1A1918;letter-spacing:-.02em;white-space:nowrap}
.tag{font:400 56px/1.15 Lora;margin-top:28px;color:#393738;white-space:nowrap}
.cta{display:inline-block;margin-top:56px;background:#232223;color:#F2F2F2;font:500 40px/1 Inter;padding:28px 44px;border-radius:9999px;white-space:nowrap}
.url{margin-top:28px;font:400 30px/1 Inter;color:#535152;white-space:nowrap}
.endc.v{left:0;right:0;top:300px;text-align:center}.endc.v .mark,.endc.v .tag,.endc.v .url{width:max-content;margin-left:auto;margin-right:auto}
.endc.v .tag{font-size:52px;margin-top:24px}
.endc.v .cta{position:absolute;left:50%;transform:translateX(-50%);top:920px;margin:0}
.endc.v .url{position:absolute;left:0;right:0;top:1040px;margin:0 auto}`

// Background-image crop: source rect (device px) scaled into the box. Returns the markup and the numbers to check.
function crop(stills, [src, [cx, cy, cw], [l, t, bw, bh], kind = 'win']) {
  const s = stills[SRC[src]]
  const k = bw / (cw * s.dsf) // box px per device px
  const style =
    `left:${l}px;top:${t}px;width:${bw}px;height:${bh}px;background-image:url('/stills/${s.format}/${s.scene}.png');` +
    `background-size:${s.width * k}px ${s.height * k}px;background-position:${-cx * s.dsf * k}px ${-cy * s.dsf * k}px`
  return {
    html: `<div class="${kind}" data-src="${src}" style="${style}"></div>`,
    check: {
      src,
      kind,
      box: [l, t, bw, bh],
      crop: [cx, cy, cw],
      dsf: s.dsf,
      img: [s.width, s.height],
    },
  }
}

function roll([cols, cell, gap, rows, stop]) {
  const tiles = Array.from({ length: cols * rows }, (_, i) => {
    const n = ((i * 5 + Math.floor(i / cols) * 8) % 21) + 1
    return `<div style="width:${cell}px;height:${cell}px;background-image:url('/photos/p${String(n).padStart(2, '0')}.jpg')"></div>`
  })
  const fade = `<div class="fade" style="background:linear-gradient(180deg,#F5F2EC 0%,#F5F2EC ${stop - 14}%,rgb(245 242 236/.9) ${stop - 4}%,rgb(245 242 236/0) ${stop + 12}%)"></div>`
  return `<div class="roll" style="grid-template-columns:repeat(${cols},${cell}px);gap:${gap}px">${tiles.join('')}</div>${fade}`
}

function slideHtml(set, sl, stills) {
  const { fmt } = set
  let body = ''
  let img = null
  if (sl.hook) body += roll(sl.hook)
  if (sl.img) {
    img = crop(stills, sl.img)
    body += img.html
  }
  if (sl.head) {
    const [l, t, size] = fmt.head
    const [a, b] = sl.head
    body += `<div class="head" style="left:${l}px;top:${sl.hook ? fmt.hook : t}px;font-size:${size}px">${a}${b ? `<br><i>${esc(b)}</i>` : ''}</div>`
  }
  if (sl.swipe) body += '<div class="swipe">Swipe →</div>'
  if (sl.cta === 'feed')
    body +=
      '<div class="endc"><div class="mark">Photobooks</div><div class="tag">A quiet place<br><i>for your books.</i></div>' +
      '<div class="cta">Make your first book →</div><div class="url">photobooks · link in bio</div></div>'
  if (sl.cta === 'stories')
    body +=
      '<div class="endc v"><div class="mark">Photobooks</div><div class="tag">A quiet place <i>for your books.</i></div>' +
      '<div class="cta">Make your first book ↓</div><div class="url">Tap the link</div></div>'
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div id="slide" style="width:${fmt.w}px;height:${fmt.h}px">${body}</div>`
  return { html, img }
}

// ---- Checks
const box = (r) => ({
  l: Math.round(r.left),
  t: Math.round(r.top),
  r: Math.round(r.right),
  b: Math.round(r.bottom),
})
const overlaps = (a, [x, y, w, h]) =>
  a.l < x + w && a.r > x && a.t < y + h && a.b > y

async function measure(page) {
  return page.evaluate(() => {
    const rect = (e) => e.getBoundingClientRect()
    const pick = (sel) =>
      [...document.querySelectorAll(sel)].map((e) => {
        const cs = getComputedStyle(e)
        return {
          c: e.className.split(' ')[0],
          r: rect(e).toJSON(),
          // layout box before the card's rotate(3deg)
          off: [e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight],
          radius: cs.borderTopLeftRadius,
          font: cs.fontFamily,
        }
      })
    return {
      text: pick('.head,.swipe,.mark,.tag,.cta,.url'),
      frames: pick('.win,.phone,.card,.bleed'),
    }
  })
}

// Fonts: the three faces must be loaded from the kit woff2 (a FontFace that failed or was never fetched means fallback)
async function checkFonts(page) {
  return page.evaluate(async () => {
    const want = ['400 84px Lora', 'italic 400 84px Lora', '500 32px Inter']
    await Promise.all(want.map((d) => document.fonts.load(d)))
    await document.fonts.ready
    const faces = [...document.fonts].map(
      (f) => `${f.family}/${f.style}:${f.status}`,
    )
    const ok =
      want.every((d) => document.fonts.check(d)) &&
      [...document.fonts].every((f) => f.status === 'loaded')
    return { ok, faces }
  })
}

function checkSlide(set, sl, i, m, img) {
  const bad = []
  const fail = (msg) => bad.push(`${set.name} ${i + 1} ${sl.beat}: ${msg}`)
  const { fmt } = set
  const eq = (what, got, want) => {
    if (Math.abs(got - want) > 0.5) fail(`${what} ${got} ≠ ${want}`)
  }
  // Spec layout numbers
  const head = m.text.find((t) => t.c === 'head')
  if (head) {
    eq('title left', head.r.left, fmt.head[0])
    eq('title top', head.r.top, sl.hook ? fmt.hook : fmt.head[1])
    if (!/Lora/.test(head.font)) fail(`title font ${head.font}`)
  }
  const swipe = m.text.find((t) => t.c === 'swipe')
  if (!!swipe !== (set.name === 'feed' && i === 0))
    fail('the Swipe chip belongs on feed slide 1 only')
  if (swipe) {
    eq('chip right gap', fmt.w - swipe.r.right, 72)
    eq('chip bottom gap', fmt.h - swipe.r.bottom, 64)
  }
  for (const f of m.frames) {
    const [l, t, w, h] = f.off
    const want = img.check.box
    eq(`${f.c} left`, l, want[0])
    eq(`${f.c} top`, t, want[1])
    eq(`${f.c} width`, w, want[2])
    eq(`${f.c} height`, h, want[3])
    const r = { win: '24px', phone: '56px', card: '4px', bleed: '0px' }[f.c]
    if (f.radius !== r) fail(`${f.c} radius ${f.radius} ≠ ${r}`)
  }
  // Safe zones. Text, the chip, the CTA and every framed picture stay out; the feed windows and the full-width
  // pictures (collage, open book) bleed off the edges by design (Spec «Direction»: the cut says "more →").
  const keep = [
    ...m.text,
    ...m.frames.filter(
      (f) => f.c !== 'bleed' && !(set.name === 'feed' && f.c === 'win'),
    ),
  ]
  const z = SAFE[set.name]
  for (const e of keep) {
    const b = box(e.r)
    if (b.l < z.sides || b.r > fmt.w - z.sides)
      fail(`${e.c} x ${b.l}–${b.r} inside the ${z.sides} px side margin`)
    if (z.corner && overlaps(b, z.corner))
      fail(`${e.c} ${JSON.stringify(b)} inside the top-right counter box`)
    if (z.top && b.t < z.top) fail(`${e.c} top ${b.t} < ${z.top}`)
    if (z.bottom && b.b > fmt.h - z.bottom)
      fail(`${e.c} bottom ${b.b} > ${fmt.h - z.bottom}`)
    if (set.name === 'stories' && sl.cta && overlaps(b, STICKER))
      fail(`${e.c} covers the link sticker area`)
  }
  if (set.name === 'feed' && head && head.r.right > 1020)
    fail(`title ends at x ${Math.round(head.r.right)} > 1020`)
  // Crops: never upscaled past 1.1×, and the visible part of the box lies inside the still
  if (img) {
    const {
      box: b,
      crop: c,
      dsf,
      img: [iw, ih],
    } = img.check
    const devW = c[2] * dsf
    if (devW < UPSCALE_MIN * b[2])
      fail(`crop ${c[2]} CSS px × ${dsf} = ${devW} < 0.9 × box ${b[2]}`)
    const k = b[2] / devW
    const visW = Math.min(b[0] + b[2], fmt.w) - Math.max(b[0], 0)
    const visH = Math.min(b[1] + b[3], fmt.h) - Math.max(b[1], 0)
    const x1 = c[0] * dsf + visW / k
    const y1 = c[1] * dsf + visH / k
    if (c[0] < 0 || c[1] < 0 || x1 > iw + 0.5 || y1 > ih + 0.5)
      fail(
        `crop runs off the still (${Math.round(x1)}×${Math.round(y1)} of ${iw}×${ih})`,
      )
  }
  return bad
}

// ---- Route allowlist: the only files a page can load
async function allowlist(context, stills, extra = {}) {
  const refused = []
  const served = new Set()
  const allowed = {}
  for (const s of Object.values(stills))
    allowed[`/stills/${s.format}/${s.scene}.png`] = s.abs
  for (let n = 1; n <= 21; n++) {
    const f = `p${String(n).padStart(2, '0')}.jpg`
    allowed[`/photos/${f}`] = path.join(PHOTOS, f)
  }
  for (const f of [
    'lora-latin-wght-normal.woff2',
    'lora-latin-wght-italic.woff2',
    'inter-latin-wght-normal.woff2',
  ])
    allowed[`/fonts/${f}`] = path.join(FONTS, f)
  Object.assign(allowed, extra)
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    const file = url.origin === ORIGIN && allowed[url.pathname]
    if (url.origin === ORIGIN && url.pathname === '/') return route.continue()
    if (!file) {
      refused.push(route.request().url())
      return route.abort()
    }
    served.add(url.pathname)
    return route.fulfill({ path: file })
  })
  return { refused, served }
}

async function render(browser, stills) {
  const violations = []
  const report = []
  for (const set of SETS) {
    fs.rmSync(path.join(OUT, set.name), { recursive: true, force: true })
    fs.mkdirSync(path.join(OUT, set.name), { recursive: true })
    const context = await browser.newContext({
      viewport: { width: set.fmt.w, height: set.fmt.h },
      deviceScaleFactor: 1,
    })
    const net = await allowlist(context, stills)
    const page = await context.newPage()
    for (const [i, sl] of set.slides.entries()) {
      const { html, img } = slideHtml(set, sl, stills)
      await page.route(`${ORIGIN}/`, (r) =>
        r.fulfill({ contentType: 'text/html', body: html }),
      )
      await page.goto(`${ORIGIN}/`, { waitUntil: 'load' })
      await page.unroute(`${ORIGIN}/`)
      const fonts = await checkFonts(page)
      if (!fonts.ok)
        violations.push(
          `${set.name} ${i + 1}: fonts not loaded (${fonts.faces.join(', ')})`,
        )
      const m = await measure(page)
      violations.push(...checkSlide(set, sl, i, m, img))
      const file = path.join(
        OUT,
        set.name,
        `${String(i + 1).padStart(2, '0')}-${sl.beat}.png`,
      )
      await page.locator('#slide').screenshot({ path: file })
      const size = pngSize(file)
      if (size.width !== set.fmt.w || size.height !== set.fmt.h)
        violations.push(`${file}: ${size.width}×${size.height}`)
      report.push({
        set: set.name,
        n: i + 1,
        beat: sl.beat,
        file: path.relative(ROOT, file),
        ...size,
        text: m.text.map((t) => ({ c: t.c, ...box(t.r) })),
        frames: m.frames.map((f) => ({ c: f.c, box: f.off, radius: f.radius })),
        crop: img && {
          src: img.check.src,
          css: img.check.crop,
          upscale: +(
            img.check.box[2] /
            (img.check.crop[2] * img.check.dsf)
          ).toFixed(3),
        },
      })
      log(`${set.name} ${i + 1} ${sl.beat}: ${size.width}×${size.height}`)
    }
    if (net.refused.length)
      violations.push(`${set.name}: refused requests ${net.refused.join(' ')}`)
    report.push({ set: set.name, served: [...net.served].sort() })
    await context.close()
  }
  return { violations, report }
}

async function contactSheet(browser, stills) {
  const extra = {}
  const fig = (set, sl, i, scale) => {
    const f = `${set.name}/${String(i + 1).padStart(2, '0')}-${sl.beat}.png`
    extra[`/out/${f}`] = path.join(OUT, f)
    const w = set.fmt.w * scale
    const h = set.fmt.h * scale
    return `<figure><img src="/out/${f}" style="width:${w}px;height:${h}px"><figcaption><b>${set.name === 'feed' ? 'Feed' : 'Stories'} ${i + 1} · ${sl.beat}</b>${esc(sl.visual)}</figcaption></figure>`
  }
  const section = (set, cols, scale) =>
    `<h2>${set.name === 'feed' ? 'Feed · 8 slides · 1080×1350' : 'Stories · 8 frames · 1080×1920'}</h2>` +
    `<div class="grid" style="grid-template-columns:repeat(${cols},${set.fmt.w * scale}px)">${set.slides.map((sl, i) => fig(set, sl, i, scale)).join('')}</div>`
  const html =
    `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Lora;font-display:block;src:url('/fonts/lora-latin-wght-normal.woff2')}
@font-face{font-family:Inter;font-weight:100 900;font-display:block;src:url('/fonts/inter-latin-wght-normal.woff2')}
body{margin:0;background:#C9C7C3;font-family:Inter;color:#393738}#sheet{padding:40px;width:max-content}
h1,h2{font-family:Lora;font-weight:400;color:#1A1918;margin:0 0 16px}h1{font-size:34px}h2{font-size:26px;margin-top:32px}
.grid{display:grid;gap:28px 20px}figure{margin:0}img{display:block;border-radius:6px;box-shadow:0 4px 14px -3px rgb(20 20 19/.13)}
figcaption{font-size:12px;line-height:1.4;margin-top:8px;display:flex;flex-direction:column;gap:2px;max-width:100%}figcaption b{font-weight:600;color:#1A1918}
</style><div id="sheet"><h1>Promo carousels · finals for review</h1>` +
    section(SETS[0], 4, 0.4) +
    section(SETS[1], 8, 0.2) +
    '</div>'
  const context = await browser.newContext({
    viewport: { width: 1900, height: 1200 },
    deviceScaleFactor: 1,
  })
  const net = await allowlist(context, stills, extra)
  await context.route(`${ORIGIN}/`, (r) =>
    r.fulfill({ contentType: 'text/html', body: html }),
  )
  const page = await context.newPage()
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const file = path.join(OUT, 'contact-sheet.png')
  await page.locator('#sheet').screenshot({ path: file })
  await context.close()
  return { file, refused: net.refused }
}

async function main() {
  const stills = loadStills()
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: [
      '--no-sandbox',
      '--force-device-scale-factor=1',
      '--font-render-hinting=none',
      '--force-color-profile=srgb',
    ],
  })
  let result
  try {
    result = await render(browser, stills)
    if (SHEET) {
      const sheet = await contactSheet(browser, stills)
      if (sheet.refused.length)
        result.violations.push(
          `contact sheet: refused ${sheet.refused.join(' ')}`,
        )
      log(
        `contact sheet: ${path.relative(process.cwd(), sheet.file)} ${Object.values(pngSize(sheet.file)).join('×')}`,
      )
    }
  } finally {
    await browser.close()
  }
  fs.writeFileSync(
    path.join(OUT, 'carousel.json'),
    JSON.stringify(result.report, null, 1) + '\n',
  )
  const served = result.report.filter((r) => r.served).flatMap((r) => r.served)
  console.log(`files served: ${[...new Set(served)].sort().join(' ')}`)
  if (result.violations.length) {
    console.error(
      `carousel: ${result.violations.length} violation(s):\n${result.violations.join('\n')}`,
    )
    process.exit(1)
  }
  log('done: 8 feed + 8 Stories PNGs, all checks passed')
}

await main()

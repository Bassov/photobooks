// Reels photo layer (promo-reels-3 §2 "Photos", "Grade"): check the licence of every photo in photos.json through
// the Wikimedia Commons API, download the originals, write the 4000 px copy per set, the graded copy per reel and the
// 2400 px graded kit copy that capture.mjs serves. Output lives in the gitignored promo/out/reels/photos/.
//
//   node promo/reels/photos.mjs                    check + download + grade everything (exit 1 on any non-CC0 file)
//   node promo/reels/photos.mjs --check            licence check only (no downloads)
//   node promo/reels/photos.mjs --list <file>      use another list (same shape as photos.json)
//   node promo/reels/photos.mjs --reel a           only the sets of reel a (a | b | c)
//   node promo/reels/photos.mjs --only L18,L4      only these photos (the licence check still covers the whole list)
// Re-runs reuse the downloaded originals; manifest.json is merged, so partial runs add to it.
//   node promo/reels/photos.mjs --import <file>    build photos.json from a Designer list (adds licence, author, checked)
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const OUT = path.resolve(HERE, '../out/reels/photos')
const ORIG = path.resolve(HERE, '../out/reels/originals')
const UA = 'photobooks-promo/1.0'
const API = 'https://commons.wikimedia.org/w/api.php'
const LONG_EDGE = 4000
const KIT_EDGE = 2400
const JPEG_Q = 0.92

/** Licences we accept: CC0 or public domain, read from the file page metadata (LicenseShortName / License). */
export function licenceOk(shortName, licence) {
  const s = String(shortName ?? '')
    .trim()
    .toLowerCase()
  const l = String(licence ?? '')
    .trim()
    .toLowerCase()
  if (s === 'cc0' || l === 'cc0') return true
  if (s === 'public domain' || l === 'pd' || l.startsWith('pd-')) return true
  return false
}

/** §2 Grade, per reel. Applied per pixel on 0–255 channels in this order: gain → lift → split tone → sat → contrast → black point. */
export const GRADES = {
  a: {
    gain: [1.04, 1, 0.94],
    lift: [6, 4, 0],
    shadows: [0, 0, 0],
    highlights: [0, 0, 0],
    sat: 0.95,
    contrast: 1.04,
    black: 0,
  },
  b: {
    gain: [1, 1, 1],
    lift: [0, 0, 0],
    shadows: [-4, 2, 8],
    highlights: [8, 3, -6],
    sat: 0.9,
    contrast: 1.1,
    black: 10,
  },
  c: {
    gain: [1, 1, 1],
    lift: [0, 0, 0],
    shadows: [0, 0, 0],
    highlights: [0, 0, 0],
    sat: 1.08,
    contrast: 1.14,
    black: 6,
  },
}

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const stripHtml = (s) =>
  String(s ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
/** File page URL → title without the `File:` namespace (callers add it back). */
const fileTitle = (page) =>
  decodeURIComponent(page.split('/wiki/')[1])
    .replace(/^File:/, '')
    .replace(/_/g, ' ')

async function apiMeta(titles) {
  const out = new Map()
  for (let i = 0; i < titles.length; i += 40) {
    const chunk = titles.slice(i, i + 40)
    const q = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      titles: chunk.join('|'),
      prop: 'imageinfo',
      iiprop: 'size|url|extmetadata',
      iiextmetadatafilter: 'LicenseShortName|License|Artist',
    })
    const r = await fetch(`${API}?${q}`, { headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error(`Commons API ${r.status}`)
    const j = await r.json()
    const norm = new Map((j.query?.normalized ?? []).map((n) => [n.to, n.from]))
    for (const p of j.query?.pages ?? []) {
      const ii = p.imageinfo?.[0]
      const em = ii?.extmetadata ?? {}
      const meta = {
        missing: !ii,
        shortName: em.LicenseShortName?.value ?? null,
        licence: em.License?.value ?? null,
        author: stripHtml(em.Artist?.value),
        w: ii?.width,
        h: ii?.height,
        url: ii?.url,
      }
      out.set(p.title, meta)
      if (norm.has(p.title)) out.set(norm.get(p.title), meta)
    }
  }
  return out
}

/** Every entry of every set, with its set name. */
const entries = (list) =>
  Object.entries(list.sets).flatMap(([set, items]) =>
    items.map((it) => ({ ...it, set })),
  )

async function checkLicences(list) {
  const all = entries(list)
  const meta = await apiMeta([
    ...new Set(all.map((e) => `File:${fileTitle(e.page)}`)),
  ])
  const bad = []
  for (const e of all) {
    const m = meta.get(`File:${fileTitle(e.page)}`)
    if (!m || m.missing)
      bad.push(`${e.set}/${e.src}: file page not found (${e.page})`)
    else if (!licenceOk(m.shortName, m.licence))
      bad.push(
        `${e.set}/${e.src}: licence "${m.shortName ?? m.licence}" is not CC0 / public domain (${e.page})`,
      )
    else if (e.licence && e.licence !== m.shortName)
      bad.push(
        `${e.set}/${e.src}: licence changed ${e.licence} → ${m.shortName}`,
      )
  }
  return { all, meta, bad }
}

async function importList(file) {
  const src = JSON.parse(fs.readFileSync(file, 'utf8'))
  const list = { checked: new Date().toISOString().slice(0, 10), sets: src }
  const { all, meta, bad } = await checkLicences(list)
  if (bad.length) {
    console.error(bad.join('\n'))
    process.exit(1)
  }
  for (const [set, items] of Object.entries(src)) {
    list.sets[set] = items.map((it) => {
      const m = meta.get(`File:${fileTitle(it.page)}`)
      return {
        src: it.src,
        set,
        title: it.t,
        w: it.w,
        h: it.h,
        url: it.url.split('?')[0],
        page: it.page,
        licence: m.shortName,
        author: m.author,
      }
    })
  }
  const out = path.join(HERE, 'photos.json')
  fs.writeFileSync(
    out,
    JSON.stringify(
      { checked: list.checked, reels: REELS_DEFAULT, sets: list.sets },
      null,
      1,
    ) + '\n',
  )
  console.log(`photos.json: ${all.length} files, all CC0 / PD`)
}

/** Which sets each reel uses (C's shelf also shows the Lake trip book, set A, graded C). */
const REELS_DEFAULT = {
  a: ['A'],
  b: ['B'],
  c: ['Cdesert', 'Csurf', 'Ccity', 'Csnow', 'A'],
}

async function download(e) {
  fs.mkdirSync(ORIG, { recursive: true })
  const file = path.join(
    ORIG,
    `${e.src}${path.extname(new URL(e.url).pathname).toLowerCase() || '.jpg'}`,
  )
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file
  // upload.wikimedia.org answers 429 to bursts: pace the downloads and back off (Retry-After when it sends one)
  await sleep(1500)
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(e.url, { headers: { 'User-Agent': UA } })
    if (r.ok) {
      const tmp = `${file}.part`
      fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()))
      fs.renameSync(tmp, file)
      return file
    }
    if (attempt >= 8 || (r.status !== 429 && r.status < 500))
      throw new Error(`${e.src}: download ${r.status} ${e.url}`)
    const after = Number(r.headers.get('retry-after'))
    const ms =
      after > 0 ? after * 1000 : Math.min(120000, 5000 * 2 ** (attempt - 1))
    console.log(`${e.src}: ${r.status}, retry in ${Math.round(ms / 1000)} s`)
    await sleep(ms)
  }
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

/** Local server so Chromium can read the originals (no file:// canvas taint). */
function serve(dir) {
  const server = http.createServer((req, res) => {
    const f = path.join(
      dir,
      path.basename(decodeURIComponent(req.url.split('?')[0])),
    )
    if (!fs.existsSync(f)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Access-Control-Allow-Origin': '*',
    })
    fs.createReadStream(f).pipe(res)
  })
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)))
}

/** In-page: decode, scale to `edge` long edge (never up), optionally grade, return JPEG bytes as base64. */
function renderInPage({ url, edge, grade, q }) {
  return (async () => {
    const blob = await (await fetch(url)).blob()
    const bmp = await createImageBitmap(blob)
    const k = Math.min(1, edge / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * k)
    const h = Math.round(bmp.height * k)
    const c = new OffscreenCanvas(w, h)
    const g = c.getContext('2d')
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.drawImage(bmp, 0, 0, w, h)
    if (grade) {
      const img = g.getImageData(0, 0, w, h)
      const d = img.data
      const { gain, lift, shadows, highlights, sat, contrast, black } = grade
      const bk = 255 / (255 - black)
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i] * gain[0] + lift[0]
        let gg = d[i + 1] * gain[1] + lift[1]
        let b = d[i + 2] * gain[2] + lift[2]
        const L = Math.min(
          1,
          Math.max(0, (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255),
        )
        const ws = (1 - L) * (1 - L)
        const wh = L * L
        r += shadows[0] * ws + highlights[0] * wh
        gg += shadows[1] * ws + highlights[1] * wh
        b += shadows[2] * ws + highlights[2] * wh
        const y = 0.2126 * r + 0.7152 * gg + 0.0722 * b
        r = y + (r - y) * sat
        gg = y + (gg - y) * sat
        b = y + (b - y) * sat
        r = (r - 128) * contrast + 128
        gg = (gg - 128) * contrast + 128
        b = (b - 128) * contrast + 128
        d[i] = (r - black) * bk
        d[i + 1] = (gg - black) * bk
        d[i + 2] = (b - black) * bk
      }
      g.putImageData(img, 0, 0)
    }
    const out = await c.convertToBlob({ type: 'image/jpeg', quality: q })
    const bytes = new Uint8Array(await out.arrayBuffer())
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000)
      s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return { b64: btoa(s), w, h }
  })()
}

async function main() {
  const imp = opt('--import')
  if (imp) return importList(imp)

  const list = JSON.parse(
    fs.readFileSync(opt('--list') ?? path.join(HERE, 'photos.json'), 'utf8'),
  )
  const { all, bad } = await checkLicences(list)
  if (bad.length) {
    console.error(`licence check FAILED (${bad.length}):\n${bad.join('\n')}`)
    process.exit(1)
  }
  console.log(`licence check ok: ${all.length} files CC0 / PD`)
  if (flag('--check')) return

  const reels = opt('--reel') ? [opt('--reel')] : Object.keys(list.reels)
  for (const reel of reels)
    if (!GRADES[reel] || !list.reels[reel])
      throw new Error(`unknown reel ${reel}`)
  const only = opt('--only')?.split(',')
  const pick = (e) => !only || only.includes(e.src)
  const sets = new Set(reels.flatMap((r) => list.reels[r]))
  const todo = all.filter((e) => sets.has(e.set) && pick(e))
  const bySrc = new Map(all.map((e) => [e.src, e]))
  const server = await serve(ORIG)
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${base}/none`).catch(() => {})
  const mfFile = path.join(OUT, 'manifest.json')
  const old = fs.existsSync(mfFile)
    ? JSON.parse(fs.readFileSync(mfFile, 'utf8'))
    : {}
  const manifest = {
    checked: list.checked,
    generated: new Date().toISOString(),
    sets: old.sets ?? {},
    reels: old.reels ?? {},
  }
  // merge by src, keeping the list order
  const put = (arr, entry, order) => {
    const next = arr.filter((x) => x.src !== entry.src)
    next.push(entry)
    return next.sort((a, b) => order.indexOf(a.src) - order.indexOf(b.src))
  }
  // written after every entry (atomic rename), so a killed run keeps what it finished
  const save = () => {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(`${mfFile}.part`, JSON.stringify(manifest, null, 1) + '\n')
    fs.renameSync(`${mfFile}.part`, mfFile)
  }
  const write = async (src, file, edge, grade) => {
    const f = await download(bySrc.get(src))
    const { b64, w, h } = await page.evaluate(renderInPage, {
      url: `${base}/${path.basename(f)}`,
      edge,
      grade,
      q: JPEG_Q,
    })
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, Buffer.from(b64, 'base64'))
    return { w, h }
  }
  try {
    for (const e of todo) {
      const file = path.join(OUT, e.set, `${e.src}.jpg`)
      const size = await write(e.src, file, LONG_EDGE, null)
      const order = list.sets[e.set].map((x) => x.src)
      manifest.sets[e.set] = put(
        manifest.sets[e.set] ?? [],
        {
          src: e.src,
          file: path.relative(OUT, file),
          ...size,
          sourceW: e.w,
          sourceH: e.h,
        },
        order,
      )
      save()
      console.log(`${e.set}/${e.src} ${size.w}×${size.h}`)
    }
    for (const reel of reels) {
      const grade = GRADES[reel]
      const items = list.reels[reel]
        .flatMap((set) => list.sets[set].map((it) => ({ ...it, set })))
        .filter(pick)
      const order = list.reels[reel].flatMap((set) =>
        list.sets[set].map((x) => x.src),
      )
      for (const e of items) {
        const full = path.join(OUT, 'graded', reel, `${e.src}.jpg`)
        const kit = path.join(OUT, 'kit', reel, `${e.src}.jpg`)
        const fs1 = await write(e.src, full, LONG_EDGE, grade)
        const fs2 = await write(e.src, kit, KIT_EDGE, grade)
        manifest.reels[reel] = put(
          manifest.reels[reel] ?? [],
          {
            src: e.src,
            set: e.set,
            graded: path.relative(OUT, full),
            ...fs1,
            kit: path.relative(OUT, kit),
            kitW: fs2.w,
            kitH: fs2.h,
          },
          order,
        )
        save()
      }
      console.log(`graded ${reel}: ${items.length}`)
    }
  } finally {
    await browser.close()
    server.close()
    save()
    console.log(`wrote ${path.relative(process.cwd(), mfFile)}`)
  }
  const want = reels.flatMap((r) =>
    list.reels[r].flatMap((set) => list.sets[set].map((x) => x.src)),
  )
  const have = new Set(
    reels.flatMap((r) => manifest.reels[r].map((x) => x.src)),
  )
  const missing = want.filter((s) => !have.has(s))
  if (missing.length)
    console.log(
      `not yet graded: ${missing.length} (${missing.slice(0, 6).join(' ')}…)`,
    )
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === new URL(import.meta.url).pathname
) {
  main().catch((err) => {
    console.error(err.message ?? err)
    process.exit(1)
  })
}

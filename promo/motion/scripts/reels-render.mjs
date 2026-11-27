#!/usr/bin/env node
// Renders and checks one Instagram reel (Designer promo-reels-3 spec §2, §7):
//   prepare → audio → render (H.264 High CRF 16, yuv420p, +faststart, AAC 48 kHz stereo 192k) → poster → 0.5 s sheet
//   → checks 1–8 of spec §7. Exit 1 on any failed check.
//
//   node scripts/reels-render.mjs --reel a|b|c [--checks-only] [--publish <dir>]
//   node scripts/reels-render.mjs --selftest        # every check must fail on its deliberately bad fixture
//
// Outputs: promo/out/reels/render/reel-<x>.mp4, reel-<x>-poster.jpg, reel-<x>-sheet.png, reel-<x>-checks.json.
// `--publish <dir>` copies the three files there (the reel items pass shared/promo/reels/).
//
// Inputs (until promo-reels-capture lands, all optional; the stub reel needs none of them):
//   promo/out/reels/clips/<x>/<clip>.{webm,mp4}   kit clips (filmed at DPR 3)
//   promo/out/reels/clips/<x>/<clip>.rects.json   { fps, frames: [{ busy: [] , ... }] }: busy = progressbar /
//                                                 *-running* / spinner hits in that frame's DOM (check 5)
//   promo/out/reels/clips/<x>/<clip>.requests.json [{ url, served }]: served = the file on disk (check 7)
//   promo/out/reels/photos/graded/<x>/<src>.jpg   graded CC0 photos; promo/reels/photos.json the CC0 manifest
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import {
  FPS,
  HEIGHT,
  SAFE,
  SHEET_CELL,
  SHEET_COLS,
  WIDTH,
  isCueOnGrid,
  isCutOnGrid,
  reelConfig,
  sheetSize,
} from '../src/reels/shared/beats.js'
import { CAMERA_MIN, cameraAt, shotAt } from '../src/reels/shared/Springs.js'
import { AUDIO_TAG, buildAudio, loadTable, readWav } from './reels-audio.mjs'

const motion = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repo = resolve(motion, '..', '..')
const out = join(repo, 'promo', 'out', 'reels')
const FONTS = join(repo, 'uikit', 'src', 'fonts')
// Inter is the reels' only face; Root also loads the v1/v2 Promo.jsx, whose module loads Lora at import time.
const FONT_FILES = [
  'inter-latin-wght-normal.woff2',
  'lora-latin-wght-normal.woff2',
  'lora-latin-wght-italic.woff2',
]
const MANIFEST = join(repo, 'promo', 'reels', 'photos.json')
const REMOTION = join(motion, 'node_modules', '.bin', 'remotion')

/** Spec §2 end card text, kept here as its own copy so a drift in EndCard.jsx fails check 6. */
export const EXPECTED_TEXT = {
  wordmark: 'Photobooks',
  tagline: 'A quiet place for your books.',
  cta: 'Make your first book →',
  foot: 'Runs in Chrome or Edge. No sign-up, no uploads. · link in bio',
}

// ---------------------------------------------------------------- small file formats

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** 8-bit greyscale PNG. */
export function pngGrey(width, height, pixels) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.writeUInt8(8, 8)
  ihdr.writeUInt8(0, 9)
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) {
    pixels.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** `{ w, h }` of a PNG (IHDR) or JPEG (SOFn), else null. */
export function imageSize(file) {
  if (!existsSync(file)) return null
  const b = readFileSync(file)
  if (b.readUInt32BE(0) === 0x89504e47)
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let p = 2; p + 9 < b.length;) {
      if (b[p] !== 0xff) return null
      const marker = b[p + 1]
      const len = b.readUInt16BE(p + 2)
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      ) {
        return { w: b.readUInt16BE(p + 7), h: b.readUInt16BE(p + 5) }
      }
      p += 2 + len
    }
  }
  return null
}

/** Grain tile k: 540×960, Gaussian σ 18/255 around mid grey, seeded. */
export function grainTile(k) {
  const w = 540
  const h = 960
  let seed = (k + 1) * 2654435761
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) + 1) / 4294967297
  }
  const px = Buffer.alloc(w * h)
  for (let i = 0; i < px.length; i++) {
    const g = Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand())
    px[i] = Math.max(0, Math.min(255, Math.round(128 + 18 * g)))
  }
  return pngGrey(w, h, px)
}

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((name) => {
        const p = join(dir, name)
        return statSync(p).isDirectory() ? walk(p) : [p]
      })
    : []

// ---------------------------------------------------------------- checks (pure: inputs in, { ok, notes } out)

const result = (problems, info = []) => ({
  ok: problems.length === 0,
  notes: problems.length ? problems : info,
})

/** 1. ffprobe: 1080×1920, 30 fps, h264 yuv420p, AAC stereo, 15.0 ≤ duration ≤ 20.0. */
export function check1(probe) {
  const p = []
  const v = probe.streams?.find((s) => s.codec_type === 'video')
  const a = probe.streams?.find((s) => s.codec_type === 'audio')
  if (!v) p.push('no video stream')
  else {
    if (v.width !== WIDTH || v.height !== HEIGHT)
      p.push(`size ${v.width}×${v.height}`)
    if (v.r_frame_rate !== '30/1') p.push(`fps ${v.r_frame_rate}`)
    if (v.codec_name !== 'h264') p.push(`codec ${v.codec_name}`)
    if (v.pix_fmt !== 'yuv420p') p.push(`pix_fmt ${v.pix_fmt}`)
  }
  if (!a) p.push('no audio stream')
  else if (a.codec_name !== 'aac' || a.channels !== 2)
    p.push(`audio ${a.codec_name} ${a.channels} ch`)
  const d = Number(probe.format?.duration)
  if (!(d >= 15 && d <= 20)) p.push(`duration ${d} s`)
  return result(p, [
    `${v?.width}×${v?.height} ${v?.r_frame_rate} ${v?.codec_name} ${v?.pix_fmt}, ${a?.codec_name} ${a?.channels} ch, ${d} s`,
  ])
}

/** 2. Shot table: scale class alternates, 0.5–2.0 s shots (breath + end excepted), cuts and cues on the beat grid. */
export function check2(reel, table) {
  const p = []
  const { shots } = table
  if (shots[0]?.from !== 0) p.push('first shot does not start at 0')
  if (shots.at(-1)?.to !== table.frames) p.push('shots do not cover the reel')
  shots.forEach((s, k) => {
    const prev = shots[k - 1]
    if (prev && s.from !== prev.to)
      p.push(`${s.id} does not start where ${prev.id} ends`)
    if (prev && s.scale === prev.scale)
      p.push(`${prev.id} → ${s.id} both ${s.scale}`)
    if (k > 0 && !isCutOnGrid(reel, s.from))
      p.push(`${s.id} cut at frame ${s.from} off the grid`)
    const len = s.to - s.from
    if (s.breath) {
      const turn = s.breath.to - s.breath.from
      if (turn < 30 || turn > 45)
        p.push(`${s.id} breath turn ${(turn / FPS).toFixed(2)} s`)
    } else if (s.scale !== 'end' && (len < 15 || len > 60)) {
      p.push(`${s.id} lasts ${(len / FPS).toFixed(2)} s`)
    }
  })
  const breath = shots.filter((s) => s.breath)
  const end = shots.findIndex((s) => s.scale === 'end')
  if (breath.length !== 1) p.push(`${breath.length} breath shots (want 1)`)
  else if (shots.indexOf(breath[0]) !== end - 1)
    p.push('the breath is not the shot before the end card')
  if (end !== shots.length - 1) p.push('the end card is not the last shot')
  for (const c of table.cues)
    if (!isCueOnGrid(reel, c)) p.push(`cue ${c.sfx} @ ${c.frame} off the grid`)
  return result(p, [
    `${shots.length} shots, ${table.cues.length} cues on the grid`,
  ])
}

/** 3. UI crops 1.25 ≤ scale ≤ 3 on every frame; no photo above its source px. `photoSize(file)` → { w, h } | null. */
export function check3(table, photoSize) {
  const p = []
  let uiFrames = 0
  for (const s of table.shots) {
    if (s.ui) {
      for (let f = s.from; f < s.to; f++) {
        const scale = cameraAt(s, f).s
        uiFrames++
        if (scale < 1.25 - 1e-9 || scale > 3 + 1e-9) {
          p.push(`${s.id} frame ${f}: UI scale ${scale.toFixed(3)}`)
          break
        }
      }
    }
    for (const ph of s.photos ?? []) {
      const src = photoSize(ph.file)?.w ?? ph.srcW
      if (!src) p.push(`${s.id}: ${ph.file} has no known source size`)
      else if (ph.outW > src)
        p.push(`${s.id}: ${ph.file} shown ${ph.outW} px > source ${src} px`)
    }
  }
  return result(p, [`${uiFrames} UI frames in range`])
}

/** 4. Every frame: camera Δscale ≥ 0.0002 or Δtranslate ≥ 0.15 px. */
export function check4(table) {
  const still = []
  for (let f = 1; f < table.frames; f++) {
    const a = cameraAt(shotAt(table.shots, f - 1), f - 1)
    const b = cameraAt(shotAt(table.shots, f), f)
    const ds = Math.abs(b.s / a.s - 1)
    const dt = Math.hypot(b.tx - a.tx, b.ty - a.ty)
    if (ds < CAMERA_MIN.scale && dt < CAMERA_MIN.translate) still.push(f)
  }
  return result(
    still.length
      ? [`${still.length} frozen frames, first ${still.slice(0, 5).join(', ')}`]
      : [],
    [`${table.frames - 1} frame steps move`],
  )
}

/** 5. UI clips at rate 1 (A2 rewind -1 only); no frame of a clip shows a busy state (capture DOM log). */
export function check5(reel, table, clipsDir) {
  const p = []
  for (const s of table.shots.filter((x) => x.ui)) {
    const rate = s.ui.rate ?? 1
    const rewind = reel === 'a' && s.id === 'A2' && rate === -1
    if (rate !== 1 && !rewind) p.push(`${s.id}: clip rate ${rate}`)
    const log = join(clipsDir, `${s.ui.clip}.rects.json`)
    if (!existsSync(log)) {
      p.push(`${s.id}: no DOM log ${basename(log)}`)
      continue
    }
    const frames = JSON.parse(readFileSync(log, 'utf8')).frames ?? []
    if (!frames.length) p.push(`${s.id}: empty DOM log`)
    const busy = frames
      .map((fr, k) => (!Array.isArray(fr.busy) || fr.busy.length ? k : -1))
      .filter((k) => k >= 0)
    if (busy.length)
      p.push(
        `${s.id}: ${s.ui.clip} busy / unlogged at clip frames ${busy.slice(0, 5).join(', ')}`,
      )
  }
  return result(p, [
    `${table.shots.filter((x) => x.ui).length} UI shots at 1×, DOM clean`,
  ])
}

/** 6. Safe zones for text, CTA and click/drop points; the end card text byte for byte; no other text. */
export function check6(table, logs, posterFrame) {
  const p = []
  const byFrame = new Map(logs.map((l) => [l.frame, l]))
  const missing = []
  for (let f = 0; f < table.frames; f++) if (!byFrame.has(f)) missing.push(f)
  if (missing.length)
    p.push(
      `${missing.length} frames without a text probe, first ${missing.slice(0, 3).join(', ')}`,
    )
  const seen = new Set()
  for (const log of logs) {
    if (log.stray.length)
      p.push(
        `frame ${log.frame}: other text ${JSON.stringify(log.stray.slice(0, 3))}`,
      )
    for (const it of log.items) {
      seen.add(it.role)
      if (!(it.role in EXPECTED_TEXT))
        p.push(`frame ${log.frame}: unknown text role ${it.role}`)
      else if (it.text !== EXPECTED_TEXT[it.role])
        p.push(`frame ${log.frame}: ${it.role} = ${JSON.stringify(it.text)}`)
      if (
        !/^"?Inter"?/.test(it.font) ||
        it.style !== 'normal' ||
        !['400', '600'].includes(String(it.weight))
      ) {
        p.push(
          `frame ${log.frame}: ${it.role} font ${it.font} ${it.weight} ${it.style}`,
        )
      }
      const right = it.x + it.w
      const bottom = it.y + it.h
      if (
        it.x < SAFE.left - 0.5 ||
        right > SAFE.right + 0.5 ||
        it.y < SAFE.top ||
        bottom > SAFE.bottom
      ) {
        p.push(
          `frame ${log.frame}: ${it.role} box ${[it.x, it.y, right, bottom].map(Math.round).join(',')} outside the safe zone`,
        )
      }
      if (
        log.frame === posterFrame &&
        (it.y < SAFE.posterTop || bottom > SAFE.posterBottom)
      ) {
        p.push(`poster: ${it.role} outside the 3:4 crop`)
      }
    }
  }
  for (const role of Object.keys(EXPECTED_TEXT))
    if (!seen.has(role)) p.push(`end card ${role} never shown`)
  for (const c of table.cues.filter((x) => x.x != null)) {
    if (c.x < 0 || c.x > SAFE.right || c.y < SAFE.top || c.y > SAFE.bottom) {
      p.push(
        `${c.sfx} point (${c.x}, ${c.y}) @ ${c.frame} outside the safe zone`,
      )
    }
  }
  // One line per kind of problem (its first frame), not one per frame.
  const first = new Map()
  for (const m of p) {
    const key = m.replace(/^frame \d+: /, '')
    if (!first.has(key)) first.set(key, m)
  }
  return result(
    [...first.values()],
    [`${logs.length} frames probed, end card text exact, no other text`],
  )
}

const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'])
const AUDIO = new Set(['.wav', '.mp3', '.aac', '.m4a', '.ogg', '.flac'])
const KIT_ORIGINAL = /(^|[\\/])(p(0[1-9]|1\d|2[01])\.jpe?g|hi[\\/].*)$/i

/** CC0 file names from promo/reels/photos.json (`<src>.jpg` per entry), or null without a manifest. */
export function manifestNames(file = MANIFEST) {
  if (!existsSync(file)) return null
  const json = JSON.parse(readFileSync(file, 'utf8'))
  const entries = Array.isArray(json) ? json : Object.values(json).flat()
  const names = new Set()
  const visit = (e) => {
    if (Array.isArray(e)) e.forEach(visit)
    else if (e && typeof e === 'object') {
      if (e.src != null) names.add(`${e.src}.jpg`)
      if (e.file) names.add(basename(e.file))
      Object.values(e).forEach((v) => typeof v === 'object' && visit(v))
    }
  }
  visit(entries)
  return names
}

/** 7. Every staged image is a CC0 manifest photo or a generated grain tile; audio is our WAV; no kit originals. */
export function check7(pubDir, names, clipsDir) {
  const p = []
  const files = walk(pubDir)
  for (const f of files) {
    const rel = relative(pubDir, f).split('\\').join('/')
    const ext = extname(f).toLowerCase()
    if (KIT_ORIGINAL.test(rel)) p.push(`kit original staged: ${rel}`)
    else if (IMAGE.has(ext)) {
      const grain = /^grain\/grain-\d+\.png$/.test(rel)
      const photo = rel.startsWith('photos/') && names?.has(basename(rel))
      if (!grain && !photo) p.push(`image not in photos.json: ${rel}`)
    } else if (AUDIO.has(ext)) {
      let tag = null
      try {
        tag = ext === '.wav' ? readWav(readFileSync(f)).tag : null
      } catch {
        tag = null
      }
      if (tag !== AUDIO_TAG)
        p.push(`audio not generated by reels-audio: ${rel}`)
    }
  }
  for (const log of walk(clipsDir).filter((f) =>
    f.endsWith('.requests.json'),
  )) {
    for (const r of JSON.parse(readFileSync(log, 'utf8'))) {
      const served = r.served ?? ''
      if (
        KIT_ORIGINAL.test(served) &&
        /uikit[\\/]dist[\\/]photos/.test(served)
      ) {
        p.push(`${basename(log)}: ${r.url} served the kit original ${served}`)
      }
    }
  }
  return result(p, [
    `${files.length} staged files: CC0 photos, generated grain + audio, kit clips`,
  ])
}

/** 8. Sheet: one 270×480 cell per 0.5 s (6 columns). */
export function check8(sheetFile, frames) {
  const want = sheetSize(frames)
  const got = imageSize(sheetFile)
  if (!got) return result([`no sheet at ${sheetFile}`])
  const p =
    got.w !== want.width || got.h !== want.height
      ? [`sheet ${got.w}×${got.h}, want ${want.width}×${want.height}`]
      : []
  return result(p, [
    `${want.cells} cells of ${SHEET_CELL.w}×${SHEET_CELL.h} (${SHEET_COLS} columns)`,
  ])
}

// ---------------------------------------------------------------- pipeline

function tool(args) {
  const res = spawnSync(REMOTION, args, {
    cwd: motion,
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  })
  if (res.status !== 0)
    throw new Error(`remotion ${args[0]} failed: ${res.stderr || res.stdout}`)
  return res.stdout
}

export const ffprobe = (file) =>
  JSON.parse(
    tool([
      'ffprobe',
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_streams',
      '-show_format',
      file,
    ]),
  )

function prepare(reel, pub) {
  rmSync(pub, { recursive: true, force: true })
  mkdirSync(join(pub, 'fonts'), { recursive: true })
  mkdirSync(join(pub, 'grain'), { recursive: true })
  for (const font of FONT_FILES) {
    copyFileSync(join(FONTS, font), join(pub, 'fonts', font))
  }
  for (let k = 0; k < 8; k++)
    writeFileSync(join(pub, 'grain', `grain-${k}.png`), grainTile(k))
  const clips = join(out, 'clips', reel)
  for (const f of walk(clips).filter((x) => /\.(webm|mp4)$/.test(x))) {
    mkdirSync(join(pub, 'clips'), { recursive: true })
    copyFileSync(f, join(pub, 'clips', basename(f)))
  }
  const graded = join(out, 'photos', 'graded', reel)
  for (const f of walk(graded).filter((x) => /\.jpe?g$/i.test(x))) {
    mkdirSync(join(pub, 'photos'), { recursive: true })
    copyFileSync(f, join(pub, 'photos', basename(f)))
  }
}

async function renderAll(reel, pub, files, table) {
  const { bundle } = await import('@remotion/bundler')
  const { renderMedia, renderStill, selectComposition } =
    await import('@remotion/renderer')
  const id = reel.toUpperCase()
  console.log('bundle …')
  const serveUrl = await bundle({
    entryPoint: join(motion, 'src', 'index.jsx'),
    publicDir: pub,
  })
  const logs = []
  const onBrowserLog = (log) => {
    if (log.text.startsWith('REEL_TEXT '))
      logs.push(JSON.parse(log.text.slice('REEL_TEXT '.length)))
  }
  const composition = await selectComposition({
    serveUrl,
    id: `Reel${id}`,
    inputProps: {},
  })
  if (composition.durationInFrames !== table.frames)
    throw new Error('composition length ≠ shot table')
  const raw = files.video.replace(/\.mp4$/, '.raw.mp4')
  let step = -1
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: 16,
    pixelFormat: 'yuv420p',
    audioCodec: 'aac',
    audioBitrate: '192k',
    outputLocation: raw,
    onBrowserLog,
    onProgress: ({ progress }) => {
      const k = Math.floor(progress * 10)
      if (k !== step) {
        step = k
        console.log(`render ${k * 10} %`)
      }
    },
  })
  tool([
    'ffmpeg',
    '-y',
    '-v',
    'error',
    '-i',
    raw,
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    files.video,
  ])
  rmSync(raw, { force: true })
  writeFileSync(files.text, JSON.stringify(logs))
  const { poster } = reelConfig(reel)
  await renderStill({
    composition,
    serveUrl,
    frame: poster,
    imageFormat: 'jpeg',
    jpegQuality: 92,
    output: files.poster,
  })
  const sheet = await selectComposition({
    serveUrl,
    id: `ReelSheet${id}`,
    inputProps: {},
  })
  await renderStill({
    composition: sheet,
    serveUrl,
    frame: 0,
    imageFormat: 'png',
    output: files.sheet,
  })
}

function runChecks(reel, table, pub, files) {
  const clipsDir = join(out, 'clips', reel)
  const logs = existsSync(files.text)
    ? JSON.parse(readFileSync(files.text, 'utf8'))
    : []
  const checks = [
    ['1 ffprobe', () => check1(ffprobe(files.video))],
    ['2 shot table', () => check2(reel, table)],
    [
      '3 crop scale / photo px',
      () => check3(table, (f) => imageSize(join(pub, 'photos', f))),
    ],
    ['4 camera never still', () => check4(table)],
    ['5 real time, no busy UI', () => check5(reel, table, clipsDir)],
    ['6 safe zones + text', () => check6(table, logs, reelConfig(reel).poster)],
    ['7 licences', () => check7(pub, manifestNames(), clipsDir)],
    ['8 sheet', () => check8(files.sheet, table.frames)],
  ]
  const results = checks.map(([name, fn]) => {
    let r
    try {
      r = fn()
    } catch (e) {
      r = { ok: false, notes: [String(e.message ?? e)] }
    }
    console.log(
      `${r.ok ? 'ok  ' : 'FAIL'} ${name}: ${r.notes.slice(0, 6).join('; ')}`,
    )
    return { name, ...r }
  })
  writeFileSync(files.checks, JSON.stringify(results, null, 1))
  return results.every((r) => r.ok)
}

async function runReel(reel, { checksOnly, publish }) {
  const table = await loadTable(reel)
  const pub = join(out, 'public', reel)
  const dir = join(out, 'render')
  mkdirSync(dir, { recursive: true })
  const files = {
    video: join(dir, `reel-${reel}.mp4`),
    poster: join(dir, `reel-${reel}-poster.jpg`),
    sheet: join(dir, `reel-${reel}-sheet.png`),
    text: join(dir, `reel-${reel}-text.json`),
    checks: join(dir, `reel-${reel}-checks.json`),
  }
  if (table.stub)
    console.log(`reel ${reel}: stub shot table (no ${reel}.shots.js yet)`)
  if (!checksOnly) {
    prepare(reel, pub)
    const audio = await buildAudio(reel, join(pub, 'audio'), table)
    for (const line of audio.lines) console.log(`audio: ${line}`)
    if (!audio.ok) throw new Error('audio check failed')
    await renderAll(reel, pub, files, table)
  }
  const ok = runChecks(reel, table, pub, files)
  if (ok && publish) {
    mkdirSync(publish, { recursive: true })
    for (const f of [files.video, files.poster, files.sheet])
      copyFileSync(f, join(publish, basename(f)))
    console.log(`published to ${publish}`)
  }
  return ok
}

// ---------------------------------------------------------------- selftest: one bad fixture per check

async function selftest() {
  const dir = join(out, 'selftest')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const good = await loadTable('a')
  const clone = () => JSON.parse(JSON.stringify(good))

  // 1: a 1920×1080 25 fps yuv444p video without audio, 2 s.
  const badProbe = {
    streams: [
      {
        codec_type: 'video',
        width: 1920,
        height: 1080,
        r_frame_rate: '25/1',
        codec_name: 'h264',
        pix_fmt: 'yuv444p',
      },
    ],
    format: { duration: '2.0' },
  }
  // 2: A3 shares A2's scale, A4 cut half a beat + 1 frame late, a cue between frames.
  const t2 = clone()
  t2.shots[2].scale = 'Md'
  t2.shots[3].from += 10
  t2.shots[2].to += 10
  t2.cues[0].frame += 1
  // 3: a UI shot cropped 1000 px wide (scale 1.08) and a photo shown wider than its source.
  const t3 = clone()
  t3.shots[1].ui = { clip: 'fixture', rate: 1 }
  t3.shots[1].cam = [
    { cx: 640, cy: 720, w: 1000 },
    { cx: 640, cy: 720, w: 1000 },
  ]
  t3.shots[2].photos = [{ file: 'L18.jpg', outW: 4600, srcW: 4000 }]
  // 4: a locked-off shot (no drift, no push, equal keys).
  const t4 = clone()
  Object.assign(t4.shots[4], {
    drift: { x: 0, y: 0 },
    push: 0,
    cam: [t4.shots[4].cam[0], t4.shots[4].cam[0]],
  })
  // 5: a clip played at 1.5× and a DOM log with a progressbar frame.
  const t5 = clone()
  t5.shots[3].ui = { clip: 'busy', rate: 1.5 }
  const clips5 = join(dir, 'clips')
  mkdirSync(clips5, { recursive: true })
  writeFileSync(
    join(clips5, 'busy.rects.json'),
    JSON.stringify({
      fps: 30,
      frames: [{ busy: [] }, { busy: ['[role=progressbar]'] }],
    }),
  )
  // 6: a changed tagline, a stray caption, a foot pushed into the bottom margin, a click under the Reels UI.
  const t6 = clone()
  t6.cues.find((c) => c.x != null).y = 1700
  const items = Object.entries(EXPECTED_TEXT).map(([role, text], k) => ({
    role,
    text,
    x: 96,
    y: 1000 + k * 140,
    w: 700,
    h: 60,
    font: 'Inter',
    weight: '400',
    style: 'normal',
  }))
  items[1].text = 'A quiet place for your books'
  items[3].y = 1500
  const logs6 = Array.from({ length: t6.frames }, (_, frame) => ({
    frame,
    items,
    stray: frame === 10 ? ['Fill book'] : [],
  }))
  // 7: a kit thumb p05.jpg, a non-CC0 photo and an MP3 staged.
  const pub7 = join(dir, 'public')
  mkdirSync(join(pub7, 'photos'), { recursive: true })
  mkdirSync(join(pub7, 'audio'), { recursive: true })
  writeFileSync(
    join(pub7, 'photos', 'p05.jpg'),
    Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  )
  writeFileSync(
    join(pub7, 'photos', 'stock.jpg'),
    Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  )
  writeFileSync(join(pub7, 'audio', 'track.mp3'), Buffer.from('ID3'))
  // 8: a 3×2 sheet of 320×180 cells.
  const sheet8 = join(dir, 'sheet.png')
  writeFileSync(sheet8, pngGrey(960, 360, Buffer.alloc(960 * 360, 40)))

  const cases = [
    ['1 ffprobe', () => check1(badProbe)],
    ['2 shot table', () => check2('a', t2)],
    ['3 crop scale / photo px', () => check3(t3, () => null)],
    ['4 camera never still', () => check4(t4)],
    ['5 real time, no busy UI', () => check5('a', t5, clips5)],
    ['6 safe zones + text', () => check6(t6, logs6, 525)],
    ['7 licences', () => check7(pub7, new Set(['L18.jpg']), clips5)],
    ['8 sheet', () => check8(sheet8, t6.frames)],
  ]
  let ok = true
  for (const [name, fn] of cases) {
    const r = fn()
    console.log(
      `${r.ok ? 'PASSED (bad!)' : 'fails as it should'} — check ${name}: ${r.notes.slice(0, 4).join('; ')}`,
    )
    ok &&= !r.ok
  }
  // And the stub tables pass the table-only checks (2, 4) for every reel.
  for (const reel of ['a', 'b', 'c']) {
    const t = await loadTable(reel)
    for (const [name, r] of [
      ['2', check2(reel, t)],
      ['4', check4(t)],
    ]) {
      console.log(
        `${r.ok ? 'ok' : 'FAIL'} — reel ${reel} table check ${name}: ${r.notes.slice(0, 3).join('; ')}`,
      )
      ok &&= r.ok
    }
  }
  return ok
}

async function main() {
  const args = process.argv.slice(2)
  const arg = (name) => {
    const k = args.indexOf(name)
    return k >= 0 ? args[k + 1] : undefined
  }
  if (args.includes('--selftest')) {
    process.exit((await selftest()) ? 0 : 1)
  }
  const reel = arg('--reel')
  if (!reel)
    throw new Error(
      'usage: reels-render.mjs --reel a|b|c [--checks-only] [--publish <dir>] | --selftest',
    )
  reelConfig(reel)
  const publish = arg('--publish') ? resolve(arg('--publish')) : null
  const ok = await runReel(reel, {
    checksOnly: args.includes('--checks-only'),
    publish,
  })
  console.log(
    ok ? `reel ${reel}: all checks pass` : `reel ${reel}: checks FAILED`,
  )
  process.exit(ok ? 0 : 1)
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main()
}

#!/usr/bin/env node
// Renders and checks one Instagram reel (Designer promo-reels-3 spec §2, §7):
//   prepare → audio → render (H.264 High CRF 14 preset slow, yuv420p, +faststart, AAC 48 kHz stereo 192k) → poster
//   → 0.5 s sheet → checks 1–8 of spec §7 and 9–11 of promo-reels-v2 §5. Exit 1 on any failed check.
//
//   node scripts/reels-render.mjs --reel a|b|c [--checks-only] [--publish <dir>] [--music <file>]
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
import { spawn, spawnSync } from 'node:child_process'
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
import { deflateSync, inflateSync } from 'node:zlib'
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
  'inter-latin-opsz-normal.woff2',
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

// ---------------------------------------------------------------- v2 checks 9–11 (promo-reels-v2 spec §2 G1–G3, G6, §5)
//
// Inputs: the `REEL_GEOM` log Finish.jsx writes per frame (reel-<x>-geom.json), the clips' rects.json `geom:*`
// targets (capture.mjs) mapped through the shot camera, and the decoded output frames (rgb24). The functions below
// are pure; the pipeline collects their inputs.

/** Spec v2 thresholds. */
export const GEO = {
  scaleTol: 0.002, // |sx − sy| ≤ 0.002·sx
  skewDeg: 0.1,
  aspectTol: 0.003, // media / mask box vs image aspect
  handleTol: 0.04, // round handle |w/h − 1|
  pageTol: 0.005, // page / book output aspect vs CSS aspect
  band: { rows: 96, level: 28 },
  share: { M: 0.45, Md: 0.45, W: 0.25 },
  uiOnly: { frames: 18, count: 2 },
  first: { share: 0.45, within: 4 },
  every: 15,
}

/** G1 in source: banned anywhere under promo/motion/src/reels/. */
export const BANNED_SRC = [
  [/\bscale[XY]\s*\(/, 'scaleX/scaleY'],
  [/\bmatrix3d\s*\(/, 'matrix3d'],
  [/\bskew[XY]?\s*\(/, 'skew'],
  [/object-?fit['"]?\s*:\s*['"]?(fill|contain)\b/i, 'object-fit fill|contain'],
]

/** Problems grouped by key: first frame, count, worst value. */
function tally() {
  const map = new Map()
  return {
    add(key, frame, value) {
      const t = map.get(key) ?? { first: frame, n: 0, worst: value }
      t.n++
      if (value != null && Math.abs(value) > Math.abs(t.worst ?? 0))
        t.worst = value
      map.set(key, t)
    },
    lines: () =>
      [...map].map(
        ([key, t]) =>
          `${key}: ${t.n}× from frame ${t.first}${t.worst != null ? `, worst ${+t.worst.toFixed(4)}` : ''}`,
      ),
  }
}

/**
 * A computed `transform` (`none`, `matrix(a, b, c, d, e, f)` or `matrix3d(…)`) → `{ sx, sy, skew° , is3d }`
 * (QR decomposition of the 2×2 part; sy is signed, a mirror has sy < 0). Null when it does not parse.
 */
export function decompose(transform) {
  if (!transform || transform === 'none')
    return { sx: 1, sy: 1, skew: 0, is3d: false }
  const m = /^matrix(3d)?\(([^)]*)\)$/.exec(transform.trim())
  if (!m) return null
  const v = m[2].split(',').map(Number)
  if (v.some((x) => !Number.isFinite(x))) return null
  const [a, b, c, d] = m[1] ? [v[0], v[1], v[4], v[5]] : v
  const sx = Math.hypot(a, b)
  if (!sx) return { sx: 0, sy: 0, skew: 0, is3d: !!m[1] }
  const sy = (a * d - b * c) / sx
  const shear = (a * c + b * d) / sx
  const skew = (Math.atan2(shear, Math.abs(sy)) * 180) / Math.PI
  return { sx, sy, skew, is3d: !!m[1] }
}

/** Computed `scale` property (`none`, `s`, `sx sy`, `sx sy sz`) → `{ sx, sy }`. */
export function parseScale(scale) {
  if (!scale || scale === 'none') return { sx: 1, sy: 1 }
  const [sx, sy = sx] = scale.trim().split(/\s+/).map(Number)
  return { sx, sy }
}

const uniform = (sx, sy) =>
  Math.abs(Math.abs(sx) - Math.abs(sy)) <= GEO.scaleTol * Math.abs(sx)

/** One probe transform entry → a problem string or null. */
export function transformProblem({ transform, scale }) {
  const d = decompose(transform)
  if (!d) return `unparsed transform ${transform}`
  if (d.is3d) return 'matrix3d'
  if (!uniform(d.sx, d.sy)) return `non-uniform scale (sx/sy)`
  if (Math.abs(d.skew) > GEO.skewDeg) return 'skew'
  const s = parseScale(scale)
  if (!uniform(s.sx, s.sy)) return 'non-uniform scale property'
  return null
}

const aspectOff = ([w, h], [iw, ih]) => Math.abs((w / h) * (ih / iw) - 1)

/** img / video / canvas: box aspect = intrinsic aspect (± 0.3 %) or object-fit: cover. */
export function mediaProblem({ tag, box, intrinsic, fit }) {
  if (!intrinsic || !intrinsic[0] || !intrinsic[1] || !box[0] || !box[1])
    return null
  const off = aspectOff(box, intrinsic)
  if (off > GEO.aspectTol && fit !== 'cover')
    return `${tag} ${box.join('×')} shows ${intrinsic.join('×')} with object-fit ${fit}`
  return null
}

/** mask-size / background-size 100% 100% only when the image aspect = the box aspect (± 0.3 %). */
export function maskProblem({ prop, box, image }) {
  if (!image) return `${prop} image size unknown`
  if (!box[0] || !box[1]) return null
  return aspectOff(box, image) > GEO.aspectTol
    ? `${prop}-size 100% 100% stretches ${image.join('×')} into ${box.join('×')}`
    : null
}

/** Frames check 9 walks: every shot's first, middle and last frame, every 15th frame, and frames 0–4 (G6). */
export function geomSampleFrames(table) {
  const set = new Set()
  for (const s of table.shots)
    for (const f of [s.from, Math.floor((s.from + s.to - 1) / 2), s.to - 1])
      set.add(f)
  for (let f = 0; f < table.frames; f += GEO.every) set.add(f)
  for (let f = 0; f <= GEO.first.within; f++) set.add(f)
  return [...set]
    .filter((f) => f >= 0 && f < table.frames)
    .sort((a, b) => a - b)
}

/**
 * 9. G1 static: computed transforms decompose to one scale (|sx − sy| ≤ 0.002·sx), skew ≤ 0.1°, no matrix3d; media
 * and mask rules; no banned pattern in the reels' source; every clip file is viewport × DPR, SAR 1:1.
 * `logs` = REEL_GEOM entries, `frames` = the sample, `sources` = [{ file, text }], `clips` = clipSizes() output.
 */
export function check9({ logs, frames, sources, clips }) {
  const t = tally()
  const byFrame = new Map(logs.map((l) => [l.frame, l]))
  const missing = frames.filter((f) => !byFrame.has(f))
  const n = { frames: 0, transforms: 0, media: 0, masks: 0 }
  for (const f of frames) {
    const l = byFrame.get(f)
    if (!l) continue
    n.frames++
    for (const x of l.transforms ?? []) {
      n.transforms++
      const bad = transformProblem(x)
      if (bad) {
        const d = decompose(x.transform)
        t.add(`${x.el} ${bad}`, f, d ? d.sx / d.sy - 1 : null)
      }
    }
    for (const x of l.media ?? []) {
      n.media++
      const bad = mediaProblem(x)
      if (bad) t.add(`${x.el} ${bad}`, f)
    }
    for (const x of l.masks ?? []) {
      n.masks++
      const bad = maskProblem(x)
      if (bad) t.add(`${x.el} ${bad}`, f)
    }
  }
  const p = []
  if (missing.length)
    p.push(
      `no geometry log at ${missing.length}/${frames.length} sampled frames (first ${missing.slice(0, 5).join(', ')})`,
    )
  p.push(...t.lines())
  for (const { file, text } of sources) {
    text.split('\n').forEach((line, k) => {
      for (const [re, what] of BANNED_SRC)
        if (re.test(line)) p.push(`${file}:${k + 1}: ${what}`)
    })
  }
  for (const c of clips) {
    if (!c.actual) p.push(`clip ${c.id}: no file to measure`)
    else if (c.actual.w !== c.expected.w || c.actual.h !== c.expected.h)
      p.push(
        `clip ${c.id}: ${c.actual.w}×${c.actual.h}, wanted viewport × DPR ${c.expected.w}×${c.expected.h}`,
      )
    else if (c.actual.sar && !['1:1', '0:1', 'N/A'].includes(c.actual.sar))
      p.push(`clip ${c.id}: SAR ${c.actual.sar}`)
  }
  const numbers = { ...n, sampled: frames.length, clips: clips.length }
  return {
    ...result(p, [
      `${n.frames} frames walked: ${n.transforms} transforms, ${n.media} media, ${n.masks} masks uniform; ` +
        `${sources.length} source files clean; ${clips.length} clips at viewport × DPR`,
    ]),
    numbers,
  }
}

// ---- pixels

/** Longest full-width run of rows whose every channel is < 28 in an rgb24 frame. `{ rows, start }`. */
export function blackBand(rgb, w, h, level = GEO.band.level) {
  let best = { rows: 0, start: -1 }
  let run = 0
  const stride = w * 3
  for (let y = 0; y < h; y++) {
    let dark = true
    for (let i = y * stride, end = i + stride; i < end; i++) {
      if (rgb[i] >= level) {
        dark = false
        break
      }
    }
    run = dark ? run + 1 : 0
    if (run > best.rows) best = { rows: run, start: y - run + 1 }
  }
  return best
}

const lumAt = (rgb, w, x, y) => {
  const i = (y * w + x) * 3
  return 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2]
}

/** Strongest luminance step in `prof` within [lo, hi] (indices), with a sub-pixel parabola fit. */
function edgeAt(prof, lo, hi) {
  let best = -1
  let k = -1
  for (let i = Math.max(1, lo); i <= Math.min(prof.length - 1, hi); i++) {
    const g = Math.abs(prof[i] - prof[i - 1])
    if (g > best) {
      best = g
      k = i
    }
  }
  if (k < 2 || k > prof.length - 2) return k
  const g = (i) => Math.abs(prof[i] - prof[i - 1])
  const [a, b, c] = [g(k - 1), g(k), g(k + 1)]
  const den = a - 2 * b + c
  return k + (den ? (0.5 * (a - c)) / den : 0)
}

/**
 * Measured size of the shape expected at `rect` (output px) in an rgb24 frame: the strongest luminance edge within
 * ± `pad` of each expected side, along the rect's centre row and column (3-line average). Null when the search
 * window leaves the frame.
 */
export function measureBox(rgb, w, h, rect, pad) {
  const x0 = Math.floor(rect.x - pad)
  const x1 = Math.ceil(rect.x + rect.w + pad)
  const y0 = Math.floor(rect.y - pad)
  const y1 = Math.ceil(rect.y + rect.h + pad)
  if (x0 < 1 || y0 < 1 || x1 >= w - 1 || y1 >= h - 1) return null
  const cx = Math.round(rect.x + rect.w / 2)
  const cy = Math.round(rect.y + rect.h / 2)
  const row = []
  for (let x = x0; x <= x1; x++)
    row.push(
      (lumAt(rgb, w, x, cy - 1) +
        lumAt(rgb, w, x, cy) +
        lumAt(rgb, w, x, cy + 1)) /
        3,
    )
  const col = []
  for (let y = y0; y <= y1; y++)
    col.push(
      (lumAt(rgb, w, cx - 1, y) +
        lumAt(rgb, w, cx, y) +
        lumAt(rgb, w, cx + 1, y)) /
        3,
    )
  const p = Math.ceil(pad)
  const left = edgeAt(row, 0, 2 * p)
  const right = edgeAt(row, row.length - 1 - 2 * p, row.length - 1)
  const top = edgeAt(col, 0, 2 * p)
  const bottom = edgeAt(col, col.length - 1 - 2 * p, col.length - 1)
  return { w: right - left, h: bottom - top }
}

/** Search pad: round handles ± 35 % of their size, pages / books / screens ± 3 %. */
export const measurePad = (kind, rect) =>
  kind === 'handle'
    ? Math.max(3, 0.35 * Math.max(rect.w, rect.h))
    : Math.max(4, 0.03 * Math.max(rect.w, rect.h))

/** Kinds measured in pixels (the phone body is checked by its DOM box; its screen carries the pixel edge). */
export const PIXEL_KINDS = new Set(['handle', 'page', 'endbook', 'screen'])

/**
 * 10. G1 pixels: every round handle in frame has |w/h − 1| ≤ 0.04; every page / book / screen's output aspect
 * (pixels, and its DOM box) equals its CSS aspect within 0.5 %. `measures` = [{ frame, kind, css: [w, h],
 * out: [x, y, w, h], px: { w, h } | null }].
 */
export function check10(measures) {
  if (!measures)
    return { ...result(['no rendered video to measure']), numbers: {} }
  const t = tally()
  const n = { handle: 0, page: 0, unmeasured: 0 }
  let worstHandle = 0
  let worstPage = 0
  for (const m of measures) {
    const cssA = m.css[0] / m.css[1]
    if (m.kind !== 'handle' && m.out && m.out[2] && m.out[3]) {
      const off = m.out[2] / m.out[3] / cssA - 1
      worstPage = Math.max(worstPage, Math.abs(off))
      if (Math.abs(off) > GEO.pageTol)
        t.add(`${m.kind} box aspect off`, m.frame, off)
    }
    if (!PIXEL_KINDS.has(m.kind)) continue
    if (!m.px || !(m.px.h > 0)) {
      n.unmeasured++
      continue
    }
    const pxA = m.px.w / m.px.h
    if (m.kind === 'handle') {
      n.handle++
      const off = pxA - 1
      worstHandle = Math.max(worstHandle, Math.abs(off))
      if (Math.abs(off) > GEO.handleTol)
        t.add('round handle w/h off', m.frame, off)
    } else {
      n.page++
      const off = pxA / cssA - 1
      worstPage = Math.max(worstPage, Math.abs(off))
      if (Math.abs(off) > GEO.pageTol)
        t.add(`${m.kind} pixel aspect off`, m.frame, off)
    }
  }
  return {
    ...result(t.lines(), [
      `${n.handle} handle and ${n.page} page/book/screen measurements in range (${n.unmeasured} at the frame edge)`,
    ]),
    numbers: { ...n, worstHandle, worstPage },
  }
}

/** Union area of `rects` ([x, y, w, h], output px) clipped to the frame, on a 4 px grid, as a share of the frame. */
export function photoShare(rects) {
  const g = 4
  const cols = WIDTH / g
  const rows = HEIGHT / g
  const grid = new Uint8Array(cols * rows)
  let hit = 0
  for (const [x, y, w, h] of rects) {
    const c0 = Math.max(0, Math.round(x / g))
    const c1 = Math.min(cols, Math.round((x + w) / g))
    const r0 = Math.max(0, Math.round(y / g))
    const r1 = Math.min(rows, Math.round((y + h) / g))
    for (let r = r0; r < r1; r++)
      for (let c = c0; c < c1; c++) {
        const i = r * cols + c
        if (!grid[i]) {
          grid[i] = 1
          hit++
        }
      }
  }
  return hit / grid.length
}

const median = (xs) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * 11. G2 / G3 / G6: no full-width band ≥ 96 rows with every channel < 28 in any frame; photo share (median of the
 * shot's sampled frames) ≥ .45 in M / Md, ≥ .25 in W; UI-only shots (`uiOnly`) ≤ 0.6 s, at most two; one of frames
 * 0–4 ≥ .45 photo; the end-card book ≥ 780 px wide (B: the phone ≥ 700). `bands` = [{ frame, rows, start }] (all
 * frames), `shares` = Map frame → share, `end` = the last frame's geom boxes.
 */
export function check11(reel, table, { bands, shares, end }) {
  const p = []
  const t = tally()
  if (!bands) p.push('no rendered video to scan for bands')
  let worstBand = 0
  for (const b of bands ?? []) {
    worstBand = Math.max(worstBand, b.rows)
    if (b.rows >= GEO.band.rows)
      t.add(`black band ≥ ${GEO.band.rows} rows`, b.frame, b.rows)
  }
  p.push(...t.lines())
  const perShot = {}
  for (const s of table.shots) {
    const min = GEO.share[s.scale]
    if (min == null) continue
    const xs = [...shares]
      .filter(([f]) => f >= s.from && f < s.to)
      .map(([, v]) => v)
    const m = median(xs)
    perShot[s.id] = +m.toFixed(3)
    if (m < min)
      p.push(`${s.id} (${s.scale}): photo share ${m.toFixed(2)} < ${min}`)
  }
  const ui = table.shots.filter((s) => s.uiOnly)
  for (const s of ui)
    if (s.to - s.from > GEO.uiOnly.frames)
      p.push(
        `${s.id}: UI-only for ${s.to - s.from} frames > ${GEO.uiOnly.frames}`,
      )
  if (ui.length > GEO.uiOnly.count)
    p.push(`${ui.length} UI-only moments > ${GEO.uiOnly.count}`)
  let first = 0
  for (let f = 0; f <= GEO.first.within; f++)
    first = Math.max(first, shares.get(f) ?? 0)
  if (first < GEO.first.share)
    p.push(
      `frames 0–${GEO.first.within}: photo share ${first.toFixed(2)} < ${GEO.first.share}`,
    )
  const kind = reel === 'b' ? 'phone' : 'endbook'
  const min = reel === 'b' ? 700 : 780
  const hero = (end ?? []).filter((g) => g.kind === kind)
  const endW = hero.length ? Math.max(...hero.map((g) => g.out[2])) : 0
  if (endW < min) p.push(`end card ${kind} ${endW.toFixed(0)} px wide < ${min}`)
  return {
    ...result(p, [
      `worst dark band ${worstBand} rows; frame 0–4 photo share ${first.toFixed(2)}; end ${kind} ${endW.toFixed(0)} px`,
    ]),
    numbers: {
      worstBand,
      firstShare: +first.toFixed(3),
      perShot,
      endWidth: endW,
      uiOnly: ui.length,
    },
  }
}

// ---- collecting the inputs

const findFile = (root, name) => walk(root).find((f) => basename(f) === name)

/** Clip frame index for output frame `f` of a UI shot (`ui.start` = first clip frame; rate −1 plays backwards). */
const clipFrame = (s, f) =>
  (s.ui.start ?? 0) + (f - s.from) * (s.ui.rate === -1 ? -1 : 1)

/**
 * Geometry from the clips: rects.json targets named `geom:<kind>` (capture.mjs adds handles and pages to every clip)
 * mapped through the shot camera into output px. Returns Map frame → [{ kind, css, out }].
 */
export function clipGeom(table, clipsRoot) {
  const byFrame = new Map()
  const cache = new Map()
  for (const s of table.shots.filter((x) => x.ui?.clip)) {
    if (!cache.has(s.ui.clip)) {
      const file = findFile(clipsRoot, `${s.ui.clip}.rects.json`)
      cache.set(s.ui.clip, file ? JSON.parse(readFileSync(file, 'utf8')) : null)
    }
    const log = cache.get(s.ui.clip)
    if (!log) continue
    for (let f = s.from; f < s.to; f++) {
      const rects = log.frames?.[clipFrame(s, f)]?.rects
      if (!rects) continue
      const cam = cameraAt(s, f)
      for (const [name, v] of Object.entries(rects)) {
        if (!name.startsWith('geom:') || !v) continue
        for (const [x, y, w, h] of Array.isArray(v[0]) ? v : [v]) {
          const item = {
            kind: name.slice(5),
            css: [w, h],
            out: [x * cam.s + cam.tx, y * cam.s + cam.ty, w * cam.s, h * cam.s],
          }
          byFrame.set(f, [...(byFrame.get(f) ?? []), item])
        }
      }
    }
  }
  return byFrame
}

/** Map frame → photo share (DOM `data-photo` boxes + clip `geom:photo` boxes) for the logged frames. */
export function photoShares(logs, cgeom) {
  const shares = new Map()
  for (const l of logs) {
    const rects = [
      ...(l.photos ?? []).map((x) => x.out),
      ...(cgeom.get(l.frame) ?? [])
        .filter((g) => g.kind === 'photo')
        .map((g) => g.out),
    ]
    shares.set(l.frame, photoShare(rects))
  }
  return shares
}

/** Every clip a shot names: its expected pixels (capture `<clip>.json`) and the measured file. */
function clipSizes(table, clipsRoot, pub) {
  const ids = [
    ...new Set(table.shots.filter((s) => s.ui?.clip).map((s) => s.ui.clip)),
  ]
  return ids.map((id) => {
    const metaFile = findFile(clipsRoot, `${id}.json`)
    const meta = metaFile ? JSON.parse(readFileSync(metaFile, 'utf8')) : null
    const expected = meta?.pixels
      ? { w: meta.pixels.width, h: meta.pixels.height }
      : { w: NaN, h: NaN }
    const video = walk(join(pub, 'clips')).find(
      (f) => basename(f).replace(/\.(webm|mp4)$/, '') === id,
    )
    let actual = null
    if (video) {
      const v = ffprobe(video).streams?.find((x) => x.codec_type === 'video')
      if (v) actual = { w: v.width, h: v.height, sar: v.sample_aspect_ratio }
    } else if (metaFile) {
      const frame = walk(join(dirname(metaFile), 'frames')).sort()[0]
      const size = frame ? imageSize(frame) : null
      if (size) actual = { ...size, sar: '1:1' }
    }
    return { id, expected, actual }
  })
}

const reelSources = () =>
  walk(join(motion, 'src', 'reels'))
    .filter((f) => /\.(jsx?|mjs)$/.test(f))
    .map((f) => ({ file: relative(repo, f), text: readFileSync(f, 'utf8') }))

/** 8-bit RGB / RGBA PNG (non-interlaced) → `{ w, h, rgb }` (rgb24). Enough for ffmpeg's png encoder output. */
export function decodePng(b) {
  let p = 8
  let w = 0
  let h = 0
  let type = 2
  const idat = []
  while (p < b.length) {
    const len = b.readUInt32BE(p)
    const t = b.toString('latin1', p + 4, p + 8)
    const data = b.subarray(p + 8, p + 8 + len)
    if (t === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      type = data[9]
      if (data[8] !== 8 || ![2, 6].includes(type) || data[12])
        throw new Error('PNG: only 8-bit non-interlaced RGB(A)')
    } else if (t === 'IDAT') idat.push(data)
    else if (t === 'IEND') break
    p += 12 + len
  }
  const bpp = type === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const cur = Buffer.alloc(stride)
  const prev = Buffer.alloc(stride)
  const rgb = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const up = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v = line[i]
      if (f === 1) v += a
      else if (f === 2) v += up
      else if (f === 3) v += (a + up) >> 1
      else if (f === 4) {
        const pa = Math.abs(up - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + up - 2 * c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c
      }
      cur[i] = v & 0xff
    }
    for (let x = 0; x < w; x++)
      cur.copy(rgb, (y * w + x) * 3, x * bpp, x * bpp + 3)
    cur.copy(prev)
  }
  return { w, h, rgb }
}

/** End offset of the first whole PNG in `b` (after IEND), or -1. */
function pngEnd(b) {
  if (b.length < 8) return -1
  for (let p = 8; p + 12 <= b.length;) {
    const len = b.readUInt32BE(p)
    if (b.toString('latin1', p + 4, p + 8) === 'IEND')
      return p + 12 + len <= b.length ? p + 12 + len : -1
    p += 12 + len
  }
  return -1
}

/**
 * Decodes `video` and calls `onFrame(index, rgb24)` per frame. Remotion's ffmpeg has no rawvideo muxer, so frames
 * come as a stream of uncompressed PNGs.
 */
function decodeFrames(video, onFrame) {
  return new Promise((ok, fail) => {
    const ff = spawn(
      REMOTION,
      [
        'ffmpeg',
        '-v',
        'error',
        '-i',
        video,
        '-f',
        'image2pipe',
        '-c:v',
        'png',
        '-compression_level',
        '0',
        '-pix_fmt',
        'rgb24',
        'pipe:1',
      ],
      { cwd: motion },
    )
    // growable buffer: chunks are ~64 KB, frames ~6 MB
    let buf = Buffer.alloc(16 << 20)
    let len = 0
    let frame = 0
    let err = ''
    ff.stdout.on('data', (chunk) => {
      if (len + chunk.length > buf.length) {
        const next = Buffer.alloc(Math.max(buf.length * 2, len + chunk.length))
        buf.copy(next, 0, 0, len)
        buf = next
      }
      chunk.copy(buf, len)
      len += chunk.length
      for (
        let end = pngEnd(buf.subarray(0, len));
        end > 0;
        end = pngEnd(buf.subarray(0, len))
      ) {
        const png = decodePng(buf.subarray(0, end))
        if (png.w !== WIDTH || png.h !== HEIGHT)
          throw new Error(`decoded frame ${png.w}×${png.h}`)
        onFrame(frame++, png.rgb)
        buf.copy(buf, 0, end, len)
        len -= end
      }
    })
    ff.stderr.on('data', (d) => (err += d))
    ff.on('error', fail)
    ff.on('close', (code) =>
      code === 0 ? ok(frame) : fail(new Error(`frame decode failed: ${err}`)),
    )
  })
}

/** One pass over the output frames: dark bands per frame, pixel sizes of every geom box in frame. */
async function pixelPass(video, logs, cgeom) {
  const geomAt = new Map(logs.map((l) => [l.frame, l.geom ?? []]))
  const bands = []
  const measures = []
  await decodeFrames(video, (f, rgb) => {
    bands.push({ frame: f, ...blackBand(rgb, WIDTH, HEIGHT) })
    for (const g of [...(geomAt.get(f) ?? []), ...(cgeom.get(f) ?? [])]) {
      if (g.kind === 'photo') continue
      const [x, y, w, h] = g.out
      const rect = { x, y, w, h }
      const px = PIXEL_KINDS.has(g.kind)
        ? measureBox(rgb, WIDTH, HEIGHT, rect, measurePad(g.kind, rect))
        : null
      measures.push({ frame: f, ...g, px })
    }
  })
  return { bands, measures }
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
  const geom = new Map()
  const onBrowserLog = (log) => {
    if (log.text.startsWith('REEL_TEXT '))
      logs.push(JSON.parse(log.text.slice('REEL_TEXT '.length)))
    if (log.text.startsWith('REEL_GEOM ')) {
      const g = JSON.parse(log.text.slice('REEL_GEOM '.length))
      geom.set(g.frame, g)
    }
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
    // spec v2 G8: CRF 14, -preset slow
    crf: 14,
    x264Preset: 'slow',
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
  writeFileSync(
    files.geom,
    JSON.stringify([...geom.values()].sort((a, b) => a.frame - b.frame)),
  )
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

async function runChecks(reel, table, pub, files, extra = {}) {
  const clipsDir = join(out, 'clips', reel)
  const logs = existsSync(files.text)
    ? JSON.parse(readFileSync(files.text, 'utf8'))
    : []
  const geomLogs = existsSync(files.geom)
    ? JSON.parse(readFileSync(files.geom, 'utf8'))
    : []
  const clipsRoot = join(out, 'clips')
  const cgeom = clipGeom(table, clipsRoot)
  let pixels = null
  if (existsSync(files.video)) {
    console.log('checks 10–11: decoding the output frames …')
    pixels = await pixelPass(files.video, geomLogs, cgeom)
  }
  const shares = photoShares(geomLogs, cgeom)
  const last = geomLogs.length ? geomLogs[geomLogs.length - 1] : null
  const v2 = [
    [
      '9 G1 static geometry',
      () =>
        check9({
          logs: geomLogs,
          frames: geomSampleFrames(table),
          sources: reelSources(),
          clips: clipSizes(table, clipsRoot, pub),
        }),
    ],
    ['10 G1 pixels', () => check10(pixels?.measures ?? null)],
    [
      '11 G2/G3/G6 frame',
      () =>
        check11(reel, table, {
          bands: pixels?.bands ?? null,
          shares,
          end: last?.geom,
        }),
    ],
  ]
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
    ...v2,
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
    if (r.numbers) console.log(`     numbers: ${JSON.stringify(r.numbers)}`)
    return { name, ...r }
  })
  // RESULT-x.md (spec v2 §5 13) copies the measured numbers of 9–11 and the music source from here.
  writeFileSync(
    files.checks,
    JSON.stringify({ reel, music: extra.music ?? null, results }, null, 1),
  )
  return results.every((r) => r.ok)
}

async function runReel(reel, { checksOnly, publish, music }) {
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
    geom: join(dir, `reel-${reel}-geom.json`),
  }
  if (table.stub)
    console.log(`reel ${reel}: stub shot table (no ${reel}.shots.js yet)`)
  if (music) {
    // Hook for promo-reels-v2-sound: the track is staged here; its mix (reels-mix.mjs) and the beat grid it cuts
    // to land with that item. Until then the synthesised v1 audio is what renders.
    console.log(
      `music: ${relative(repo, music)} (staged as audio/music${extname(music)})`,
    )
  }
  if (!checksOnly) {
    prepare(reel, pub)
    if (music) {
      mkdirSync(join(pub, 'audio'), { recursive: true })
      copyFileSync(music, join(pub, 'audio', `music${extname(music)}`))
    }
    const audio = await buildAudio(reel, join(pub, 'audio'), table)
    for (const line of audio.lines) console.log(`audio: ${line}`)
    if (!audio.ok) throw new Error('audio check failed')
    await renderAll(reel, pub, files, table)
  }
  const ok = await runChecks(reel, table, pub, files, {
    music: music ? relative(repo, music) : null,
  })
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

  // 9: an element under scaleX(1.2) (its computed value is matrix(1.2, 0, 0, 1, 0, 0)), an <img> stretched into the
  // frame, a square mask sized 100% 100% on the frame, the same transform written in source, a clip encoded at
  // half height.
  const logs9 = [
    {
      frame: 0,
      transforms: [
        {
          el: 'div.squash',
          transform: 'matrix(1.2, 0, 0, 1, 0, 0)',
          scale: 'none',
        },
      ],
      media: [
        {
          el: 'img',
          tag: 'img',
          box: [1080, 1920],
          intrinsic: [1000, 1000],
          fit: 'fill',
        },
      ],
      masks: [
        {
          el: 'div',
          prop: 'mask',
          size: '100% 100%',
          box: [1080, 1920],
          image: [1000, 1000],
        },
      ],
    },
  ]
  const in9 = {
    logs: logs9,
    frames: [0],
    sources: [
      { file: 'fixture.jsx', text: "const s = { transform: 'scaleX(1.2)' }" },
    ],
    clips: [
      {
        id: 'fixture',
        expected: { w: 3840, h: 4320 },
        actual: { w: 3840, h: 2160, sar: '1:1' },
      },
    ],
  }
  // 10: a round handle drawn 44×40 px (w/h 1.1) on a grey frame.
  const W10 = 200
  const H10 = 200
  const disc = (rx, ry) => {
    const rgb = Buffer.alloc(W10 * H10 * 3, 80)
    for (let y = 0; y < H10; y++)
      for (let x = 0; x < W10; x++)
        if (((x + 0.5 - 100) / rx) ** 2 + ((y + 0.5 - 100) / ry) ** 2 <= 1)
          rgb.fill(245, (y * W10 + x) * 3, (y * W10 + x) * 3 + 3)
    return rgb
  }
  const handleAt = (rx, ry) => {
    const rect = { x: 100 - rx, y: 100 - ry, w: 2 * rx, h: 2 * ry }
    return {
      frame: 0,
      kind: 'handle',
      css: [rect.w, rect.h],
      out: [rect.x, rect.y, rect.w, rect.h],
      px: measureBox(disc(rx, ry), W10, H10, rect, measurePad('handle', rect)),
    }
  }
  // 11: a full-width black band of 120 rows across a mid-grey frame.
  const frame11 = Buffer.alloc(WIDTH * HEIGHT * 3, 90)
  frame11.fill(0, 900 * WIDTH * 3, 1020 * WIDTH * 3)
  const bands11 = [{ frame: 0, ...blackBand(frame11, WIDTH, HEIGHT) }]
  const full = new Map(Array.from({ length: good.frames }, (_, f) => [f, 1]))
  const end11 = [
    { kind: 'endbook', css: [860, 606], out: [110, 300, 860, 606] },
  ]

  const cases = [
    ['1 ffprobe', () => check1(badProbe)],
    ['2 shot table', () => check2('a', t2)],
    ['3 crop scale / photo px', () => check3(t3, () => null)],
    ['4 camera never still', () => check4(t4)],
    ['5 real time, no busy UI', () => check5('a', t5, clips5)],
    ['6 safe zones + text', () => check6(t6, logs6, 525)],
    ['7 licences', () => check7(pub7, new Set(['L18.jpg']), clips5)],
    ['8 sheet', () => check8(sheet8, t6.frames)],
    ['9 G1 static geometry', () => check9(in9)],
    ['10 G1 pixels (1.1 handle)', () => check10([handleAt(22, 20)])],
    [
      '11 G2 black band (120 rows)',
      () => check11('a', good, { bands: bands11, shares: full, end: end11 }),
    ],
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
  // The v2 checks pass their good twins: uniform scale + cover media + frame-sized mask, the shipped reels source
  // (spec v2 Done-when 3), a round handle, a 90-row band, a full photo frame with the end book in place.
  const good9 = check9({
    logs: [
      {
        frame: 0,
        transforms: [
          {
            el: 'div',
            transform: 'matrix(1.2, 0, 0, 1.2, 10, 0)',
            scale: 'none',
          },
          {
            el: 'div',
            transform: 'matrix(0.866025, 0.5, -0.5, 0.866025, 0, 0)',
            scale: '1.1',
          },
        ],
        media: [
          {
            el: 'img',
            tag: 'img',
            box: [1080, 1920],
            intrinsic: [1000, 1000],
            fit: 'cover',
          },
        ],
        masks: [
          {
            el: 'div',
            prop: 'mask',
            size: '100% 100%',
            box: [1080, 1920],
            image: [1080, 1920],
          },
        ],
      },
    ],
    frames: [0],
    sources: reelSources(),
    clips: [
      {
        id: 'ok',
        expected: { w: 3840, h: 4320 },
        actual: { w: 3840, h: 4320, sar: '1:1' },
      },
    ],
  })
  const band90 = Buffer.alloc(WIDTH * HEIGHT * 3, 90)
  band90.fill(0, 900 * WIDTH * 3, 990 * WIDTH * 3)
  const good11 = check11(
    'a',
    { ...good, shots: good.shots.map((s) => ({ ...s, uiOnly: false })) },
    {
      bands: [{ frame: 0, ...blackBand(band90, WIDTH, HEIGHT) }],
      shares: full,
      end: end11,
    },
  )
  for (const [name, r] of [
    ['9 (uniform, cover, shared/** source)', good9],
    ['10 (round handle 40×40)', check10([handleAt(20, 20)])],
    ['11 (90-row band, full photo, end book 860)', good11],
  ]) {
    console.log(
      `${r.ok ? 'ok' : 'FAIL'} — good fixture, check ${name}: ${r.notes.slice(0, 4).join('; ')}`,
    )
    ok &&= r.ok
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
      'usage: reels-render.mjs --reel a|b|c [--checks-only] [--publish <dir>] [--music <file>] | --selftest',
    )
  reelConfig(reel)
  const publish = arg('--publish') ? resolve(arg('--publish')) : null
  const music = arg('--music') ? resolve(arg('--music')) : null
  if (music && !existsSync(music))
    throw new Error(`--music ${music}: no such file`)
  const ok = await runReel(reel, {
    checksOnly: args.includes('--checks-only'),
    publish,
    music,
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

// Reels sound: track gate, foley plan, OfflineAudioContext mix and check 12 (Designer promo-reels-v2 spec §3, §5.12).
//
//   node scripts/reels-mix.mjs --analyse --reel a [--music <file>]
//       Track gate over sound.json's candidates for the reel (or one file): tempo by onset-flux autocorrelation, beat
//       confidence, last-third rise, beat contrast, onsets on the half-beat grid, music floor, phone loss and hero-bar
//       lift (2.5–8 dB) of a downbeat excerpt. Rounds (GATE.rounds): lift ≥ 2.5, then ≥ 2, then R3 (rise ≥ 1, lift
//       ≥ 1.5), all at the own tempo before any half-tempo round (C only). A track that won an earlier reel (a, b, c;
//       its beats.json) is skipped. First passing track wins; prints it and 2 runners-up (none: the best 3) and writes
//       promo/out/reels/sound/<reel>.beats.json (with liftBar, liftDb, barRmsDb[], contrast, onGrid, floorDb,
//       phoneLossDb); a failed gate removes the reel's old beats.json.
//   node scripts/reels-mix.mjs --reel a --cues <json | sample> [--music <file>] [--beats <json>] [--out <dir>] [--seed <n>]
//       Mix in Playwright Chromium (decode + OfflineAudioContext, 48 kHz stereo) → <out>/<reel>-{music,sfx,mix}.wav and
//       <reel>-mix.json, then check 12. `--cues sample` builds a demo cue list (every cue type) on the reel's beats.
//   node scripts/reels-mix.mjs --check --reel a [--dir <dir>] [--cues <json>] [--cuts 0,54,…]
//       Check 12 on stems already written (reels-render.mjs calls checkSoundFiles()).
//
// Cue list JSON: `{ frames?, cuts?: [frame], cues: [{ frame, type, x?, frames? }] }` or a bare cue array. `type` is a
// key of CUES, `x` the cue's output x in px (pan ± 0.35), `frames` the length of a `breath` (music dip).
// Needs promo/reels/sound.mjs to have run (files in promo/out/reels/sound/, sha256 checked).
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import {
  LICENCES,
  SOUND_JSON,
  SOUND_OUT,
  entryPath,
  loadSound,
  sha256,
  soundEntries,
} from '../../reels/sound.mjs'
import {
  FPS,
  SAMPLE_RATE,
  WIDTH,
  gridBeatFrame,
  nearestBeatDistance,
  reelConfig,
} from '../src/reels/shared/beats.js'

const SR = SAMPLE_RATE
export const MIX_TAG = 'photobooks reels-mix'
const ANALYSIS_SR = 12000

/** Spec §3 track gate: own tempo window per reel, confidence, rise, beat contrast and hero-bar lift. */
export const TEMPO = {
  a: [[80, 110]],
  b: [[60, 100]],
  c: [[108, 132]],
}
/**
 * Half-tempo window (C only): a track whose felt tempo is twice its pulse. Tried only when no candidate passes with
 * its own tempo (Designer decision 2026-11-28, Owner Q-36: C's pacing is the reference).
 */
export const HALF_TEMPO = { c: [[54, 66]] }
/**
 * Hero window (0-based bars): the bar whose RMS steps up most from the bar before it is `liftBar`, where the reel puts
 * Fill book / the cover drop (Designer decision 2026-11-28).
 */
export const HERO_BARS = { a: [1, 3], b: [1, 2], c: [1, 3] }
export const GATE = {
  confidence: 0.3,
  riseDb: 2,
  contrast: 1.5,
  liftDb: 2.5,
  /**
   * Rounds in order (Designer decisions 2026-11-28): the reel's gate stops at the first round any candidate passes;
   * every own-tempo round runs before any half-tempo round.
   */
  rounds: [
    { name: 'R1', liftMin: 2.5, riseMin: 2 },
    { name: 'R2', liftMin: 2, riseMin: 2 },
    { name: 'R3', liftMin: 1.5, riseMin: 1 },
  ],
  /** a larger lift is a quiet intro, not a lift (Designer decision 2026-11-28) */
  liftMaxDb: 8,
  /** share of the excerpt's onsets within `onGridTolSec` of the half-beat lattice (the grid is the track's metre) */
  onGrid: 0.7,
  onGridTolSec: 0.04,
  /** an onset is a local maximum of the onset flux ≥ this share of the excerpt's maximum */
  onsetShare: 0.15,
  /** passing excerpts within this of the largest lift: the one whose liftBar / bars is closest to `heroAt` wins */
  liftTieDb: 0.25,
  heroAt: 0.31,
  /** momentary loudness from 0 to length − 1.2 s ≥ integrated − 10 dB (no music holes) */
  floorDb: -10,
  /** integrated loudness high-passed at 300 Hz − full band (phone speaker) */
  phoneLossDb: -4,
  minSec: 15,
  maxSec: 20,
}
/** Spec §3 master targets. */
export const TARGET = { lufs: -14, tol: 0.5, truePeak: -1, samplePeak: 0.99 }
const SILENCE = { db: -60, ms: 150 }
/** Check 12k/12l (Designer decision 2026-11-28): no music holes before the fade, enough level on a phone speaker. */
const HOLES = { momentaryLufs: -24 }
const PHONE = { lufs: -18 }

/**
 * Foley cue types (spec §3 "Foley cues"). `group` = sound.json `cues` tag of the variants, `bus` foley (high-pass
 * 80 Hz + room send) or ui (dry), `sub` = sine sub under it, `duck` = −3 dB music duck for 180 ms, `minLen` / `maxLen`
 * = shortest / longest slice of the file (s; a variant whose event is shorter than `minLen` fails sound.mjs and check
 * 12), `flicks` = staggered copies, `onset: 'peak'` = check 12 measures the loudest point (a swell has no attack).
 * Level: `rms` = the slice's loudest 100 ms RMS in the SFX stem, dB against the music stem's RMS around the cue
 * (Designer decision 2026-11-28; `fill`: the first flick); `peak` = the slice's sample peak in dBFS before the master.
 */
export const CUES = {
  page: { group: 'page', rms: -15, bus: 'foley', minLen: 0.25, maxLen: 1.2 },
  pageSlow: {
    group: 'pageSlow',
    rms: -13,
    bus: 'foley',
    minLen: 0.45,
    maxLen: 1.8,
  },
  flutter: {
    group: 'flutter',
    rms: -18,
    bus: 'foley',
    reverse: true,
    minLen: 0.4,
    maxLen: 0.9,
    onset: 'peak',
  },
  click: { group: 'click', peak: -12, bus: 'ui', maxLen: 0.4 },
  pick: { group: 'pick', peak: -12, bus: 'ui', maxLen: 0.4 },
  key: { group: 'key', peak: -16, bus: 'ui', maxLen: 0.3 },
  drop: {
    group: 'drop',
    peak: -8,
    bus: 'foley',
    sub: true,
    duck: true,
    maxLen: 0.6,
  },
  fill: {
    group: 'fill',
    rms: -20,
    bus: 'foley',
    flicks: [5, 7],
    minLen: 0.04,
    maxLen: 0.3,
  },
  swish: {
    group: 'swish',
    rms: -12,
    bus: 'foley',
    minLen: 0.2,
    maxLen: 1.0,
    onset: 'peak',
  },
  wood: { group: 'wood', peak: -8, bus: 'foley', minLen: 0.15, maxLen: 0.8 },
  cover: { group: 'cover', peak: -8, bus: 'foley', minLen: 0.15, maxLen: 0.8 },
  impact: {
    group: 'impact',
    peak: -6,
    bus: 'foley',
    sub: true,
    duck: true,
    minLen: 0.15,
    maxLen: 1.0,
  },
  /** Music dip (−6 dB, low-pass 1.2 kHz) for the cue's `frames`; no sound of its own. */
  breath: { music: true },
}
const MUSIC_RMS_DB = -20
const SUB = { hz: 50, ms: 155, peakDb: -14 }
const SEND_DB = -14
const SEND_END_DB = -6
/** Music → room send in the ending: 0 until the fade starts, rising linearly to this at its end. */
const MUSIC_SEND_END_DB = -6
const FADE_SEC = 1.2
/** Check 12j: per-type spread of the RMS-levelled cues, and how far every swish stays under the music. */
const LEVELS = { spreadDb: 4, swishUnderDb: 8, jitterDb: 1.5 }

const db = (x) => 20 * Math.log10(Math.max(x, 1e-12))
const undb = (d) => 10 ** (d / 20)
const round = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n

/** Seeded PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------- DSP helpers (Node)

/** Biquad (direct form I) with given normalised coefficients, applied in place on a copy. */
function biquad(x, b, a) {
  const y = new Float32Array(x.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
    x2 = x1
    x1 = x[i]
    y2 = y1
    y1 = v
    y[i] = v
  }
  return y
}

/** RBJ low-pass coefficients. */
function lowpass(f, sr, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * f) / sr
  const al = Math.sin(w) / (2 * q)
  const c = Math.cos(w)
  const a0 = 1 + al
  return {
    b: [(1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0],
    a: [1, (-2 * c) / a0, (1 - al) / a0],
  }
}

/**
 * BS.1770-4 K-weighting (shelf + RLB high-pass) at any rate, from the analogue prototypes (at 48 kHz these are the
 * published coefficients).
 */
function kWeighting(sr) {
  const shelf = (() => {
    const K = Math.tan((Math.PI * 1681.974450955533) / sr)
    const Q = 0.7071752369554196
    const Vh = 10 ** (3.999843853973347 / 20)
    const Vb = Vh ** 0.4996667741545416
    const a0 = 1 + K / Q + K * K
    return {
      b: [
        (Vh + (Vb * K) / Q + K * K) / a0,
        (2 * (K * K - Vh)) / a0,
        (Vh - (Vb * K) / Q + K * K) / a0,
      ],
      a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
    }
  })()
  const rlb = (() => {
    const K = Math.tan((Math.PI * 38.13547087602444) / sr)
    const Q = 0.5003270373238773
    const a0 = 1 + K / Q + K * K
    return {
      b: [1, -2, 1],
      a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
    }
  })()
  return [shelf, rlb]
}

/** RBJ high-pass coefficients. */
function highpass(f, sr, q = Math.SQRT1_2) {
  const w = (2 * Math.PI * f) / sr
  const al = Math.sin(w) / (2 * q)
  const c = Math.cos(w)
  const a0 = 1 + al
  return {
    b: [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0],
    a: [1, (-2 * c) / a0, (1 - al) / a0],
  }
}

/** Phone speaker model (Designer decision 2026-11-28): 4th-order Butterworth high-pass at 300 Hz (two biquads). */
export const PHONE_HZ = 300
const phoneHighpass = (sr) => [
  highpass(PHONE_HZ, sr, 0.5411961),
  highpass(PHONE_HZ, sr, 1.306563),
]

/**
 * Cumulative K-weighted power per channel (`phone`: high-passed at 300 Hz first), for 400 ms blocks at any offset.
 */
function kPower(chans, sr, phone = false) {
  const stages = [...(phone ? phoneHighpass(sr) : []), ...kWeighting(sr)]
  return chans.map((c) => {
    let y = c
    for (const s of stages) y = biquad(y, s.b, s.a)
    const cum = new Float64Array(y.length + 1)
    for (let i = 0; i < y.length; i++) cum[i + 1] = cum[i] + y[i] * y[i]
    return cum
  })
}

const lk = (v) => -0.691 + 10 * Math.log10(v)

/** Mean-square block powers (400 ms, 100 ms hop) of `cums` from sample `from` to `to`. */
function blockPowers(cums, sr, from = 0, to = cums[0].length - 1) {
  const block = Math.round(0.4 * sr)
  const hop = Math.round(0.1 * sr)
  const z = []
  for (let s = Math.round(from); s + block <= to; s += hop) {
    let sum = 0
    for (const cum of cums) sum += (cum[s + block] - cum[s]) / block
    z.push(sum)
  }
  return z
}

/** BS.1770-4 gating (−70 LUFS absolute, −10 LU relative) of block powers → LUFS. */
function gatedLufs(z) {
  const abs = z.filter((v) => v > 0 && lk(v) > -70)
  if (!abs.length) return -Infinity
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10
  const gated = abs.filter((v) => lk(v) > rel)
  return lk(gated.reduce((a, b) => a + b, 0) / gated.length)
}

/**
 * Integrated loudness (LUFS, BS.1770-4: 400 ms blocks, 75 % overlap, −70 LUFS absolute and −10 LU relative gate).
 * `phone`: of the signal high-passed at 300 Hz (4th order) first.
 */
export function loudness(left, right, sr = SR, { phone = false } = {}) {
  return gatedLufs(blockPowers(kPower([left, right], sr, phone), sr))
}

/** Momentary loudness (LUFS, 400 ms K-weighted blocks, 100 ms hop): `[{ t, lufs }]`, `t` = block start (s). */
export function momentary(left, right, sr = SR) {
  return blockPowers(kPower([left, right], sr), sr).map((v, i) => ({
    t: i * 0.1,
    lufs: v > 0 ? lk(v) : -Infinity,
  }))
}

/** 4× oversampling interpolator (BS.1770 Annex 2 style, 48-tap windowed sinc, 12 taps per phase). */
const OS = 4
const TAPS = 12
const PHASES = (() => {
  const n = OS * TAPS
  const h = []
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) / OS
    const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)
    const w =
      0.42 -
      0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) +
      0.08 * Math.cos((4 * Math.PI * i) / (n - 1))
    h.push(sinc * w)
  }
  return Array.from({ length: OS }, (_, p) => {
    const taps = []
    for (let k = 0; k < TAPS; k++) taps.push(h[p + OS * k])
    const sum = taps.reduce((a, b) => a + b, 0)
    return taps.map((v) => v / sum)
  })
})()

/** Per sample: the largest |value| of the oversampled signal around it, max over both channels. */
function truePeakEnvelope(left, right) {
  const n = left.length
  const env = new Float32Array(n)
  for (const x of [left, right]) {
    for (let i = 0; i < n; i++) {
      let m = Math.abs(x[i])
      for (const taps of PHASES) {
        let v = 0
        for (let k = 0; k < TAPS; k++) {
          const j = i - k + TAPS / 2
          if (j >= 0 && j < n) v += x[j] * taps[k]
        }
        if (Math.abs(v) > m) m = Math.abs(v)
      }
      if (m > env[i]) env[i] = m
    }
  }
  return env
}

/** True peak (dBTP) and sample peak (linear) of a stereo signal. */
export function peaks(left, right) {
  const env = truePeakEnvelope(left, right)
  let tp = 0
  let sp = 0
  for (let i = 0; i < left.length; i++) {
    if (env[i] > tp) tp = env[i]
    const s = Math.max(Math.abs(left[i]), Math.abs(right[i]))
    if (s > sp) sp = s
  }
  return { truePeak: db(tp), samplePeak: sp }
}

/**
 * Look-ahead true-peak limiter gain curve: never above the gain the peak needs (min filter ± w, then a ± w mean, so
 * every averaged value is ≤ the requirement), with a 50 ms release.
 */
function limiterGain(left, right, ceilingDb) {
  const env = truePeakEnvelope(left, right)
  const n = env.length
  const ceil = undb(ceilingDb)
  const req = new Float32Array(n)
  for (let i = 0; i < n; i++) req[i] = env[i] > ceil ? ceil / env[i] : 1
  const w = Math.round(0.0015 * SR)
  const minf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let m = 1
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++)
      if (req[j] < m) m = req[j]
    minf[i] = m
  }
  const cum = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + minf[i]
  const g = new Float32Array(n)
  const rel = 1 - Math.exp(-1 / (0.05 * SR))
  let prev = 1
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - w)
    const hi = Math.min(n, i + w + 1)
    const avg = (cum[hi] - cum[lo]) / (hi - lo)
    prev = Math.min(avg, prev + (1 - prev) * rel)
    g[i] = prev
  }
  return g
}

/**
 * Master gain to −14 LUFS with true peak ≤ −1 dBTP: gain, then the limiter where needed, re-gained (4 rounds).
 * Returns a function that applies the same gain + limiter curve to any stem.
 */
export function masterCurve(left, right) {
  let gain = 1
  let curve = null
  for (let round2 = 0; round2 < 4; round2++) {
    const [l, r] = apply([left, right], gain, curve)
    const lufs = loudness(l, r)
    gain *= undb(TARGET.lufs - lufs)
    const [l2, r2] = apply([left, right], gain, curve)
    if (peaks(l2, r2).truePeak <= TARGET.truePeak - 0.2) break
    const g = limiterGain(l2, r2, TARGET.truePeak - 0.3)
    curve = curve ? curve.map((v, i) => v * g[i]) : g
  }
  return (chans) => apply(chans, gain, curve)
}

function apply(chans, gain, curve) {
  return chans.map((c) => {
    const y = new Float32Array(c.length)
    for (let i = 0; i < c.length; i++)
      y[i] = c[i] * gain * (curve ? curve[i] : 1)
    return y
  })
}

// ---------------------------------------------------------------- WAV I/O

/** 24-bit PCM stereo WAV with a LIST/INFO ISFT tag. */
export function wavBytes(left, right, tag = MIX_TAG, sr = SR) {
  const n = left.length
  const info = Buffer.from(`${tag}\0${tag.length % 2 ? '' : '\0'}`, 'latin1')
  const list = Buffer.alloc(20 + info.length)
  list.write('LIST', 0)
  list.writeUInt32LE(12 + info.length, 4)
  list.write('INFO', 8)
  list.write('ISFT', 12)
  list.writeUInt32LE(info.length, 16)
  info.copy(list, 20)
  const fmt = Buffer.alloc(24)
  fmt.write('fmt ', 0)
  fmt.writeUInt32LE(16, 4)
  fmt.writeUInt16LE(1, 8)
  fmt.writeUInt16LE(2, 10)
  fmt.writeUInt32LE(sr, 12)
  fmt.writeUInt32LE(sr * 6, 16)
  fmt.writeUInt16LE(6, 20)
  fmt.writeUInt16LE(24, 22)
  const data = Buffer.alloc(8 + n * 6)
  data.write('data', 0)
  data.writeUInt32LE(n * 6, 4)
  const q = (v) =>
    Math.max(-8388608, Math.min(8388607, Math.round(v * 8388607)))
  for (let i = 0; i < n; i++) {
    data.writeIntLE(q(left[i]), 8 + i * 6, 3)
    data.writeIntLE(q(right[i]), 11 + i * 6, 3)
  }
  const head = Buffer.alloc(12)
  head.write('RIFF', 0)
  head.writeUInt32LE(4 + fmt.length + list.length + data.length, 4)
  head.write('WAVE', 8)
  return Buffer.concat([head, fmt, list, data])
}

/** `{ sampleRate, channels, bits, tag, left, right }` of a 16/24-bit PCM or 32-bit float WAV. */
export function readWav(bytes) {
  if (
    bytes.toString('latin1', 0, 4) !== 'RIFF' ||
    bytes.toString('latin1', 8, 12) !== 'WAVE'
  )
    throw new Error('not a RIFF/WAVE file')
  const out = { tag: null }
  for (let p = 12; p + 8 <= bytes.length;) {
    const id = bytes.toString('latin1', p, p + 4)
    const size = bytes.readUInt32LE(p + 4)
    const body = p + 8
    if (id === 'fmt ') {
      out.format = bytes.readUInt16LE(body)
      out.channels = bytes.readUInt16LE(body + 2)
      out.sampleRate = bytes.readUInt32LE(body + 4)
      out.bits = bytes.readUInt16LE(body + 14)
    } else if (
      id === 'LIST' &&
      bytes.toString('latin1', body, body + 4) === 'INFO'
    ) {
      for (let q = body + 4; q + 8 <= body + size;) {
        const len = bytes.readUInt32LE(q + 4)
        if (bytes.toString('latin1', q, q + 4) === 'ISFT')
          out.tag = bytes
            .toString('latin1', q + 8, q + 8 + len)
            .replace(/\0+$/, '')
        q += 8 + len + (len % 2)
      }
    } else if (id === 'data') {
      const bps = out.bits / 8
      const frames = Math.floor(size / (out.channels * bps))
      const read = (o) =>
        out.format === 3
          ? bytes.readFloatLE(o)
          : bps === 3
            ? bytes.readIntLE(o, 3) / 8388608
            : bytes.readInt16LE(o) / 32768
      out.left = new Float32Array(frames)
      out.right = new Float32Array(frames)
      for (let i = 0; i < frames; i++) {
        const o = body + i * out.channels * bps
        out.left[i] = read(o)
        out.right[i] = read(o + (out.channels - 1) * bps)
      }
    }
    p = body + size + (size % 2)
  }
  return out
}

// ---------------------------------------------------------------- Chromium (decode + render)

/** One Chromium page that serves the given files (key → path) from https://sound.local/f/<key>. */
async function openAudioPage(files) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.route('https://sound.local/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>reels-mix</title>',
      })
    const key = decodeURIComponent(url.pathname.replace(/^\/f\//, ''))
    const file = files.get(key)
    if (!file) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({
      contentType: 'application/octet-stream',
      body: fs.readFileSync(file),
    })
  })
  await page.goto('https://sound.local/')
  await page.evaluate(() => {
    window.__bufs = new Map()
    window.__b64 = (f32) => {
      const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength)
      let s = ''
      for (let i = 0; i < u8.length; i += 0x8000)
        s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
      return btoa(s)
    }
  })
  return { page, close: () => browser.close() }
}

const fromB64 = (s) => {
  const b = Buffer.from(s, 'base64')
  const f = new Float32Array(b.length / 4)
  Buffer.from(f.buffer).set(b)
  return f
}

/**
 * Decodes files in the page (at 48 kHz they stay there as AudioBuffers for the render); returns the mono mix of each
 * key in `keys` (keys in `keep` are decoded but not sent back); with `power`, also `<key>:pow` = the per-sample stereo
 * power the mix carries.
 */
async function decodeMono(page, keys, sr, keep = [], power = false) {
  const out = await page.evaluate(
    async ({ keys, sr, keep, power }) => {
      const res = {}
      for (const key of [...keep, ...keys]) {
        const ab = await (
          await fetch(`/f/${encodeURIComponent(key)}`)
        ).arrayBuffer()
        const ctx = new OfflineAudioContext(2, 1, sr)
        let buf = await ctx.decodeAudioData(ab)
        const kept = keep.includes(key)
        if (sr === 48000 && !kept) {
          // 5 ms of silence in front, so a clip's 3 ms fade-in never touches a transient at sample 0
          const pad = 240
          const padded = new AudioBuffer({
            numberOfChannels: buf.numberOfChannels,
            length: buf.length + pad,
            sampleRate: sr,
          })
          for (let c = 0; c < buf.numberOfChannels; c++)
            padded.copyToChannel(buf.getChannelData(c), c, pad)
          buf = padded
        }
        if (sr === 48000) window.__bufs.set(key, buf)
        if (kept) continue
        const mono = new Float32Array(buf.length)
        // stereo power as the mix will carry it: (L² + R²) / 2, where a mono file goes through an equal-power
        // StereoPannerNode (L² + R² = x² at any pan), so its power is x² / 2
        const pow = new Float32Array(buf.length)
        const nc = buf.numberOfChannels
        for (let c = 0; c < nc; c++) {
          const d = buf.getChannelData(c)
          for (let i = 0; i < d.length; i++) {
            mono[i] += d[i] / nc
            pow[i] += (d[i] * d[i]) / 2
          }
        }
        res[key] = window.__b64(mono)
        if (power) res[`${key}:pow`] = window.__b64(pow)
      }
      return res
    },
    { keys, sr, keep, power },
  )
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, fromB64(v)]),
  )
}

// ---------------------------------------------------------------- track analysis

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const xr = re[b] * cr - im[b] * ci
        const xi = re[b] * ci + im[b] * cr
        re[b] = re[a] - xr
        im[b] = im[a] - xi
        re[a] += xr
        im[a] += xi
        const t = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = t
      }
    }
  }
}

/**
 * Onset strength: positive log-magnitude spectral flux (1024-point Hann, hop 128), minus its ±0.25 s local mean,
 * half-wave rectified. `rate` = flux frames per second; frame f is centred at (f·hop + size/2) / sr.
 */
export function onsetFlux(mono, sr, size = 1024, hop = 128) {
  const frames = Math.max(0, Math.floor((mono.length - size) / hop) + 1)
  const win = Float64Array.from(
    { length: size },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size),
  )
  const half = size / 2
  const prev = new Float64Array(half)
  const raw = new Float64Array(frames)
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < size; i++) {
      re[i] = mono[f * hop + i] * win[i]
      im[i] = 0
    }
    fft(re, im)
    let sum = 0
    for (let k = 1; k < half; k++) {
      const mag = Math.log1p(100 * Math.hypot(re[k], im[k]))
      const d = mag - prev[k]
      if (d > 0) sum += d
      prev[k] = mag
    }
    raw[f] = f === 0 ? 0 : sum
  }
  const rate = sr / hop
  const w = Math.round(0.25 * rate)
  const cum = new Float64Array(frames + 1)
  for (let i = 0; i < frames; i++) cum[i + 1] = cum[i] + raw[i]
  const flux = new Float64Array(frames)
  for (let i = 0; i < frames; i++) {
    const lo = Math.max(0, i - w)
    const hi = Math.min(frames, i + w + 1)
    flux[i] = Math.max(0, raw[i] - (cum[hi] - cum[lo]) / (hi - lo))
  }
  return { flux, rate, offset: size / 2 / sr, hop: hop / sr }
}

/**
 * Tempo by autocorrelation of the (mean-removed) flux inside the given tempo windows. Confidence = ACF peak / zero
 * lag (spec §3). `half` (a half-tempo window) puts the grid on the doubled tempo. Returns
 * `{ bpm, lag, confidence, half }`.
 */
export function tempoOf(flux, rate, windows, half = false) {
  const n = flux.length
  let mean = 0
  for (const v of flux) mean += v / n
  const x = Float64Array.from(flux, (v) => v - mean)
  let r0 = 0
  for (const v of x) r0 += v * v
  const acf = (lag) => {
    let s = 0
    for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag]
    return s / r0
  }
  let best = null
  windows.forEach(([lo, hi]) => {
    const l0 = Math.floor((60 * rate) / hi)
    const l1 = Math.ceil((60 * rate) / lo)
    const vals = new Map()
    const at = (l) => {
      if (!vals.has(l)) vals.set(l, acf(l))
      return vals.get(l)
    }
    for (let l = l0; l <= l1; l++) {
      const v = at(l)
      if (v < at(l - 1) || v < at(l + 1)) continue
      if (!best || v > best.confidence) {
        const a = at(l - 1)
        const c = at(l + 1)
        const den = a - 2 * v + c
        const frac = den < 0 ? (0.5 * (a - c)) / den : 0
        best = { lag: l + frac, confidence: v, half }
      }
    }
  })
  if (!best) return { bpm: 0, lag: 0, confidence: 0, half }
  const lag = best.half ? best.lag / 2 : best.lag
  return { ...best, lag, bpm: (60 * rate) / lag }
}

const interp = (a, t) => {
  const i = Math.floor(t)
  if (i < 0 || i + 1 >= a.length) return 0
  return a[i] + (a[i + 1] - a[i]) * (t - i)
}

/** Fits period (± 2 %) and phase of the beat grid to the flux (comb sum); `{ period, phase }` in flux frames. */
export function fitGrid(flux, lag) {
  let best = { score: -Infinity, period: lag, phase: 0 }
  for (let p = lag * 0.98; p <= lag * 1.02; p += 0.01) {
    for (let ph = 0; ph < p; ph += 0.25) {
      let s = 0
      for (let t = ph; t < flux.length; t += p) s += interp(flux, t)
      if (s > best.score) best = { score: s, period: p, phase: ph }
    }
  }
  return best
}

const rmsDb = (x, a, b) => {
  let s = 0
  const lo = Math.max(0, Math.floor(a))
  const hi = Math.min(x.length, Math.floor(b))
  for (let i = lo; i < hi; i++) s += x[i] * x[i]
  return 10 * Math.log10(Math.max(s / Math.max(1, hi - lo), 1e-12))
}

/**
 * Full gate analysis of one track (mono at `sr`): tempo, grid, downbeat, then the best downbeat excerpt of whole bars
 * inside 15–20 s (closest to the reel's v1 length). Guards: no quarter-second inside the excerpt is > 24 dB under its
 * mean, its first third is ≥ track RMS − 12 dB, and it ends 0.5 s before the track does. Among the excerpts that pass
 * the guards, rise (last third vs first third ≥ `round.riseMin`: 2 dB, R3 1 dB) and beat contrast (mean flux on the beats / on the half-beats
 * ≥ 1.5), onsets on the half-beat lattice (`onGrid` ≥ 0.70), floor (momentary loudness from 0 to length − 1.2 s ≥
 * integrated − 10 dB) and phone loss (integrated loudness high-passed at 300 Hz − full band ≥ −4 dB) decide; of the
 * passing ones, those within 0.25 dB of the largest lift (the largest RMS step up from the bar before inside the hero
 * window `HERO_BARS`, `round.liftMin` ≤ lift ≤ 8 dB) compete: liftBar / bars closest to 0.31, then the larger rise.
 * `half` analyses the reel's half-tempo window instead of its own tempo; `round` = one of `GATE.rounds`.
 */
export function analyseTrack(
  mono,
  sr,
  reel,
  { half = false, round = GATE.rounds[0] } = {},
) {
  return judgeTrack(excerptsOf(mono, sr, reel, half), round)
}

/**
 * Onsets between `t0` and `t1` (s) = local maxima of the onset flux ≥ `GATE.onsetShare` of the window's maximum;
 * `onGrid` = the share of them within `GATE.onGridTolSec` of the lattice `t0 + n · step`. `{ onGrid, onsets }`, onset
 * times relative to `t0`.
 */
export function onGridShare({ flux, offset, hop }, t0, t1, step) {
  const f0 = Math.max(0, Math.round((t0 - offset) / hop))
  const f1 = Math.min(flux.length, Math.round((t1 - offset) / hop))
  let mx = 0
  for (let f = f0; f < f1; f++) mx = Math.max(mx, flux[f])
  const onsets = []
  for (let f = f0 + 1; f < f1 - 1; f++)
    if (
      mx > 0 &&
      flux[f] >= GATE.onsetShare * mx &&
      flux[f] >= flux[f - 1] &&
      flux[f] > flux[f + 1]
    )
      onsets.push(f * hop + offset - t0)
  const hit = onsets.filter(
    (t) =>
      Math.abs(t / step - Math.round(t / step)) * step <= GATE.onGridTolSec,
  ).length
  return { onGrid: onsets.length ? hit / onsets.length : 0, onsets }
}

/** Tempo, grid and every guarded downbeat excerpt with its measurements (the part of the gate that needs audio). */
function excerptsOf(mono, sr, reel, half) {
  const windows = half ? HALF_TEMPO[reel] : TEMPO[reel]
  const out = { half, duration: round(mono.length / sr, 2) }
  if (!windows)
    return { ...out, bpm: 0, confidence: 0, ok: false, why: 'no window' }
  const { flux, rate, offset, hop } = onsetFlux(mono, sr)
  const tempo = tempoOf(flux, rate, windows, half)
  out.bpm = round(tempo.bpm, 2)
  out.confidence = round(tempo.confidence, 3)
  if (!tempo.lag) return { ...out, ok: false, why: 'no tempo peak' }
  const grid = fitGrid(flux, tempo.lag)
  const period = grid.period * hop
  out.bpm = round(60 / period, 2)
  const beatAt = (k) => offset + (grid.phase + k * grid.period) * hop
  const nBeats = Math.floor((mono.length / sr - beatAt(0)) / period)
  // downbeat: the beat phase (mod 4) with the most onset energy
  const score = [0, 0, 0, 0]
  for (let k = 0; k < nBeats; k++)
    score[k % 4] += interp(flux, grid.phase + k * grid.period)
  const down = score.indexOf(Math.max(...score))
  const bar = 4 * period
  const target = reelConfig(reel).frames / FPS
  let bars = 0
  for (let n = 1; n * bar <= GATE.maxSec; n++)
    if (
      n * bar >= GATE.minSec &&
      (!bars || Math.abs(n * bar - target) < Math.abs(bars * bar - target))
    )
      bars = n
  if (!bars) return { ...out, ok: false, why: 'no whole-bar length in 15–20 s' }
  const len = bars * bar
  const trackRms = rmsDb(mono, 0, mono.length)
  const fluxAt = (t) => interp(flux, (t - offset) / hop)
  const [h0, h1] = HERO_BARS[reel]
  const kFull = kPower([mono], sr)
  const kPhone = kPower([mono], sr, true)
  const excerpts = []
  for (let k = down; beatAt(k) + len <= mono.length / sr - 0.5; k += 4) {
    const s = beatAt(k) * sr
    const L = len * sr
    const first = rmsDb(mono, s, s + L / 3)
    const last = rmsDb(mono, s + (2 * L) / 3, s + L)
    const mean = rmsDb(mono, s, s + L)
    let minQ = Infinity
    for (let q = s; q + 0.25 * sr <= s + L; q += 0.25 * sr)
      minQ = Math.min(minQ, rmsDb(mono, q, q + 0.25 * sr))
    if (minQ < mean - 24 || first < trackRms - 12) continue
    const barRms = Array.from({ length: bars }, (_, b) =>
      rmsDb(mono, s + b * bar * sr, s + (b + 1) * bar * sr),
    )
    let lift = -Infinity
    let liftBar = h0
    for (let b = h0; b <= Math.min(h1, bars - 1); b++)
      if (barRms[b] - barRms[b - 1] > lift) {
        lift = barRms[b] - barRms[b - 1]
        liftBar = b
      }
    let on = 0
    let offBeat = 0
    for (let j = 0; j < bars * 4; j++) {
      on += fluxAt(beatAt(k + j))
      offBeat += fluxAt(beatAt(k + j) + period / 2)
    }
    const integrated = gatedLufs(blockPowers(kFull, sr, s, s + L))
    const head = blockPowers(kFull, sr, s, s + L - FADE_SEC * sr)
    const floor = lk(Math.max(Math.min(...head), 1e-12)) - integrated
    const phoneLoss = gatedLufs(blockPowers(kPhone, sr, s, s + L)) - integrated
    excerpts.push({
      floor,
      phoneLoss,
      k,
      start: beatAt(k),
      rise: last - first,
      mean,
      barRms,
      lift,
      liftBar,
      contrast: on / Math.max(offBeat, 1e-9),
      onGrid: onGridShare(
        { flux, offset, hop },
        beatAt(k),
        beatAt(k) + len,
        period / 2,
      ).onGrid,
    })
  }
  if (!excerpts.length)
    return { ...out, ok: false, why: 'no excerpt passes the guards' }
  // the grid tempo, or (half-tempo window) the felt tempo, inside the window
  const felt = half ? out.bpm / 2 : out.bpm
  const tempoOk = windows.some(([lo, hi]) => felt >= lo && felt <= hi)
  const beatsOf = (e) => {
    const beats = []
    for (let k = e.k; beatAt(k) < e.start + len - 1e-6; k++)
      beats.push(round(beatAt(k) - e.start, 4))
    return beats
  }
  return {
    out,
    excerpts,
    track: [
      tempoOk ? '' : 'tempo out of range',
      tempo.confidence >= GATE.confidence ? '' : 'confidence < 0.30',
    ].filter(Boolean),
    beatsOf,
    len,
    bars,
    period,
  }
}

/** A gate round; a bare number (older callers) is a lift minimum at the default rise. */
const roundOf = (r) =>
  typeof r === 'number'
    ? { name: `lift ${r}`, liftMin: r, riseMin: GATE.riseDb }
    : r

/** What an excerpt fails in gate round `r` (empty = passes). */
function excerptFails(e, r) {
  const { liftMin, riseMin } = roundOf(r)
  return [
    e.rise >= riseMin ? '' : `rise < ${riseMin} dB`,
    e.contrast >= GATE.contrast ? '' : 'contrast < 1.5',
    e.onGrid >= GATE.onGrid ? '' : `onGrid < ${GATE.onGrid}`,
    e.floor >= GATE.floorDb ? '' : `floor < ${GATE.floorDb} dB`,
    e.phoneLoss >= GATE.phoneLossDb
      ? ''
      : `phone loss < ${GATE.phoneLossDb} dB`,
    e.lift >= liftMin ? '' : `lift < ${liftMin} dB`,
    e.lift <= GATE.liftMaxDb ? '' : `lift > ${GATE.liftMaxDb} dB`,
  ].filter(Boolean)
}

/**
 * Gate verdict of an analysed track in gate round `r`: of the passing excerpts, those within 0.25 dB of the largest
 * lift compete — liftBar / bars closest to 0.31 (Fill book at 22–40 % of the reel), then the larger rise; when none
 * passes, the excerpt failing the fewest criteria (then the largest lift ≤ 8 dB) is reported with its reasons.
 */
function judgeTrack(raw, r) {
  if (!raw.excerpts) return raw
  const gr = roundOf(r)
  const { out, excerpts, track, beatsOf, len, bars, period } = raw
  const scored = excerpts.map((e) => ({ e, fails: excerptFails(e, gr) }))
  const capped = (x) => (x.e.lift <= GATE.liftMaxDb ? x.e.lift : -99)
  const passing = scored.filter((x) => !x.fails.length)
  const topLift = Math.max(...passing.map((x) => x.e.lift))
  const heroOff = (x) => Math.abs(x.e.liftBar / bars - GATE.heroAt)
  const { e: best, fails: own } = passing.length
    ? passing
        .filter((x) => x.e.lift >= topLift - GATE.liftTieDb)
        .reduce((a, b) =>
          heroOff(b) < heroOff(a) - 1e-9 ||
          (Math.abs(heroOff(b) - heroOff(a)) <= 1e-9 && b.e.rise > a.e.rise)
            ? b
            : a,
        )
    : scored.reduce((a, b) =>
        b.fails.length < a.fails.length ||
        (b.fails.length === a.fails.length && capped(b) > capped(a))
          ? b
          : a,
      )
  const fails = [...track, ...own]
  const beats = beatsOf(best)
  return {
    ...out,
    ok: !fails.length,
    why: fails.join(', '),
    round: gr.name,
    liftMin: gr.liftMin,
    riseMin: gr.riseMin,
    riseDb: round(best.rise, 2),
    contrast: round(best.contrast, 2),
    onGrid: round(best.onGrid, 2),
    floorDb: round(best.floor, 2),
    phoneLossDb: round(best.phoneLoss, 2),
    liftBar: best.liftBar,
    liftDb: round(best.lift, 2),
    barRmsDb: best.barRms.map((v) => round(v, 2)),
    start: round(best.start, 4),
    length: round(len, 4),
    frames: Math.round(len * FPS),
    bars,
    period: round(period, 5),
    beats,
    downbeats: beats.map((_, i) => i).filter((i) => i % 4 === 0),
    excerptRmsDb: round(best.mean, 2),
  }
}

const analysisCache = new Map()

/**
 * Track gate for a reel over `manifest.candidates[reel]` (or `only`: one file path): analyses each, picks the first
 * that passes and the next two passing as runners-up (else the best failing ones), writes `<reel>.beats.json` to
 * `out`. A candidate that won an earlier reel (order a, b, c: the track of its `<reel>.beats.json` in `out`) is
 * skipped (Designer decision 2026-11-28). Returns `{ ok, lines, winner, runnersUp, beats }`.
 */
export async function trackGate(reel, manifest, out = SOUND_OUT, only = null) {
  reelConfig(reel)
  const taken = only ? new Map() : earlierWinners(reel, out)
  const items = only
    ? [{ id: musicIdOf(only, manifest) ?? path.basename(only), file: only }]
    : manifest.candidates[reel]
        .filter((id) => !taken.has(id))
        .map((id) => ({
          id,
          file: path.resolve(out, manifest.files[id].path),
        }))
  const modes = HALF_TEMPO[reel] ? [false, true] : [false]
  const cacheKey = (it, half) => `${reel}:${half ? 'half' : 'own'}:${it.file}`
  const todo = items.filter((it) =>
    modes.some((half) => !analysisCache.has(cacheKey(it, half))),
  )
  if (todo.length) {
    const files = new Map(todo.map((it) => [it.id, it.file]))
    const { page, close } = await openAudioPage(files)
    try {
      for (const it of todo) {
        const mono = (await decodeMono(page, [it.id], ANALYSIS_SR))[it.id]
        for (const half of modes)
          analysisCache.set(
            cacheKey(it, half),
            excerptsOf(mono, ANALYSIS_SR, reel, half),
          )
      }
    } finally {
      await close()
    }
  }
  const resultsOf = (half, gr) =>
    items.map((it) => ({
      ...it,
      ...judgeTrack(analysisCache.get(cacheKey(it, half)), gr),
    }))
  // every own-tempo round (2.5 dB, 2 dB, R3) before any half-tempo round (Designer 2026-11-28): the grid must be the
  // metre of the track; the first round any candidate passes ends the gate
  const rounds = modes.flatMap((half) => GATE.rounds.map((gr) => [half, gr]))
  let results = []
  for (const [half, gr] of rounds) {
    results = [...results, ...resultsOf(half, gr)]
    if (results.some((r) => r.ok)) break
  }
  const winner = results.find((r) => r.ok) ?? null
  // one row per reading of a track: its last (lowest lift minimum) round
  const latest = new Map(results.map((r) => [`${r.id}:${r.half}`, r]))
  const rest = [...latest.values()].filter(
    (r) =>
      r !== winner && `${r.id}:${r.half}` !== `${winner?.id}:${winner?.half}`,
  )
  const failCount = (r) => (r.why ? r.why.split(', ').length : 99)
  const runnersUp = [
    ...rest.filter((r) => r.ok),
    ...rest
      .filter((r) => !r.ok)
      .sort(
        (x, y) =>
          failCount(x) - failCount(y) || (y.liftDb ?? -99) - (x.liftDb ?? -99),
      ),
  ].slice(0, winner ? 2 : 3)
  const sign = (v, unit = ' dB') =>
    v == null ? '   —  ' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}${unit}`
  const fmt = (tag, r) =>
    `${reel}  ${tag.padEnd(9)} ${r.id.padEnd(26)} BPM ${String(r.bpm).padStart(6)}${r.half ? ' (½)' : '    '}  conf ${r.confidence.toFixed(2)}  rise ${sign(r.riseDb)}  contrast ${r.contrast == null ? '—' : r.contrast.toFixed(2)}  onGrid ${r.onGrid == null ? '—' : r.onGrid.toFixed(2)}  floor ${sign(r.floorDb)}  phone ${sign(r.phoneLossDb)}  lift ${sign(r.liftDb)}${r.liftBar == null ? '' : ` @bar ${r.liftBar}`}${r.round == null ? '' : ` ${r.round}`}${r.start == null ? '' : `  start ${r.start.toFixed(2)} s  ${r.bars} bars ${r.length.toFixed(2)} s`}${r.ok ? '' : `  [${r.why}]`}`
  // tracks tried before the winner, one row per reading (its last round)
  const skipped = winner
    ? [...latest.values()].filter(
        (r) =>
          results.indexOf(r) < results.indexOf(winner) &&
          !runnersUp.some((u) => u.id === r.id && u.half === r.half),
      )
    : []
  const lines = [
    ...[...taken].map(([id, r]) => `${reel}  skipped   ${id} (won reel ${r})`),
    ...skipped
      .filter((r) => !runnersUp.includes(r))
      .map((r) => fmt('skipped', r)),
    winner ? fmt('WINNER', winner) : `${reel}  no track passes the gate`,
    ...runnersUp.map((r) => fmt(r.ok ? 'runner-up' : 'fail', r)),
  ]
  let beats = null
  if (winner) {
    const entry = manifest.files[winner.id]
    beats = {
      reel,
      track: winner.id,
      title: entry?.title ?? winner.id,
      sha256: sha256(fs.readFileSync(winner.file)),
      bpm: winner.bpm,
      period: winner.period,
      half: winner.half,
      confidence: winner.confidence,
      riseDb: winner.riseDb,
      contrast: winner.contrast,
      onGrid: winner.onGrid,
      floorDb: winner.floorDb,
      phoneLossDb: winner.phoneLossDb,
      round: winner.round,
      riseMin: winner.riseMin,
      liftMin: winner.liftMin,
      liftBar: winner.liftBar,
      liftDb: winner.liftDb,
      barRmsDb: winner.barRmsDb,
      start: winner.start,
      length: winner.length,
      frames: winner.frames,
      bars: winner.bars,
      excerptRmsDb: winner.excerptRmsDb,
      downbeats: winner.downbeats,
      beats: winner.beats,
      runnersUp: runnersUp.map((r) => ({
        track: r.id,
        ok: r.ok,
        half: r.half,
        bpm: r.bpm,
        confidence: r.confidence,
        riseDb: r.riseDb ?? null,
        contrast: r.contrast ?? null,
        onGrid: r.onGrid ?? null,
        floorDb: r.floorDb ?? null,
        phoneLossDb: r.phoneLossDb ?? null,
        liftDb: r.liftDb ?? null,
        why: r.why || null,
      })),
    }
    fs.mkdirSync(out, { recursive: true })
    const file = path.join(out, `${reel}.beats.json`)
    fs.writeFileSync(file, `${JSON.stringify(beats, null, 2)}\n`)
    lines.push(`${reel}  beats → ${file}`)
  } else {
    // a failed gate leaves no beats behind: an older winner must not reach the mix or the render
    const stale = path.join(out, `${reel}.beats.json`)
    if (fs.existsSync(stale)) {
      fs.unlinkSync(stale)
      lines.push(`${reel}  removed stale ${stale}`)
    }
  }
  return { ok: Boolean(winner), lines, winner, runnersUp, beats }
}

/** Tracks of the reels before `reel` (order a, b, c) that have a beats.json in `out`: id → reel. */
function earlierWinners(reel, out) {
  const order = ['a', 'b', 'c']
  const taken = new Map()
  for (const r of order.slice(0, Math.max(0, order.indexOf(reel)))) {
    const file = path.join(out, `${r}.beats.json`)
    if (fs.existsSync(file))
      taken.set(JSON.parse(fs.readFileSync(file, 'utf8')).track, r)
  }
  return taken
}

function musicIdOf(file, manifest) {
  const hash = sha256(fs.readFileSync(file))
  return (
    Object.entries(manifest.files).find(
      ([, f]) => f.kind === 'music' && f.sha256 === hash,
    )?.[0] ?? null
  )
}

// ---------------------------------------------------------------- foley plan

/** Foley segmentation (Designer decision 2026-11-28): 20 ms RMS envelope; an event ends only after ≥ 150 ms > 30 dB under its peak. */
export const SEGMENT = { winMs: 20, hopMs: 5, quietDb: -30, quietMs: 150 }

/**
 * The slice of a foley file around its loudest transient, on a 20 ms RMS envelope (5 ms hop). Another event of the
 * same file starts only where the envelope rises back over −30 dB (re its peak) after ≥ 150 ms under it; shorter gaps
 * (paper crackle) stay inside the event. Forward: to 20 ms before the next event, where the tail has stayed under
 * −50 dB for 80 ms, or `maxLen`. Back, at most `pre` s: to 20 ms after the previous event, or where the lead-in has
 * stayed under −40 dB for 30 ms.
 * `pow` = the per-sample stereo power the mix carries (decodeMono `:pow`; default mono² / 2). Returns seconds:
 * `{ start, end, len, transient, peak, rmsDb }`, `transient` = the loudest sample, `rmsDb` = the slice's loudest
 * 100 ms RMS (dBFS of that power).
 */
export function segmentHit(mono, sr, maxLen = 1.5, pre = 0.25, pow = null) {
  let peak = 0
  let peakI = 0
  for (let i = 0; i < mono.length; i++) {
    const v = Math.abs(mono[i])
    if (v > peak) {
      peak = v
      peakI = i
    }
  }
  const cum = new Float64Array(mono.length + 1)
  for (let i = 0; i < mono.length; i++) cum[i + 1] = cum[i] + mono[i] ** 2
  const hop = Math.round((SEGMENT.hopMs / 1000) * sr)
  const half = Math.round((SEGMENT.winMs / 2000) * sr)
  const nb = Math.ceil(mono.length / hop)
  const env = new Float64Array(nb)
  let envPeak = 0
  for (let j = 0; j < nb; j++) {
    const lo = Math.max(0, j * hop - half)
    const hi = Math.min(mono.length, j * hop + half)
    env[j] = (cum[hi] - cum[lo]) / Math.max(1, hi - lo)
    if (env[j] > envPeak) envPeak = env[j]
  }
  const quiet = envPeak * undb(SEGMENT.quietDb) ** 2
  const runBlocks = Math.round(SEGMENT.quietMs / SEGMENT.hopMs)
  const jp = Math.min(nb - 1, Math.round(peakI / hop))
  // the event keeps its decay: it ends where the tail has stayed under −50 dB for 80 ms, or 20 ms before another
  // event, i.e. a rise back over −30 dB after a ≥ 150 ms quiet run (shorter dips are crackle of the same event)
  const tail = envPeak * undb(-50) ** 2
  const tailBlocks = Math.round(80 / SEGMENT.hopMs)
  const lead = Math.round(20 / SEGMENT.hopMs)
  let end = nb
  for (let j = jp, run = 0, low = 0, apart = false; j < nb; j++) {
    run = env[j] < quiet ? run + 1 : 0
    low = env[j] < tail ? low + 1 : 0
    if (run >= runBlocks) apart = true
    if (apart && !run) {
      end = Math.max(jp + 1, j - lead)
      break
    }
    if (low >= tailBlocks) {
      end = j - low + 1
      break
    }
  }
  // back, at most `pre` s: from where the lead-in has been under −40 dB for 30 ms, or 20 ms after an earlier event
  const head = envPeak * undb(-40) ** 2
  const headBlocks = Math.round(30 / SEGMENT.hopMs)
  const preBlocks = Math.round((pre * sr) / hop)
  let start = Math.max(0, jp - preBlocks)
  for (
    let j = jp, run = 0, low = 0, apart = false;
    j >= Math.max(0, jp - preBlocks);
    j--
  ) {
    run = env[j] < quiet ? run + 1 : 0
    low = env[j] < head ? low + 1 : 0
    if (run >= runBlocks) apart = true
    if (apart && !run) {
      start = Math.min(jp, j + lead)
      break
    }
    if (low >= headBlocks) {
      start = j + low - 1
      break
    }
  }
  // ≥ 4 ms before the transient, so the 3 ms fade-in stays ahead of it; ends with half a window of decay
  const t0 = Math.max(0, Math.min((start * hop) / sr, peakI / sr - 0.004))
  const t1 = Math.min(mono.length / sr, t0 + maxLen, (end * hop + half) / sr)
  const p = pow ?? Float32Array.from(mono, (v) => (v * v) / 2)
  const pc = new Float64Array(p.length + 1)
  for (let i = 0; i < p.length; i++) pc[i + 1] = pc[i] + p[i]
  const w = Math.round(0.1 * sr)
  const a = Math.round(t0 * sr)
  const b = Math.round(t1 * sr)
  let loud = 0
  for (let s = a; s === a || s + w <= b; s += Math.round(sr / 1000)) {
    const e = (pc[Math.min(b, s + w)] - pc[s]) / w
    if (e > loud) loud = e
  }
  return {
    start: t0,
    end: t1,
    len: t1 - t0,
    transient: peakI / sr,
    peak,
    rmsDb: 10 * Math.log10(Math.max(loud, 1e-14)),
  }
}

/**
 * Slice check over every foley file of the manifest (sound.mjs): each variant's slice per cue type it serves, against
 * the type's `minLen`. Returns `{ ok, lines, slices }`.
 */
export async function sliceCheck(manifest, out = SOUND_OUT) {
  const groups = {}
  const files = new Map()
  for (const [id, f] of Object.entries(manifest.files)) {
    if (f.kind !== 'sfx') continue
    files.set(id, path.resolve(out, f.path))
    for (const c of f.cues) (groups[c] ??= []).push(id)
  }
  const { page, close } = await openAudioPage(files)
  let decoded
  try {
    decoded = await decodeMono(page, [...files.keys()], SR, [], true)
  } finally {
    await close()
  }
  const pows = Object.fromEntries(
    [...files.keys()].map((id) => [id, decoded[`${id}:pow`]]),
  )
  const { segs, short } = sliceAll(groups, decoded, pows)
  const lines = []
  const slices = []
  for (const [type, def] of Object.entries(CUES)) {
    if (def.music) continue
    for (const id of groups[def.group] ?? []) {
      const s = segs[sliceKey(def, id)]
      const bad = def.minLen && s.len < def.minLen - 1e-6
      slices.push({
        type,
        id,
        ms: Math.round(s.len * 1000),
        rmsDb: round(s.rmsDb, 1),
      })
      lines.push(
        `${bad ? 'FAIL' : 'ok  '} ${type.padEnd(9)} ${id.padEnd(20)} ${String(Math.round(s.len * 1000)).padStart(5)} ms${def.minLen ? ` (≥ ${Math.round(def.minLen * 1000)})` : ''}  transient +${Math.round((s.transient - s.start) * 1000)} ms  loudest 100 ms ${s.rmsDb.toFixed(1)} dBFS`,
      )
    }
  }
  return { ok: !short.length, lines, slices }
}

/** Slice key of a cue type's variant: `<id>[:rev]@<maxLen>`. */
const sliceKey = (def, id) => `${def.reverse ? `${id}:rev` : id}@${def.maxLen}`

/**
 * Slices of every variant of every cue type (`monos[id]`, `pows[id]` at 48 kHz) → `{ segs, short }`; `short` lists the
 * variants whose slice is under the type's `minLen` (sound.mjs and check 12 fail on them).
 */
export function sliceAll(groups, monos, pows, types = Object.keys(CUES)) {
  const segs = {}
  const short = []
  for (const type of types) {
    const def = CUES[type]
    if (def.music) continue
    for (const id of groups[def.group] ?? []) {
      const key = sliceKey(def, id)
      if (segs[key]) continue
      const rev = (x) => (def.reverse ? x.slice().reverse() : x)
      const seg = segmentHit(
        rev(monos[id]),
        SR,
        def.maxLen,
        def.pre ?? 0.25,
        pows?.[id] ? rev(pows[id]) : null,
      )
      segs[key] = seg
      if (def.minLen && seg.len < def.minLen - 1e-6)
        short.push({ type, id, len: round(seg.len, 3), minLen: def.minLen })
    }
  }
  return { segs, short }
}

/** Cue list from a file or `sample` (every type, cycling on the beats; cuts on every 2nd downbeat). */
export function loadCues(spec, beats) {
  if (spec === 'sample') return sampleCues(beats)
  const raw = JSON.parse(fs.readFileSync(spec, 'utf8'))
  const list = Array.isArray(raw) ? { cues: raw } : raw
  for (const c of list.cues) {
    if (!CUES[c.type])
      throw new Error(`cue type "${c.type}" (frame ${c.frame}) is not in CUES`)
    if (!Number.isInteger(c.frame))
      throw new Error(`cue frame ${c.frame} is not an integer`)
  }
  return list
}

export function sampleCues(beats) {
  const order = [
    'pageSlow',
    'click',
    'swish',
    'pick',
    'drop',
    'key',
    'page',
    'flutter',
    'fill',
    'wood',
    'click',
    'cover',
    'page',
    'swish',
    'key',
    'drop',
    'pageSlow',
    'breath',
    'page',
    'impact',
  ]
  const cues = []
  const n = beats.beats.length
  const step = Math.max(1, Math.floor((n - 2) / order.length))
  order.forEach((type, i) => {
    const beat = 1 + i * step
    if (beat >= n - 2) return
    const cue = {
      frame: gridBeatFrame(beats, type === 'impact' ? n - 4 : beat),
      type,
      x: Math.round(((i * 7) % 10) * (WIDTH / 9)),
    }
    if (type === 'breath') cue.frames = Math.round(beats.period * FPS * 2)
    cues.push(cue)
  })
  const cuts = beats.downbeats
    .filter((_, i) => i % 2 === 0)
    .map((i) => gridBeatFrame(beats, i))
  return { frames: beats.frames, cuts, cues }
}

/** Merges overlapping [a, b] intervals. */
function merge(intervals) {
  const out = []
  for (const iv of [...intervals].sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else out.push([...iv])
  }
  return out
}

/**
 * Mix plan (pure): music timing + automation, one event per foley clip with variant, slice, pitch, level, pan and
 * start so the slice's loudest transient lands on the cue frame. `segs[key]` = segmentHit of each (reversed) file.
 * `musicDb(t)` = the music stem's RMS (dB) around time t as rendered before the master; RMS-levelled cues (`rms`) are
 * set against it (without it: the music's target RMS).
 */
export function buildPlan({
  reel,
  cues,
  beats,
  groups,
  segs,
  seed,
  musicKey,
  musicDb = () => MUSIC_RMS_DB,
}) {
  const length = (cues.frames ?? beats.frames) / FPS
  const random = rng(seed ?? reel.charCodeAt(0) * 7919)
  const last = {}
  let lastFile = null
  // never the file of the last event of the group, nor of the previous foley event (wood / cover / impact share files)
  const pickVariant = (group) => {
    const ids = groups[group]
    if (!ids?.length) throw new Error(`no sound for cue group "${group}"`)
    const fresh = ids.filter((id) => id !== last[group] && id !== lastFile)
    const pool = fresh.length
      ? fresh
      : ids.filter((id) => id !== lastFile).length
        ? ids.filter((id) => id !== lastFile)
        : ids
    const id = pool[Math.floor(random() * pool.length)]
    last[group] = id
    lastFile = id
    return id
  }
  const events = []
  const subs = []
  const ducks = []
  const breaths = []
  const sorted = [...cues.cues].sort((a, b) => a.frame - b.frame)
  for (const c of sorted) {
    const def = CUES[c.type]
    const t = c.frame / FPS
    if (def.music) {
      breaths.push([t, t + (c.frames ?? FPS) / FPS])
      continue
    }
    const pan = Math.max(
      -0.35,
      Math.min(0.35, ((c.x ?? WIDTH / 2) / WIDTH - 0.5) * 0.7),
    )
    const count = def.flicks
      ? def.flicks[0] +
        Math.floor(random() * (def.flicks[1] - def.flicks[0] + 1))
      : 1
    for (let j = 0; j < count; j++) {
      const id = pickVariant(def.group)
      const key = def.reverse ? `${id}:rev` : id
      const seg = segs[sliceKey(def, id)]
      const rate = 2 ** ((random() * 2 - 1) / 12)
      const jitter = (random() * 2 - 1) * LEVELS.jitterDb
      const at = t + j * 0.04
      // RMS-levelled: the slice's loudest 100 ms lands at this level (dB, before the master gain)
      const level =
        def.rms != null ? musicDb(t) + def.rms - 2 * j + jitter : null
      const gain =
        level != null
          ? undb(level - seg.rmsDb)
          : undb(def.peak - 2 * j + jitter) / seg.peak
      let when = at - (seg.transient - seg.start) / rate
      let offset = seg.start
      if (when < 0) {
        offset += -when * rate
        when = 0
      }
      events.push({
        cue: c.frame,
        type: c.type,
        id,
        key,
        bus: def.bus,
        when: round(when, 6),
        offset: round(offset, 6),
        duration: round(Math.max(0.01, seg.end - offset), 6),
        rate: round(rate, 6),
        gain: round(gain, 6),
        pan: round(pan + (j % 2 ? 0.05 : 0), 3),
        at: round(at, 6),
        sliceLen: round(seg.len, 4),
        levelDb: level == null ? null : round(level, 2),
        sliceRmsDb: round(seg.rmsDb, 2),
        minLen: def.minLen ?? 0,
      })
    }
    if (def.sub) subs.push({ when: t, gain: undb(SUB.peakDb) })
    if (def.duck) ducks.push([t, t + 0.18])
  }
  for (const e of events)
    for (const k of ['when', 'offset', 'duration', 'rate', 'gain', 'pan'])
      if (!Number.isFinite(e[k]))
        throw new Error(`plan: ${e.type}@${e.cue} ${e.id} ${k} = ${e[k]}`)
  const bar = beats.period * 4
  return {
    reel,
    length,
    music: {
      key: musicKey,
      offset: beats.start,
      gain: undb(MUSIC_RMS_DB - beats.excerptRmsDb),
      introEnd: Math.min(bar, length),
      ducks: merge(ducks),
      breaths: merge(breaths),
    },
    events,
    subs,
    sub: SUB,
    send: { db: SEND_DB, endDb: SEND_END_DB, musicEndDb: MUSIC_SEND_END_DB },
    fade: { start: Math.max(0, length - FADE_SEC), end: length },
  }
}

/** Stereo room impulse (0.6 s decaying noise, −60 dB at the end, low-pass 6 kHz), energy-normalised, seeded. */
export function roomImpulse(seed = 1) {
  const n = Math.round(0.6 * SR)
  const random = rng(seed)
  const lp = lowpass(6000, SR)
  return [0, 1].map(() => {
    const x = new Float32Array(n)
    for (let i = 0; i < n; i++)
      x[i] = (random() * 2 - 1) * Math.exp((-6.9 * i) / n)
    const y = biquad(x, lp.b, lp.a)
    let e = 0
    for (const v of y) e += v * v
    const k = 1 / Math.sqrt(e)
    return y.map((v) => v * k)
  })
}

/** Renders the plan in the page; `parts` ∈ {'mix', 'music', 'sfx'}. Returns `{ [part]: [left, right] }`. */
async function renderPlan(page, plan, parts) {
  const ir = roomImpulse(7)
  const toB64 = (f) =>
    Buffer.from(f.buffer, f.byteOffset, f.byteLength).toString('base64')
  const out = await page.evaluate(
    async ({ plan, parts, ir }) => {
      const SRATE = 48000
      const fromB64 = (s) => {
        const bin = atob(s)
        const u8 = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
        return new Float32Array(u8.buffer)
      }
      const reversed = (key) => {
        if (window.__bufs.has(key)) return window.__bufs.get(key)
        const src = window.__bufs.get(key.replace(/:rev$/, ''))
        const buf = new AudioBuffer({
          numberOfChannels: src.numberOfChannels,
          length: src.length,
          sampleRate: src.sampleRate,
        })
        for (let c = 0; c < src.numberOfChannels; c++)
          buf.copyToChannel(src.getChannelData(c).slice().reverse(), c)
        window.__bufs.set(key, buf)
        return buf
      }
      const undb = (d) => 10 ** (d / 20)
      const res = {}
      for (const part of parts) {
        const len = Math.round(plan.length * SRATE)
        // Chromium's DynamicsCompressorNode delays its output by a fixed 6 ms look-ahead: render that much longer
        // and drop it from the front, so every cue stays on its frame.
        const pre = Math.round(0.006 * SRATE)
        const ctx = new OfflineAudioContext(2, len + pre, SRATE)
        const sum = ctx.createGain()
        // below 120 Hz mono: LR4 crossover, low band downmixed to mono
        const lowA = new BiquadFilterNode(ctx, {
          type: 'lowpass',
          frequency: 120,
          Q: Math.SQRT1_2,
        })
        const lowB = new BiquadFilterNode(ctx, {
          type: 'lowpass',
          frequency: 120,
          Q: Math.SQRT1_2,
        })
        const mono = new GainNode(ctx, {
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers',
        })
        const highA = new BiquadFilterNode(ctx, {
          type: 'highpass',
          frequency: 120,
          Q: Math.SQRT1_2,
        })
        const highB = new BiquadFilterNode(ctx, {
          type: 'highpass',
          frequency: 120,
          Q: Math.SQRT1_2,
        })
        const join = ctx.createGain()
        sum.connect(lowA).connect(lowB).connect(mono).connect(join)
        sum.connect(highA).connect(highB).connect(join)
        const comp = new DynamicsCompressorNode(ctx, {
          threshold: -10,
          knee: 0,
          ratio: 2,
          attack: 0.01,
          release: 0.15,
        })
        const fade = ctx.createGain()
        join.connect(comp).connect(fade).connect(ctx.destination)
        fade.gain.setValueAtTime(1, plan.fade.start)
        fade.gain.exponentialRampToValueAtTime(0.01, plan.fade.end)
        // one room for the foley send and, in the ending, the music send
        const irL = fromB64(ir[0])
        const irBuf = new AudioBuffer({
          numberOfChannels: 2,
          length: irL.length,
          sampleRate: SRATE,
        })
        irBuf.copyToChannel(irL, 0)
        irBuf.copyToChannel(fromB64(ir[1]), 1)
        const verb = new ConvolverNode(ctx, {
          disableNormalization: true,
          buffer: irBuf,
        })
        verb.connect(sum)

        if (part !== 'sfx') {
          const m = plan.music
          const src = new AudioBufferSourceNode(ctx, {
            buffer: window.__bufs.get(m.key),
          })
          const hp = new BiquadFilterNode(ctx, {
            type: 'highpass',
            frequency: 30,
            Q: Math.SQRT1_2,
          })
          const lp = new BiquadFilterNode(ctx, {
            type: 'lowpass',
            frequency: 2400,
            Q: Math.SQRT1_2,
          })
          const base = new GainNode(ctx, { gain: 0 })
          const duck = ctx.createGain()
          const breath = ctx.createGain()
          src
            .connect(hp)
            .connect(lp)
            .connect(base)
            .connect(duck)
            .connect(breath)
            .connect(sum)
          // the ending: the music's room send rises from 0 at the fade start to −6 dB at its end
          const musicSend = new GainNode(ctx, { gain: 0 })
          breath.connect(musicSend).connect(verb)
          musicSend.gain.setValueAtTime(0, 0)
          musicSend.gain.setValueAtTime(0, plan.fade.start)
          musicSend.gain.linearRampToValueAtTime(
            undb(plan.send.musicEndDb),
            plan.fade.end,
          )
          base.gain.setValueAtTime(0, 0)
          base.gain.linearRampToValueAtTime(m.gain, 0.003)
          base.gain.setValueAtTime(m.gain, plan.length - 0.003)
          base.gain.linearRampToValueAtTime(0, plan.length)
          lp.frequency.setValueAtTime(2400, 0)
          lp.frequency.setValueAtTime(2400, Math.max(0, m.introEnd - 0.05))
          lp.frequency.exponentialRampToValueAtTime(20000, m.introEnd)
          for (const [a, b] of m.breaths) {
            const a0 = Math.max(a, m.introEnd)
            if (b - a0 < 0.2) continue
            lp.frequency.setValueAtTime(20000, a0)
            lp.frequency.exponentialRampToValueAtTime(1200, a0 + 0.08)
            lp.frequency.setValueAtTime(1200, b - 0.08)
            lp.frequency.exponentialRampToValueAtTime(20000, b)
            breath.gain.setValueAtTime(1, a0)
            breath.gain.linearRampToValueAtTime(undb(-6), a0 + 0.08)
            breath.gain.setValueAtTime(undb(-6), b - 0.08)
            breath.gain.linearRampToValueAtTime(1, b)
          }
          for (const [a, b] of m.ducks) {
            duck.gain.setValueAtTime(1, Math.max(0, a - 0.005))
            duck.gain.linearRampToValueAtTime(undb(-3), a + 0.01)
            duck.gain.setValueAtTime(undb(-3), b)
            duck.gain.linearRampToValueAtTime(1, b + 0.06)
          }
          src.start(0, m.offset, plan.length)
        }

        if (part !== 'music') {
          const foley = new BiquadFilterNode(ctx, {
            type: 'highpass',
            frequency: 80,
            Q: Math.SQRT1_2,
          })
          const ui = new BiquadFilterNode(ctx, {
            type: 'highpass',
            frequency: 80,
            Q: Math.SQRT1_2,
          })
          foley.connect(sum)
          ui.connect(sum)
          const send = new GainNode(ctx, { gain: undb(plan.send.db) })
          foley.connect(send).connect(verb)
          send.gain.setValueAtTime(undb(plan.send.db), plan.fade.start)
          send.gain.linearRampToValueAtTime(
            undb(plan.send.endDb),
            plan.fade.end,
          )
          for (const e of plan.events) {
            const buf = e.key.endsWith(':rev')
              ? reversed(e.key)
              : window.__bufs.get(e.key)
            const src = new AudioBufferSourceNode(ctx, {
              buffer: buf,
              playbackRate: e.rate,
            })
            const g = new GainNode(ctx, { gain: 0 })
            const p = new StereoPannerNode(ctx, { pan: e.pan })
            src
              .connect(g)
              .connect(p)
              .connect(e.bus === 'ui' ? ui : foley)
            const end = e.when + e.duration / e.rate
            g.gain.setValueAtTime(0, e.when)
            g.gain.linearRampToValueAtTime(e.gain, e.when + 0.003)
            g.gain.setValueAtTime(e.gain, Math.max(e.when + 0.003, end - 0.003))
            g.gain.linearRampToValueAtTime(0, end)
            src.start(e.when, e.offset, e.duration)
          }
          for (const s of plan.subs) {
            const osc = new OscillatorNode(ctx, {
              type: 'sine',
              frequency: plan.sub.hz,
            })
            const g = new GainNode(ctx, { gain: 0 })
            osc.connect(g).connect(sum)
            g.gain.setValueAtTime(0, s.when)
            g.gain.linearRampToValueAtTime(s.gain, s.when + 0.004)
            g.gain.exponentialRampToValueAtTime(
              0.0001,
              s.when + plan.sub.ms / 1000,
            )
            osc.start(s.when)
            osc.stop(s.when + plan.sub.ms / 1000 + 0.004)
          }
        }
        const rendered = await ctx.startRendering()
        res[part] = [
          window.__b64(rendered.getChannelData(0).subarray(pre, pre + len)),
          window.__b64(rendered.getChannelData(1).subarray(pre, pre + len)),
        ]
      }
      return res
    },
    { plan, parts, ir: ir.map(toB64) },
  )
  return Object.fromEntries(
    Object.entries(out).map(([k, [l, r]]) => [k, [fromB64(l), fromB64(r)]]),
  )
}

// ---------------------------------------------------------------- mix

/** `t → dB`: RMS of a stereo stem ((L² + R²) / 2) over t ± 0.5 s. */
export function localRmsDb(left, right, sr = SR) {
  const cum = new Float64Array(left.length + 1)
  for (let i = 0; i < left.length; i++)
    cum[i + 1] = cum[i] + (left[i] ** 2 + right[i] ** 2) / 2
  return (t) => {
    const a = Math.max(0, Math.round((t - 0.5) * sr))
    const b = Math.min(left.length, Math.round((t + 0.5) * sr))
    return (
      10 * Math.log10(Math.max((cum[b] - cum[a]) / Math.max(1, b - a), 1e-14))
    )
  }
}

const LEVEL_PASSES = 4

/**
 * One level pass (mutates `plan.events`): per RMS-levelled cue, its loudest 100 ms in the SFX stem (before the master)
 * against its planned `levelDb` (`fill`: the flick burst against the first flick's level); the cue's events take the
 * difference (± 12 dB). Returns true when any cue moved by more than 0.3 dB.
 */
export function levelCorrect(plan, left, right) {
  let moved = false
  const byCue = new Map()
  for (const e of plan.events)
    if (e.levelDb != null) {
      const k = `${e.type}@${e.cue}`
      if (!byCue.has(k)) byCue.set(k, [])
      byCue.get(k).push(e)
    }
  for (const evs of byCue.values()) {
    const got = cueRmsDb(left, right, evs[0].cue / FPS)
    const delta = Math.max(-12, Math.min(12, evs[0].levelDb - got))
    if (Math.abs(delta) <= 0.3) continue
    moved = true
    for (const e of evs) e.gain = round(e.gain * undb(delta), 6)
  }
  return moved
}

/** Loudest 100 ms RMS (dB, (L² + R²) / 2, 10 ms hop) of a stereo stem within [t − 150 ms, t + 250 ms]. */
export function cueRmsDb(left, right, t, sr = SR) {
  const w = Math.round(0.1 * sr)
  let best = 0
  for (
    let s = Math.round((t - 0.15) * sr);
    s + w <= Math.round((t + 0.25) * sr);
    s += Math.round(0.01 * sr)
  ) {
    let e = 0
    for (let i = Math.max(0, s); i < Math.min(left.length, s + w); i++)
      e += (left[i] ** 2 + right[i] ** 2) / 2
    if (e / w > best) best = e / w
  }
  return 10 * Math.log10(Math.max(best, 1e-14))
}

/** Sound list lookups: id → entry with its local path; cue group → ids. */
function soundIndex(list = loadSound(SOUND_JSON)) {
  const byId = new Map()
  const groups = {}
  for (const e of soundEntries(list)) {
    byId.set(e.id, { ...e, file: entryPath(e) })
    for (const c of e.cues ?? []) (groups[c] ??= []).push(e.id)
  }
  return { list, byId, groups }
}

/**
 * Mixes one reel: decode music + every foley variant the cues need, plan, render mix / music / sfx in Chromium,
 * master to −14 LUFS / −1 dBTP, write the stems and `<reel>-mix.json`. Returns `{ files, plan, numbers }`.
 */
export async function mixReel({ reel, music, cues, beats, out, seed }) {
  const { byId, groups } = soundIndex()
  const musicHash = sha256(fs.readFileSync(music))
  const musicEntry = [...byId.values()].find(
    (e) => e.kind === 'music' && e.sha256 === musicHash,
  )
  const needGroups = new Set(
    cues.cues.map((c) => CUES[c.type].group).filter(Boolean),
  )
  const sfxIds = [...needGroups].flatMap((g) => groups[g] ?? [])
  const files = new Map([['music', music]])
  for (const id of sfxIds) files.set(id, byId.get(id).file)
  const { page, close } = await openAudioPage(files)
  try {
    const decoded = await decodeMono(
      page,
      [...new Set(sfxIds)],
      SR,
      ['music'],
      true,
    )
    const pows = Object.fromEntries(
      sfxIds.map((id) => [id, decoded[`${id}:pow`]]),
    )
    const { segs } = sliceAll(groups, decoded, pows, [
      ...new Set(cues.cues.map((c) => c.type)),
    ])
    const args = { reel, cues, beats, groups, segs, seed, musicKey: 'music' }
    // the music stem as it will be rendered (ducks, breaths, intro filter), so RMS-levelled foley sits on it
    const [ml, mr] = (await renderPlan(page, buildPlan(args), ['music'])).music
    const musicDb = localRmsDb(ml, mr)
    const plan = buildPlan({ ...args, musicDb })
    // closed loop: measure each RMS-levelled cue in the rendered SFX stem as check 12j does (stereo files, pan, the
    // room send and neighbouring tails make the slice model miss by up to ~8 dB) and correct its events' gain
    for (let pass = 0; pass < LEVEL_PASSES; pass++) {
      const [sl, sr] = (await renderPlan(page, plan, ['sfx'])).sfx
      if (!levelCorrect(plan, sl, sr)) break
    }
    const stems = await renderPlan(page, plan, ['mix', 'music', 'sfx'])
    const master = masterCurve(...stems.mix)
    const done = Object.fromEntries(
      Object.entries(stems).map(([k, v]) => [k, master(v)]),
    )
    fs.mkdirSync(out, { recursive: true })
    const written = {}
    for (const [k, [l, r]] of Object.entries(done)) {
      const file = path.join(out, `${reel}-${k}.wav`)
      fs.writeFileSync(file, wavBytes(l, r))
      written[k] = file
    }
    const sources = [
      ...new Set([musicEntry?.id ?? null, ...plan.events.map((e) => e.id)]),
    ].filter(Boolean)
    const meta = {
      reel,
      tag: MIX_TAG,
      music: {
        id: musicEntry?.id ?? null,
        file: path.relative(out, music),
        sha256: musicHash,
        start: beats.start,
      },
      sources,
      frames: cues.frames ?? beats.frames,
      cues: cues.cues,
      cuts: cues.cuts ?? [],
      plan,
    }
    fs.writeFileSync(
      path.join(out, `${reel}-mix.json`),
      `${JSON.stringify(meta, null, 2)}\n`,
    )
    return { files: written, meta, stems: done }
  } finally {
    await close()
  }
}

// ---------------------------------------------------------------- check 12

/** Longest run (ms) of 10 ms windows under −60 dBFS RMS. */
export function longestSilenceMs(left, right, sr = SR) {
  const w = Math.round(0.01 * sr)
  const th = undb(SILENCE.db) ** 2
  let run = 0
  let best = 0
  for (let s = 0; s + w <= left.length; s += w) {
    let e = 0
    for (let i = s; i < s + w; i++)
      e += (left[i] * left[i] + right[i] * right[i]) / 2
    run = e / w < th ? run + 10 : 0
    if (run > best) best = run
  }
  return best
}

/**
 * Onset of each sound cue in the SFX stem: the 1 ms block with the largest rise of pre-emphasised energy within
 * ± 3 frames of the cue, bounded halfway to the neighbouring sound cues (a rise, so the tail of a louder sound before
 * it does not count). Returns `[{ frame, type, offsetFrames, offsetMs, peakDb }]`.
 */
export function cueOnsets(left, right, cues, sr = SR) {
  const sound = cues
    .filter((c) => !CUES[c.type]?.music)
    .sort((a, b) => a.frame - b.frame)
  const frames = [...new Set(sound.map((c) => c.frame))]
  const blk = Math.round(sr / 1000)
  const nb = Math.floor(left.length / blk)
  const energy = new Float64Array(nb)
  let prevL = 0
  let prevR = 0
  for (let b = 0; b < nb; b++) {
    let e = 0
    for (let i = b * blk; i < (b + 1) * blk; i++) {
      const yl = left[i] - 0.97 * prevL
      const yr = right[i] - 0.97 * prevR
      prevL = left[i]
      prevR = right[i]
      e += yl * yl + yr * yr
    }
    energy[b] = e
  }
  return sound.map((c) => {
    const k = frames.indexOf(c.frame)
    const prev = k > 0 ? (frames[k - 1] + c.frame) / 2 : -Infinity
    const next =
      k < frames.length - 1 ? (frames[k + 1] + c.frame) / 2 : Infinity
    const lo = Math.max(0, Math.round((Math.max(c.frame - 3, prev) / FPS) * sr))
    const hi = Math.min(
      left.length,
      Math.round((Math.min(c.frame + 3, next) / FPS) * sr),
    )
    let peak = 0
    let peakAt = lo
    for (let i = lo; i < hi; i++) {
      const v = Math.max(Math.abs(left[i]), Math.abs(right[i]))
      if (v > peak) {
        peak = v
        peakAt = i
      }
    }
    let best = Math.max(1, Math.floor(lo / blk))
    let bestRise = -Infinity
    for (let b = best; b < Math.min(nb, Math.ceil(hi / blk)); b++) {
      const rise = energy[b] - energy[b - 1]
      if (rise > bestRise) {
        bestRise = rise
        best = b
      }
    }
    // swells (whoosh, reversed flutter) have no attack: their onset is their loudest point, as the plan aligns them
    const at = CUES[c.type].onset === 'peak' ? peakAt : best * blk
    const offsetSec = at / sr - c.frame / FPS
    return {
      frame: c.frame,
      type: c.type,
      offsetFrames: round(offsetSec * FPS, 3),
      offsetMs: round(offsetSec * 1000, 1),
      peakDb: round(db(peak), 1),
    }
  })
}

/**
 * Share of the music stem's onsets (0 … `t1` s) on the half-beat lattice of `beats` (the stem starts on beat 0):
 * stereo 48 kHz → mono at the gate's analysis rate, the gate's onset flux and `onGridShare`.
 */
export function stemOnGrid([left, right], beats, t1, sr = SR) {
  const k = Math.max(1, Math.round(sr / ANALYSIS_SR))
  const mono = new Float32Array(Math.floor(left.length / k))
  for (let i = 0; i < mono.length; i++) {
    let s = 0
    for (let j = 0; j < k; j++) s += left[i * k + j] + right[i * k + j]
    mono[i] = s / (2 * k)
  }
  const fx = onsetFlux(mono, sr / k)
  return onGridShare(
    fx,
    0,
    Math.min(t1, mono.length / (sr / k)),
    beats.period / 2,
  )
}

/**
 * Check 12 (spec §5): every audio file is in sound.json with an accepted licence and its sha256; the music comes from
 * a listed track; mix −14 LUFS ± 0.5, true peak ≤ −1 dBTP, no sample ≥ 0.99; every sound cue has an onset in the
 * SFX stem within ± 1 frame; every cut is within ± 1 frame of a beat (0 cues or 0 cuts fail: nothing was measured) and
 * ≥ 70 % of the music stem's onsets before the fade lie within 40 ms of the half-beat grid;
 * no silence > 150 ms; momentary loudness ≥ −24 LUFS before the fade (breath windows excepted); the mix high-passed
 * at 300 Hz (4th order) ≥ −18 LUFS; every foley slice reaches its type's minimum length; RMS-levelled cues (loudest 100 ms of the
 * SFX stem vs the music stem's RMS around the cue) spread ≤ 4 dB per type and every swish ≤ music − 8 dB.
 * `{ ok, lines, numbers }`.
 */
export function checkSound({
  meta,
  mix,
  sfx,
  music,
  beats,
  cuts = meta.cuts,
  list = loadSound(SOUND_JSON),
}) {
  const lines = []
  let ok = true
  const line = (pass, text) => {
    if (!pass) ok = false
    lines.push(`${pass ? 'ok  ' : 'FAIL'} ${text}`)
  }
  const entries = new Map(soundEntries(list).map((e) => [e.id, e]))
  const src = (e) => list.sources[e.source] ?? {}
  const bad = []
  for (const id of meta.sources) {
    const e = entries.get(id)
    if (!e) {
      bad.push(`${id}: not in sound.json`)
      continue
    }
    const lic = e.licence ?? src(e).licence
    if (!LICENCES.has(lic)) bad.push(`${id}: licence ${lic}`)
    const file = entryPath(e)
    const hash = fs.existsSync(file) ? sha256(fs.readFileSync(file)) : null
    if (!e.sha256 || hash !== e.sha256)
      bad.push(`${id}: sha256 ${hash ?? 'missing file'} ≠ ${e.sha256}`)
  }
  line(
    !bad.length,
    `12a files: ${meta.sources.length} in sound.json with licence + sha256${bad.length ? ` (${bad.join('; ')})` : ''}`,
  )
  const musicEntry = entries.get(meta.music.id)
  line(
    Boolean(
      musicEntry &&
      musicEntry.kind === 'music' &&
      musicEntry.sha256 === meta.music.sha256,
    ),
    `12b music: ${musicEntry ? `"${musicEntry.title}" (${musicEntry.licence ?? src(musicEntry).licence})` : `unlisted file sha256 ${meta.music.sha256}`}`,
  )
  const lufs = loudness(...mix)
  const pk = peaks(...mix)
  line(
    Math.abs(lufs - TARGET.lufs) <= TARGET.tol,
    `12c loudness ${lufs.toFixed(2)} LUFS (−14 ± 0.5)`,
  )
  line(
    pk.truePeak <= TARGET.truePeak,
    `12d true peak ${pk.truePeak.toFixed(2)} dBTP (≤ −1)`,
  )
  line(
    pk.samplePeak < TARGET.samplePeak,
    `12e sample peak ${pk.samplePeak.toFixed(4)} (< 0.99)`,
  )
  const onsets = cueOnsets(...sfx, meta.cues)
  const off = onsets.filter((o) => Math.abs(o.offsetFrames) > 1)
  const maxMs = Math.max(0, ...onsets.map((o) => Math.abs(o.offsetMs)))
  line(
    onsets.length > 0 && !off.length,
    `12f cue onsets: ${onsets.length} cues, max |offset| ${maxMs.toFixed(1)} ms (± 1 frame = 33.3 ms)${off.length ? `; off: ${off.map((o) => `${o.type}@${o.frame} ${o.offsetFrames} f`).join(', ')}` : ''}`,
  )
  const cutDist = cuts.map((f) => ({ f, d: nearestBeatDistance(beats, f) }))
  const offCuts = cutDist.filter((c) => c.d > 1)
  const fadeStart = meta.plan?.fade?.start ?? mix[0].length / SR
  // the grid must be the metre of the music: its onsets in the music stem sit on the half-beat lattice
  const grid = music ? stemOnGrid(music, beats, fadeStart) : null
  line(
    cuts.length > 0 &&
      !offCuts.length &&
      grid != null &&
      grid.onGrid >= GATE.onGrid,
    `12g cuts on beats: ${cuts.length ? `${cuts.length} cuts, max ${Math.max(0, ...cutDist.map((c) => c.d))} frame(s) from a beat` : 'no cuts given'}${offCuts.length ? `; off: ${offCuts.map((c) => `${c.f} (${c.d} f)`).join(', ')}` : ''}; music onsets on the half-beat grid ${grid ? `${grid.onGrid.toFixed(2)} of ${grid.onsets.length}` : '— (no music stem)'} (≥ ${GATE.onGrid.toFixed(2)})`,
  )
  const silence = longestSilenceMs(...mix)
  line(
    silence <= SILENCE.ms,
    `12h longest silence ${silence} ms (≤ 150 ms under −60 dBFS)`,
  )
  const breaths = meta.plan?.music?.breaths ?? []
  const counted = momentary(...mix).filter(
    (b) =>
      b.t + 0.4 <= fadeStart + 1e-6 &&
      !breaths.some(([a, z]) => b.t < z && b.t + 0.4 > a),
  )
  const lowest = counted.reduce((a, b) => (b.lufs < a.lufs ? b : a), {
    t: null,
    lufs: Infinity,
  })
  const holes = counted.filter((b) => b.lufs < HOLES.momentaryLufs)
  line(
    counted.length > 0 && !holes.length,
    `12k music holes: min momentary ${lowest.lufs.toFixed(1)} LUFS at ${lowest.t?.toFixed(1)} s before the fade at ${fadeStart.toFixed(2)} s, ${breaths.length} breath window(s) excepted (≥ ${HOLES.momentaryLufs})${holes.length ? `; under: ${holes.length} blocks from ${holes[0].t.toFixed(1)} s` : ''}`,
  )
  const phone = loudness(...mix, SR, { phone: true })
  line(
    phone >= PHONE.lufs,
    `12l phone speaker: ${phone.toFixed(2)} LUFS high-passed at ${PHONE_HZ} Hz (4th order) (≥ ${PHONE.lufs.toFixed(1)})`,
  )
  const events = meta.plan?.events ?? []
  const short = events.filter((e) => e.sliceLen < e.minLen - 1e-6)
  const minOf = (type) =>
    Math.min(
      ...events.filter((e) => e.type === type).map((e) => e.sliceLen * 1000),
    )
  const sliceTypes = [
    ...new Set(events.filter((e) => e.minLen).map((e) => e.type)),
  ]
  line(
    events.length > 0 && !short.length,
    `12i foley slices: ${events.length} events, shortest ${sliceTypes.map((t) => `${t} ${Math.round(minOf(t))}/${Math.round(CUES[t].minLen * 1000)} ms`).join(', ')}${short.length ? `; short: ${short.map((e) => `${e.type}@${e.cue} ${e.id} ${Math.round(e.sliceLen * 1000)} ms`).join(', ')}` : ''}`,
  )
  const levels = {}
  if (music) {
    const musicAt = localRmsDb(...music)
    for (const c of meta.cues) {
      if (CUES[c.type]?.rms == null) continue
      const t = c.frame / FPS
      ;(levels[c.type] ??= []).push(round(cueRmsDb(...sfx, t) - musicAt(t), 1))
    }
  }
  const spread = (v) => Math.max(...v) - Math.min(...v)
  const wide = Object.entries(levels).filter(
    ([, v]) => spread(v) > LEVELS.spreadDb,
  )
  const loudSwish = (levels.swish ?? []).filter((v) => v > -LEVELS.swishUnderDb)
  line(
    Boolean(music) && !wide.length && !loudSwish.length,
    `12j foley levels vs music: ${
      music
        ? Object.entries(levels)
            .map(
              ([t, v]) =>
                `${t} ${Math.min(...v).toFixed(1)}…${Math.max(...v).toFixed(1)} dB (spread ${spread(v).toFixed(1)})`,
            )
            .join(', ') || 'no RMS-levelled cues'
        : 'no music stem'
    } (spread ≤ ${LEVELS.spreadDb} dB, swish ≤ −${LEVELS.swishUnderDb} dB)${loudSwish.length ? `; loud swish: ${loudSwish.join(', ')}` : ''}`,
  )
  return {
    ok,
    lines,
    numbers: {
      lufs: round(lufs, 2),
      truePeak: round(pk.truePeak, 2),
      samplePeak: round(pk.samplePeak, 4),
      maxCueOffsetMs: maxMs,
      cues: onsets.length,
      cuts: cuts.length,
      musicOnGrid: grid ? round(grid.onGrid, 2) : null,
      longestSilenceMs: silence,
      minMomentaryLufs: round(lowest.lufs, 2),
      minMomentaryAt: lowest.t == null ? null : round(lowest.t, 1),
      phoneLufs: round(phone, 2),
      shortSlices: short.length,
      levels,
    },
    onsets,
  }
}

/** Check 12 from files: `<dir>/<reel>-{mix,sfx}.wav`, `<reel>-mix.json` and the beats the mix used. */
export function checkSoundFiles({
  reel,
  dir = path.join(SOUND_OUT, 'mix'),
  cuts,
  beatsFile,
}) {
  const meta = JSON.parse(
    fs.readFileSync(path.join(dir, `${reel}-mix.json`), 'utf8'),
  )
  const wav = (k) => {
    const w = readWav(fs.readFileSync(path.join(dir, `${reel}-${k}.wav`)))
    if (w.tag !== MIX_TAG)
      throw new Error(
        `${reel}-${k}.wav: not written by reels-mix (tag ${w.tag})`,
      )
    return [w.left, w.right]
  }
  const beats = JSON.parse(
    fs.readFileSync(beatsFile ?? path.join(dir, `${reel}.beats.json`), 'utf8'),
  )
  return checkSound({
    meta,
    mix: wav('mix'),
    sfx: wav('sfx'),
    music: wav('music'),
    beats,
    cuts: cuts ?? meta.cuts,
  })
}

// ---------------------------------------------------------------- CLI

async function main() {
  const args = process.argv.slice(2)
  const flag = (name) => args.includes(name)
  const opt = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const reel = opt('--reel') ?? 'a'
  reelConfig(reel)
  const manifestFile = path.join(SOUND_OUT, 'manifest.json')
  if (!fs.existsSync(manifestFile))
    throw new Error(
      'no promo/out/reels/sound/manifest.json: run node promo/reels/sound.mjs first',
    )
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))

  if (flag('--analyse')) {
    const music = opt('--music') ? path.resolve(opt('--music')) : null
    const res = await trackGate(reel, manifest, SOUND_OUT, music)
    for (const l of res.lines) console.log(l)
    return res.ok ? 0 : 1
  }

  const out = path.resolve(
    opt('--out') ?? opt('--dir') ?? path.join(SOUND_OUT, 'mix'),
  )
  if (flag('--check')) {
    const cuts = opt('--cuts')?.split(',').map(Number)
    const res = checkSoundFiles({ reel, dir: out, cuts })
    for (const l of res.lines) console.log(l)
    if (flag('--verbose'))
      for (const o of res.onsets)
        console.log(
          `     ${o.type.padEnd(9)} frame ${String(o.frame).padStart(4)}  ${o.offsetMs >= 0 ? '+' : ''}${o.offsetMs} ms  peak ${o.peakDb} dBFS`,
        )
    return res.ok ? 0 : 1
  }

  if (!opt('--cues')) throw new Error('--cues <json | sample> is required')
  let beatsFile = path.resolve(
    opt('--beats') ?? path.join(SOUND_OUT, `${reel}.beats.json`),
  )
  let beats = fs.existsSync(beatsFile)
    ? JSON.parse(fs.readFileSync(beatsFile, 'utf8'))
    : null
  let music = opt('--music') ? path.resolve(opt('--music')) : null
  if (music && (!beats || beats.sha256 !== sha256(fs.readFileSync(music)))) {
    // another track: its own beats (the cut follows them)
    const gate = await trackGate(reel, manifest, out, music)
    for (const l of gate.lines) console.log(l)
    if (!gate.beats) return 1
    beats = gate.beats
    beatsFile = path.join(out, `${reel}.beats.json`)
  }
  if (!beats) throw new Error(`no beats for reel ${reel}: run --analyse first`)
  music ??= path.resolve(SOUND_OUT, manifest.files[beats.track].path)
  if (path.dirname(beatsFile) !== out) {
    fs.mkdirSync(out, { recursive: true })
    fs.copyFileSync(beatsFile, path.join(out, `${reel}.beats.json`))
  }
  const cues = loadCues(opt('--cues'), beats)
  const seed = opt('--seed') ? Number(opt('--seed')) : undefined
  const res = await mixReel({ reel, music, cues, beats, out, seed })
  for (const f of Object.values(res.files)) console.log(`wrote ${f}`)
  if (opt('--cues') === 'sample')
    fs.writeFileSync(
      path.join(out, `${reel}-sample-cues.json`),
      `${JSON.stringify(cues, null, 2)}\n`,
    )
  const check = checkSound({
    meta: res.meta,
    mix: res.stems.mix,
    sfx: res.stems.sfx,
    music: res.stems.music,
    beats,
  })
  for (const l of check.lines) console.log(l)
  return check.ok ? 0 : 1
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err)
      process.exit(1)
    },
  )
}

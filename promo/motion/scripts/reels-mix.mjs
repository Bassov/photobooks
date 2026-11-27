// Reels sound: track gate, foley plan, OfflineAudioContext mix and check 12 (Designer promo-reels-v2 spec §3, §5.12).
//
//   node scripts/reels-mix.mjs --analyse --reel a [--music <file>]
//       Track gate over sound.json's candidates for the reel (or one file): tempo by onset-flux autocorrelation, beat
//       confidence, last-third rise of a downbeat excerpt. First passing track wins; prints it and 2 runners-up and
//       writes promo/out/reels/sound/<reel>.beats.json.
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

/** Spec §3 track gate: tempo window(s) per reel (C also takes its half tempo), confidence and rise. */
export const TEMPO = {
  a: [[80, 110]],
  b: [[60, 100]],
  c: [
    [108, 132],
    [54, 66],
  ],
}
export const GATE = { confidence: 0.3, riseDb: 2, minSec: 15, maxSec: 20 }
/** Spec §3 master targets. */
export const TARGET = { lufs: -14, tol: 0.5, truePeak: -1, samplePeak: 0.99 }
const SILENCE = { db: -60, ms: 150 }

/**
 * Foley cue types (spec §3 "Foley cues"). `group` = sound.json `cues` tag of the variants, `peak` = clip peak in dBFS
 * before the master gain, `bus` foley (high-pass 80 Hz + room send) or ui (dry), `sub` = sine sub under it,
 * `duck` = −3 dB music duck for 180 ms, `maxLen` = longest slice of the file (s), `flicks` = staggered copies,
 * `onset: 'peak'` = check 12 measures the loudest point (a swell has no attack).
 */
export const CUES = {
  page: { group: 'page', peak: -10, bus: 'foley', maxLen: 1.2 },
  pageSlow: { group: 'pageSlow', peak: -10, bus: 'foley', maxLen: 1.8 },
  flutter: {
    group: 'flutter',
    peak: -14,
    bus: 'foley',
    reverse: true,
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
    peak: -14,
    bus: 'foley',
    flicks: [5, 7],
    maxLen: 0.3,
  },
  swish: {
    group: 'swish',
    peak: -14,
    bus: 'foley',
    maxLen: 1.0,
    onset: 'peak',
  },
  wood: { group: 'wood', peak: -8, bus: 'foley', maxLen: 0.8 },
  cover: { group: 'cover', peak: -8, bus: 'foley', maxLen: 0.8 },
  impact: {
    group: 'impact',
    peak: -6,
    bus: 'foley',
    sub: true,
    duck: true,
    maxLen: 1.0,
  },
  /** Music dip (−6 dB, low-pass 1.2 kHz) for the cue's `frames`; no sound of its own. */
  breath: { music: true },
}
const MUSIC_RMS_DB = -20
const SUB = { hz: 50, ms: 155, peakDb: -14 }
const SEND_DB = -14
const SEND_END_DB = -6
const FADE_SEC = 1.2

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

/** BS.1770-4 K-weighting at 48 kHz (shelf + RLB high-pass). */
const K1 = {
  b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
  a: [1, -1.69065929318241, 0.73248077421585],
}
const K2 = { b: [1, -2, 1], a: [1, -1.99004745483398, 0.99007225036621] }

/** Integrated loudness (LUFS, BS.1770-4: 400 ms blocks, 75 % overlap, −70 LUFS absolute and −10 LU relative gate). */
export function loudness(left, right, sr = SR) {
  if (sr !== 48000) throw new Error('loudness: 48 kHz only')
  const chans = [left, right].map((c) => {
    const y = biquad(biquad(c, K1.b, K1.a), K2.b, K2.a)
    const cum = new Float64Array(y.length + 1)
    for (let i = 0; i < y.length; i++) cum[i + 1] = cum[i] + y[i] * y[i]
    return cum
  })
  const block = Math.round(0.4 * sr)
  const hop = Math.round(0.1 * sr)
  const z = []
  for (let s = 0; s + block <= left.length; s += hop) {
    let sum = 0
    for (const cum of chans) sum += (cum[s + block] - cum[s]) / block
    z.push(sum)
  }
  const lk = (v) => -0.691 + 10 * Math.log10(v)
  const abs = z.filter((v) => v > 0 && lk(v) > -70)
  if (!abs.length) return -Infinity
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10
  const gated = abs.filter((v) => lk(v) > rel)
  return lk(gated.reduce((a, b) => a + b, 0) / gated.length)
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
 * key in `keys` (keys in `keep` are decoded but not sent back).
 */
async function decodeMono(page, keys, sr, keep = []) {
  const out = await page.evaluate(
    async ({ keys, sr, keep }) => {
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
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const d = buf.getChannelData(c)
          for (let i = 0; i < d.length; i++)
            mono[i] += d[i] / buf.numberOfChannels
        }
        res[key] = window.__b64(mono)
      }
      return res
    },
    { keys, sr, keep },
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
 * Tempo by autocorrelation of the (mean-removed) flux inside the reel's tempo windows. Confidence = ACF peak / zero
 * lag (spec §3). A half-tempo window (C) puts the grid on the doubled tempo. Returns `{ bpm, lag, confidence, half }`.
 */
export function tempoOf(flux, rate, windows) {
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
  windows.forEach(([lo, hi], w) => {
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
        best = { lag: l + frac, confidence: v, half: w > 0 }
      }
    }
  })
  if (!best) return { bpm: 0, lag: 0, confidence: 0, half: false }
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
 * inside 15–20 s (closest to the reel's v1 length) whose last third is loudest against its first third. Guards: no
 * quarter-second inside the excerpt is > 24 dB under its mean, its first third is ≥ track RMS − 12 dB, and it ends
 * 0.5 s before the track does.
 */
export function analyseTrack(mono, sr, reel) {
  const { flux, rate, offset, hop } = onsetFlux(mono, sr)
  const tempo = tempoOf(flux, rate, TEMPO[reel])
  const out = {
    bpm: round(tempo.bpm, 2),
    confidence: round(tempo.confidence, 3),
    half: tempo.half,
    duration: round(mono.length / sr, 2),
  }
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
  let best = null
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
    const rise = last - first
    if (!best || rise > best.rise)
      best = { k, start: beatAt(k), rise, mean, first }
  }
  if (!best) return { ...out, ok: false, why: 'no excerpt passes the guards' }
  const beats = []
  for (let k = best.k; beatAt(k) < best.start + len - 1e-6; k++)
    beats.push(round(beatAt(k) - best.start, 4))
  let strongestBar = 0
  let strongest = -Infinity
  for (let b = 0; b < bars; b++) {
    const s = (best.start + b * bar) * sr
    const v = rmsDb(mono, s, s + bar * sr)
    if (v > strongest) {
      strongest = v
      strongestBar = b
    }
  }
  // the grid tempo, or (half-tempo window) the felt tempo, inside a window
  const tempoOk = TEMPO[reel].some(
    ([lo, hi]) =>
      (out.bpm >= lo && out.bpm <= hi) ||
      (tempo.half && out.bpm / 2 >= lo && out.bpm / 2 <= hi),
  )
  const ok =
    tempoOk && tempo.confidence >= GATE.confidence && best.rise >= GATE.riseDb
  return {
    ...out,
    ok,
    why: ok
      ? ''
      : [
          tempoOk ? '' : 'tempo out of range',
          tempo.confidence >= GATE.confidence ? '' : 'confidence < 0.30',
          best.rise >= GATE.riseDb ? '' : 'rise < 2 dB',
        ]
          .filter(Boolean)
          .join(', '),
    riseDb: round(best.rise, 2),
    start: round(best.start, 4),
    length: round(len, 4),
    frames: Math.round(len * FPS),
    bars,
    period: round(period, 5),
    beats,
    downbeats: beats.map((_, i) => i).filter((i) => i % 4 === 0),
    strongestBar,
    excerptRmsDb: round(best.mean, 2),
  }
}

const analysisCache = new Map()

/**
 * Track gate for a reel over `manifest.candidates[reel]` (or `only`: one file path): analyses each, picks the first
 * that passes and the next two passing as runners-up (else the best failing ones), writes `<reel>.beats.json` to
 * `out`. Returns `{ ok, lines, winner, runnersUp, beats }`.
 */
export async function trackGate(reel, manifest, out = SOUND_OUT, only = null) {
  reelConfig(reel)
  const items = only
    ? [{ id: musicIdOf(only, manifest) ?? path.basename(only), file: only }]
    : manifest.candidates[reel].map((id) => ({
        id,
        file: path.resolve(out, manifest.files[id].path),
      }))
  const todo = items.filter((it) => !analysisCache.has(`${reel}:${it.file}`))
  if (todo.length) {
    const files = new Map(todo.map((it) => [it.id, it.file]))
    const { page, close } = await openAudioPage(files)
    try {
      for (const it of todo) {
        const mono = (await decodeMono(page, [it.id], ANALYSIS_SR))[it.id]
        analysisCache.set(
          `${reel}:${it.file}`,
          analyseTrack(mono, ANALYSIS_SR, reel),
        )
      }
    } finally {
      await close()
    }
  }
  const results = items.map((it) => ({
    ...it,
    ...analysisCache.get(`${reel}:${it.file}`),
  }))
  const winner = results.find((r) => r.ok) ?? null
  const rest = results.filter((r) => r !== winner)
  const runnersUp = [
    ...rest.filter((r) => r.ok),
    ...rest
      .filter((r) => !r.ok)
      .sort((x, y) => (y.riseDb ?? -99) - (x.riseDb ?? -99)),
  ].slice(0, 2)
  const fmt = (tag, r) =>
    `${reel}  ${tag.padEnd(9)} ${r.id.padEnd(26)} BPM ${String(r.bpm).padStart(6)}${r.half ? ' (½)' : '    '}  conf ${r.confidence.toFixed(2)}  rise ${r.riseDb == null ? '   —  ' : `${r.riseDb >= 0 ? '+' : ''}${r.riseDb.toFixed(1)} dB`}${r.start == null ? '' : `  start ${r.start.toFixed(2)} s  ${r.bars} bars ${r.length.toFixed(2)} s`}${r.ok ? '' : `  [${r.why}]`}`
  const skipped = winner ? results.slice(0, results.indexOf(winner)) : []
  const lines = [
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
      start: winner.start,
      length: winner.length,
      frames: winner.frames,
      bars: winner.bars,
      strongestBar: winner.strongestBar,
      excerptRmsDb: winner.excerptRmsDb,
      downbeats: winner.downbeats,
      beats: winner.beats,
      runnersUp: runnersUp.map((r) => ({
        track: r.id,
        ok: r.ok,
        bpm: r.bpm,
        confidence: r.confidence,
        riseDb: r.riseDb ?? null,
      })),
    }
    fs.mkdirSync(out, { recursive: true })
    const file = path.join(out, `${reel}.beats.json`)
    fs.writeFileSync(file, `${JSON.stringify(beats, null, 2)}\n`)
    lines.push(`${reel}  beats → ${file}`)
  }
  return { ok: Boolean(winner), lines, winner, runnersUp, beats }
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

/**
 * The slice of a foley file around its loudest transient: back ≤ `pre` s until 30 ms under −40 dB of the peak, forward
 * until 80 ms under −50 dB or `maxLen`, and never into a neighbouring event of the same file. Times in seconds;
 * `transient` is the loudest sample.
 */
export function segmentHit(mono, sr, maxLen = 1.5, pre = 0.25) {
  const blk = Math.round(sr / 1000)
  const nb = Math.floor(mono.length / blk)
  const env = new Float32Array(nb)
  let peak = 0
  let peakI = 0
  for (let i = 0; i < nb * blk; i++) {
    const v = Math.abs(mono[i])
    const b = Math.floor(i / blk)
    if (v > env[b]) env[b] = v
    if (v > peak) {
      peak = v
      peakI = i
    }
  }
  const pb = Math.floor(peakI / blk)
  const lo = peak * undb(-40)
  // a file with several events (page turns, whooshes): the slice stops in the dip (≥ 20 dB down) before another
  // event that comes back within 10 dB of the peak
  const dipLevel = peak * undb(-20)
  const other = peak * undb(-10)
  let start = pb
  let dip = { at: pb, v: Infinity }
  for (let quiet = 0; start > 0 && pb - start < pre * 1000; start--) {
    const v = env[start - 1]
    if (v < dip.v) dip = { at: start - 1, v }
    if (dip.v < dipLevel && v > other) {
      start = dip.at + 1
      break
    }
    quiet = v < lo ? quiet + 1 : 0
    if (quiet >= 30) {
      start += 30
      break
    }
  }
  const tail = peak * undb(-50)
  let end = pb
  dip = { at: pb, v: Infinity }
  for (let quiet = 0; end < nb && end - start < maxLen * 1000; end++) {
    const v = env[end]
    if (v < dip.v) dip = { at: end, v }
    if (dip.v < dipLevel && v > other) {
      end = dip.at
      break
    }
    quiet = v < tail ? quiet + 1 : 0
    if (quiet >= 80) break
  }
  return {
    // ≥ 4 ms before the transient, so the 3 ms fade-in stays ahead of it
    start: Math.max(0, Math.min((start * blk) / sr, peakI / sr - 0.004)),
    end: Math.min(mono.length, end * blk) / sr,
    transient: peakI / sr,
    peak,
  }
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
 */
export function buildPlan({ reel, cues, beats, groups, segs, seed, musicKey }) {
  const length = (cues.frames ?? beats.frames) / FPS
  const random = rng(seed ?? reel.charCodeAt(0) * 7919)
  const last = {}
  const pickVariant = (group) => {
    const ids = groups[group]
    if (!ids?.length) throw new Error(`no sound for cue group "${group}"`)
    let id
    do id = ids[Math.floor(random() * ids.length)]
    while (ids.length > 1 && id === last[group])
    last[group] = id
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
      const seg = segs[`${key}@${def.maxLen}`]
      const rate = 2 ** ((random() * 2 - 1) / 12)
      const jitter = (random() * 2 - 1) * 1.5
      const at = t + j * 0.04
      const gain = undb(def.peak - 2 * j + jitter) / seg.peak
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
    send: { db: SEND_DB, endDb: SEND_END_DB },
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
          const send = new GainNode(ctx, { gain: undb(plan.send.db) })
          foley.connect(send).connect(verb).connect(sum)
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
    const monos = await decodeMono(page, [...new Set(sfxIds)], SR, ['music'])
    const segs = {}
    for (const type of new Set(cues.cues.map((c) => c.type))) {
      const def = CUES[type]
      if (def.music) continue
      for (const id of groups[def.group] ?? []) {
        const mono = def.reverse ? monos[id].slice().reverse() : monos[id]
        segs[`${def.reverse ? `${id}:rev` : id}@${def.maxLen}`] = segmentHit(
          mono,
          SR,
          def.maxLen,
        )
      }
    }
    const plan = buildPlan({
      reel,
      cues,
      beats,
      groups,
      segs,
      seed,
      musicKey: 'music',
    })
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
 * Check 12 (spec §5): every audio file is in sound.json with an accepted licence and its sha256; the music comes from
 * a listed track; mix −14 LUFS ± 0.5, true peak ≤ −1 dBTP, no sample ≥ 0.99; every sound cue has an onset in the
 * SFX stem within ± 1 frame; every cut is within ± 1 frame of a beat; no silence > 150 ms. `{ ok, lines, numbers }`.
 */
export function checkSound({
  meta,
  mix,
  sfx,
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
    !off.length,
    `12f cue onsets: ${onsets.length} cues, max |offset| ${maxMs.toFixed(1)} ms (± 1 frame = 33.3 ms)${off.length ? `; off: ${off.map((o) => `${o.type}@${o.frame} ${o.offsetFrames} f`).join(', ')}` : ''}`,
  )
  const cutDist = cuts.map((f) => ({ f, d: nearestBeatDistance(beats, f) }))
  const offCuts = cutDist.filter((c) => c.d > 1)
  line(
    !offCuts.length,
    `12g cuts on beats: ${cuts.length ? `${cuts.length} cuts, max ${Math.max(0, ...cutDist.map((c) => c.d))} frame(s) from a beat` : 'no cuts given'}${offCuts.length ? `; off: ${offCuts.map((c) => `${c.f} (${c.d} f)`).join(', ')}` : ''}`,
  )
  const silence = longestSilenceMs(...mix)
  line(
    silence <= SILENCE.ms,
    `12h longest silence ${silence} ms (≤ 150 ms under −60 dBFS)`,
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
      longestSilenceMs: silence,
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

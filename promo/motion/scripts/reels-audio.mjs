#!/usr/bin/env node
// Music + SFX for the three reels, synthesised from code on each reel's beat grid (spec §2 «Sound»). Plain Node, no
// samples, no dependencies beyond the shot tables: every hit is placed on the exact sample of its beat or cue frame.
//
//   node scripts/reels-audio.mjs [--reel a|b|c] [--out <dir>]     → <dir>/<reel>.wav (default promo/out/reels/audio)
//
// Each WAV is 48 kHz 16-bit stereo with a LIST/INFO ISFT tag (reels-render.mjs check 7 reads it). After writing, the
// file is read back and every percussive hit's onset is located in the audio: the script prints the largest offset
// from its scheduled frame and exits 1 unless it rounds to 0 frames.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import {
  REEL_IDS,
  SAMPLES_PER_FRAME,
  SAMPLE_RATE,
  beatSample,
  frameSample,
  isCueOnGrid,
  reelConfig,
} from '../src/reels/shared/beats.js'
import { stubShots } from '../src/reels/stub.shots.js'

const motion = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const AUDIO_TAG = 'photobooks reels-audio'
const SR = SAMPLE_RATE
const TAU = 2 * Math.PI

/** The reel's shot table: `src/reels/<x>.shots.js` once a reel item adds it, else the stub grid. */
export async function loadTable(reel) {
  const file = join(motion, 'src', 'reels', `${reel}.shots.js`)
  if (existsSync(file)) return (await import(pathToFileURL(file).href)).default
  return stubShots(reel)
}

// ---------------------------------------------------------------- DSP helpers

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** RBJ biquad; `type` lp | hp | bp. `set` retunes it (sweeps). */
class Biquad {
  constructor(type, freq, q = 0.707) {
    this.type = type
    this.x1 = this.x2 = this.y1 = this.y2 = 0
    this.set(freq, q)
  }
  set(freq, q = this.q) {
    this.q = q
    const w = (TAU * Math.min(freq, SR * 0.45)) / SR
    const cos = Math.cos(w)
    const alpha = Math.sin(w) / (2 * q)
    let b0, b1, b2
    if (this.type === 'lp') {
      b0 = (1 - cos) / 2
      b1 = 1 - cos
      b2 = b0
    } else if (this.type === 'hp') {
      b0 = (1 + cos) / 2
      b1 = -(1 + cos)
      b2 = b0
    } else {
      b0 = alpha
      b1 = 0
      b2 = -alpha
    }
    const a0 = 1 + alpha
    this.b0 = b0 / a0
    this.b1 = b1 / a0
    this.b2 = b2 / a0
    this.a1 = (-2 * cos) / a0
    this.a2 = (1 - alpha) / a0
  }
  run(x) {
    const y =
      this.b0 * x +
      this.b1 * this.x1 +
      this.b2 * this.x2 -
      this.a1 * this.y1 -
      this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}

const ms = (v) => Math.round((v / 1000) * SR)
const noteHz = (midi) => 440 * 2 ** ((midi - 69) / 12)
const saw = (phase) => 2 * (phase - Math.floor(phase + 0.5))
/** A short linear fade-in so no voice starts with a click; transients still peak within 1 ms. */
const attack = (i, n = 24) => (i < n ? i / n : 1)

// ---------------------------------------------------------------- voices (mono Float32Array, start at sample 0)

const voices = {
  kick(r) {
    const n = ms(350)
    const out = new Float32Array(n)
    let phase = 0
    for (let i = 0; i < n; i++) {
      const t = i / SR
      const f = 45 + 75 * Math.exp(-t / 0.035)
      phase += f / SR
      out[i] = Math.sin(TAU * phase) * Math.exp((-5 * t) / 0.35) * attack(i, 12)
    }
    for (let i = 0; i < ms(3); i++)
      out[i] += (r() * 2 - 1) * 0.5 * (1 - i / ms(3))
    return out
  },
  clap(r) {
    const n = ms(180)
    const out = new Float32Array(n)
    const bp = new Biquad('bp', 1200, 1.4)
    for (let i = 0; i < n; i++) {
      const t = i / SR
      const burst = [0, 0.011, 0.022].reduce(
        (a, s, k) =>
          a + (t >= s ? Math.exp(-(t - s) / (k === 2 ? 0.06 : 0.008)) : 0),
        0,
      )
      out[i] = bp.run((r() * 2 - 1) * burst) * 3 * attack(i, 6)
    }
    return out
  },
  hat(r, { len = 40, freq = 7000, kind = 'hp' } = {}) {
    const n = ms(len)
    const out = new Float32Array(n)
    const f = new Biquad(kind, freq, kind === 'bp' ? 1.2 : 0.707)
    for (let i = 0; i < n; i++) {
      out[i] = f.run(r() * 2 - 1) * Math.exp((-4 * i) / n) * attack(i, 6)
    }
    return out
  },
  bass(r, { midi, len }) {
    const n = ms(len)
    const out = new Float32Array(n)
    const lp = new Biquad('lp', 300, 0.9)
    const f = noteHz(midi)
    for (let i = 0; i < n; i++) {
      const p = (f * i) / SR
      const env =
        Math.min(1, i / ms(4)) *
        Math.exp((-1.5 * i) / n) *
        Math.min(1, (n - i) / ms(20))
      out[i] = lp.run(0.6 * Math.sin(TAU * p) + 0.5 * saw(p)) * env
    }
    return out
  },
  pad(r, { notes, len }) {
    const n = ms(len + 300)
    const out = new Float32Array(n)
    const lp = new Biquad('lp', 900, 0.7)
    const detune = [-0.11, -0.04, 0.05, 0.12]
    const phases = notes.flatMap(() => detune.map(() => r()))
    for (let i = 0; i < n; i++) {
      let v = 0
      notes.forEach((m, a) => {
        detune.forEach((d, b) => {
          v += saw(phases[a * 4 + b] + (noteHz(m + d) * i) / SR)
        })
      })
      const env = Math.min(1, i / ms(200)) * Math.min(1, (n - i) / ms(300))
      out[i] = lp.run(v / (notes.length * 4)) * env
    }
    return out
  },
  pluck(r, { midi, len = 700 }) {
    const n = ms(len)
    const out = new Float32Array(n)
    const period = Math.max(2, Math.round(SR / noteHz(midi)))
    const buf = Float32Array.from({ length: period }, () => r() * 2 - 1)
    for (let i = 0; i < n; i++) {
      const k = i % period
      const v = buf[k]
      buf[k] = 0.996 * 0.5 * (v + buf[(k + 1) % period])
      out[i] = v * attack(i, 8) * Math.min(1, (n - i) / ms(30))
    }
    return out
  },
  sub(r, { midi }) {
    const n = ms(420)
    const out = new Float32Array(n)
    const f = noteHz(midi)
    for (let i = 0; i < n; i++) {
      out[i] =
        Math.sin((TAU * f * i) / SR) * Math.exp((-3 * i) / n) * attack(i, 48)
    }
    return out
  },
  stab(r, { notes }) {
    const n = ms(220)
    const out = new Float32Array(n)
    const lp = new Biquad('lp', 2200, 0.9)
    for (let i = 0; i < n; i++) {
      const v =
        notes.reduce((a, m) => a + saw((noteHz(m) * i) / SR), 0) / notes.length
      out[i] = lp.run(v) * Math.exp((-4 * i) / n) * attack(i, 6)
    }
    return out
  },
  tick(r) {
    const n = ms(4)
    return Float32Array.from(
      { length: n },
      (_, i) => (r() * 2 - 1) * (1 - i / n),
    )
  },
  // ---- SFX
  click(r) {
    const n = ms(10)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const noise = i < ms(2) ? (r() * 2 - 1) * (1 - i / ms(2)) : 0
      const tone =
        i < ms(8) ? Math.sin((TAU * 3000 * i) / SR) * (1 - i / ms(8)) : 0
      out[i] = 0.8 * noise + 0.6 * tone
    }
    return out
  },
  snap(r) {
    const n = ms(90)
    const out = new Float32Array(n)
    const bp = new Biquad('bp', 3200, 0.8)
    for (let i = 0; i < n; i++) {
      const thump =
        i < ms(60)
          ? Math.sin((TAU * 90 * i) / SR) * Math.exp((-5 * i) / ms(60))
          : 0
      const slap =
        i < ms(80) ? bp.run(r() * 2 - 1) * Math.exp((-6 * i) / ms(80)) * 2.5 : 0
      out[i] = (thump + slap) * attack(i, 6)
    }
    return out
  },
  rustle(r, { len = 500 } = {}) {
    const n = ms(len)
    const out = new Float32Array(n)
    const bp = new Biquad('bp', 4000, 0.7)
    // 30 grains over the length; the first sits on the cue so the rustle starts on the frame.
    const grains = Array.from({ length: 30 }, (_, k) => ({
      at: k === 0 ? 0 : Math.floor(r() * (n - ms(30))),
      len: ms(8 + r() * 18),
      amp: k === 0 ? 1 : 0.25 + r() * 0.35,
    }))
    const raw = new Float32Array(n)
    for (const g of grains) {
      for (let i = 0; i < g.len && g.at + i < n; i++) {
        raw[g.at + i] +=
          (r() * 2 - 1) *
          g.amp *
          Math.sin((Math.PI * Math.min(i, g.len - 1)) / g.len + 0.3)
      }
    }
    for (let i = 0; i < n; i++) out[i] = bp.run(raw[i]) * 1.6
    return out
  },
  whoosh(r, { frames = 7 } = {}) {
    const n = Math.round(frames * SAMPLES_PER_FRAME)
    const out = new Float32Array(n)
    const bp = new Biquad('bp', 400, 1.1)
    for (let i = 0; i < n; i++) {
      const t = i / n
      if (i % 32 === 0) bp.set(400 * 10 ** t)
      out[i] =
        bp.run(r() * 2 - 1) *
        Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) *
        2 *
        attack(i, 24)
    }
    return out
  },
  thud(r) {
    const n = ms(130)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const body =
        i < ms(120)
          ? Math.sin((TAU * 70 * i) / SR) * Math.exp((-4 * i) / ms(120))
          : 0
      const knock =
        i < ms(30)
          ? Math.sin((TAU * 900 * i) / SR) * Math.exp((-6 * i) / ms(30)) * 0.5
          : 0
      out[i] = (body + knock) * attack(i, 6)
    }
    return out
  },
  key(r) {
    const n = ms(5)
    return Float32Array.from(
      { length: n },
      (_, i) => (r() * 2 - 1) * (1 - i / n) * 0.5,
    )
  },
  shimmer(r) {
    const n = ms(600)
    const out = new Float32Array(n)
    const hp = new Biquad('hp', 5000)
    for (let i = 0; i < n; i++) {
      const tone =
        [2637, 3136, 3951].reduce(
          (a, f) => a + Math.sin((TAU * f * i) / SR),
          0,
        ) / 3
      out[i] =
        (0.4 * hp.run(r() * 2 - 1) + 0.3 * tone) *
        Math.exp((-3 * i) / n) *
        attack(i, 12)
    }
    return out
  },
  riser(r, { frames }) {
    // A 1-beat filtered-noise rise that ends on the next cue (rack focus); onset-free by design.
    const n = Math.round(frames * SAMPLES_PER_FRAME)
    const out = new Float32Array(n)
    const bp = new Biquad('bp', 300, 1.5)
    for (let i = 0; i < n; i++) {
      const t = i / n
      if (i % 32 === 0) bp.set(300 + 3700 * t * t)
      out[i] = bp.run(r() * 2 - 1) * t * t * 1.5
    }
    return out
  },
  air(r) {
    const n = ms(400)
    const out = new Float32Array(n)
    const lp = new Biquad('lp', 1800)
    for (let i = 0; i < n; i++) {
      out[i] =
        (lp.run(r() * 2 - 1) * 1.5 + Math.sin((TAU * 55 * i) / SR) * 0.6) *
        Math.exp((-4 * i) / n) *
        attack(i, 12)
    }
    return out
  },
  tape(r) {
    // Tape-stop blip on Undo: a falling saw.
    const n = ms(180)
    const out = new Float32Array(n)
    let phase = 0
    for (let i = 0; i < n; i++) {
      phase += (440 * (1 - i / n) ** 2 + 40) / SR
      out[i] = saw(phase) * 0.6 * (1 - i / n) * attack(i, 6)
    }
    return out
  },
}

/**
 * Voices with a sharp attack: their onsets are located in the audio and must sit on their scheduled sample. B's 8th
 * ticks (−30 dB, under the pad by design) and the swells (pad, riser, whoosh, air, shimmer) are only grid-checked.
 */
export const PERCUSSIVE = new Set([
  'kick',
  'clap',
  'click',
  'snap',
  'thud',
  'key',
  'stab',
  'rustle',
  'pluck',
])

// ---------------------------------------------------------------- arrangement

const CHORDS = {
  // D major I–V–vi–IV
  a: [
    [62, 66, 69],
    [57, 61, 64],
    [59, 62, 66],
    [55, 59, 62],
  ],
  // Dm–Bb–F–C
  b: [
    [62, 65, 69],
    [58, 62, 65],
    [53, 57, 60],
    [60, 64, 67],
  ],
  // Am–F–C–G
  c: [
    [57, 60, 64],
    [53, 57, 60],
    [60, 64, 67],
    [55, 59, 62],
  ],
}

/** Music events `{ beat, voice, gain, opts }` of one reel (spec §3–§5 «Music»). */
export function musicEvents(reel, table) {
  const { frames, beatFrames } = reelConfig(reel)
  const beats = frames / beatFrames
  const chords = CHORDS[reel]
  const chordAt = (b) => chords[Math.floor(b / 4) % 4]
  const ev = []
  const add = (beat, voice, gain, opts) => ev.push({ beat, voice, gain, opts })
  const beatMs = (beatFrames / 30) * 1000
  const end = table.shots.find((s) => s.scale === 'end')
  const endBeat = end ? end.from / beatFrames : beats
  const breath = table.shots.find((s) => s.breath)
  const breathBeat = breath ? breath.from / beatFrames : beats

  for (let bar = 0; bar * 4 < beats; bar++) {
    const b = bar * 4
    if (b >= endBeat) break
    add(b, 'pad', 0.5, {
      notes: chordAt(b),
      len: Math.min(4, endBeat - b) * beatMs,
    })
  }

  if (reel === 'a') {
    for (let b = 0; b < endBeat; b += 0.5) {
      const notes = chordAt(b)
      add(b, 'pluck', 0.55, { midi: notes[(b * 2) % 3] + 12 })
      if (b >= breathBeat) continue
      if (b % 2 === 0) add(b, 'kick', 0.8)
      if (b % 1 === 0)
        add(b, 'bass', 0.45, { midi: notes[0] - 24, len: beatMs * 0.9 })
    }
    for (let b = 0; b < breathBeat; b += 0.25)
      add(b, 'hat', 0.12, { len: 60, freq: 6000, kind: 'bp' })
    for (let b = 10.5; b < breathBeat; b += 1) add(b, 'hat', 0.3)
  }
  if (reel === 'b') {
    for (let b = 0; b < endBeat; b++) {
      if (b % 2 === 0) add(b, 'sub', 0.9, { midi: chordAt(b)[0] - 24 })
    }
    for (let b = 0; b < endBeat; b += 0.5) add(b, 'tick', 0.03)
  }
  if (reel === 'c') {
    const cuts = new Set(table.shots.map((s) => s.from / beatFrames))
    const breathEnd = breath ? breath.breath.to / beatFrames : breathBeat
    const dropped = (b) => b >= breathBeat && b < Math.ceil(breathEnd)
    for (let b = 0; b < endBeat; b += 0.5) {
      const notes = chordAt(b)
      add(b, 'bass', 0.5, { midi: notes[0] - 24, len: beatMs * 0.45 })
      if (dropped(b)) continue
      if (b % 1 === 0) add(b, 'kick', 0.9)
      if (b % 2 === 1) add(b, 'clap', 0.5)
      if (cuts.has(b)) add(b, 'stab', 0.35, { notes: notes.map((m) => m + 12) })
    }
    for (let b = 0; b < endBeat; b += 0.25)
      if (!dropped(b)) add(b, 'hat', b % 0.5 ? 0.12 : 0.2)
  }

  // End card: kick + chord on its downbeat, then the ring-out.
  if (end) {
    const notes = chordAt(0)
    add(endBeat, 'kick', 0.9)
    add(endBeat, 'pad', 0.6, { notes, len: (beats - endBeat) * beatMs })
    if (reel === 'c')
      add(endBeat, 'stab', 0.45, { notes: notes.map((m) => m + 12) })
    else add(endBeat, 'pluck', 0.6, { midi: notes[0] + 12, len: 1800 })
  }
  return ev
}

/** SFX events from the shot table cues (frame-exact). Risers end on their cue's next beat. */
export function sfxEvents(reel, table) {
  const { beatFrames } = reelConfig(reel)
  return table.cues
    .filter((c) => voices[c.sfx])
    .map((c) => ({
      frame: c.frame,
      voice: c.sfx,
      gain: c.sfx === 'key' ? 0.5 : 1,
      opts:
        c.sfx === 'riser'
          ? { frames: beatFrames }
          : c.sfx === 'rustle' &&
              table.shots.some((s) => s.breath?.from === c.frame)
            ? { len: 1300 }
            : {},
    }))
}

// ---------------------------------------------------------------- render

function mixInto(buf, voice, at, gain, pan = 0) {
  const [l, r] = buf
  const gl = gain * Math.min(1, 1 - pan)
  const gr = gain * Math.min(1, 1 + pan)
  for (let i = 0; i < voice.length && at + i < l.length; i++) {
    l[at + i] += voice[i] * gl
    r[at + i] += voice[i] * gr
  }
}

const peak = ([l, r]) =>
  l.reduce(
    (m, v) => Math.max(m, Math.abs(v)),
    r.reduce((m, v) => Math.max(m, Math.abs(v)), 0),
  )
const scale = ([l, r], k) => {
  for (let i = 0; i < l.length; i++) {
    l[i] *= k
    r[i] *= k
  }
}
const db = (v) => 10 ** (v / 20)

/**
 * Renders a reel: music stem (peak −6 dBFS) + SFX stem (peak −3 dBFS) → tanh soft clip, master gain for RMS −16 dBFS,
 * last 0.4 s faded. Returns `{ left, right, events }` (events with their exact start sample).
 */
export function renderReel(reel, table) {
  const { frames } = reelConfig(reel)
  const n = frames * SAMPLES_PER_FRAME
  const r = rng(reel.charCodeAt(0) * 7919)
  const music = [new Float32Array(n), new Float32Array(n)]
  const sfx = [new Float32Array(n), new Float32Array(n)]
  const events = []
  for (const e of musicEvents(reel, table)) {
    const at = beatSample(reel, e.beat)
    const pan = e.voice === 'hat' ? 0.25 : e.voice === 'pluck' ? -0.15 : 0
    mixInto(music, voices[e.voice](r, e.opts), at, e.gain, pan)
    events.push({ at, voice: e.voice, stem: 'music', beat: e.beat })
  }
  for (const e of sfxEvents(reel, table)) {
    const at = frameSample(e.frame)
    mixInto(sfx, voices[e.voice](r, e.opts), at, e.gain)
    events.push({ at, voice: e.voice, stem: 'sfx', frame: e.frame })
  }
  scale(music, db(-6) / (peak(music) || 1))
  scale(sfx, db(-3) / (peak(sfx) || 1))
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    left[i] = music[0][i] + sfx[0][i]
    right[i] = music[1][i] + sfx[1][i]
  }
  const rmsAt = (g) => {
    let sum = 0
    for (let i = 0; i < n; i++)
      sum += Math.tanh(g * left[i]) ** 2 + Math.tanh(g * right[i]) ** 2
    return Math.sqrt(sum / (2 * n))
  }
  let lo = 0.01
  let hi = 40
  for (let k = 0; k < 40; k++) {
    const mid = Math.sqrt(lo * hi)
    if (rmsAt(mid) < db(-16)) lo = mid
    else hi = mid
  }
  const fade = Math.round(0.4 * SR)
  for (let i = 0; i < n; i++) {
    const f = i >= n - fade ? (n - i) / fade : 1
    left[i] = Math.tanh(lo * left[i]) * f
    right[i] = Math.tanh(lo * right[i]) * f
  }
  return { left, right, events: events.sort((a, b) => a.at - b.at) }
}

// ---------------------------------------------------------------- WAV io

export function wavBytes(left, right, tag = AUDIO_TAG) {
  const n = left.length
  const info = Buffer.from(`${tag}\0${tag.length % 2 ? '' : '\0'}`, 'latin1')
  const list = Buffer.alloc(12 + 8 + info.length)
  list.write('LIST', 0)
  list.writeUInt32LE(4 + 8 + info.length, 4)
  list.write('INFO', 8)
  list.write('ISFT', 12)
  list.writeUInt32LE(info.length, 16)
  info.copy(list, 20)
  const fmt = Buffer.alloc(24)
  fmt.write('fmt ', 0)
  fmt.writeUInt32LE(16, 4)
  fmt.writeUInt16LE(1, 8)
  fmt.writeUInt16LE(2, 10)
  fmt.writeUInt32LE(SR, 12)
  fmt.writeUInt32LE(SR * 4, 16)
  fmt.writeUInt16LE(4, 20)
  fmt.writeUInt16LE(16, 22)
  const data = Buffer.alloc(8 + n * 4)
  data.write('data', 0)
  data.writeUInt32LE(n * 4, 4)
  const q = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)))
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(q(left[i]), 8 + i * 4)
    data.writeInt16LE(q(right[i]), 10 + i * 4)
  }
  const head = Buffer.alloc(12)
  head.write('RIFF', 0)
  head.writeUInt32LE(4 + fmt.length + list.length + data.length, 4)
  head.write('WAVE', 8)
  return Buffer.concat([head, fmt, list, data])
}

/** `{ sampleRate, channels, bits, tag, left, right }` of a PCM WAV. */
export function readWav(bytes) {
  if (
    bytes.toString('latin1', 0, 4) !== 'RIFF' ||
    bytes.toString('latin1', 8, 12) !== 'WAVE'
  ) {
    throw new Error('not a RIFF/WAVE file')
  }
  const out = { tag: null }
  for (let p = 12; p + 8 <= bytes.length;) {
    const id = bytes.toString('latin1', p, p + 4)
    const size = bytes.readUInt32LE(p + 4)
    const body = p + 8
    if (id === 'fmt ') {
      out.channels = bytes.readUInt16LE(body + 2)
      out.sampleRate = bytes.readUInt32LE(body + 4)
      out.bits = bytes.readUInt16LE(body + 14)
    } else if (
      id === 'LIST' &&
      bytes.toString('latin1', body, body + 4) === 'INFO'
    ) {
      for (let q = body + 4; q + 8 <= body + size;) {
        const sub = bytes.toString('latin1', q, q + 4)
        const len = bytes.readUInt32LE(q + 4)
        if (sub === 'ISFT')
          out.tag = bytes
            .toString('latin1', q + 8, q + 8 + len)
            .replace(/\0+$/, '')
        q += 8 + len + (len % 2)
      }
    } else if (id === 'data') {
      const frames = size / (out.channels * 2)
      out.left = new Float32Array(frames)
      out.right = new Float32Array(frames)
      for (let i = 0; i < frames; i++) {
        out.left[i] = bytes.readInt16LE(body + i * out.channels * 2) / 32768
        out.right[i] =
          bytes.readInt16LE(
            body + i * out.channels * 2 + (out.channels - 1) * 2,
          ) / 32768
      }
    }
    p = body + size + (size % 2)
  }
  return out
}

// ---------------------------------------------------------------- onset check

const BLOCK = 48 // 1 ms

/**
 * Locates each percussive event's onset in the audio: the 1 ms block with the largest rise of pre-emphasised energy
 * between one frame before the event and the next event (or one frame after). Returns the offsets in frames.
 */
export function onsetOffsets(wav, events) {
  const n = wav.left.length
  const blocks = Math.floor(n / BLOCK)
  const energy = new Float32Array(blocks)
  let prev = 0
  for (let b = 0; b < blocks; b++) {
    let e = 0
    for (let i = b * BLOCK; i < (b + 1) * BLOCK; i++) {
      const x = (wav.left[i] + wav.right[i]) / 2
      const y = x - 0.97 * prev
      prev = x
      e += y * y
    }
    energy[b] = e
  }
  const starts = [...new Set(events.map((e) => e.at))].sort((a, b) => a - b)
  const result = []
  for (const e of events.filter((ev) => PERCUSSIVE.has(ev.voice))) {
    const next = starts.find((s) => s > e.at) ?? n
    const prevStart = starts.findLast((s) => s < e.at) ?? -Infinity
    // From one frame before (never into the previous event's own attack) up to the next event.
    const lo = Math.max(
      1,
      Math.ceil(Math.max(prevStart + BLOCK, e.at - SAMPLES_PER_FRAME) / BLOCK),
    )
    const hi = Math.min(
      blocks,
      Math.floor(Math.min(next, e.at + SAMPLES_PER_FRAME) / BLOCK),
    )
    let best = lo
    let bestRise = -Infinity
    for (let b = lo; b < hi; b++) {
      const rise = energy[b] - energy[b - 1]
      if (rise > bestRise) {
        bestRise = rise
        best = b
      }
    }
    const found = best * BLOCK
    result.push({
      ...e,
      found,
      offsetFrames: (found - e.at) / SAMPLES_PER_FRAME,
    })
  }
  return result
}

/** Full audio check of one WAV against its schedule; `{ ok, lines }`. */
export function checkAudio(reel, table, bytes, events) {
  const lines = []
  let ok = true
  const wav = readWav(bytes)
  const fail = (msg) => {
    ok = false
    lines.push(`FAIL ${msg}`)
  }
  if (wav.sampleRate !== SR || wav.channels !== 2 || wav.bits !== 16)
    fail('WAV is not 48 kHz 16-bit stereo')
  if (wav.tag !== AUDIO_TAG)
    fail(`WAV tag "${wav.tag}" is not "${AUDIO_TAG}" (generated audio only)`)
  const { beatFrames } = reelConfig(reel)
  const sub = (beatFrames * SAMPLES_PER_FRAME) / 4
  const offGrid = events.filter((e) =>
    e.stem === 'music' ? e.at % sub !== 0 : e.at % SAMPLES_PER_FRAME !== 0,
  )
  if (offGrid.length) fail(`${offGrid.length} events off the 16th / frame grid`)
  const badCues = table.cues.filter((c) => !isCueOnGrid(reel, c))
  if (badCues.length)
    fail(
      `cues off the beat grid: ${badCues.map((c) => `${c.sfx}@${c.frame}`).join(', ')}`,
    )
  const offsets = onsetOffsets(wav, events)
  const worst = offsets.reduce(
    (m, o) => (Math.abs(o.offsetFrames) > Math.abs(m.offsetFrames) ? o : m),
    { offsetFrames: 0 },
  )
  const maxFrames = Math.abs(worst.offsetFrames)
  lines.push(
    `onsets ${offsets.length}, max offset in frames: ${Math.round(maxFrames)} (${((maxFrames * 1000) / 30).toFixed(1)} ms${worst.voice ? `, ${worst.voice} @ frame ${(worst.at / SAMPLES_PER_FRAME).toFixed(2)}` : ''})`,
  )
  if (Math.round(maxFrames) !== 0) fail('an onset is off its frame')
  let sum = 0
  let first = 0
  for (let i = 0; i < wav.left.length; i++)
    sum += wav.left[i] ** 2 + wav.right[i] ** 2
  for (let i = 0; i < SAMPLES_PER_FRAME; i++)
    first = Math.max(first, Math.abs(wav.left[i]))
  const rms = 20 * Math.log10(Math.sqrt(sum / (2 * wav.left.length)))
  lines.push(`RMS ${rms.toFixed(1)} dBFS, frame 0 peak ${first.toFixed(3)}`)
  if (Math.abs(rms + 16) > 1) fail('RMS outside −16 ± 1 dBFS')
  if (first < 0.01) fail('silence at frame 0')
  return { ok, lines, maxFrames }
}

/** Writes `<out>/<reel>.wav` and checks it; returns `{ ok, file, lines }`. */
export async function buildAudio(reel, out, table) {
  const t = table ?? (await loadTable(reel))
  const { left, right, events } = renderReel(reel, t)
  const bytes = wavBytes(left, right)
  mkdirSync(out, { recursive: true })
  const file = join(out, `${reel}.wav`)
  writeFileSync(file, bytes)
  const check = checkAudio(reel, t, readFileSync(file), events)
  return { ...check, file }
}

async function main() {
  const args = process.argv.slice(2)
  const arg = (name) => {
    const k = args.indexOf(name)
    return k >= 0 ? args[k + 1] : undefined
  }
  const reels = arg('--reel') ? [arg('--reel')] : REEL_IDS
  const out = resolve(
    arg('--out') ?? join(motion, '..', 'out', 'reels', 'audio'),
  )
  let ok = true
  for (const reel of reels) {
    reelConfig(reel)
    const res = await buildAudio(reel, out)
    console.log(`reel ${reel}: ${res.file}`)
    for (const line of res.lines) console.log(`  ${line}`)
    ok &&= res.ok
  }
  process.exit(ok ? 0 : 1)
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main()
}

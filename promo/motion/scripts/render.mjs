// Renders the promo: promo/out/video/promo-<format>.mp4 + promo-<format>-sheet.png, then checks them.
// Usage: pnpm -C promo/motion render [16x9|9x16] [--sheet-only | --strips | --prepare-only]
// Inputs (run `node promo/capture.mjs` first): promo/out/clips/<format>/*.webm, promo/out/stills/<format>/08-end-cover.png,
// promo/out/clips.json; uikit/dist/photos/p01–p21.jpg (pnpm uikit:build); uikit/src/fonts; optional promo/out/music/track.mp3.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import {
  getVideoMetadata,
  renderMedia,
  renderStill,
  selectComposition,
} from '@remotion/renderer'

const here = dirname(fileURLToPath(import.meta.url))
const motion = resolve(here, '..')
const repo = resolve(motion, '../..')
const out = join(repo, 'promo/out')
const pub = join(out, 'motion-public')
const videoDir = join(out, 'video')

const args = process.argv.slice(2)
const prepareOnly = args.includes('--prepare-only')
const sheetOnly = args.includes('--sheet-only') // contact sheets + text checks only (fast tuning)
const formats = ['16x9', '9x16'].filter(
  (f) => !args.some((a) => /^\d+x\d+$/.test(a)) || args.includes(f),
)

const SIZE = { '16x9': [1920, 1080], '9x16': [1080, 1920] }
const SAFE = { top: 220, bottom: 400, right: 120 } // 9:16 platform UI (spec «Layout values»)
const CLIPS = {
  '16x9': [
    '02-add-folder',
    '03-drop-in-frame',
    '04-fill-book',
    '05-cover-title',
    '06-site-shelf',
    '07-book-turn',
  ],
  '9x16': [
    '02-add-folder',
    '03-drop-in-frame',
    '04-fill-book',
    '05-cover-title',
    '06-site-shelf',
    '07-book-swipe',
  ],
}
const FONTS = [
  'inter-latin-wght-normal.woff2',
  'lora-latin-wght-normal.woff2',
  'lora-latin-wght-italic.woff2',
]
const PHOTOS = Array.from(
  { length: 21 },
  (_, k) => `p${String(k + 1).padStart(2, '0')}.jpg`,
)

const fail = (message) => {
  console.error(`render: ${message}`)
  process.exit(1)
}

// 1. Stage every input into one public dir (Remotion serves staticFile() from it).
const copy = (from, to) => {
  if (!existsSync(from))
    fail(
      `missing ${from.replace(`${repo}/`, '')} (run: pnpm uikit:build && node promo/capture.mjs)`,
    )
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
}
rmSync(pub, { recursive: true, force: true })
for (const format of formats) {
  for (const clip of CLIPS[format])
    copy(
      join(out, 'clips', format, `${clip}.webm`),
      join(pub, 'clips', format, `${clip}.webm`),
    )
  copy(
    join(out, 'stills', format, '08-end-cover.png'),
    join(pub, 'stills', format, '08-end-cover.png'),
  )
}
for (const photo of PHOTOS)
  copy(join(repo, 'uikit/dist/photos', photo), join(pub, 'photos', photo))
for (const font of FONTS)
  copy(join(repo, 'uikit/src/fonts', font), join(pub, 'fonts', font))
const music = existsSync(join(out, 'music/track.mp3'))
if (music) copy(join(out, 'music/track.mp3'), join(pub, 'music/track.mp3'))

// Clip lengths, read back by the capture: { "16x9": { "02-add-folder": 4.5, … } }. Only used to keep a cut inside
// its clip, so a capture still running (no clips.json yet) can be previewed.
const clipsJson = join(out, 'clips.json')
if (!existsSync(clipsJson))
  console.warn('render: no promo/out/clips.json yet; cuts are not clamped')
const clips = {}
const listed = existsSync(clipsJson)
  ? JSON.parse(readFileSync(clipsJson, 'utf8'))
  : []
for (const c of listed) {
  const name = c.file
    .split('/')
    .pop()
    .replace(/\.webm$/, '')
  clips[c.format] = { ...clips[c.format], [name]: c.duration }
}
const inputProps = { clips, music }
console.log(
  `render: inputs staged in promo/out/motion-public (music: ${music ? 'track.mp3' : 'none, silent'})`,
)
if (prepareOnly) process.exit(0)

// 2. Bundle once, render each format and its contact sheet.
const serveUrl = await bundle({
  entryPoint: join(motion, 'src/index.jsx'),
  publicDir: pub,
})
mkdirSync(videoDir, { recursive: true })
if (args.includes('--strips')) {
  // Cutting aid: every clip as a frame grid (0.25 s steps) → promo/out/video/strips/<format>-<clip>.png.
  for (const format of formats) {
    for (const clip of CLIPS[format]) {
      const props = { ...inputProps, clip }
      const output = join(videoDir, 'strips', `${format}-${clip}.png`)
      const composition = await selectComposition({
        serveUrl,
        id: `Strip${format}`,
        inputProps: props,
      })
      await renderStill({ composition, serveUrl, output, inputProps: props })
      console.log(`render: strips/${format}-${clip}.png`)
    }
  }
  process.exit(0)
}
const boxes = []
let problems = 0
for (const format of formats) {
  const sheet = await selectComposition({
    serveUrl,
    id: `Sheet${format}`,
    inputProps,
  })
  await renderStill({
    composition: sheet,
    serveUrl,
    output: join(videoDir, `promo-${format}-sheet.png`),
    inputProps,
    onBrowserLog: ({ text }) => {
      if (text.startsWith('TEXT_BOX '))
        boxes.push(JSON.parse(text.slice('TEXT_BOX '.length)))
    },
  })
  console.log(`render: promo-${format}-sheet.png`)
  if (sheetOnly) continue

  const id = `Promo${format}`
  const output = join(videoDir, `promo-${format}.mp4`)
  const composition = await selectComposition({ serveUrl, id, inputProps })
  let last = -1
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    pixelFormat: 'yuv420p',
    crf: 18,
    outputLocation: output,
    inputProps,
    onProgress: ({ progress }) => {
      const step = Math.floor(progress * 10)
      if (step !== last) console.log(`render: ${id} ${step * 10} %`)
      last = step
    },
  })

  // 3. Checks: size, frame rate, length; no text in the 9:16 safe-zone margins.
  const meta = await getVideoMetadata(output)
  const [w, h] = SIZE[format]
  const line = `${meta.width}×${meta.height}, ${meta.fps} fps, ${meta.durationInSeconds.toFixed(3)} s, ${meta.codec}`
  console.log(`probe: promo-${format}.mp4 ${line}`)
  if (
    meta.width !== w ||
    meta.height !== h ||
    meta.fps !== 30 ||
    meta.durationInSeconds < 14.5 ||
    meta.durationInSeconds > 15.5
  ) {
    console.error(
      `probe: promo-${format}.mp4 expected ${w}×${h}, 30 fps, 14.5–15.5 s`,
    )
    problems++
  }
}
for (const b of boxes) {
  const [w, h] = SIZE[b.format]
  const safe = b.format === '9x16' ? SAFE : { top: 0, bottom: 0, right: 0 }
  b.inSafeArea =
    b.left >= 0 &&
    b.top >= safe.top &&
    b.right <= w - safe.right &&
    b.bottom <= h - safe.bottom
  console.log(
    `text: ${b.format} scene ${b.scene} ${b.role} ${b.left},${b.top} → ${b.right},${b.bottom}${b.inSafeArea ? '' : '  OUTSIDE'}`,
  )
  if (!b.inSafeArea && b.format === '9x16') problems++
}
writeFileSync(
  join(videoDir, 'text-boxes.json'),
  `${JSON.stringify(boxes, null, 2)}\n`,
)
if (problems) fail(`${problems} check(s) failed`)
console.log('render: done → promo/out/video/')

// The 15 s promo (Designer spec promo-video/spec.md, «Script» + «Layout values»), both formats from one scene table.
// Product pictures are the clips promo/capture.mjs films; this file only places, trims and titles them.
import React, { useEffect, useRef } from 'react'
import {
  AbsoluteFill,
  Audio,
  Easing,
  Freeze,
  Img,
  OffthreadVideo,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import { loadFont } from '@remotion/fonts'

export const FPS = 30
const BEAT = FPS / 2 // 120 BPM: cuts on 0.5 s beats
const HANDLE = 0.5 // capture adds 0.5 s of still picture at each clip end

export const FORMATS = {
  '16x9': { width: 1920, height: 1080 },
  '9x16': { width: 1080, height: 1920 },
}

// Reels / Shorts / TikTok UI (spec «Layout values»): no text in these margins of the 9:16 frame.
export const SAFE_9x16 = { top: 220, bottom: 400, right: 120 }

const INK = '#1A1918'
const PAPER = 'linear-gradient(180deg, #F5F2EC 0%, #ECE8E1 55%, #E1DCD3 100%)'
const SERIF = 'Lora, Georgia, serif'
const SANS = 'Inter, system-ui, sans-serif'
const SHADOW = [
  '0 40px 80px -24px rgb(20 20 19 / 0.28)',
  '0 8px 20px -8px rgb(20 20 19 / 0.14)',
  '0 0 0 1px rgb(0 0 0 / 0.06)',
].join(', ')

const fonts = Promise.all([
  loadFont({
    family: 'Inter',
    url: staticFile('fonts/inter-latin-wght-normal.woff2'),
    weight: '100 900',
  }),
  loadFont({
    family: 'Lora',
    url: staticFile('fonts/lora-latin-wght-normal.woff2'),
    weight: '400 700',
  }),
  loadFont({
    family: 'Lora',
    url: staticFile('fonts/lora-latin-wght-italic.woff2'),
    weight: '400 700',
    style: 'italic',
  }),
])

// A caption line is a list of runs; `i` = italic (the spec's second, italic line).
const r = (t) => [{ t }]
const it = (t) => [{ t, i: true }]

// Spec «Script»: start and length in frames (30 fps), English captions word for word (Owner 2026-11-26 20:08).
// `clip` is the capture file stem; `cuts` (optional, per format) = [scene frame, clip second, playback rate].
export const SCENES = [
  {
    n: 1,
    from: 0,
    frames: 60,
    kind: 'hook',
    lines: [r('Thousands of photos.'), it('Not a single book.')],
  },
  {
    n: 2,
    from: 60,
    frames: 60,
    kind: 'window',
    clip: '02-add-folder',
    anchor: 'bottom',
    lines: [r('Add a folder —'), it('every shot at hand.')],
  },
  {
    n: 3,
    from: 120,
    frames: 75,
    kind: 'window',
    clip: '03-drop-in-frame',
    zoom: 1.04,
    lines: [r('Drag a photo in —'), it('the spread is done.')],
  },
  {
    n: 4,
    from: 195,
    frames: 60,
    kind: 'window',
    clip: '04-fill-book',
    lines: [r('The whole book —'), it('in one click.')],
  },
  {
    n: 5,
    from: 255,
    frames: 60,
    kind: 'window',
    clip: '05-cover-title',
    lines: [r('Your cover,'), it('your title.')],
  },
  {
    n: 6,
    from: 315,
    frames: 45,
    kind: 'site',
    clip: '06-site-shelf',
    lines: [r('Print to PDF —'), it('or your own site with a shelf.')],
    // Same words, one more break: at 80 px the second line would run into the 9:16 right margin.
    lines9x16: [
      r('Print to PDF —'),
      it('or your own site'),
      it('with a shelf.'),
    ],
  },
  {
    n: 7,
    from: 360,
    frames: 45,
    kind: 'site',
    clip: { '16x9': '07-book-turn', '9x16': '07-book-swipe' },
    lines: [[{ t: 'Like a ' }, { t: 'real book.', i: true }]],
  },
  { n: 8, from: 405, frames: 45, kind: 'end' },
]
export const TOTAL_FRAMES = 450

// Clip timing per format: [scene frame, clip second, playback rate]. Seconds count from the clip start (the
// 0.5 s handle included), picked from the capture contact sheet so each scene shows its action.
// Scene 4 (one cut per beat): popover opens, Enter, the first filled spread, a later one.
// Scene 7 skips the flat title page (it prints the sample author name): opening, then straight to the turn / swipe.
const EDITOR_CUTS = {
  '02-add-folder': [[0, 1.0, 1.35]], // picker opens at 1.25 s, the filmstrip fills at 2.5 s
  '03-drop-in-frame': [[0, 0.5, 1.15]],
  '04-fill-book': [
    [0, 0.9, 1],
    [BEAT, 1.5, 1],
    [BEAT * 2, 2.05, 1],
    [BEAT * 3, 3.55, 1],
  ],
  '05-cover-title': [[0, 0.7, 1.5]],
  '06-site-shelf': [[0, 0.5, 1.4]],
}
const CUTS = {
  '16x9': {
    ...EDITOR_CUTS,
    '07-book-turn': [
      [0, 0.7, 1], // closed → starts to open (ends before the title page shows)
      [BEAT, 3.2, 0.7], // the turn already past the title page, slowed a little
    ],
  },
  '9x16': {
    ...EDITOR_CUTS,
    '07-book-swipe': [
      [0, 0.45, 1.2],
      [18, 2.0, 1],
    ],
  },
}

// The book's title page prints the kit's sample author name under the title. While that page lies flat in a clip
// (clip seconds `from`–`to`), the line is blurred out. Box in fractions of the clip frame.
const MASKS = {
  '16x9': {}, // 07-book-turn's cuts never show the flat title page
  '9x16': {
    '07-book-swipe': [
      { from: 2.5, to: 9, x0: 0.19, y0: 0.481, x1: 0.69, y1: 0.515 },
    ],
  },
}

const Masks = ({ masks, start, rate }) => {
  const t = start + (useCurrentFrame() / FPS) * rate
  return masks
    .filter((m) => t >= m.from && t <= m.to)
    .map((m, k) => (
      <div
        key={k}
        style={{
          position: 'absolute',
          left: `${m.x0 * 100}%`,
          top: `${m.y0 * 100}%`,
          width: `${(m.x1 - m.x0) * 100}%`,
          height: `${(m.y1 - m.y0) * 100}%`,
          backdropFilter: 'blur(14px)',
          background: 'rgb(253 253 252 / 0.75)', // the page's white, so the blur leaves no grey bar
          maskImage:
            'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)',
        }}
      />
    ))
}

const clipOf = (scene, format) =>
  typeof scene.clip === 'string' ? scene.clip : scene.clip?.[format]

const ease = Easing.bezier(0.22, 1, 0.36, 1)
const rise = (frame, start, frames, distance) => ({
  opacity: interpolate(frame, [start, start + frames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }),
  transform: `translateY(${interpolate(
    frame,
    [start, start + frames],
    [distance, 0],
    {
      easing: ease,
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  )}px)`,
})

// Lines fade up one by one: opacity + 8 px over 400 ms (spec scene 1; the same entrance for every title).
const Title = ({ lines, style, size, lineHeight = 1.08, stagger = 6 }) => {
  const frame = useCurrentFrame()
  return (
    <div
      data-text="title"
      style={{ position: 'absolute', width: 'max-content', ...style }}
    >
      {lines.map((runs, k) => (
        <div
          key={k}
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: size,
            lineHeight,
            letterSpacing: '-0.01em',
            color: INK,
            whiteSpace: 'nowrap',
            ...rise(frame, 2 + k * stagger, 12, 8),
          }}
        >
          {runs.map((run, j) => (
            <span key={j} style={{ fontStyle: run.i ? 'italic' : 'normal' }}>
              {run.t}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

// One clip, cut on beats: each cut starts at its scene frame and plays until the next one.
const Clip = ({ name, format, frames, clips, style, anchor = 'top' }) => {
  const cuts = CUTS[format][name]
  const length = clips?.[format]?.[name]
  return (
    <AbsoluteFill style={style}>
      {cuts.map(([at, second, rate], k) => {
        const until = k + 1 < cuts.length ? cuts[k + 1][0] : frames
        const start = Math.min(
          second,
          Math.max(
            0,
            (length ?? Infinity) - HANDLE - ((until - at) / FPS) * rate,
          ),
        )
        return (
          <Sequence
            key={k}
            from={at}
            durationInFrames={until - at}
            layout="none"
          >
            <OffthreadVideo
              src={staticFile(`clips/${format}/${name}.webm`)}
              trimBefore={Math.round(start * FPS)}
              playbackRate={rate}
              muted
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: `50% ${anchor === 'bottom' ? 100 : 0}%`,
              }}
            />
            <Masks
              masks={MASKS[format][name] ?? []}
              start={start}
              rate={rate}
            />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

const LAYOUT = {
  '16x9': {
    title: { left: 120, top: 110 },
    size: 84,
    // Spec 1360×750 (to the frame's right and bottom edges): the 1.6 clip is cropped by 100 px, at the bottom, or at
    // the top for scenes with `anchor: 'bottom'` (scene 2: the filmstrip fills at the bottom of the editor).
    window: { left: 560, top: 330, width: 1360, height: 750 },
  },
  '9x16': {
    title: { left: 80, top: 240 },
    size: 80,
    window: { left: 60, top: 640, width: 900, height: 860 }, // the 9:16 capture window, 2× its placed size
    phone: { left: 190, top: 560, width: 700, height: 1000, radius: 56 },
  },
}

const Paper = ({ children }) => (
  <AbsoluteFill style={{ background: PAPER }}>{children}</AbsoluteFill>
)

const WindowScene = ({ scene, format, clips }) => {
  const frame = useCurrentFrame()
  const L = LAYOUT[format]
  const w = L.window
  const lift = interpolate(frame, [0, 14], [40, 0], {
    easing: ease,
    extrapolateRight: 'clamp',
  })
  const zoom = interpolate(frame, [0, scene.frames], [1, scene.zoom ?? 1], {
    extrapolateRight: 'clamp',
  })
  return (
    <Paper>
      <div
        style={{
          position: 'absolute',
          ...w,
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: SHADOW,
          background: '#fff',
          transform: `translateY(${lift}px)`,
          opacity: interpolate(frame, [0, 6], [0, 1], {
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <Clip
          name={clipOf(scene, format)}
          format={format}
          frames={scene.frames}
          clips={clips}
          anchor={scene.anchor}
          style={{ transform: `scale(${zoom})`, transformOrigin: '60% 55%' }}
        />
      </div>
      <Title lines={scene.lines} size={L.size} style={L.title} />
    </Paper>
  )
}

// 16:9: full-bleed 1440×900 site shot (1920×1200), the site header with the sample owner's name pushed off the top.
// 9:16: the 390-wide phone screen as a card; the card crops the phone header the same way.
const SiteScene = ({ scene, format, clips }) => {
  const frame = useCurrentFrame()
  const L = LAYOUT[format]
  const name = clipOf(scene, format)
  if (format === '16x9') {
    const glide =
      scene.n === 6 ? interpolate(frame, [0, scene.frames], [0, -40]) : 0
    const titleAtTop = scene.n === 7
    return (
      <Paper>
        <div
          style={{
            position: 'absolute',
            left: -20,
            top: -120,
            width: 1960,
            height: 1225,
          }}
        >
          <Clip
            name={name}
            format={format}
            frames={scene.frames}
            clips={clips}
            style={{ transform: `translateX(${glide}px)` }}
          />
        </div>
        {titleAtTop ? (
          <>
            <AbsoluteFill
              style={{
                height: 260,
                background:
                  'linear-gradient(180deg, #F5F2EC 0%, #F5F2EC 62%, rgb(245 242 236 / 0) 100%)',
              }}
            />
            <Title
              lines={scene.lines}
              size={72}
              style={{
                left: '50%',
                top: 64,
                transform: 'translateX(-50%)',
                textAlign: 'center',
              }}
            />
          </>
        ) : (
          <>
            <AbsoluteFill
              style={{
                top: 'auto',
                height: 380,
                background:
                  'linear-gradient(0deg, #ECE8E1 0%, #ECE8E1 55%, rgb(236 232 225 / 0) 100%)',
              }}
            />
            <Title
              lines={scene.lines}
              size={72}
              style={{ left: 120, bottom: 80 }}
            />
          </>
        )}
      </Paper>
    )
  }
  const p = L.phone
  const lift = interpolate(frame, [0, 14], [40, 0], {
    easing: ease,
    extrapolateRight: 'clamp',
  })
  return (
    <Paper>
      <div
        style={{
          position: 'absolute',
          left: p.left,
          top: p.top,
          width: p.width,
          height: p.height,
          borderRadius: p.radius,
          overflow: 'hidden',
          boxShadow: SHADOW,
          background: '#fff',
          transform: `translateY(${lift}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            // the 390×557 phone screen scaled so its top PHONE_HEADER_CROP px sit above the card, centred
            left: (p.width - PHONE_SCREEN.width) / 2,
            top: -PHONE_HEADER_CROP,
            ...PHONE_SCREEN,
          }}
        >
          <Clip
            name={name}
            format={format}
            frames={scene.frames}
            clips={clips}
          />
        </div>
      </div>
      <Title
        lines={scene.lines}
        size={L.size}
        style={{ ...L.title, top: 220 + 20 }}
      />
    </Paper>
  )
}
// Phone screen pixels hidden above the card (the phone site header with the sample owner's name).
const PHONE_HEADER_CROP = 100
const PHONE_SCREEN = { width: Math.round((1100 * 780) / 1114), height: 1100 } // clip aspect, 1000 + crop tall

// Scene 1: a camera roll of the CC0 sample photos p01–p21, tilted −4°, drifting up 60 px/s, push-in 1.00→1.06.
const PHOTOS = Array.from(
  { length: 21 },
  (_, k) => `photos/p${String(k + 1).padStart(2, '0')}.jpg`,
)

const HookScene = ({ scene, format }) => {
  const frame = useCurrentFrame()
  const wide = format === '16x9'
  const cols = wide ? 7 : 5
  const tile = wide ? 300 : 260
  const gap = 10
  const rows = wide ? 6 : 9
  const drift = (-60 * frame) / FPS
  const push = interpolate(frame, [0, scene.frames], [1, 1.06])
  const cells = Array.from(
    { length: cols * rows },
    (_, k) => PHOTOS[(k * 5 + Math.floor(k / cols) * 3) % PHOTOS.length],
  )
  const gridW = cols * tile + (cols - 1) * gap
  const gridH = rows * tile + (rows - 1) * gap
  const anchor = wide ? { left: 1560, top: 560 } : { left: 540, top: 1260 }
  return (
    <Paper>
      <div
        style={{
          position: 'absolute',
          left: anchor.left - gridW / 2,
          top: anchor.top - gridH / 2,
          width: gridW,
          height: gridH,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${tile}px)`,
          gap,
          transform: `scale(${push}) rotate(-4deg) translateY(${drift}px)`,
        }}
      >
        {cells.map((src, k) => (
          <Img
            key={k}
            src={staticFile(src)}
            style={{
              width: tile,
              height: tile,
              objectFit: 'cover',
              borderRadius: 6,
              display: 'block',
            }}
          />
        ))}
      </div>
      <AbsoluteFill
        style={{
          background: wide
            ? 'linear-gradient(90deg, #F5F2EC 0%, #F5F2EC 55%, rgb(245 242 236 / 0.8) 61%, rgb(245 242 236 / 0) 72%)'
            : 'linear-gradient(180deg, #F5F2EC 0%, #F5F2EC 26%, rgb(245 242 236 / 0.85) 31%, rgb(245 242 236 / 0) 40%)',
        }}
      />
      <Title
        lines={scene.lines}
        // spec hook 92; in 9:16 "Thousands of photos." is 899 px wide at 92, past the 880 px between the left
        // title edge and the right safe margin, so 88 there
        size={wide ? 92 : 88}
        stagger={12}
        style={wide ? { left: 120, top: 430 } : LAYOUT['9x16'].title}
      />
    </Paper>
  )
}

// Scene 8: the "Lake trip 2026" cover settles, wordmark and CTA fade in, hold 1 s.
const EndScene = ({ scene, format }) => {
  const frame = useCurrentFrame()
  const wide = format === '16x9'
  const settle = interpolate(frame, [0, 18], [0, 1], {
    easing: ease,
    extrapolateRight: 'clamp',
  })
  const text = (start) => rise(frame, start, 9, 8)
  const cover = wide
    ? { left: 170, top: 150, height: 780 }
    : { left: 80, top: 250, height: 600 }
  const column = wide ? { left: 1000, top: 250 } : { left: 80, top: 920 }
  return (
    <Paper>
      <Img
        src={staticFile(`stills/${format}/08-end-cover.png`)}
        style={{
          position: 'absolute',
          ...cover,
          borderRadius: 6,
          boxShadow: SHADOW,
          opacity: interpolate(frame, [0, 4], [0.6, 1], {
            extrapolateRight: 'clamp',
          }),
          transform: `translateY(${(1 - settle) * 30}px) scale(${1.05 - 0.05 * settle})`,
          transformOrigin: '50% 100%',
        }}
      />
      <div style={{ position: 'absolute', ...column, width: 'max-content' }}>
        <div
          data-text="wordmark"
          style={{
            fontFamily: SERIF,
            fontSize: 120,
            lineHeight: 1.08,
            letterSpacing: '-0.01em',
            color: INK,
            ...text(2),
          }}
        >
          Photobooks
        </div>
        <div
          data-text="tagline"
          style={{
            fontFamily: SERIF,
            fontSize: wide ? 56 : 52,
            lineHeight: 1.12,
            color: INK,
            marginTop: wide ? 28 : 20,
            ...text(5),
          }}
        >
          <div>A quiet place</div>
          <div style={{ fontStyle: 'italic' }}>for your books.</div>
        </div>
        <div
          data-text="cta"
          style={{
            display: 'inline-block',
            marginTop: wide ? 56 : 44,
            padding: '28px 44px',
            borderRadius: 999,
            background: '#232223',
            color: '#F2F2F2',
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: 40,
            lineHeight: 1,
            ...text(8),
          }}
        >
          Make your first book →
        </div>
        <div
          data-text="footer"
          style={{
            fontFamily: SANS,
            fontSize: 30,
            color: '#535152',
            marginTop: 28,
            ...text(11),
          }}
        >
          photobooks · link in bio
        </div>
      </div>
    </Paper>
  )
}

const SceneView = ({ scene: base, format, clips }) => {
  const scene =
    format === '9x16' && base.lines9x16
      ? { ...base, lines: base.lines9x16 }
      : base
  if (scene.kind === 'hook') return <HookScene scene={scene} format={format} />
  if (scene.kind === 'window')
    return <WindowScene scene={scene} format={format} clips={clips} />
  if (scene.kind === 'site')
    return <SiteScene scene={scene} format={format} clips={clips} />
  return <EndScene scene={scene} format={format} />
}

export const Promo = ({ format, clips, music }) => (
  <AbsoluteFill style={{ background: '#ECE8E1' }}>
    {SCENES.map((scene) => (
      <Sequence
        key={scene.n}
        from={scene.from}
        durationInFrames={scene.frames}
        name={`${scene.n}`}
      >
        <SceneView scene={scene} format={format} clips={clips} />
      </Sequence>
    ))}
    {music ? (
      <Audio
        src={staticFile('music/track.mp3')}
        volume={(f) =>
          interpolate(
            f,
            [0, 6, TOTAL_FRAMES - 30, TOTAL_FRAMES],
            [0, 1, 1, 0],
            { extrapolateRight: 'clamp' },
          )
        }
      />
    ) : null}
  </AbsoluteFill>
)

// Contact sheet: one frame per scene (75 % into it: titles settled, action shown), 4 × 2, with the scene number.
export const SHEET_CELL = {
  '16x9': { w: 480, h: 270 },
  '9x16': { w: 270, h: 480 },
}
const SHEET_GAP = 16
const SHEET_LABEL = 36
export const sheetFrame = (scene) =>
  scene.from + Math.floor(scene.frames * 0.75)
export const sheetSize = (format) => {
  const c = SHEET_CELL[format]
  return {
    width: 4 * c.w + 5 * SHEET_GAP,
    height: 2 * (c.h + SHEET_LABEL) + 3 * SHEET_GAP,
  }
}

// Logs every text box of one scene frame in composition pixels: `TEXT_BOX {"scene":2,"role":"title",...}`.
const Measured = ({ scene, format, clips, scale }) => {
  const ref = useRef(null)
  useEffect(() => {
    const handle = delayRender(`measure scene ${scene.n}`)
    fonts
      .then(() => document.fonts.ready)
      .then(() => {
        const root = ref.current.getBoundingClientRect()
        for (const el of ref.current.querySelectorAll('[data-text]')) {
          const b = el.getBoundingClientRect()
          const box = {
            left: Math.round((b.left - root.left) / scale),
            top: Math.round((b.top - root.top) / scale),
            right: Math.round((b.right - root.left) / scale),
            bottom: Math.round((b.bottom - root.top) / scale),
          }
          console.log(
            `TEXT_BOX ${JSON.stringify({ format, scene: scene.n, role: el.dataset.text, ...box })}`,
          )
        }
        continueRender(handle)
      })
  }, [scene, format, scale])
  const f = FORMATS[format]
  return (
    <div
      ref={ref}
      style={{
        width: f.width,
        height: f.height,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
      }}
    >
      <Freeze frame={sheetFrame(scene)}>
        <Promo format={format} clips={clips} music={false} />
      </Freeze>
    </div>
  )
}

export const Sheet = ({ format, clips }) => {
  const c = SHEET_CELL[format]
  const scale = c.w / FORMATS[format].width
  return (
    <AbsoluteFill style={{ background: '#2A2928' }}>
      {SCENES.map((scene, k) => (
        <div
          key={scene.n}
          style={{
            position: 'absolute',
            left: SHEET_GAP + (k % 4) * (c.w + SHEET_GAP),
            top:
              SHEET_GAP + Math.floor(k / 4) * (c.h + SHEET_LABEL + SHEET_GAP),
          }}
        >
          <div
            style={{
              width: c.w,
              height: c.h,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Measured
              scene={scene}
              format={format}
              clips={clips}
              scale={scale}
            />
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 20,
              color: '#E8E6E3',
              height: SHEET_LABEL,
              paddingTop: 8,
            }}
          >
            {scene.n} · {(sheetFrame(scene) / FPS).toFixed(2)} s
          </div>
        </div>
      ))}
    </AbsoluteFill>
  )
}

// Cutting aid (`render --strips`): one clip as a grid of frames every 0.25 s, labelled with the clip second, to pick
// the CUTS values. 8 columns × 4 rows covers 8 s.
export const STRIP = { cols: 8, rows: 4, w: 320, label: 28, step: 0.25 }
export const stripSize = (format) => {
  const h = Math.round(STRIP.w / (format === '16x9' ? 1.6 : 0.7))
  return {
    width: STRIP.cols * STRIP.w,
    height: STRIP.rows * (h + STRIP.label),
    cellH: h,
  }
}
export const Strip = ({ format, clip, clips }) => {
  const { cellH } = stripSize(format)
  const length = clips?.[format]?.[clip] ?? 8
  const count = Math.min(
    STRIP.cols * STRIP.rows,
    Math.floor(length / STRIP.step),
  )
  return (
    <AbsoluteFill style={{ background: '#2A2928' }}>
      {Array.from({ length: count }, (_, k) => (
        <div
          key={k}
          style={{
            position: 'absolute',
            left: (k % STRIP.cols) * STRIP.w,
            top: Math.floor(k / STRIP.cols) * (cellH + STRIP.label),
            width: STRIP.w,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: STRIP.w,
              height: cellH,
              overflow: 'hidden',
            }}
          >
            <Freeze frame={Math.round(k * STRIP.step * FPS)}>
              <OffthreadVideo
                src={staticFile(`clips/${format}/${clip}.webm`)}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Freeze>
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 18,
              color: '#E8E6E3',
              height: STRIP.label,
              paddingLeft: 6,
            }}
          >
            {(k * STRIP.step).toFixed(2)} s
          </div>
        </div>
      ))}
    </AbsoluteFill>
  )
}

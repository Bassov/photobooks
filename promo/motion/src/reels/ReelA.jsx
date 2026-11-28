import React from 'react'
import { flushSync } from 'react-dom'
import {
  AbsoluteFill,
  Audio,
  Freeze,
  Img,
  OffthreadVideo,
  getRemotionEnvironment,
  staticFile,
  useCurrentFrame,
  useDelayRender,
} from 'remotion'
import { FPS, WIDTH, HEIGHT, reelConfig } from './shared/beats.js'
import { clickScaleAt, shotAt, springAt } from './shared/Springs.js'
import { Background } from './shared/Background.jsx'
import {
  Camera,
  DRAG,
  PARALLAX,
  boxToOutput,
  dragTilt,
  toOutput,
} from './shared/Camera.jsx'
import { Cursor } from './shared/Cursor.jsx'
import { EndCard, EndHero } from './shared/EndCard.jsx'
import { Focus } from './shared/Focus.jsx'
import { Grain } from './shared/Grain.jsx'
import { CAPTURE } from './a.capture.js'
import {
  BEAT,
  CARDS,
  DROP_BOX,
  FACE,
  FILLED_ROWS,
  FILLED_STAY,
  GHOST_W,
  GRIP,
  OFFSET,
  PLANE,
  ROWS,
  pointerAt,
  readerPhotosAt,
  rectAt,
  rectsAt,
} from './a.shots.js'

// Reel A v2 «Одна поездка» (Designer promo-reels-v2 §3–§4 item 3; v1 reel C sets the pacing, Owner Q-36): warm,
// daytime, tactile, cut on the Walking Away grid (a.plan.js). The kit clips (filmed frame-stepped at DPR 3,
// a.capture.js) play at rate 1 under the shared crop camera (G1, one scale); Remotion only adds what the product does
// not draw: the cursor (the captured pointer path, G5 parallax), the A2 rewind cards, the held photo of the A3 drag
// (G5 DRAG) and its landing spring, the focus holes (G4) and the end-card book (G7). Text: the end card only.
// Every photo on screen carries a `data-photo` box (plane px through the camera) for check 11's photo share; the GL
// reader draws its pages in WebGL, so its photo boxes are the measured `READER_PHOTOS`.

const FILL = {
  position: 'absolute',
  left: 0,
  top: 0,
  width: PLANE.w,
  height: PLANE.h,
}
const photo = (name) => staticFile(`photos/${name}.jpg`)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const lerp = (a, b, t) => a + (b - a) * t
const easeOut = (t) => 1 - (1 - t) ** 3
const asBox = ([x, y, w, h]) => ({ x, y, w, h })

// ---------------------------------------------------------------- clip frames (v1 cache, kept)

// CameraMotionBlur mounts 11 copies of the plane, and each copy's OffthreadVideo re-fetches the same 3840×4320 frame
// from the compositor (`cache: 'no-store'`), so one blurred frame could hit the delayRender timeout. While rendering,
// a clip frame is fetched once from the proxy URL OffthreadVideo uses and every sample draws that one blob through
// <Img>. The 0.5 s sheet (36 cells mounted at once, `probe` false) fetches its frames 8 at a time at plane size.
const LONG = 10 * 60 * 1000
const SheetMode = React.createContext(false)
const FRAME_CACHE = new Map()
const FRAME_CACHE_MAX = 6
const LANES = 8
let busy = 0
const waiting = []
const serial = (job) =>
  new Promise((resolve, reject) => {
    const start = () => {
      busy++
      job()
        .then(resolve, reject)
        .finally(() => {
          busy--
          waiting.shift()?.()
        })
    }
    if (busy < LANES) start()
    else waiting.push(start)
  })
async function fetchFrame(url, small) {
  const res = await fetch(url)
  if (res.status !== 200)
    throw new Error(`clip frame ${url}: HTTP ${res.status}`)
  const blob = new Blob([await res.arrayBuffer()], {
    type: res.headers.get('Content-Type') ?? '',
  })
  if (!small) return URL.createObjectURL(blob)
  const bmp = await createImageBitmap(blob, {
    resizeWidth: PLANE.w,
    resizeHeight: PLANE.h,
    resizeQuality: 'high',
  })
  const canvas = new OffscreenCanvas(PLANE.w, PLANE.h)
  canvas.getContext('2d').drawImage(bmp, 0, 0)
  bmp.close()
  const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
  return URL.createObjectURL(jpeg)
}
function clipFrameUrl(src, frame, small) {
  const abs = new URL(src, window.location.origin).href
  const time = frame / FPS
  const url = `http://localhost:${window.remotion_proxyPort}/proxy?src=${encodeURIComponent(abs)}&time=${encodeURIComponent(Math.max(0, time))}&transparent=false&toneMapped=true`
  const key = `${small ? 's' : 'f'} ${url}`
  let hit = FRAME_CACHE.get(key)
  if (!hit) {
    hit = small ? serial(() => fetchFrame(url, true)) : fetchFrame(url, false)
    FRAME_CACHE.set(key, hit)
    // the sheet keeps all of its (small) frames; a video tab renders one frame at a time and drops old ones
    while (!small && FRAME_CACHE.size > FRAME_CACHE_MAX) {
      const [old, p] = FRAME_CACHE.entries().next().value
      FRAME_CACHE.delete(old)
      p.then((u) => setTimeout(() => URL.revokeObjectURL(u), 60000)).catch(
        () => {},
      )
    }
  }
  return hit
}

/** <Img> that may wait behind the clip frames (the sheet mounts 36 frames at once). */
const Pic = (props) => (
  <Img delayRenderTimeoutInMilliseconds={LONG} {...props} />
)

// The drawn image is keyed by its clip frame: a new frame never shows the previous frame's (possibly revoked) blob
// while its own loads, so the geometry probe (Finish.jsx, same commit) never reads a broken <img>.
const CachedFrame = ({ src, frame }) => {
  const small = React.useContext(SheetMode)
  const key = `${small ? 's' : 'f'} ${src} ${frame}`
  const [loaded, setLoaded] = React.useState(null)
  const img = loaded?.key === key ? loaded.url : null
  const { delayRender, continueRender, cancelRender } = useDelayRender()
  React.useLayoutEffect(() => {
    let live = true
    const handle = delayRender(`clip frame ${src} @ ${frame}`, {
      timeoutInMilliseconds: LONG,
    })
    const done = () => {
      if (!live) return
      live = false
      continueRender(handle)
    }
    clipFrameUrl(src, frame, small)
      .then((u) => {
        // committed before the handle is released: the frame's own <Img> then holds the render until it decodes
        if (live) flushSync(() => setLoaded({ key, url: u }))
        done()
      })
      .catch((e) => cancelRender(e))
    return done
  }, [key, src, frame, small, delayRender, continueRender, cancelRender])
  return img ? <Pic src={img} style={FILL} /> : null
}

/** One frame of a kit clip over the plane (the clip's CSS viewport; its 3× pixels give the crop its sharpness). */
const Clip = ({ id, f }) => {
  const frame = clamp(Math.round(f), 0, CAPTURE[id].frames - 1)
  const src = staticFile(`clips/${id}.mp4`)
  if (getRemotionEnvironment().isRendering)
    return <CachedFrame src={src} frame={frame} />
  return (
    <Freeze frame={frame}>
      <OffthreadVideo src={src} muted style={FILL} />
    </Freeze>
  )
}

/** Clip frame a UI shot shows at reel `frame` (rate 1: `ui.start` at the shot's first frame). */
const clipF = (shot, frame) => shot.ui.start + (frame - shot.from)

/** Empty box tagging a photo for check 11 (plane px; the probe reads it through the camera). */
const Tag = ({ id, box }) => {
  const [x, y, w, h] = box
  return (
    <div
      data-photo={id}
      style={{ position: 'absolute', left: x, top: y, width: w, height: h }}
    />
  )
}
const Tags = ({ id, boxes }) =>
  boxes.map((b, k) => <Tag key={`${id}${k}`} id={`${id}${k}`} box={b} />)

const PhotoCard = ({ name, box, spin = 0, lift = 1, shadow, tag }) => {
  const [x, y, w, h] = box
  return (
    <div
      data-photo={tag}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        overflow: 'hidden',
        transform: spin ? `rotate(${spin}deg)` : undefined,
        boxShadow:
          shadow ??
          `0 ${14 * lift}px ${34 * lift}px rgb(0 0 0 / ${0.35 * lift})`,
      }}
    >
      <Pic
        src={photo(name)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
}

// ---------------------------------------------------------------- A2: the filled book un-fills into the strip

const PAPER = '#ECEAE6'

/** A card's box at `frame` (light spring from its frame to its thumbnail, lifted on an arc). */
function cardAt(card, frame) {
  const p = springAt(frame - card.start, 'light')
  const arc = Math.sin(Math.PI * clamp(p, 0, 1))
  const [x0, y0, w0, h0] = card.from
  const [x1, y1, w1, h1] = card.to
  return {
    box: [
      lerp(x0, x1, p),
      lerp(y0, y1, p) - 140 * arc,
      lerp(w0, w1, p),
      lerp(h0, h1, p),
    ],
    arc,
  }
}

const Unfill = ({ frame }) => (
  <>
    <Clip id="a-filled" f={0} />
    {CARDS.filter((c) => frame >= c.start).map((c) => (
      <div
        key={`paper${c.photo}`}
        style={{
          position: 'absolute',
          left: c.from[0],
          top: c.from[1],
          width: c.from[2],
          height: c.from[3],
          background: PAPER,
        }}
      />
    ))}
    {CARDS.map((c) => {
      if (frame < c.start)
        return <Tag key={c.photo} id={c.photo} box={c.from} />
      const { box, arc } = cardAt(c, frame)
      return (
        <PhotoCard
          key={c.photo}
          tag={c.photo}
          name={c.photo}
          box={box}
          spin={c.spin * arc}
          lift={arc}
        />
      )
    })}
    <Tags id="stay" boxes={FILLED_STAY} />
    <Tags id="row" boxes={FILLED_ROWS} />
  </>
)

// ---------------------------------------------------------------- A3: the held photo (G5 DRAG) and its landing

const GHOST = { from: BEAT.pick, to: BEAT.drop }
const DROP_CLIP = (frame) => frame + OFFSET['a-drop']

/** The held photo's box (plane px of the drag layer) at reel `frame`: the thumb grows to 62 % of the target width. */
function ghostBox(frame) {
  const p = pointerAt('a-drop', DROP_CLIP(frame))
  const tw = ROWS[0][2]
  const t = easeOut(clamp((frame - GHOST.from + 1) / 9, 0, 1))
  const w = lerp(tw, GHOST_W, t)
  const h = (w * DROP_BOX[3]) / DROP_BOX[2]
  // the grip scales with the photo (GRIP is measured at GHOST_W)
  const g = w / GHOST_W
  return [p.x - GRIP.x * g - w / 2, p.y - GRIP.y * g - h / 2, w, h]
}
/** Tilt from the pointer's horizontal velocity (output px per frame). */
function ghostTilt(shot, frame) {
  const a = toOutput(
    shot,
    frame - 1,
    pointerAt('a-drop', DROP_CLIP(frame - 1)),
    PARALLAX.drag,
  )
  const b = toOutput(
    shot,
    frame,
    pointerAt('a-drop', DROP_CLIP(frame)),
    PARALLAX.drag,
  )
  return dragTilt(b.x - a.x)
}

const Ghost = ({ shot }) => {
  const frame = useCurrentFrame()
  if (frame < GHOST.from || frame >= GHOST.to) return null
  return (
    <PhotoCard
      tag="ghost"
      name="L18"
      box={ghostBox(frame)}
      spin={ghostTilt(shot, frame)}
      shadow={DRAG.shadow}
    />
  )
}

/** The landing: the held photo springs into spread 1's frame over the empty frame of the take (light spring). */
function landingAt(land, frame) {
  const k = frame - land.at
  if (k < 0) return null
  const q = springAt(k, 'light')
  const from = ghostBox(land.at - 1)
  const box = land.box.map((v, i) => lerp(from[i], v, q))
  const off = Math.max(...box.map((v, i) => Math.abs(v - land.box[i])))
  // gone once within 0.5 px of the measured frame (the take already shows the photo there)
  if (k > 14 && off < 0.5) return null
  return { box, q }
}

const Landing = ({ land, frame }) => {
  const l = landingAt(land, frame)
  if (!l) return null
  const [x, y, w, h] = land.box
  const rest = clamp(1 - l.q, 0, 1)
  return (
    <>
      <div
        style={{
          ...FILL,
          clipPath: `inset(${y}px ${PLANE.w - x - w}px ${PLANE.h - y - h}px ${x}px)`,
        }}
      >
        <Clip id="a-drop" f={DROP_CLIP(land.at - 1)} />
      </div>
      <PhotoCard
        tag="landing"
        name={land.photo}
        box={l.box}
        spin={-DRAG.maxTilt * rest}
        lift={rest}
      />
    </>
  )
}

/**
 * The kit's round pan handle on the dropped photo (a-drop's `pan` log), tagged for check 10 on every frame it shows:
 * from the frame the landing card has settled (before that the card covers the take's handle).
 */
const PanTag = ({ shot, f, frame }) => {
  if (shot.land && landingAt(shot.land, frame)) return null
  const log = CAPTURE['a-drop'].rects.pan
  const pan = log[clamp(Math.round(f), 0, log.length - 1)]?.[0]
  if (!pan) return null
  const [x, y, w, h] = pan
  return (
    <div
      data-geom="handle"
      style={{ position: 'absolute', left: x, top: y, width: w, height: h }}
    />
  )
}

// ---------------------------------------------------------------- per-shot plane content

/** The photos the take shows at clip frame `f` (boxes the checks cannot read from the clip itself). */
function photosOf(shot, f) {
  const id = shot.ui.clip
  switch (id) {
    case 'a-drop': {
      const rows = rectsAt('a-drop', 'row', f)
      // spread 1's frame holds L18 once the kit has dropped it (the landing overlay tags itself before)
      const filled = f >= BEAT.drop + OFFSET['a-drop'] ? [DROP_BOX] : []
      return [...rows, ...filled]
    }
    case 'a-fill': {
      const frames =
        f > CAPTURE['a-fill'].events.find((e) => e[1] === 'key')[0]
          ? rectsAt('a-fill', 'frame', f)
          : []
      return [...frames, ...ROWS]
    }
    case 'a-shelf':
      return [rectAt('a-shelf', 'face', f)]
    default:
      return readerPhotosAt(id, f)
  }
}

const Scene = ({ shot }) => {
  const frame = useCurrentFrame()
  if (shot.id === 'A2') return <Unfill frame={frame} />
  const f = clipF(shot, frame)
  return (
    <>
      <Clip id={shot.ui.clip} f={f} />
      {shot.land && <Landing land={shot.land} frame={frame} />}
      {shot.ui.clip === 'a-drop' && <PanTag shot={shot} f={f} frame={frame} />}
      <Tags id={shot.id} boxes={photosOf(shot, f)} />
    </>
  )
}

// ---------------------------------------------------------------- the end card book (G7)

/** Keyline width in the hero's px (it shrinks to ≈ 0.63 × on the way into END_BOX). */
const KEY = 2
/** A10: the page block of the take's last frame, cut out at its output box and eased into END_BOX. */
const EndBook = ({ shot }) => {
  const b = shot.endBook
  const rect = boxToOutput(shot, shot.from, b)
  const s = rect.w / b.w
  return (
    <EndHero rect={rect} from={shot.from}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          boxShadow: `0 0 0 ${1.5 * KEY}px rgb(26 25 24), 0 40px 80px -30px rgb(0 0 0 / 0.55)`,
        }}
      >
        <div
          style={{
            ...FILL,
            left: -b.x * s,
            top: -b.y * s,
            transformOrigin: '0 0',
            transform: `scale(${s})`,
          }}
        >
          <Clip id={shot.still.clip} f={shot.still.frame} />
        </div>
        {/* the cut edge as one strong step: a light keyline just inside (print border), the ink ring just outside;
            it reads on a light ground (the sky) and a dark one alike, wherever the page or photo sits (check 10) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: `inset 0 0 0 ${KEY}px rgb(245 243 239)`,
          }}
        />
      </div>
    </EndHero>
  )
}

// ---------------------------------------------------------------- overlays in output px

/** The focus box (output px) of a shot: its one action point; null = the frame is the action (and on every W). */
function focusBox(shot, frame) {
  if (shot.scale === 'W') return null
  const out = (box, k = 1) => boxToOutput(shot, frame, asBox(box), k)
  switch (shot.focus) {
    case 'drag': {
      if (frame < GHOST.to) return out(ghostBox(frame), PARALLAX.drag)
      const l = landingAt(shot.land, frame)
      return l ? out(l.box) : null
    }
    case 'face':
      return out(rectAt('a-shelf', 'face', clipF(shot, frame)))
    default:
      return null
  }
}

function cursorOf(shot, frame) {
  if (!shot.cursor || !shot.ui) return null
  const id = shot.ui.clip
  const p = toOutput(
    shot,
    frame,
    pointerAt(id, clipF(shot, frame)),
    PARALLAX.cursor,
  )
  if (p.x < -20 || p.y < -20 || p.x > WIDTH + 20 || p.y > HEIGHT + 20)
    return null
  const clicks = CAPTURE[id].events
    .filter((e) => e[1] === 'down')
    .map((e) => e[0] - shot.ui.start + shot.from)
  return { ...p, scale: clickScaleAt(clicks, frame) }
}

export const ReelA = ({ reel, table, audio = true, probe = true }) => {
  const frame = useCurrentFrame()
  const { beatFrames } = reelConfig(reel)
  const shot = shotAt(table.shots, frame)
  const end = table.shots.find((s) => s.scale === 'end')
  const cursor = cursorOf(shot, frame)
  return (
    <SheetMode.Provider value={!probe}>
      <AbsoluteFill>
        <Background reel={reel} photo={photo(shot.bg)} />
        {shot.endBook ? (
          <EndBook shot={shot} />
        ) : (
          <Focus
            reel={reel}
            box={focusBox(shot, frame)}
            render={() => (
              <>
                <Camera shot={shot} plane={table.plane}>
                  <Scene shot={shot} />
                </Camera>
                {shot.focus === 'drag' && (
                  <Camera shot={shot} plane={table.plane} layer="drag">
                    <Ghost shot={shot} />
                  </Camera>
                )}
              </>
            )}
          />
        )}
        {cursor && <Cursor at={cursor} />}
        {end && (
          <EndCard
            from={end.from}
            beatFrames={beatFrames}
            reel={reel}
            probe={probe}
          />
        )}
        <Grain reel={reel} probe={probe} />
        {audio && <Audio src={staticFile(`audio/${reel}.wav`)} />}
      </AbsoluteFill>
    </SheetMode.Provider>
  )
}

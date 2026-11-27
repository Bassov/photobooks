import React from 'react'
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
import { cameraAt, clickScaleAt, shotAt, springAt } from './shared/Springs.js'
import { Background } from './shared/Background.jsx'
import { Camera, boxToOutput, toOutput } from './shared/Camera.jsx'
import { Cursor } from './shared/Cursor.jsx'
import { EndCard, endMove } from './shared/EndCard.jsx'
import { Focus } from './shared/Focus.jsx'
import { Grain } from './shared/Grain.jsx'
import { CAPTURE } from './a.capture.js'
import { CARDS, FOLD, PLANE, STRIP } from './a.shots.js'

// Reel A «Одна поездка» (Designer promo-reels-3 §3): warm, daytime, tactile. The kit clips (filmed in real time at
// DPR 3, a.capture.js) play at rate 1 under the shot table's crop camera; Remotion only adds what the product does not
// draw: the cursor (replaying the captured pointer path), the A2 rewind cards, the A5 landing spring, the A7
// zoom-through, the A8 pull-out, the A8 → A9 whip pan, the end card move. Text: the end card only.

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
const easeIn = (t) => t * t * t
const easeOut = (t) => 1 - (1 - t) ** 3

// Local wrapper (shared Camera.jsx bug, named in the PR): CameraMotionBlur mounts 11 copies of the plane, and each
// copy's OffthreadVideo re-fetches the same 3840×4320 frame from the compositor (`cache: 'no-store'`, ≈ 8 s each), so
// one blurred frame took 95–200 s and the render hit the 30 s delayRender timeout. While rendering, a clip frame is
// fetched once from the same proxy URL OffthreadVideo uses and every sample draws that one blob through <Img>.
const FRAME_CACHE = new Map()
const FRAME_CACHE_MAX = 6
function clipFrameUrl(src, frame) {
  const abs = new URL(src, window.location.origin).href
  const time = frame / FPS
  const url = `http://localhost:${window.remotion_proxyPort}/proxy?src=${encodeURIComponent(abs)}&time=${encodeURIComponent(Math.max(0, time))}&transparent=false&toneMapped=true`
  let hit = FRAME_CACHE.get(url)
  if (!hit) {
    hit = fetch(url).then(async (res) => {
      if (res.status !== 200)
        throw new Error(`clip frame ${url}: HTTP ${res.status}`)
      const blob = new Blob([await res.arrayBuffer()], {
        type: res.headers.get('Content-Type') ?? '',
      })
      return URL.createObjectURL(blob)
    })
    FRAME_CACHE.set(url, hit)
    while (FRAME_CACHE.size > FRAME_CACHE_MAX) {
      const [old, p] = FRAME_CACHE.entries().next().value
      FRAME_CACHE.delete(old)
      p.then((u) => setTimeout(() => URL.revokeObjectURL(u), 60000)).catch(
        () => {},
      )
    }
  }
  return hit
}

const CachedFrame = ({ src, frame }) => {
  const [img, setImg] = React.useState(null)
  const { delayRender, continueRender, cancelRender } = useDelayRender()
  React.useLayoutEffect(() => {
    let live = true
    const handle = delayRender(`clip frame ${src} @ ${frame}`)
    const done = () => {
      if (!live) return
      live = false
      continueRender(handle)
    }
    clipFrameUrl(src, frame)
      .then((u) => {
        if (live) setImg(u)
        done()
      })
      .catch((e) => cancelRender(e))
    return done
  }, [src, frame, delayRender, continueRender, cancelRender])
  return img ? <Img src={img} style={FILL} /> : null
}

/** One frame of a kit clip, drawn over the plane (the clip's CSS viewport; its 3× pixels give the crop its sharpness). */
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

/** Clip frame of a UI shot at reel `frame` (rate 1; A2 opens with its rewind). */
function clipAt(shot, frame) {
  const { ui } = shot
  if (!ui) return null
  if (shot.rewind && frame < shot.from + shot.rewind)
    return { id: ui.clip, f: ui.from - (frame - shot.from) }
  if (ui.rate === 1) return { id: ui.clip, f: frame + ui.offset }
  return null
}

const pointerAt = (id, f) => {
  const p = CAPTURE[id].pointer
  const [x, y] = p[clamp(f, 0, p.length - 1)]
  return { x, y }
}

/** Output px a whip moves the plane by: 1600 px of output, in plane px. */
const whipShift = (shot, frame) => {
  const { s } = cameraAt(shot, frame)
  const k = frame - shot.from
  if (shot.whipIn && k < shot.whipIn)
    return (1600 / s) * (1 - easeOut((k + 1) / (shot.whipIn + 1)))
  const left = shot.to - frame
  if (shot.whipOut && left <= shot.whipOut)
    return (-1600 / s) * easeIn((shot.whipOut - left + 1) / (shot.whipOut + 1))
  return 0
}

// ---------------------------------------------------------------- A2: the filled spread un-fills into the strip

const PAPER = '#ECEAE6'

const Card = ({ card, frame }) => {
  const p = springAt(frame - card.start, 'light')
  const arc = Math.sin(Math.PI * clamp(p, 0, 1))
  const [x0, y0, w0, h0] = card.from
  const [x1, y1, w1, h1] = card.to
  const w = lerp(w0, w1, p)
  const h = lerp(h0, h1, p)
  return (
    <div
      style={{
        position: 'absolute',
        left: lerp(x0, x1, p),
        top: lerp(y0, y1, p) - 140 * arc,
        width: w,
        height: h,
        transform: `rotate(${card.spin * arc}deg) scale(${1 + 0.06 * arc})`,
        boxShadow: `0 ${18 * arc}px ${40 * arc}px rgb(0 0 0 / ${0.35 * arc})`,
        overflow: 'hidden',
      }}
    >
      <Img
        src={photo(card.photo)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
}

const Unfill = ({ frame }) => {
  const q = clamp((frame - FOLD.from + 1) / FOLD.frames, 0, 1)
  return (
    <>
      <Clip id="a-filled" f={0} />
      {CARDS.filter((c) => frame >= c.start).map((c) => (
        <div
          key={`p${c.photo}`}
          style={{
            position: 'absolute',
            left: c.from[0],
            top: c.from[1],
            width: c.from[2],
            height: Math.min(c.from[3], STRIP.y - c.from[1]),
            background: PAPER,
          }}
        />
      ))}
      {CARDS.map((c) => (
        <Card key={c.photo} card={c} frame={frame} />
      ))}
      {q > 0 && (
        // the strip folds right → left: the empty strip of the same editor (a-drop, before Add folder) takes over
        <div
          style={{
            ...FILL,
            clipPath: `inset(${STRIP.y}px 0 ${PLANE.h - STRIP.y - STRIP.h}px ${PLANE.w * (1 - easeOut(q))}px)`,
          }}
        >
          <Clip id="a-drop" f={0} />
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------- per-shot plane content

const Landing = ({ land, frame }) => {
  const k = frame - land.at
  if (k < 0) return null
  const q = springAt(k, 'light')
  const scale = 1 + 0.06 * (1 - q)
  const [x, y, w, h] = land.box
  // removed once within 0.5 px of the measured frame box (the clip already shows the photo underneath)
  if (k > 14 && Math.abs(scale - 1) * w * 3 < 0.5) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        overflow: 'hidden',
        transform: `scale(${scale})`,
        boxShadow: `0 ${10 * (scale - 1) * 16}px ${24 * (scale - 1) * 16}px rgb(0 0 0 / .3)`,
      }}
    >
      <Img
        src={photo(land.photo)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
}

const Through = ({ shot, frame }) => {
  const { through, still } = shot
  const k = frame - shot.from
  if (k >= through.frames)
    return (
      <Img src={photo(through.photo)} style={{ ...FILL, objectFit: 'cover' }} />
    )
  const t = easeIn((k + 1) / through.frames)
  const [x, y, w, h] = through.box
  const c = { x: x + w / 2, y: y + h / 2 }
  const z = 1 + (through.zoom - 1) * t
  return (
    <div
      style={{
        ...FILL,
        transformOrigin: `${c.x}px ${c.y}px`,
        transform: `translate(${(PLANE.w / 2 - c.x) * t}px, ${(PLANE.h / 2 - c.y) * t}px) scale(${z})`,
      }}
    >
      <Clip id={still.clip} f={still.frame} />
    </div>
  )
}

const Scene = ({ shot }) => {
  const frame = useCurrentFrame()
  if (shot.through) return <Through shot={shot} frame={frame} />
  if (shot.id === 'A2' && frame >= shot.from + shot.rewind)
    return <Unfill frame={frame} />
  const at = clipAt(shot, frame)
  const t = inner(shot, frame)
  return (
    <div
      style={{
        ...FILL,
        transformOrigin: `${t.ox}px ${t.oy}px`,
        transform: `translate(${t.dx}px, ${t.dy}px) scale(${t.z})`,
      }}
    >
      {at && <Clip id={at.id} f={at.f} />}
      {shot.land && <Landing land={shot.land} frame={frame} />}
    </div>
  )
}

/**
 * Plane-space move a shot adds on top of its crop camera: `pullOut` (A4's 6-frame whip-out zoom from the button; A8
 * opening on L18 filling the frame width and pulling out with the medium spring) and the A8 → A9 whip pan.
 * Point p → o + z·(p − o) + d.
 */
function inner(shot, frame) {
  const t = { z: 1, ox: 0, oy: 0, dx: whipShift(shot, frame), dy: 0 }
  if (!shot.pullOut) return t
  const k = frame - shot.from
  const { box, frames, whip } = shot.pullOut
  const p = whip
    ? easeOut(clamp((k + 1) / frames, 0, 1))
    : clamp(springAt(k, 'medium'), 0, 1.2)
  const [x, y, w, h] = box
  const c = { x: x + w / 2, y: y + h / 2 }
  const crop = shot.cam[0]
  return {
    z: 1 + (crop.w / w - 1) * (1 - p),
    ox: c.x,
    oy: c.y,
    dx: t.dx + (crop.cx - c.x) * (1 - p),
    dy: (crop.cy - c.y) * (1 - p),
  }
}
const innerPoint = (t, p) => ({
  x: t.ox + t.z * (p.x - t.ox) + t.dx,
  y: t.oy + t.z * (p.y - t.oy) + t.dy,
})

// ---------------------------------------------------------------- overlays in output px

/** The focus box (output px) of a shot: the one action point; null = the whole frame is the action. */
function focusBox(shot, frame) {
  const t = inner(shot, frame)
  const box = (b) => {
    const p = innerPoint(t, { x: b[0], y: b[1] })
    return boxToOutput(shot, frame, { ...p, w: b[2] * t.z, h: b[3] * t.z })
  }
  const at = clipAt(shot, frame)
  switch (shot.focus) {
    case 'choose': {
      const p = pointerAt('a-drop', at.f)
      return box([p.x - 120, p.y - 34, 240, 68])
    }
    case 'pick':
      return box(CAPTURE['a-filled'].cards.rows[0].box)
    case 'drop':
      return box(shot.land.box)
    case 'cover':
      return box(shot.pullOut.box)
    case 'book':
      return box([64, 360, 1152, 705])
    default:
      return null
  }
}

function cursorOf(shot, frame) {
  if (!shot.cursor) return null
  if (shot.whipIn && frame - shot.from < shot.whipIn) return null
  const at = clipAt(shot, frame)
  if (!at) return null
  const p = toOutput(
    shot,
    frame,
    innerPoint(inner(shot, frame), pointerAt(at.id, at.f)),
  )
  if (p.x < -20 || p.y < -20 || p.x > WIDTH + 20 || p.y > HEIGHT + 20)
    return null
  const clicks = CAPTURE[at.id].events
    .filter((e) => e[1] === 'down')
    .map((e) => e[0] - shot.ui.offset)
  return { ...p, scale: clickScaleAt(clicks, frame) }
}

export const ReelA = ({ reel, table, audio = true, probe = true }) => {
  const frame = useCurrentFrame()
  const { beatFrames } = reelConfig(reel)
  const shot = shotAt(table.shots, frame)
  const end = table.shots.find((s) => s.scale === 'end')
  const cursor = cursorOf(shot, frame)
  let move = null
  let clip = null
  if (shot.endBook) {
    const b = shot.endBook
    const start = boxToOutput(shot, end.from, b)
    const now = boxToOutput(shot, frame, b)
    move = endMove(start, frame, end.from)
    clip = `inset(${now.y}px ${WIDTH - now.x - now.w}px ${HEIGHT - now.y - now.h}px ${now.x}px round 6px)`
  }
  const picture = (
    <Focus
      reel={reel}
      box={focusBox(shot, frame)}
      render={() => (
        <Camera shot={shot} plane={table.plane}>
          <Scene shot={shot} />
        </Camera>
      )}
    />
  )
  return (
    <AbsoluteFill>
      <Background reel={reel} photo={photo(shot.bg)} />
      {move ? (
        <AbsoluteFill
          style={{
            transformOrigin: '0 0',
            transform: `translate(${move.x}px, ${move.y}px) scale(${move.s})`,
            filter: 'drop-shadow(0 40px 50px rgb(0 0 0 / 0.45))',
          }}
        >
          <AbsoluteFill style={{ clipPath: clip }}>{picture}</AbsoluteFill>
        </AbsoluteFill>
      ) : (
        picture
      )}
      {cursor && <Cursor at={cursor} />}
      {end && <EndCard from={end.from} beatFrames={beatFrames} probe={probe} />}
      <Grain reel={reel} />
      {audio && <Audio src={staticFile(`audio/${reel}.wav`)} />}
    </AbsoluteFill>
  )
}

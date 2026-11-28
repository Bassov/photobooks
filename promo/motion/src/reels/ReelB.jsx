import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Freeze,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import {
  cameraAt,
  clickScaleAt,
  minJerk,
  shotAt,
  springAt,
} from './shared/Springs.js'
import { Background } from './shared/Background.jsx'
import {
  Camera,
  DRAG,
  PARALLAX,
  boxToOutput,
  dragTilt,
  dragWidth,
  isFast,
} from './shared/Camera.jsx'
import { Cursor } from './shared/Cursor.jsx'
import { EndCard } from './shared/EndCard.jsx'
import { Finish } from './shared/Finish.jsx'
import { Focus } from './shared/Focus.jsx'
import { PdfSheet, PDF_BLEED_MM, pdfSheetSize } from './shared/PdfSheet.jsx'
import { PHONE, Phone } from './shared/Phone.jsx'
import {
  CLIP,
  HERO,
  OFFSET,
  POINTER,
  SHEET,
  SHEET_FRONT,
  b,
  outBox,
} from './b.shots.js'

// Reel B «Один снимок», v2 (promo-reels-v2 spec §2 G1–G8 over promo-reels-3 §4): one hero, one camera path, the
// context changes around it. Per frame: the warm dark ground with the hero photo (G2) → the current context (the hero
// macro, a kit clip, the PDF sheet or the phone) under the shot's camera, with focus B outside the hero on M / Md shots
// (G4; none on W, sheet and phone frames) and a short focus pull on each rack cut → the overlays the product doesn't
// draw (the hero shrinking into the strip, the drag photo, its landing, the cursor) → end card → vignette + grain (G8).

const R = 'b'
const HERO_SRC = () => staticFile(`photos/${HERO.file}`)
const HERO_ASPECT = HERO.w / HERO.h
const K = PHONE.scale
const RACK = { up: 6, down: 8, blur: 24 }
const LAND = 18

const shotById = (table, id) => table.shots.find((s) => s.id === id)
const lerp = (a, z, t) => a + (z - a) * t
const lerpBox = (a, z, t) => ({
  x: lerp(a.x, z.x, t),
  y: lerp(a.y, z.y, t),
  w: lerp(a.w, z.w, t),
  h: lerp(a.h, z.h, t),
})
const around = (p, size) => ({
  x: p.x - size.w / 2,
  y: p.y - size.h / 2,
  w: size.w,
  h: size.h,
})

/** Pointer (clip CSS px) of `clip` at reel frame `f`: the replayed walk path, held at its ends. */
function pointerAt(clip, f) {
  const fr = POINTER[clip].frames
  const k = Math.min(fr.length - 1, Math.max(0, f - OFFSET[clip]))
  return fr[k]
}
const eventAt = (clip, type) =>
  POINTER[clip].events.find((e) => e.type === type).f + OFFSET[clip]

/** Context blur of the rack cuts: 0 → 24 px over the 6 frames before the cut, 24 → 0 over the 8 after. */
export function rackBlur(table, f) {
  for (const s of table.shots) {
    if (s.rack == null) continue
    const k = f - s.rack
    if (k >= -RACK.up && k < 0) return (RACK.blur * (k + RACK.up + 1)) / RACK.up
    if (k >= 0 && k < RACK.down) return RACK.blur * (1 - k / RACK.down)
  }
  return 0
}

// ---------------------------------------------------------------- contexts (drawn in plane px under the camera)

/**
 * A kit clip at reel frame `f` (rate 1, clamped to its first / last frame). The 0.5 s sheet (Root's `ReelSheetB`)
 * reads the DPR-1 proxy `<clip>.sheet.mp4` (walks-b.mjs --stage): 72 extractions of the DPR-3 clip exceed the 30 s
 * delayRender limit there. Box = the clip's CSS viewport, the file is viewport × DPR: same aspect (G1).
 */
const ClipFrame = ({ clip, f }) => {
  const { frames, plane } = CLIP[clip]
  const { id } = useVideoConfig()
  const file = id.startsWith('ReelSheet') ? `${clip}.sheet` : clip
  const k = Math.min(frames - 1, Math.max(0, f - OFFSET[clip]))
  return (
    <Freeze frame={k}>
      <OffthreadVideo
        src={staticFile(`clips/${file}.mp4`)}
        muted
        toneMapped={false}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: plane.w,
          height: plane.h,
        }}
      />
    </Freeze>
  )
}

const HeroPlane = () => (
  <Img
    data-photo="hero"
    src={HERO_SRC()}
    style={{ position: 'absolute', width: HERO.w, height: HERO.h }}
  />
)

const PdfPlane = () => {
  const size = pdfSheetSize(SHEET.trimW, SHEET.trimH, SHEET.pxPerMm)
  if (size.slugMm !== SHEET.slugMm)
    throw new Error(`b.shots SHEET.slugMm ${SHEET.slugMm} ≠ ${size.slugMm}`)
  // the artwork box is the bleed box: its origin is (slug − bleed) mm into the media
  const art = (SHEET.slugMm - PDF_BLEED_MM) * SHEET.pxPerMm
  return (
    <PdfSheet
      trimW={SHEET.trimW}
      trimH={SHEET.trimH}
      pxPerMm={SHEET.pxPerMm}
      cover={{ spine: SHEET.spine, spineX: SHEET.spineX }}
    >
      <div
        data-photo="hero"
        style={{
          position: 'absolute',
          left: SHEET_FRONT.x - art,
          top: SHEET_FRONT.y - art,
          width: SHEET_FRONT.w,
          height: SHEET_FRONT.h,
          overflow: 'hidden',
        }}
      >
        <Img
          src={HERO_SRC()}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </PdfSheet>
  )
}

/** The phone body (G3 B8/B9, output geometry) drawn in the phone capture's CSS px, so the camera works in UI px. */
const PhonePlane = ({ f }) => {
  const k = f - OFFSET['b-phone']
  // The site pages draw the photo as a CSS background (no <img>), so the filmed photo regions are marked here
  // (G3): the full-bleed cover until the tap opens it, the hero spread band once the page turn lands.
  const photo =
    k <= PHONE_PHOTO.coverUntil
      ? CLIP['b-phone'].paper
      : k >= PHONE_PHOTO.bandFrom
        ? PHONE_PHOTO.band
        : null
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: '0 0',
        transform: `scale(${1 / K}) translate(${-PHONE.screen.x}px, ${-PHONE.screen.y}px)`,
      }}
    >
      <Phone>
        <ClipFrame clip="b-phone" f={f} />
        {photo && (
          <div
            data-photo="phone"
            style={{
              position: 'absolute',
              left: photo.x,
              top: photo.y,
              width: photo.w,
              height: photo.h,
            }}
          />
        )}
      </Phone>
    </div>
  )
}

/**
 * Read from the capture's frames: the cover stays flat until 4 frames after the tap, the breath drag (1300 ms) lands
 * the hero page 52 frames after its down (the leaf clears 6 frames after the finger's up); the hero band on that
 * page (CSS px).
 */
const PHONE_PHOTO = {
  coverUntil: CLIP['b-phone'].touch.tap + 4,
  bandFrom: CLIP['b-phone'].touch.drag + 52,
  band: { x: 42, y: 292, w: 332, h: 223 },
}

/** The site clip; once the room shows the closed GL cover (not a DOM box) its measured box is the hero photo (G3). */
const SitePlane = ({ f }) => {
  const s = CLIP['b-site']
  const k = f - OFFSET['b-site']
  return (
    <>
      <ClipFrame clip="b-site" f={f} />
      {k >= s.roomFrame && (
        <div
          data-photo="room-cover"
          style={{
            position: 'absolute',
            left: s.room.x,
            top: s.room.y,
            width: s.room.w,
            height: s.room.h,
          }}
        />
      )}
    </>
  )
}

const Context = ({ shot, f }) => {
  if (shot.context === 'hero') return <HeroPlane />
  if (shot.context === 'pdf') return <PdfPlane />
  if (shot.context === 'b-phone') return <PhonePlane f={f} />
  if (shot.context === 'b-site') return <SitePlane f={f} />
  return <ClipFrame clip={shot.context} f={f} />
}

// ---------------------------------------------------------------- the hero overlays

/** B1 tail: the full-frame photo shrinks into filmstrip thumb 1 (B2's camera), minimum-jerk. */
function heroShrink(table, f) {
  const B1 = shotById(table, 'B1')
  const B2 = shotById(table, 'B2')
  if (f < B1.shrink.from || f >= B1.shrink.to) return null
  const t = minJerk((f - B1.shrink.from + 1) / (B1.shrink.to - B1.shrink.from))
  const cam = cameraAt(B1, f)
  const full = { x: cam.tx, y: cam.ty, w: HERO.w * cam.s, h: HERO.h * cam.s }
  const thumb = outBox(B2, f, CLIP['b-hero-drop'].thumb)
  // the kit thumb cover-fits the photo (thumb 1.30 < photo 1.5: the height fills)
  const pw = thumb.h * HERO_ASPECT
  const inThumb = {
    x: thumb.x + (thumb.w - pw) / 2,
    y: thumb.y,
    w: pw,
    h: thumb.h,
  }
  return {
    clip: lerpBox({ x: 0, y: 0, w: 1080, h: 1920 }, thumb, t),
    photo: lerpBox(full, inThumb, t),
    radius: lerp(0, 6, t),
  }
}

/** The clip whose drag a shot films, the drop target box (plane px) and the down / up reel frames. */
function dragOf(shot) {
  if (shot.id === 'B2')
    return {
      clip: 'b-hero-drop',
      target: CLIP['b-hero-drop'].frame,
      down: eventAt('b-hero-drop', 'down'),
      up: eventAt('b-hero-drop', 'up'),
    }
  if (['B3', 'B4'].includes(shot.id))
    return {
      clip: 'b-hero-cover',
      target: CLIP['b-hero-cover'].coverFront,
      down: eventAt('b-hero-cover', 'down'),
      up: eventAt('b-hero-cover', 'up'),
    }
  return null
}

/**
 * G5 drag photo: the hero, 62 % of the drop target's output width, centred on the pointer (parallax 1.03 like the
 * cursor), shadow, tilt ≤ 3° from its horizontal velocity. Chromium does not paint the OS drag image into a CDP
 * screenshot, so the capture has none; a real browser shows the photo there.
 */
function dragPhoto(shot, f) {
  const d = dragOf(shot)
  if (!d || f < d.down || f >= d.up) return null
  const at = (k) =>
    boxToOutput(shot, k, { ...pointerAt(d.clip, k), w: 0, h: 0 }, PARALLAX.drag)
  const p = at(f)
  const w = dragWidth(outBox(shot, f, d.target).w)
  return {
    box: around(p, { w, h: w / HERO_ASPECT }),
    tilt: dragTilt(p.x - at(f - 1).x),
  }
}

/** B3: the dropped hero springs (`light`) from the drag photo (B2, at the drop) onto spread 1's frame. */
function landing(table, f) {
  const B2 = shotById(table, 'B2')
  const B3 = shotById(table, 'B3')
  const k = f - B3.land.from
  if (k < 0 || k >= LAND) return null
  const last =
    dragPhoto(B2, B3.from - 1)?.box ??
    outBox(B2, B3.from - 1, CLIP['b-hero-drop'].frame)
  const frame = outBox(B3, f, CLIP['b-hero-cover'].frame)
  const p = springAt(k, 'light')
  return { box: lerpBox(last, frame, p), scale: 1 + 0.06 * (1 - p) }
}

const PhotoIn = ({ box, photo, radius = 0, scale = 1, tilt = 0, shadow }) => (
  <div
    data-photo="hero"
    style={{
      position: 'absolute',
      left: box.x,
      top: box.y,
      width: box.w,
      height: box.h,
      overflow: 'hidden',
      borderRadius: radius,
      boxShadow: shadow,
      transform:
        scale !== 1 || tilt
          ? `rotate(${tilt.toFixed(3)}deg) scale(${scale})`
          : undefined,
    }}
  >
    <Img
      src={HERO_SRC()}
      style={
        photo
          ? {
              position: 'absolute',
              left: photo.x - box.x,
              top: photo.y - box.y,
              width: photo.w,
              height: photo.h,
            }
          : { width: '100%', height: '100%', objectFit: 'cover' }
      }
    />
  </div>
)

// ---------------------------------------------------------------- focus: where the hero is (output px)

/** The action box of focus B on M / Md shots; null on W shots, the phone and the end card (G4, check 11). */
export function heroBox(table, shot, f) {
  if (shot.scale === 'W' || shot.scale === 'end' || shot.context === 'b-phone')
    return null
  const drag = dragPhoto(shot, f)
  if (drag) return drag.box
  switch (shot.id) {
    case 'B1':
      return heroShrink(table, f)?.clip ?? null
    case 'B2':
      return f < eventAt('b-hero-drop', 'down')
        ? outBox(shot, f, CLIP['b-hero-drop'].thumb)
        : outBox(shot, f, CLIP['b-hero-drop'].frame)
    case 'B3': {
      if (f - shot.from < LAND) return landing(table, f).box
      return outBox(shot, f, CLIP['b-hero-cover'].frame)
    }
    case 'B5':
      return outBox(shot, f, CLIP['b-hero-cover'].coverFront)
    case 'B7': {
      const s = CLIP['b-site']
      const k = f - OFFSET['b-site']
      if (k >= s.roomFrame) return outBox(shot, f, s.room)
      const [a, z] = s.liftFrames
      const t = Math.min(1, Math.max(0, (k - a) / (z - a)))
      return outBox(shot, f, lerpBox(s.face, s.lifted, t))
    }
    default:
      return null
  }
}

/**
 * Camera for the kit clip contexts. Shared `Camera` motion-blurs fast frames with a 10-sample `CameraMotionBlur`, and
 * every sample re-extracts the 3840×4320 clip frame (memory: 30 s delayRender timeouts). The clip frame is frozen
 * across the samples anyway (`ClipFrame`), so here the same camera transform gets one extraction and fast frames
 * (G5: > 12 px/frame) get a directional blur along the camera's own motion: a 180° shutter smears half the travel.
 */
const ClipCamera = ({ shot, plane, children }) => {
  const f = useCurrentFrame()
  const id = `b-mblur-${React.useId().replace(/:/g, '')}`
  const c = cameraAt(shot, f)
  let sigma = null
  if (isFast(shot, f)) {
    const p = cameraAt(shot, f - 1)
    const at = (k, x, y) => ({ x: x * k.s + k.tx, y: y * k.s + k.ty })
    const mid = (k) => at(k, plane.w / 2, plane.h / 2)
    const edge = (k) => at(k, 0, 0)
    const m0 = mid(p)
    const m1 = mid(c)
    const zx = Math.abs(edge(c).x - m1.x - (edge(p).x - m0.x))
    const zy = Math.abs(edge(c).y - m1.y - (edge(p).y - m0.y))
    const smear = (d, z) => (0.5 * (d + z / 2)) / 3
    sigma = {
      x: smear(Math.abs(m1.x - m0.x), zx),
      y: smear(Math.abs(m1.y - m0.y), zy),
    }
  }
  return (
    <AbsoluteFill
      style={{ overflow: 'hidden', filter: sigma ? `url(#${id})` : undefined }}
    >
      {sigma && (
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur
              stdDeviation={`${sigma.x.toFixed(2)} ${sigma.y.toFixed(2)}`}
              edgeMode="duplicate"
            />
          </filter>
        </svg>
      )}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: plane.w,
          height: plane.h,
          transformOrigin: '0 0',
          transform: `translate(${c.tx}px, ${c.ty}px) scale(${c.s})`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}

// ---------------------------------------------------------------- cursor (the replayed walk path, output px)

const CURSOR_SHOTS = {
  B2: 'b-hero-drop',
  B3: 'b-hero-cover',
  B4: 'b-hero-cover',
  B5: 'b-hero-cover',
  B7: 'b-site',
}

function cursorAt(shot, f) {
  const clip = CURSOR_SHOTS[shot.id]
  if (!clip) return null
  const p = boxToOutput(
    shot,
    f,
    { ...pointerAt(clip, f), w: 0, h: 0 },
    PARALLAX.cursor,
  )
  const downs = POINTER[clip].events
    .filter((e) => e.type === 'down')
    .map((e) => e.f + OFFSET[clip])
  return { x: p.x, y: p.y, scale: clickScaleAt(downs, f) }
}

// ---------------------------------------------------------------- the reel

export const ReelB = ({ reel = R, table, audio = true, probe = true }) => {
  const f = useCurrentFrame()
  const shot = shotAt(table.shots, f)
  const end = table.shots.find((s) => s.scale === 'end')
  const B2 = shotById(table, 'B2')
  const shrink = heroShrink(table, f)
  // during the shrink the editor (B2's camera) is already under the photo
  const ctxShot = shrink ? B2 : shot
  const land = shot.land ? landing(table, f) : null
  const drag = dragPhoto(shot, f)
  const cursor = cursorAt(shot, f)
  const rack = rackBlur(table, f)
  // End card: B10's own camera pulls the phone back to its 700 px body box (G7, b.shots.js), so no extra move here.
  const content = () => (
    <AbsoluteFill style={rack ? { filter: `blur(${rack}px)` } : undefined}>
      {CLIP[ctxShot.context] ? (
        <ClipCamera shot={ctxShot} plane={ctxShot.plane}>
          <Context shot={ctxShot} f={f} />
        </ClipCamera>
      ) : (
        <Camera shot={ctxShot} plane={ctxShot.plane}>
          <Context shot={ctxShot} f={f} />
        </Camera>
      )}
    </AbsoluteFill>
  )
  const picture = (
    <Focus
      reel={reel}
      // no focus while the ground shows in a full-width band (Focus.jsx, Designer decision 2026-11-28)
      box={
        ctxShot.groundBand
          ? null
          : shrink
            ? shrink.clip
            : heroBox(table, shot, f)
      }
      render={content}
    />
  )
  return (
    <AbsoluteFill>
      <Background reel={reel} photo={HERO_SRC()} />
      {picture}
      {shrink && (
        <PhotoIn
          box={shrink.clip}
          photo={shrink.photo}
          radius={shrink.radius}
        />
      )}
      {land && <PhotoIn box={land.box} scale={land.scale} />}
      {drag && (
        <PhotoIn
          box={drag.box}
          radius={4}
          tilt={drag.tilt}
          shadow={DRAG.shadow}
        />
      )}
      {cursor && <Cursor at={cursor} />}
      <EndCard
        from={end.from}
        beatFrames={b(25) - b(24)}
        reel={reel}
        probe={probe}
      />
      <Finish reel={reel} probe={probe} />
      {audio && <Audio src={staticFile(`audio/${reel}.wav`)} />}
    </AbsoluteFill>
  )
}

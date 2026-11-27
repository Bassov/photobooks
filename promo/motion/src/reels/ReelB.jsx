import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Freeze,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import { reelConfig } from './shared/beats.js'
import {
  cameraAt,
  clickScaleAt,
  minJerk,
  shotAt,
  springAt,
} from './shared/Springs.js'
import { Background } from './shared/Background.jsx'
import { Camera } from './shared/Camera.jsx'
import { Cursor } from './shared/Cursor.jsx'
import { EndCard, endMove } from './shared/EndCard.jsx'
import { focusMask } from './shared/Focus.jsx'
import { Grain } from './shared/Grain.jsx'
import { PdfSheet, PDF_BLEED_MM, pdfSheetSize } from './shared/PdfSheet.jsx'
import { PHONE, Phone, phoneBody } from './shared/Phone.jsx'
import {
  CLIP,
  HERO,
  OFFSET,
  POINTER,
  SHEET,
  SHEET_FRONT,
  SHEET_FRONT_MARKS,
  outBox,
} from './b.shots.js'

// Reel B «Один снимок» (spec §4): one hero, one camera path, the context changes around it. The picture per frame:
// dusk background → the current context (a kit clip, the hero macro, the PDF sheet, or the phone) under the shot's
// camera, dimmed + blurred outside the hero (focus B) and blurred harder through each rack focus → the overlays the
// product doesn't draw (the hero shrinking into the strip, the landing on spread 1, the cursor) → end card → grain.

const R = 'b'
const HERO_SRC = () => staticFile(`photos/${HERO.file}`)
const K = PHONE.screen.w / PHONE.capture.w
const RACK = { up: 6, down: 8, blur: 24 }
const LAND = 18

const shotById = (table, id) => table.shots.find((s) => s.id === id)
const lerp = (a, b, t) => a + (b - a) * t
const lerpBox = (a, b, t) => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
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
const downFrames = (clip) =>
  POINTER[clip].events
    .filter((e) => e.type === 'down')
    .map((e) => e.f + OFFSET[clip])

/** Extra context blur of the rack focuses: 0 → 24 px over the 6 frames before the downbeat, 24 → 0 over 8 after. */
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

/** A kit clip at reel frame `f` (rate 1, clamped to its first / last frame). */
const ClipFrame = ({ clip, f }) => {
  const { frames, plane } = CLIP[clip]
  const k = Math.min(frames - 1, Math.max(0, f - OFFSET[clip]))
  return (
    <Freeze frame={k}>
      <OffthreadVideo
        src={staticFile(`clips/${clip}.mp4`)}
        muted
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
        style={{
          position: 'absolute',
          inset: 0,
          background: '#FFFFFF',
        }}
      />
      <Img
        src={HERO_SRC()}
        style={{
          position: 'absolute',
          left: SHEET_FRONT.x - art,
          top: SHEET_FRONT.y - art,
          width: SHEET_FRONT.w,
          height: SHEET_FRONT.h,
          objectFit: 'cover',
        }}
      />
    </PdfSheet>
  )
}

/** The phone body (§2, output geometry) drawn in the phone capture's CSS px, so the camera works in UI px. */
const PhonePlane = ({ f }) => (
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
    </Phone>
  </div>
)

const Context = ({ shot, f }) => {
  if (shot.context === 'hero') return <HeroPlane />
  if (shot.context === 'pdf') return <PdfPlane />
  if (shot.context === 'b-phone') return <PhonePlane f={f} />
  return <ClipFrame clip={shot.context} f={f} />
}

// ---------------------------------------------------------------- the hero overlays

/** B1 tail: the full-frame photo shrinks into filmstrip thumb 1 (B2's camera), minimum-jerk over 10 frames. */
function heroShrink(table, f) {
  const B1 = shotById(table, 'B1')
  const B2 = shotById(table, 'B2')
  if (f < B1.shrink.from || f >= B1.shrink.to) return null
  const t = minJerk((f - B1.shrink.from + 1) / (B1.shrink.to - B1.shrink.from))
  const cam = cameraAt(B1, f)
  const full = { x: cam.tx, y: cam.ty, w: HERO.w * cam.s, h: HERO.h * cam.s }
  const thumb = outBox(B2, f, CLIP['b-hero-drop'].thumb)
  // the kit thumb cover-fits the photo (thumb 1.30 < photo 1.5: the height fills)
  const pw = thumb.h * (HERO.w / HERO.h)
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

/** B3: the dropped hero springs (`light`) from the drag ghost (B2, at the drop) onto spread 1's frame. */
function landing(table, f) {
  const B2 = shotById(table, 'B2')
  const B3 = shotById(table, 'B3')
  const k = f - B3.land.from
  if (k < 0 || k >= LAND) return null
  const ghost = around(
    outBox(B2, B3.from - 1, {
      ...pointerAt('b-hero-drop', B3.from - 1),
      w: 0,
      h: 0,
    }),
    {
      w: CLIP['b-hero-drop'].thumb.w * cameraAt(B2, B3.from - 1).s,
      h: CLIP['b-hero-drop'].thumb.h * cameraAt(B2, B3.from - 1).s,
    },
  )
  const frame = outBox(B3, f, CLIP['b-hero-cover'].frame)
  const p = springAt(k, 'light')
  return { box: lerpBox(ghost, frame, p), scale: 1 + 0.06 * (1 - p) }
}

const PhotoIn = ({ clip, photo, radius = 0, scale = 1 }) => (
  <div
    style={{
      position: 'absolute',
      left: clip.x,
      top: clip.y,
      width: clip.w,
      height: clip.h,
      overflow: 'hidden',
      borderRadius: radius,
      transform: `scale(${scale})`,
    }}
  >
    <Img
      src={HERO_SRC()}
      style={
        photo
          ? {
              position: 'absolute',
              left: photo.x - clip.x,
              top: photo.y - clip.y,
              width: photo.w,
              height: photo.h,
            }
          : { width: '100%', height: '100%', objectFit: 'cover' }
      }
    />
  </div>
)

// ---------------------------------------------------------------- focus: where the hero is (output px)

/** Ghost of a drag: thumb-sized box on the pointer, or `fallback` while it is still outside the picture. */
function ghostBox(shot, f, clip, fallback) {
  const s = cameraAt(shot, f).s
  const p = outBox(shot, f, { ...pointerAt(clip, f), w: 0, h: 0 })
  const g = around(p, {
    w: CLIP[clip].thumb.w * s,
    h: CLIP[clip].thumb.h * s,
  })
  const inside = p.x > 0 && p.x < 1080 && p.y > 0 && p.y < 1920
  return inside ? g : fallback
}

export function heroBox(table, shot, f) {
  const clip = shot.ui?.clip
  switch (shot.id) {
    case 'B1':
      return heroShrink(table, f)?.clip ?? null
    case 'B2':
      return f < downFrames('b-hero-drop')[0]
        ? outBox(shot, f, CLIP[clip].thumb)
        : ghostBox(shot, f, clip, outBox(shot, f, CLIP[clip].frame))
    case 'B3':
    case 'B4': {
      const c = CLIP['b-hero-cover']
      const down = downFrames('b-hero-cover')[0]
      const up = POINTER['b-hero-cover'].events[1].f + OFFSET['b-hero-cover']
      if (shot.id === 'B3' && f - shot.from < LAND) return landing(table, f).box
      if (f < down) return outBox(shot, f, c.frame)
      if (f < up) return ghostBox(shot, f, clip, outBox(shot, f, c.frame))
      return outBox(shot, f, c.coverFront)
    }
    case 'B5':
      return outBox(shot, f, CLIP[clip].coverFront)
    case 'B6':
      return outBox(shot, f, SHEET_FRONT_MARKS)
    case 'B7': {
      const s = CLIP['b-site']
      const k = f - OFFSET['b-site']
      const down = downFrames('b-site')[0] - OFFSET['b-site']
      if (k >= down + 2) return outBox(shot, f, s.room)
      const [a, z] = s.liftFrames
      const t = Math.min(1, Math.max(0, (k - a) / (z - a)))
      return outBox(shot, f, lerpBox(s.face, s.lifted, t))
    }
    case 'B8':
    case 'B9':
      return outBox(shot, f, CLIP['b-phone'].paper)
    default:
      return null
  }
}

/** Focus B with the rack: outside the hero .35 brightness + 8 px blur (+ the rack blur); the hero box stays sharp. */
const RackFocus = ({ box, extra, render }) => {
  const { brightness, blur } = reelConfig(R).focus
  if (!box)
    return (
      <AbsoluteFill style={extra ? { filter: `blur(${extra}px)` } : undefined}>
        {render()}
      </AbsoluteFill>
    )
  const mask = focusMask(box)
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          filter: `brightness(${brightness}) blur(${blur + extra}px)`,
        }}
      >
        {render()}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          maskImage: mask,
          WebkitMaskImage: mask,
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
        }}
      >
        {render()}
      </AbsoluteFill>
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
  const p = outBox(shot, f, { ...pointerAt(clip, f), w: 0, h: 0 })
  return { x: p.x, y: p.y, scale: clickScaleAt(downFrames(clip), f) }
}

// ---------------------------------------------------------------- the reel

export const ReelB = ({ reel = R, table, audio = true, probe = true }) => {
  const f = useCurrentFrame()
  const { beatFrames } = reelConfig(reel)
  const shot = shotAt(table.shots, f)
  const end = table.shots.find((s) => s.scale === 'end')
  const B2 = shotById(table, 'B2')
  const shrink = heroShrink(table, f)
  // during the shrink the editor (B2's camera) is already under the photo
  const ctxShot = shrink ? B2 : shot
  const land = shot.land ? landing(table, f) : null
  const cursor = cursorAt(shot, f)
  // end card: the phone body (as it is when the end card starts) settles into y 250–940 on the heavy spring
  let move = null
  if (shot.scale === 'end') {
    const body = phoneBody()
    const plane = {
      x: (body.x - PHONE.screen.x) / K,
      y: (body.y - PHONE.screen.y) / K,
      w: body.w / K,
      h: body.h / K,
    }
    move = endMove(outBox(shot, end.from, plane), f, end.from)
  }
  const picture = (
    <RackFocus
      box={shrink ? shrink.clip : heroBox(table, shot, f)}
      extra={rackBlur(table, f)}
      render={() => (
        <Camera shot={ctxShot} plane={ctxShot.plane}>
          <Context shot={ctxShot} f={f} />
        </Camera>
      )}
    />
  )
  return (
    <AbsoluteFill>
      <Background reel={reel} />
      {move ? (
        <AbsoluteFill
          style={{
            transformOrigin: '0 0',
            transform: `translate(${move.x}px, ${move.y}px) scale(${move.s})`,
          }}
        >
          {picture}
        </AbsoluteFill>
      ) : (
        picture
      )}
      {shrink && (
        <PhotoIn
          clip={shrink.clip}
          photo={shrink.photo}
          radius={shrink.radius}
        />
      )}
      {land && <PhotoIn clip={land.box} scale={land.scale} />}
      {cursor && <Cursor at={cursor} />}
      <EndCard from={end.from} beatFrames={beatFrames} probe={probe} />
      <Grain reel={reel} />
      {audio && <Audio src={staticFile(`audio/${reel}.wav`)} />}
    </AbsoluteFill>
  )
}
